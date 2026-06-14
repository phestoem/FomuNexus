import { SessionStatus } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";
import { parseCapturedData } from "./target-schema";

type AnalyticsDataClient = {
  formBlueprint: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; label: true };
    }): Promise<{ id: string; label: string } | null>;
  };
  formSession: {
    findMany(args: {
      where: { blueprintId: string; status: SessionStatus };
      orderBy: { updatedAt: "desc" };
      select: { id: true; capturedData: true; updatedAt: true };
    }): Promise<
      Array<{
        id: string;
        capturedData: unknown;
        updatedAt: Date;
      }>
    >;
  };
};

export async function fetchBlueprintAnalyticsData(
  blueprintId: string,
  client: AnalyticsDataClient = prisma,
) {
  const blueprint = await client.formBlueprint.findUnique({
    where: { id: blueprintId },
    select: {
      id: true,
      label: true,
    },
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
  };
}
