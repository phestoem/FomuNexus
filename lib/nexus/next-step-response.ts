import { buildBlueprintContext } from "@/lib/nexus/blueprint-context";
import {
  nexusNextStepResponseSchema,
  type ActionExecuted,
  type NexusNextStepResponse,
} from "@/lib/nexus/schemas";
import {
  parseCapturedData,
  stripSessionMeta,
} from "@/lib/nexus/target-schema";

export type CompletedResponseBlueprint = {
  id?: string;
  label: string;
  targetSchema: unknown;
  toneProfile: unknown;
};

export function createCompletedResponse(
  extractedData: Record<string, unknown> = {},
  actionsExecuted: ActionExecuted[] = [],
  capturedData?: Record<string, unknown>,
  blueprint?: CompletedResponseBlueprint,
  options?: { validationError?: string },
): NexusNextStepResponse {
  const parsedCapturedData = capturedData
    ? stripSessionMeta(parseCapturedData(capturedData))
    : undefined;

  return nexusNextStepResponseSchema.parse({
    extractedData,
    isCompleted: true,
    actionsExecuted,
    capturedData: parsedCapturedData,
    blueprintContext: blueprint
      ? buildBlueprintContext({
          label: blueprint.label,
          targetSchema: blueprint.targetSchema,
          toneProfile: blueprint.toneProfile,
          capturedData: parsedCapturedData,
        })
      : undefined,
    validationError: options?.validationError,
  });
}
