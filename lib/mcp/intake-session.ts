import { SessionStatus } from "@/app/generated/prisma/client";
import { buildFormUrl } from "@/lib/nexus/app-url";
import { parseCapturedData } from "@/lib/nexus/target-schema";
import { prisma } from "@/lib/prisma";

export type IntakeSessionSnapshot = {
  sessionId: string;
  blueprintId: string;
  url: string;
  status: SessionStatus;
  awaiting_input: boolean;
  capturedData?: Record<string, unknown>;
};

export async function getIntakeSessionSnapshot(
  sessionId: string,
  origin: string,
): Promise<IntakeSessionSnapshot | null> {
  const session = await prisma.formSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      blueprintId: true,
      status: true,
      capturedData: true,
    },
  });

  if (!session) {
    return null;
  }

  const awaiting_input = session.status !== SessionStatus.COMPLETED;
  const snapshot: IntakeSessionSnapshot = {
    sessionId: session.id,
    blueprintId: session.blueprintId,
    url: buildFormUrl(session.id, origin),
    status: session.status,
    awaiting_input,
  };

  if (session.status === SessionStatus.COMPLETED) {
    snapshot.capturedData = parseCapturedData(session.capturedData);
  }

  return snapshot;
}

export function formatIntakeSnapshotJson(snapshot: IntakeSessionSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
