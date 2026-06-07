import { SessionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  attachSessionMeta,
  buildEffectiveTargetSchema,
  mergeCapturedData,
  parseCapturedData,
  parseSessionMeta,
  stripInvalidRequiredFieldValues,
  type JsonValue,
  type SessionMeta,
  type TargetSchema,
} from "@/lib/nexus/target-schema";

export function mergeSessionMeta(
  currentMeta: SessionMeta,
  nextMeta: SessionMeta,
): SessionMeta {
  const fieldsByKey = new Map(
    currentMeta.injectedFields.map((field) => [field.key, field]),
  );

  for (const field of nextMeta.injectedFields) {
    fieldsByKey.set(field.key, field);
  }

  return {
    injectedFields: [...fieldsByKey.values()].sort(
      (left, right) => left.priority - right.priority,
    ),
  };
}

export async function persistSessionProgress(params: {
  sessionId: string;
  blueprintSchema: TargetSchema;
  sessionMeta: SessionMeta;
  extractedData?: Record<string, unknown>;
  skipIfCompleted?: boolean;
}): Promise<{
  capturedData: Record<string, JsonValue>;
  sessionMeta: SessionMeta;
  targetSchema: TargetSchema;
  previousStatus: SessionStatus;
}> {
  const latestSession = await prisma.formSession.findUnique({
    where: { id: params.sessionId },
    select: {
      capturedData: true,
      status: true,
    },
  });

  if (!latestSession) {
    throw new Error(`Session "${params.sessionId}" was not found.`);
  }

  const latestCapturedData = parseCapturedData(latestSession.capturedData);
  const latestSessionMeta = parseSessionMeta(latestCapturedData);

  if (
    params.skipIfCompleted &&
    latestSession.status === SessionStatus.COMPLETED
  ) {
    return {
      capturedData: latestCapturedData,
      sessionMeta: latestSessionMeta,
      targetSchema: buildEffectiveTargetSchema(
        params.blueprintSchema,
        latestSessionMeta,
      ),
      previousStatus: latestSession.status,
    };
  }

  const sessionMeta = mergeSessionMeta(latestSessionMeta, params.sessionMeta);
  const targetSchema = buildEffectiveTargetSchema(
    params.blueprintSchema,
    sessionMeta,
  );

  const capturedData = attachSessionMeta(
    stripInvalidRequiredFieldValues(
      targetSchema,
      mergeCapturedData(
        latestCapturedData,
        params.extractedData ?? {},
        targetSchema,
      ),
    ),
    sessionMeta,
  );

  await prisma.formSession.update({
    where: { id: params.sessionId },
    data: { capturedData },
  });

  return {
    capturedData,
    sessionMeta,
    targetSchema,
    previousStatus: latestSession.status,
  };
}
