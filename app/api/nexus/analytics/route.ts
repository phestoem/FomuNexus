import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { analyticsRequestSchema } from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import { parseCapturedData } from "@/lib/nexus/target-schema";
import { SessionStatus } from "@/app/generated/prisma/client";

const OPENAI_MODEL = "gpt-4o-mini";

async function resolveBlueprintId(id: string): Promise<{
  blueprintId: string;
  resolvedFromSessionId: boolean;
} | null> {
  const blueprint = await prisma.formBlueprint.findUnique({
    where: { id },
    select: { id: true },
  });

  if (blueprint) {
    return {
      blueprintId: blueprint.id,
      resolvedFromSessionId: false,
    };
  }

  const session = await prisma.formSession.findUnique({
    where: { id },
    select: { blueprintId: true },
  });

  if (!session) {
    return null;
  }

  return {
    blueprintId: session.blueprintId,
    resolvedFromSessionId: true,
  };
}

async function fetchBlueprintAnalyticsData(idOrBlueprintId: string) {
  const resolved = await resolveBlueprintId(idOrBlueprintId);

  if (!resolved) {
    return null;
  }

  const blueprint = await prisma.formBlueprint.findUnique({
    where: { id: resolved.blueprintId },
  });

  if (!blueprint) {
    return null;
  }

  const sessions = await prisma.formSession.findMany({
    where: {
      blueprintId: resolved.blueprintId,
      status: SessionStatus.COMPLETED,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      capturedData: true,
      updatedAt: true,
    },
  });

  const submissions = sessions.map((session) => ({
    sessionId: session.id,
    completedAt: session.updatedAt.toISOString(),
    capturedData: parseCapturedData(session.capturedData),
  }));

  return {
    blueprint: {
      id: blueprint.id,
      label: blueprint.label,
    },
    submissions,
    submissionCount: submissions.length,
    resolvedFromSessionId: resolved.resolvedFromSessionId,
    inputId: idOrBlueprintId,
  };
}

export async function GET(request: Request) {
  try {
    const blueprintId = new URL(request.url).searchParams.get("blueprintId");

    if (!blueprintId) {
      return NextResponse.json(
        { error: "blueprintId query parameter is required." },
        { status: 400 },
      );
    }

    const data = await fetchBlueprintAnalyticsData(blueprintId);

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Blueprint not found. Analytics URLs use a blueprint ID, not a form session ID.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Analytics fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to load analytics data." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const parsedBody = analyticsRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const { blueprintId, query } = parsedBody.data;
    const data = await fetchBlueprintAnalyticsData(blueprintId);

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Blueprint not found. Analytics URLs use a blueprint ID, not a form session ID.",
        },
        { status: 404 },
      );
    }

    const capturedResponses = data.submissions.map(
      (submission) => submission.capturedData,
    );

    const { text } = await generateText({
      model: openai(OPENAI_MODEL),
      prompt: [
        "You are the Fomu Nexus Insights Executive.",
        "You are analyzing an array of raw JSON responses collected from a dynamic form.",
        "Read the admin's query and perform a deep analysis on the provided data.",
        "Return a highly professional, markdown-formatted response summarizing the trends, statistical anomalies, or direct answers to their question based strictly on the captured data.",
        "Do not invent data that is not present in the submissions.",
        "If there are no completed submissions, state that clearly and recommend next steps.",
        "Use headings, bullet points, and bold text where helpful.",
        "",
        `Form label: ${data.blueprint.label}`,
        `Completed submissions: ${data.submissionCount}`,
        "",
        `Admin query:\n${query}`,
        "",
        `Captured response array:\n${JSON.stringify(capturedResponses, null, 2)}`,
      ].join("\n"),
    });

    return NextResponse.json({
      analysis: text,
      blueprint: data.blueprint,
      submissionCount: data.submissionCount,
    });
  } catch (error) {
    console.error("Analytics analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze form responses." },
      { status: 500 },
    );
  }
}
