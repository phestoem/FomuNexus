import { z } from "zod";
import {
  generatedBlueprintFieldSchema,
  targetSchemaDefinitionSchema,
  toneProfileSchema,
  type GeneratedBlueprintField,
} from "@/lib/nexus/schemas";

export function buildTargetSchemaFromFields(
  fields: GeneratedBlueprintField[],
): z.infer<typeof targetSchemaDefinitionSchema> {
  const properties: Record<
    string,
    z.infer<typeof targetSchemaDefinitionSchema>["properties"][string]
  > = {};

  for (const field of fields) {
    const property = {
      type: field.type,
      description: field.description,
      ...(field.enumOptions && field.enumOptions.length > 0
        ? { enum: field.enumOptions }
        : {}),
    };

    properties[field.key] = property;
  }

  return targetSchemaDefinitionSchema.parse({
    type: "object",
    required: fields.map((field) => field.key),
    properties,
  });
}

export function validateGeneratedBlueprint(fields: GeneratedBlueprintField[]) {
  const keys = new Set<string>();

  for (const field of fields) {
    if (!/^[a-z][a-z0-9_]*$/.test(field.key)) {
      throw new Error(
        `Field key "${field.key}" must use snake_case and start with a letter.`,
      );
    }

    if (keys.has(field.key)) {
      throw new Error(`Duplicate field key "${field.key}" is not allowed.`);
    }

    keys.add(field.key);

    if (field.type !== "string" && field.enumOptions?.length) {
      throw new Error("Only string fields may define enum options.");
    }
  }
}
