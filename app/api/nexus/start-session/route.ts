import { NextResponse } from "next/server";
import { META_BLUEPRINT_LABEL, matchesMetaTargetSchema } from "@/lib/nexus/meta-blueprint-shared";
import { startSessionRequestSchema } from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/app/generated/prisma/client";

function buildFormUrl(sessionId: string, request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.origin}/form/${sessionId}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = startSessionRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const blueprint = await prisma.formBlueprint.findUnique({
      where: { id: parsedBody.data.blueprintId },
      select: {
        id: true,
        label: true,
        archivedAt: true,
        targetSchema: true,
      },
    });

    if (
      !blueprint ||
      (blueprint.label === META_BLUEPRINT_LABEL &&
        matchesMetaTargetSchema(blueprint.targetSchema)) ||
      blueprint.archivedAt
    ) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const session = await prisma.formSession.create({
      data: {
        blueprintId: blueprint.id,
        capturedData: {},
        status: SessionStatus.ACTIVE,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      blueprintId: blueprint.id,
      label: blueprint.label,
      url: buildFormUrl(session.id, request),
    });
  } catch (error) {
    console.error("Start session failed:", error);
    return NextResponse.json(
      { error: "Failed to create a new intake session." },
      { status: 500 },
    );
  }
}
