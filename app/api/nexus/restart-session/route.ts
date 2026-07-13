import { NextResponse } from "next/server";
import { restartSessionRequestSchema } from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/app/generated/prisma/client";
import { isMetaBlueprint } from "@/lib/nexus/meta-blueprint-shared";

function buildFormUrl(sessionId: string, request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.origin}/form/${sessionId}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = restartSessionRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const existingSession = await prisma.formSession.findUnique({
      where: { id: parsedBody.data.sessionId },
      select: {
        blueprintId: true,
        blueprint: {
          select: {
            label: true,
            archivedAt: true,
          },
        },
      },
    });

    if (
      !existingSession ||
      isMetaBlueprint(existingSession.blueprint) ||
      existingSession.blueprint.archivedAt
    ) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const newSession = await prisma.formSession.create({
      data: {
        blueprintId: existingSession.blueprintId,
        capturedData: {},
        status: SessionStatus.ACTIVE,
      },
    });

    return NextResponse.json({
      sessionId: newSession.id,
      url: buildFormUrl(newSession.id, request),
    });
  } catch (error) {
    console.error("Restart session failed:", error);
    return NextResponse.json(
      { error: "Failed to create a new intake session." },
      { status: 500 },
    );
  }
}
