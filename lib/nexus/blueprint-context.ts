import {
  CREATOR_WORKING_TITLE_KEY,
  INITIAL_ROUGH_IDEA_KEY,
  isMetaBlueprint,
  META_TONE_PROFILE,
} from "@/lib/nexus/meta-blueprint-shared";
import { toneProfileSchema, type BlueprintContext } from "@/lib/nexus/schemas";
import {
  getSchemaFieldDefinitions,
  parseTargetSchema,
} from "@/lib/nexus/target-schema";

export function buildBlueprintContext(params: {
  label: string;
  targetSchema: unknown;
  toneProfile: unknown;
  capturedData?: Record<string, unknown>;
}): BlueprintContext {
  const capturedData = params.capturedData ?? {};

  if (isMetaBlueprint({ label: params.label })) {
    const workingTitle = capturedData[CREATOR_WORKING_TITLE_KEY];
    const roughIdea = capturedData[INITIAL_ROUGH_IDEA_KEY];

    return {
      label:
        typeof workingTitle === "string" && workingTitle.trim().length > 0
          ? workingTitle.trim()
          : "Creator Co-Pilot",
      description:
        typeof roughIdea === "string" && roughIdea.trim().length > 0
          ? roughIdea.trim()
          : META_TONE_PROFILE.style,
    };
  }

  const schema = parseTargetSchema(params.targetSchema);
  const toneResult = toneProfileSchema.safeParse(params.toneProfile);
  const toneStyle = toneResult.success ? toneResult.data.style : "";

  const fieldDescriptions = getSchemaFieldDefinitions(schema)
    .map((field) => field.property.description)
    .filter(
      (description): description is string =>
        typeof description === "string" &&
        description.trim().length > 0 &&
        !description.trim().endsWith("?"),
    )
    .slice(0, 3);

  if (fieldDescriptions.length > 0) {
    return {
      label: params.label,
      description: fieldDescriptions.join(" · "),
    };
  }

  return {
    label: params.label,
    description: toneStyle || `Complete this ${params.label} intake.`,
  };
}
