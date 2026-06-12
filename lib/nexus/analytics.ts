import { SessionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCapturedData } from "@/lib/nexus/target-schema";

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
      where: {
        id: string;
      };
    }): Promise<AnalyticsBlueprintRecord | null>;
  };
  formSession: {
    findMany(args: {
      where: {
        blueprintId: string;
        status: SessionStatus;
      };
      orderBy: {
        updatedAt: "desc";
      };
      select: {
        id: true;
        capturedData: true;
        updatedAt: true;
      };
    }): Promise<AnalyticsSessionRecord[]>;
  };
};

export async function fetchBlueprintAnalyticsData(
  blueprintId: string,
  dataClient: AnalyticsDataClient = prisma as unknown as AnalyticsDataClient,
) {
  const blueprint = await dataClient.formBlueprint.findUnique({
    where: { id: blueprintId },
  });

  if (!blueprint) {
    return null;
  }

  const sessions = await dataClient.formSession.findMany({
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
