import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  buildTargetSchemaFromFields,
  validateGeneratedBlueprint,
} from "@/lib/nexus/blueprint-builder";
import { assertAssignableBlueprintLabel } from "@/lib/nexus/meta-blueprint-shared";
import {
  generatedBlueprintSchema,
  targetSchemaDefinitionSchema,
  toneProfileSchema,
} from "@/lib/nexus/schemas";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/app/generated/prisma/client";

const OPENAI_MODEL = "gpt-4o-mini";

export type CreateBlueprintFromPromptInput = {
  title: string;
  prompt: string;
};

export type CreateBlueprintFromPromptResult = {
  blueprint: {
    id: string;
    label: string;
    targetSchema: unknown;
    toneProfile: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    blueprintId: string;
    status: SessionStatus;
    capturedData: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export async function createBlueprintFromPrompt(
  input: CreateBlueprintFromPromptInput,
): Promise<CreateBlueprintFromPromptResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const title = assertAssignableBlueprintLabel(input.title);
  const prompt = input.prompt;

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: generatedBlueprintSchema,
    prompt: [
      "You design domain-agnostic intake form blueprints from plain-English creator prompts.",
      "Never hardcode industry-specific product names unless the creator explicitly asks for them.",
      "Use neutral field keys in snake_case (for example: full_name, reason_for_leaving, tenure_months).",
      "Every field must include a clear description for downstream AI extraction and questioning.",
      "Use enumOptions only for string fields with a closed set of choices; otherwise set enumOptions to null.",
      "Choose a toneProfile.primary label and toneProfile.style instructions that match the creator's goal.",
      "Return at least one field and ensure every field key appears in the required list implicitly via the fields array.",
      "",
      `Form title:\n${title}`,
      "",
      `Creator prompt:\n${prompt}`,
    ].join("\n"),
  });

  validateGeneratedBlueprint(object.fields);

  const toneProfile = toneProfileSchema.parse(object.toneProfile);
  const targetSchema = buildTargetSchemaFromFields(object.fields);
  targetSchemaDefinitionSchema.parse(targetSchema);

  const blueprint = await prisma.formBlueprint.create({
    data: {
      label: title,
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

  return { blueprint, session };
}
