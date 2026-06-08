import { SessionStatus } from "@/app/generated/prisma/client";
import { parseCapturedData } from "@/lib/nexus/target-schema";
import { prisma } from "@/lib/prisma";

type AnalyticsBlueprintRecord = {
  id: string;
  label: string;
};

type AnalyticsSessionRecord = {
  id: string;
  capturedData: unknown;
  updatedAt: Date;
};

export type AnalyticsDataClient = {
  formBlueprint: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; label: true };
    }): Promise<AnalyticsBlueprintRecord | null>;
  };
  formSession: {
    findMany(args: {
      where: { blueprintId: string; status: SessionStatus };
      orderBy: { updatedAt: "desc" };
      select: { id: true; capturedData: true; updatedAt: true };
    }): Promise<AnalyticsSessionRecord[]>;
  };
};

export async function fetchBlueprintAnalyticsData(
  blueprintId: string,
  client: AnalyticsDataClient = prisma,
) {
  const blueprint = await client.formBlueprint.findUnique({
    where: { id: blueprintId },
    select: { id: true, label: true },
  });

  if (!blueprint) {
    return null;
  }

  const sessions = await client.formSession.findMany({
    where: {
      blueprintId: blueprint.id,
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
    inputId: blueprintId,
  };
}
