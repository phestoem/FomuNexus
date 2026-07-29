import { stripSessionMeta, type JsonValue, type TargetSchema } from "@/lib/nexus/target-schema";

export const META_BLUEPRINT_LABEL = "__internal_creator_copilot__";
export const CREATOR_WORKING_TITLE_KEY = "_creator_working_title";
export const INITIAL_ROUGH_IDEA_KEY = "initial_rough_idea";

export const META_DATA_STRICTNESS_OPTIONS = [
  "Strict and quantitative",
  "Deeply qualitative and conversational",
  "Balanced",
] as const;

export const META_TARGET_SCHEMA: TargetSchema = {
  type: "object",
  required: [
    "primary_goal",
    "target_audience",
    "data_strictness",
    "anonymity_required",
    "ai_curated_suggestions",
  ],
  properties: {
    primary_goal: {
      type: "string",
      description:
        "The creator's primary goal for this form (e.g., Analyze workspace satisfaction after moving to the new office).",
      "x-priority": 0,
    },
    target_audience: {
      type: "string",
      description:
        "Who will fill out this form (e.g., Internal employees, all departments).",
      "x-priority": 1,
    },
    data_strictness: {
      type: "string",
      enum: [...META_DATA_STRICTNESS_OPTIONS],
      description:
        "How structured versus conversational the intake experience should feel.",
      "x-priority": 2,
    },
    anonymity_required: {
      type: "boolean",
      description:
        "Whether responses must be collected anonymously without identifying details.",
      "x-priority": 3,
    },
    ai_curated_suggestions: {
      type: "string",
      description:
        "A brief two-sentence structural suggestion from the co-pilot, followed by space for the creator's feedback on that suggestion.",
      "x-priority": 4,
    },
  },
};

export const META_TONE_PROFILE = {
  primary: "Creator Co-Pilot",
  style:
    "Collaborative, expert, and concise. Help the creator refine fuzzy goals into a sharp intake strategy. Acknowledge their rough ideas, ask clarifying follow-ups, and offer brief structural suggestions when helpful. Never feel like a static form — feel like a thoughtful partner.",
};

export function isMetaBlueprint(blueprint: Pick<{ label: string }, "label">): boolean {
  return blueprint.label === META_BLUEPRINT_LABEL;
}

export function stripInternalCapturedKeys(
  capturedData: Record<string, JsonValue>,
) {
  const stripped = stripSessionMeta(capturedData);
  delete stripped[CREATOR_WORKING_TITLE_KEY];
  delete stripped[INITIAL_ROUGH_IDEA_KEY];
  return stripped;
}

/**
 * Captured-data snapshot for next-question AI prompts.
 * Creator co-pilot interviews must retain working title / rough idea context;
 * ordinary respondent prompts should hide those internal keys.
 */
export function buildQuestionPromptCapturedData(
  capturedData: Record<string, JsonValue>,
  options: { includeCreatorContext: boolean },
): Record<string, JsonValue> {
  if (options.includeCreatorContext) {
    return stripSessionMeta(capturedData);
  }

  return stripInternalCapturedKeys(capturedData);
}
