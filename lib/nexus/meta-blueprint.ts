import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  buildTargetSchemaFromFields,
  validateGeneratedBlueprint,
} from "@/lib/nexus/blueprint-builder";
import {
  buildConflictingBlueprintLabel,
  CREATOR_WORKING_TITLE_KEY,
  INITIAL_ROUGH_IDEA_KEY,
  matchesMetaTargetSchema,
  META_BLUEPRINT_LABEL,
  META_TARGET_SCHEMA,
  META_TONE_PROFILE,
  resolveAssignableBlueprintLabel,
  stripInternalCapturedKeys,
} from "@/lib/nexus/meta-blueprint-shared";
import {
  generatedBlueprintSchema,
  targetSchemaDefinitionSchema,
  toneProfileSchema,
  type CompiledBlueprintResult,
} from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import {
  isAgentSkippedFieldValue,
  parseCapturedData,
} from "@/lib/nexus/target-schema";
import { SessionStatus } from "@/app/generated/prisma/client";

const OPENAI_MODEL = "gpt-4o-mini";

export {
  assertAssignableBlueprintLabel,
  buildConflictingBlueprintLabel,
  CREATOR_WORKING_TITLE_KEY,
  INITIAL_ROUGH_IDEA_KEY,
  isMetaBlueprint,
  isReservedBlueprintLabel,
  matchesMetaTargetSchema,
  META_BLUEPRINT_LABEL,
  META_TARGET_SCHEMA,
  META_TONE_PROFILE,
  resolveAssignableBlueprintLabel,
  stripInternalCapturedKeys,
} from "@/lib/nexus/meta-blueprint-shared";

export async function reconcileReservedBlueprintLabelCollisions() {
  const candidates = await prisma.formBlueprint.findMany({
    where: { label: META_BLUEPRINT_LABEL },
    orderBy: { createdAt: "asc" },
  });

  const metaMatches: typeof candidates = [];
  const impostors: typeof candidates = [];

  for (const blueprint of candidates) {
    if (matchesMetaTargetSchema(blueprint.targetSchema)) {
      metaMatches.push(blueprint);
    } else {
      impostors.push(blueprint);
    }
  }

  for (const impostor of impostors) {
    await prisma.formBlueprint.update({
      where: { id: impostor.id },
      data: {
        label: buildConflictingBlueprintLabel(impostor.label, impostor.id),
      },
    });
  }

  return metaMatches;
}

export async function ensureMetaBlueprint() {
  const metaMatches = await reconcileReservedBlueprintLabelCollisions();

  if (metaMatches.length > 0) {
    return metaMatches[0];
  }

  return prisma.formBlueprint.create({
    data: {
      label: META_BLUEPRINT_LABEL,
      targetSchema: META_TARGET_SCHEMA as object,
      toneProfile: META_TONE_PROFILE,
    },
  });
}

function formatCapturedValue(value: unknown): string {
  if (isAgentSkippedFieldValue(value)) {
    return value.reason;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function buildCreatorBrief(
  capturedData: Record<string, unknown>,
): Record<string, string> {
  const data = stripInternalCapturedKeys(parseCapturedData(capturedData));
  const brief: Record<string, string> = {};

  const workingTitle =
    typeof capturedData[CREATOR_WORKING_TITLE_KEY] === "string"
      ? capturedData[CREATOR_WORKING_TITLE_KEY]
      : typeof data[CREATOR_WORKING_TITLE_KEY] === "string"
        ? data[CREATOR_WORKING_TITLE_KEY]
        : "";

  if (workingTitle.trim()) {
    brief.working_title = workingTitle.trim();
  }

  const roughIdea =
    typeof capturedData[INITIAL_ROUGH_IDEA_KEY] === "string"
      ? capturedData[INITIAL_ROUGH_IDEA_KEY]
      : typeof data[INITIAL_ROUGH_IDEA_KEY] === "string"
        ? data[INITIAL_ROUGH_IDEA_KEY]
        : "";

  if (roughIdea.trim()) {
    brief.initial_rough_idea = roughIdea.trim();
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === INITIAL_ROUGH_IDEA_KEY) {
      continue;
    }

    const formatted = formatCapturedValue(value).trim();
    if (formatted.length > 0) {
      brief[key] = formatted;
    }
  }

  return brief;
}

function buildCompiledBlueprintLabel(brief: Record<string, string>): string {
  if (brief.working_title) {
    return resolveAssignableBlueprintLabel(brief.working_title);
  }

  if (brief.primary_goal) {
    const primaryGoalLabel =
      brief.primary_goal.length > 80
        ? `${brief.primary_goal.slice(0, 77)}...`
        : brief.primary_goal;
    return resolveAssignableBlueprintLabel(primaryGoalLabel);
  }

  return "Untitled Intake Form";
}

export async function compileCreatorBlueprint(params: {
  capturedData: Record<string, unknown>;
  origin: string;
}): Promise<CompiledBlueprintResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const brief = buildCreatorBrief(params.capturedData);

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: generatedBlueprintSchema,
    prompt: [
      "You compile a production-ready, domain-agnostic intake form blueprint from a creator co-pilot interview.",
      "The creator has already refined their goals through a guided conversation.",
      "Translate the interview brief into a pristine targetSchema field list and toneProfile.",
      "",
      "Rules:",
      "- Use neutral snake_case field keys.",
      "- Match data_strictness: quantitative briefs favor number/select fields; qualitative briefs favor open text; balanced uses a mix.",
      "- If anonymity_required is true, avoid fields that collect direct identifiers unless essential.",
      "- Honor ai_curated_suggestions feedback when choosing field structure and ordering.",
      "- Every field must include a clear description for downstream AI extraction.",
      "- Use enumOptions only for string fields with closed choices; otherwise set enumOptions to null.",
      "- Return at least three fields unless the goal is extremely narrow.",
      "",
      `Creator interview brief:\n${JSON.stringify(brief, null, 2)}`,
    ].join("\n"),
  });

  validateGeneratedBlueprint(object.fields);

  const toneProfile = toneProfileSchema.parse(object.toneProfile);
  const targetSchema = buildTargetSchemaFromFields(object.fields);
  targetSchemaDefinitionSchema.parse(targetSchema);

  const label = buildCompiledBlueprintLabel(brief);

  const blueprint = await prisma.formBlueprint.create({
    data: {
      label,
      toneProfile,
      targetSchema,
    },
  });

  const session = await prisma.formSession.create({
    data: {
      blueprintId: blueprint.id,
      capturedData: {},
      status: SessionStatus.ACTIVE,
    },
  });

  const origin = params.origin.replace(/\/$/, "");

  return {
    blueprintId: blueprint.id,
    sessionId: session.id,
    label: blueprint.label,
    formUrl: `${origin}/form/${session.id}`,
    analyticsUrl: `${origin}/admin/blueprints/${blueprint.id}/analytics`,
  };
}
