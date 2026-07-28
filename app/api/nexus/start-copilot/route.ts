import { NextResponse } from "next/server";
import {
  assertAssignableBlueprintLabel,
  CREATOR_WORKING_TITLE_KEY,
  ensureMetaBlueprint,
  INITIAL_ROUGH_IDEA_KEY,
} from "@/lib/nexus/meta-blueprint";
import { startCopilotRequestSchema } from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/app/generated/prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = startCopilotRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const title = assertAssignableBlueprintLabel(parsedBody.data.title);
    const roughIdea = parsedBody.data.roughIdea.trim();
    const metaBlueprint = await ensureMetaBlueprint();

    const session = await prisma.formSession.create({
      data: {
        blueprintId: metaBlueprint.id,
        status: SessionStatus.ACTIVE,
        capturedData: {
          [CREATOR_WORKING_TITLE_KEY]: title,
          [INITIAL_ROUGH_IDEA_KEY]: roughIdea,
        },
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      blueprintId: metaBlueprint.id,
    });
  } catch (error) {
    console.error("Start co-pilot failed:", error);
    return NextResponse.json(
      { error: "Failed to start the creator co-pilot session." },
      { status: 500 },
    );
  }
}
