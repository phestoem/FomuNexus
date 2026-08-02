import { z } from "zod";

export const requestHumanIntakeInputShape = {
  formTitle: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Human-readable title for the intake form. Required when creating a new intake; omit when polling with sessionId.",
    ),
  roughIntakeGoal: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Plain-language description of what the human should provide. Required when creating a new intake; omit when polling with sessionId.",
    ),
  sessionId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Existing intake session to poll. Omit on first call; pass the returned sessionId to resolve captured data when the human finishes.",
    ),
};

export const requestHumanIntakeInputSchema = z.object(requestHumanIntakeInputShape);

export type RequestHumanIntakeInput = z.infer<typeof requestHumanIntakeInputSchema>;

export type ParsedRequestHumanIntakeInput =
  | { mode: "poll"; sessionId: string }
  | { mode: "create"; formTitle: string; roughIntakeGoal: string }
  | { mode: "invalid"; error: string };

export function parseRequestHumanIntakeInput(
  input: RequestHumanIntakeInput,
): ParsedRequestHumanIntakeInput {
  const sessionId = input.sessionId?.trim();
  if (sessionId) {
    return { mode: "poll", sessionId };
  }

  const formTitle = input.formTitle?.trim();
  const roughIntakeGoal = input.roughIntakeGoal?.trim();

  if (!formTitle || !roughIntakeGoal) {
    return {
      mode: "invalid",
      error:
        "Provide formTitle and roughIntakeGoal to create an intake, or sessionId to poll an existing session.",
    };
  }

  return { mode: "create", formTitle, roughIntakeGoal };
}
