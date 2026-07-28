import {
  parseTargetSchema,
  stripSessionMeta,
  type JsonValue,
  type TargetSchema,
} from "@/lib/nexus/target-schema";

export const META_BLUEPRINT_LABEL = "__internal_creator_copilot__";
export const CREATOR_WORKING_TITLE_KEY = "_creator_working_title";
export const INITIAL_ROUGH_IDEA_KEY = "initial_rough_idea";
export const RESERVED_BLUEPRINT_LABEL_ERROR =
  "This form title is reserved by the system. Choose a different title.";

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

export function matchesMetaTargetSchema(targetSchema: unknown): boolean {
  const schema = parseTargetSchema(targetSchema);
  const requiredKeys = new Set(schema.required ?? []);
  const properties = schema.properties ?? {};
  const metaRequired = META_TARGET_SCHEMA.required ?? [];

  return metaRequired.every((key) => {
    return requiredKeys.has(key) && properties[key] != null;
  });
}

export function isReservedBlueprintLabel(label: string): boolean {
  return label.trim() === META_BLUEPRINT_LABEL;
}

export function assertAssignableBlueprintLabel(label: string): string {
  const trimmed = label.trim();

  if (trimmed.length === 0) {
    throw new Error("Form title is required.");
  }

  if (isReservedBlueprintLabel(trimmed)) {
    throw new Error(RESERVED_BLUEPRINT_LABEL_ERROR);
  }

  return trimmed;
}

export function resolveAssignableBlueprintLabel(
  label: string,
  fallback = "Untitled Intake Form",
): string {
  const trimmed = label.trim();

  if (trimmed.length === 0 || isReservedBlueprintLabel(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function buildConflictingBlueprintLabel(
  label: string,
  blueprintId: string,
): string {
  const suffix = blueprintId.slice(-6);
  const base = label.trim().length > 0 ? label.trim() : "Untitled Intake Form";
  const renamed = `${base} (recovered ${suffix})`;

  if (!isReservedBlueprintLabel(renamed)) {
    return renamed;
  }

  return `Recovered intake form (${suffix})`;
}

export function isMetaBlueprint(blueprint: {
  label: string;
  targetSchema?: unknown;
}): boolean {
  if (blueprint.label !== META_BLUEPRINT_LABEL) {
    return false;
  }

  if (blueprint.targetSchema === undefined) {
    return true;
  }

  return matchesMetaTargetSchema(blueprint.targetSchema);
}

export function stripInternalCapturedKeys(
  capturedData: Record<string, JsonValue>,
) {
  const stripped = stripSessionMeta(capturedData);
  delete stripped[CREATOR_WORKING_TITLE_KEY];
  delete stripped[INITIAL_ROUGH_IDEA_KEY];
  return stripped;
}
