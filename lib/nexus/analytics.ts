import { SessionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCapturedData } from "@/lib/nexus/target-schema";

export async function fetchBlueprintAnalyticsData(blueprintId: string) {
  const blueprint = await prisma.formBlueprint.findUnique({
    where: { id: blueprintId },
  });

  if (!blueprint) {
    return null;
  }

  const sessions = await prisma.formSession.findMany({
    where: {
      blueprintId,
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
  };
}
