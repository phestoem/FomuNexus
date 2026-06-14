import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCompletedSession } from "@/lib/nexus/action-router";
import { buildBlueprintContext } from "@/lib/nexus/blueprint-context";
import { buildMissingFieldHints } from "@/lib/nexus/intent-guidance";
import { stripInternalCapturedKeys, isMetaBlueprint } from "@/lib/nexus/meta-blueprint-shared";
import {
  extractionResultSchema,
  nexusNextStepRequestSchema,
  nexusNextStepResponseSchema,
  questionGenerationResultSchema,
  toneProfileSchema,
  type ActionExecuted,
  type NexusNextStepResponse,
} from "@/lib/nexus/schemas";
import {
  areAllRequiredFieldsSatisfied,
  attachSessionMeta,
  buildAgentSkippedFieldValue,
  buildEffectiveTargetSchema,
  buildFieldSummary,
  buildTargetSchemaSummary,
  getMissingFields,
  getRequiredFieldKeys,
  getSchemaFieldDefinitions,
  isAgentSkippedFieldValue,
  isPollutedFieldValue,
  isSkippedPlaceholderValue,
  mergeCapturedData,
  parseCapturedData,
  parseSessionMeta,
  parseTargetSchema,
  registerInjectedField,
  resolveComponentType,
  SKIPPED_FIELD_VALUE,
  stripInvalidRequiredFieldValues,
  stripSessionMeta,
  NEXUS_META_KEY,
  type SchemaFieldDefinition,
  type SessionMeta,
  type TargetSchema,
} from "@/lib/nexus/target-schema";
import { SessionStatus } from "@/app/generated/prisma/client";

const OPENAI_MODEL = "gpt-4o-mini";

type ExtractionOutcome = {
  extractedData: Record<string, unknown>;
  skippedFields: string[];
  agentSkippedFields: string[];
  validationError?: string;
};

function fieldsToRecord(
  fields: Array<{ key: string; value: string | number | boolean | null }>,
): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.key, field.value]));
}

function sanitizeExtractedData(
  extracted: Record<string, unknown>,
  missingFields: SchemaFieldDefinition[],
  skippedFields: string[] = [],
): Record<string, unknown> {
  const allowedKeys = new Set(missingFields.map((field) => field.key));
  const skippedKeySet = new Set(skippedFields);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(extracted)) {
    if (!allowedKeys.has(key) || key === NEXUS_META_KEY) {
      continue;
    }

    if (skippedKeySet.has(key)) {
      sanitized[key] =
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0)
          ? SKIPPED_FIELD_VALUE
          : value;
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      continue;
    }

    if (isPollutedFieldValue(value)) {
      continue;
    }

    sanitized[key] = value;
  }

  for (const key of skippedFields) {
    if (allowedKeys.has(key) && !(key in sanitized)) {
      sanitized[key] = SKIPPED_FIELD_VALUE;
    }
  }

  return sanitized;
}

function formatFieldLabel(fieldKey: string, field?: SchemaFieldDefinition): string {
  if (field?.property.description) {
    return field.property.description.replace(/\?$/, "").trim();
  }

  return fieldKey.replace(/_/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeUserFacingMessage(
  message: string,
  fields: SchemaFieldDefinition[],
): string {
  let sanitized = message;

  for (const field of [...fields].sort((left, right) => right.key.length - left.key.length)) {
    const label = formatFieldLabel(field.key, field);
    const keyPattern = escapeRegExp(field.key);

    sanitized = sanitized.replace(
      new RegExp(`(['"\`'])${keyPattern}\\1`, "gi"),
      `$1${label}$1`,
    );
    sanitized = sanitized.replace(new RegExp(`\\b${keyPattern}\\b`, "gi"), label);
  }

  return sanitized.replace(/\s{2,}/g, " ").trim();
}

function buildRequiredFieldValidationError(
  fieldKey: string,
  field?: SchemaFieldDefinition,
): string {
  const label = formatFieldLabel(fieldKey, field);
  return `This form requires ${label}. Please provide a valid answer before we can continue.`;
}

function enforceRequiredFieldIntegrity(
  outcome: ExtractionOutcome,
  targetSchema: TargetSchema,
  missingFields: SchemaFieldDefinition[],
): ExtractionOutcome {
  if (outcome.validationError) {
    return outcome;
  }

  const requiredKeys = getRequiredFieldKeys(targetSchema);
  const missingFieldMap = new Map(
    missingFields.map((field) => [field.key, field]),
  );

  const illegalSkips = outcome.skippedFields.filter((key) => requiredKeys.has(key));
  if (illegalSkips.length > 0) {
    const blockedKey = illegalSkips[0];
    return {
      extractedData: {},
      skippedFields: [],
      agentSkippedFields: [],
      validationError: buildRequiredFieldValidationError(
        blockedKey,
        missingFieldMap.get(blockedKey),
      ),
    };
  }

  const sanitizedExtractedData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(outcome.extractedData)) {
    if (isAgentSkippedFieldValue(value)) {
      sanitizedExtractedData[key] = value;
      continue;
    }

    if (
      requiredKeys.has(key) &&
      (value === null ||
        value === undefined ||
        (typeof value === "string" &&
          (value.trim().length === 0 ||
            isSkippedPlaceholderValue(value) ||
            isPollutedFieldValue(value))))
    ) {
      continue;
    }

    if (isPollutedFieldValue(value)) {
      continue;
    }

    sanitizedExtractedData[key] = value;
  }

  const allowedSkippedFields = outcome.skippedFields.filter(
    (key) => !requiredKeys.has(key),
  );

  return {
    extractedData: sanitizedExtractedData,
    skippedFields: allowedSkippedFields,
    agentSkippedFields: outcome.agentSkippedFields,
  };
}

function applyNotApplicableFields(
  notApplicableFields: Array<{ key: string; reason: string }> | undefined,
  missingFields: SchemaFieldDefinition[],
): {
  extractedData: Record<string, unknown>;
  agentSkippedFields: string[];
} {
  const allowedKeys = new Set(missingFields.map((field) => field.key));
  const extractedData: Record<string, unknown> = {};
  const agentSkippedFields: string[] = [];

  for (const entry of notApplicableFields ?? []) {
    if (!allowedKeys.has(entry.key)) {
      continue;
    }

    extractedData[entry.key] = buildAgentSkippedFieldValue(entry.reason);
    agentSkippedFields.push(entry.key);
  }

  return { extractedData, agentSkippedFields };
}

function processExtractionResult(
  object: {
    fields: Array<{ key: string; value: string | number | boolean | null }>;
    skippedFields: string[];
    notApplicableFields: Array<{ key: string; reason: string }>;
    validationError: string | null;
  },
  missingFields: SchemaFieldDefinition[],
  targetSchema: TargetSchema,
): ExtractionOutcome {
  const validationError = object.validationError?.trim() || undefined;

  if (validationError) {
    return {
      extractedData: {},
      skippedFields: [],
      agentSkippedFields: [],
      validationError: sanitizeUserFacingMessage(validationError, missingFields),
    };
  }

  const allowedKeys = new Set(missingFields.map((field) => field.key));
  const skippedFields = object.skippedFields.filter((key) => allowedKeys.has(key));

  const extractedData = sanitizeExtractedData(
    fieldsToRecord(object.fields),
    missingFields,
    skippedFields,
  );

  const notApplicableOutcome = applyNotApplicableFields(
    object.notApplicableFields,
    missingFields,
  );

  return enforceRequiredFieldIntegrity(
    {
      extractedData: {
        ...extractedData,
        ...notApplicableOutcome.extractedData,
      },
      skippedFields,
      agentSkippedFields: notApplicableOutcome.agentSkippedFields,
    },
    targetSchema,
    missingFields,
  );
}

function hasMeaningfulExtractionProgress(outcome: ExtractionOutcome): boolean {
  return (
    Object.keys(outcome.extractedData).length > 0 ||
    outcome.skippedFields.length > 0 ||
    outcome.agentSkippedFields.length > 0
  );
}

function buildEmptyExtractionMessage(toneProfile: unknown): string {
  const toneResult = toneProfileSchema.safeParse(toneProfile);
  const style = toneResult.success ? toneResult.data.style.toLowerCase() : "";

  if (
    style.includes("clinical") ||
    style.includes("professional") ||
    style.includes("strict") ||
    style.includes("direct")
  ) {
    return "I didn't quite catch that. Could you please provide the specific details for the requested fields?";
  }

  return "Hmm, I couldn't find those details in your response. Let's try again!";
}

function rejectEmptyExtraction(
  outcome: ExtractionOutcome,
  toneProfile: unknown,
): ExtractionOutcome {
  if (outcome.validationError || hasMeaningfulExtractionProgress(outcome)) {
    return outcome;
  }

  return {
    extractedData: {},
    skippedFields: [],
    agentSkippedFields: [],
    validationError: buildEmptyExtractionMessage(toneProfile),
  };
}

function buildFallbackQuestion(field: SchemaFieldDefinition): string {
  if (field.property.description) {
    return field.property.description.endsWith("?")
      ? field.property.description
      : `${field.property.description}?`;
  }

  return `Please provide ${field.key.replace(/_/g, " ")}.`;
}

function createCompletedResponse(
  extractedData: Record<string, unknown> = {},
  actionsExecuted: ActionExecuted[] = [],
  capturedData?: Record<string, unknown>,
  blueprint?: {
    id: string;
    label: string;
    targetSchema: unknown;
    toneProfile: unknown;
  },
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

async function buildCompletedResponse(
  sessionId: string,
  extractedData: Record<string, unknown>,
  capturedData: Record<string, unknown>,
  blueprint: {
    id: string;
    label: string;
    targetSchema: unknown;
    toneProfile: unknown;
  },
  request: Request,
): Promise<NexusNextStepResponse> {
  const origin = new URL(request.url).origin;
  const parsedCapturedData = stripInternalCapturedKeys(parseCapturedData(capturedData));
  const blueprintContext = buildBlueprintContext({
    label: blueprint.label,
    targetSchema: blueprint.targetSchema,
    toneProfile: blueprint.toneProfile,
    capturedData: parsedCapturedData,
  });

  try {
    const result = await processCompletedSession(sessionId, { origin });

    if (result.kind === "meta_compilation") {
      return nexusNextStepResponseSchema.parse({
        extractedData,
        isCompleted: true,
        capturedData: parsedCapturedData,
        blueprintId: blueprint.id,
        blueprintContext,
        compiledBlueprint: result.compiledBlueprint,
        actionsExecuted: [],
      });
    }

    return createCompletedResponse(
      extractedData,
      result.actionsExecuted,
      capturedData,
      blueprint,
    );
  } catch (dispatchError) {
    console.error("Autonomous action routing failed:", dispatchError);
    return createCompletedResponse(extractedData, [], capturedData, blueprint);
  }
}

async function extractDataFromUserInput(params: {
  userInput: string;
  targetSchema: TargetSchema;
  targetSchemaSummary: string;
  capturedData: Record<string, unknown>;
  missingFields: SchemaFieldDefinition[];
  toneProfile: unknown;
}): Promise<ExtractionOutcome> {
  const missingFieldKeys = params.missingFields.map((field) => field.key);
  const requiredFieldKeys = [...getRequiredFieldKeys(params.targetSchema)];
  const missingFieldSummary = params.missingFields
    .map((field) => buildFieldSummary(field))
    .join("\n\n");

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: extractionResultSchema,
    prompt: [
      "You extract structured field values from a user's free-form message.",
      "Analyze the user's input against the missing target schema fields.",
      "",
      "Extraction rules:",
      "- Analyze the entire user input holistically.",
      "- If the user provides information that satisfies multiple missing fields in the schema simultaneously, extract ALL of them at once.",
      "- Do not restrict yourself to just answering the current question.",
      "- Paragraph dumps, voice transcripts, and long-form answers may contain several field values—extract every supported value you can find.",
      "- Return entries only for currently missing schema fields.",
      "- Use the exact field keys provided below.",
      "- Ignore unrelated information and never invent values that are not supported by the user's message.",
      "",
      "DATA CLEANLINESS DIRECTIVE:",
      "- You must ONLY extract actual, literal values matching the requested schema primitive types (e.g., real names, real dates, real choices).",
      "- If the user input does not contain any relevant information for a field, do NOT write a sentence explaining why it is missing.",
      "- Simply OMIT that key from the `fields` array entirely.",
      "- Never output strings starting with 'Not applicable' or explanations of data absence inside value fields.",
      "- Never write meta-commentary such as 'The input does not mention...' or 'No relevant information was found' as field values.",
      "",
      "USER-FACING LANGUAGE RULE:",
      "- Any `validationError` message is shown directly to the person filling out the form.",
      "- NEVER mention internal field keys, snake_case identifiers, JSON paths, schema names, or database terminology.",
      "- Refer to missing information in plain, conversational language using the field descriptions — not technical key names.",
      "- Example (bad): \"The field 'general_feedback' is required.\"",
      "- Example (good): \"Could you share any additional feedback about the AGM before we continue?\"",
      "",
      "CRITICAL ENFORCEMENT RULE (user-initiated skips only):",
      "- Before processing a user skip request or adding a field to the `skippedFields` array, check if that field's key is listed in the `targetSchema.required` array.",
      "- If the user tries to skip a field that IS in the required list, you are strictly FORBIDDEN from honoring that skip or accepting a null value.",
      "- Instead of moving to the next question, you must generate a `validationError` explaining why this specific information is mandatory for this form, and politely re-ask the user for a valid response.",
      "- When `validationError` is set for a required-field refusal, return an empty `fields` array, an empty `skippedFields` array, an empty `notApplicableFields` array, and set `validationError` to your message.",
      "",
      "AUTONOMOUS RELEVANCE FILTER:",
      "Review the data stored in `capturedData`. Evaluate the remaining missing fields in the `targetSchema`.",
      "- If the context of the user's previous answers makes a remaining missing field completely irrelevant, logical nonsense, or tone-deaf to ask (e.g., asking an intensely frustrated user 'what they love most' about their job), you are explicitly authorized to mark that field as 'NOT_APPLICABLE'.",
      "- This is an agent-driven relevance decision based on intent and context — not a user skip request and not a hardcoded rule.",
      "- If a field is flagged as NOT_APPLICABLE, add it to `notApplicableFields` with the field `key` and a concise `reason` explaining why it is contextually irrelevant.",
      "- Do not ask the user to confirm agent relevance decisions. The backend will store these as `{ \"status\": \"skipped_by_agent\", \"reason\": \"...\" }` and advance the session naturally.",
      "- Agent relevance filtering may apply to any remaining missing field when genuinely warranted, even if the field appears in `targetSchema.required`.",
      "- Do not mark fields NOT_APPLICABLE unless the contextual mismatch is clear from `capturedData`. When in doubt, leave the field active.",
      "",
      "Skip / refusal handling (optional fields only, user-initiated):",
      "- If the user explicitly states they do not have the requested information, refuse to give it, or ask to skip it (e.g., 'I don't have an email', 'skip', 'no phone', 'I don't have one', 'N/A'), do NOT leave the field unfulfilled.",
      "- Only if the field is NOT in `targetSchema.required`, add that field key to the `skippedFields` array and set its value in `fields` to null or 'Not Provided'.",
      "- Treat an allowed skip as intentional: the form should advance past that optional field.",
      "",
      "Invalid input handling:",
      "- If the user provides a completely invalid response for the expected type (e.g., typing text when a number/date is expected, random gibberish, or an answer that clearly does not match the field), do NOT silently ignore it.",
      "- Do not add invalid values to `fields` or `skippedFields`.",
      "- Instead, populate `validationError` with a polite, contextual error message matching the form's tone profile (e.g., 'Hmm, that doesn't look like a valid phone number. Could you double-check it?').",
      "- When `validationError` is set, return an empty `fields` array, empty `skippedFields`, empty `notApplicableFields`, and set `validationError` to your message.",
      "",
      "Always return all four top-level keys: `fields`, `skippedFields`, `notApplicableFields`, and `validationError`. Use empty arrays when none apply and `null` for `validationError` when there is no validation issue.",
      "",
      `targetSchema.required:\n${JSON.stringify(requiredFieldKeys)}`,
      "",
      `Allowed field keys:\n${missingFieldKeys.join(", ")}`,
      "",
      `Tone profile:\n${JSON.stringify(params.toneProfile, null, 2)}`,
      "",
      `Target schema fields:\n${params.targetSchemaSummary}`,
      "",
      `Missing fields:\n${missingFieldSummary}`,
      "",
      `Captured data so far:\n${JSON.stringify(params.capturedData, null, 2)}`,
      "",
      `Latest user input:\n${params.userInput}`,
    ].join("\n"),
  });

  return rejectEmptyExtraction(
    processExtractionResult(object, params.missingFields, params.targetSchema),
    params.toneProfile,
  );
}

function processAmendmentExtractionResult(
  object: {
    fields: Array<{ key: string; value: string | number | boolean | null }>;
    validationError: string | null;
  },
  amendableFields: SchemaFieldDefinition[],
): ExtractionOutcome {
  const validationError = object.validationError?.trim() || undefined;

  if (validationError) {
    return {
      extractedData: {},
      skippedFields: [],
      agentSkippedFields: [],
      validationError: sanitizeUserFacingMessage(validationError, amendableFields),
    };
  }

  const allowedKeys = new Set(amendableFields.map((field) => field.key));
  const extractedData: Record<string, unknown> = {};

  for (const field of object.fields) {
    if (!allowedKeys.has(field.key)) {
      continue;
    }

    if (field.value === null || field.value === undefined) {
      continue;
    }

    if (typeof field.value === "string" && field.value.trim().length === 0) {
      continue;
    }

    if (isPollutedFieldValue(field.value)) {
      continue;
    }

    extractedData[field.key] = field.value;
  }

  return {
    extractedData,
    skippedFields: [],
    agentSkippedFields: [],
  };
}

async function extractAmendmentsFromUserInput(params: {
  userInput: string;
  targetSchema: TargetSchema;
  targetSchemaSummary: string;
  capturedData: Record<string, unknown>;
  amendableFields: SchemaFieldDefinition[];
  toneProfile: unknown;
}): Promise<ExtractionOutcome> {
  const amendableFieldKeys = params.amendableFields.map((field) => field.key);
  const amendableFieldSummary = params.amendableFields
    .map((field) => buildFieldSummary(field))
    .join("\n\n");

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: extractionResultSchema,
    prompt: [
      "You extract structured field corrections from a user's free-form amendment message.",
      "The user is reviewing a finalized intake payload and may want to fix mistakes.",
      "",
      "AMENDMENT RULE:",
      "- The user is reviewing a finalized data payload.",
      "- If their input indicates a correction, adjustment, or replacement of an existing data point (e.g., 'Change the server ID to YBX' or 'Actually it's YBX, not BX'), locate the corresponding key in the capturedData and update its value to match the user's corrected intent.",
      "- Return the updated entries in the `fields` array using exact schema field keys.",
      "- Only include keys that should change based on the user's correction.",
      "- Map natural language to the closest schema field (e.g., 'server ID' -> server_id).",
      "- Do not add brand-new fields that were never part of this form unless the user clearly supplies a value for an existing schema field.",
      "",
      "USER-FACING LANGUAGE RULE:",
      "- Any `validationError` message is shown directly to the person filling out the form.",
      "- NEVER mention internal field keys, snake_case identifiers, JSON paths, schema names, or database terminology.",
      "",
      "When you cannot determine a correction:",
      "- Populate `validationError` with a polite message asking the user to clarify what should change.",
      "- Return empty `fields`, empty `skippedFields`, empty `notApplicableFields`.",
      "",
      "Do not use skippedFields or notApplicableFields during amendments. Always return all four top-level keys.",
      "",
      `Allowed field keys:\n${amendableFieldKeys.join(", ")}`,
      "",
      `Tone profile:\n${JSON.stringify(params.toneProfile, null, 2)}`,
      "",
      `Target schema fields:\n${params.targetSchemaSummary}`,
      "",
      `Amendable fields:\n${amendableFieldSummary}`,
      "",
      `Finalized captured data:\n${JSON.stringify(params.capturedData, null, 2)}`,
      "",
      `User correction:\n${params.userInput}`,
    ].join("\n"),
  });

  return processAmendmentExtractionResult(object, params.amendableFields);
}

async function handleSessionAmendment(params: {
  sessionId: string;
  userInput: string;
  session: {
    blueprintId: string;
    capturedData: unknown;
    blueprint: {
      label: string;
      targetSchema: unknown;
      toneProfile: unknown;
    };
  };
  request: Request;
}): Promise<NexusNextStepResponse> {
  const blueprintSchema = parseTargetSchema(params.session.blueprint.targetSchema);
  let capturedData = parseCapturedData(params.session.capturedData);
  const sessionMeta = parseSessionMeta(capturedData);
  const targetSchema = buildEffectiveTargetSchema(blueprintSchema, sessionMeta);
  const amendableFields = getSchemaFieldDefinitions(targetSchema);

  const outcome = await extractAmendmentsFromUserInput({
    userInput: params.userInput,
    targetSchema,
    targetSchemaSummary: buildTargetSchemaSummary(targetSchema),
    capturedData: stripSessionMeta(capturedData),
    amendableFields,
    toneProfile: params.session.blueprint.toneProfile,
  });

  const blueprint = {
    id: params.session.blueprintId,
    label: params.session.blueprint.label,
    targetSchema: params.session.blueprint.targetSchema,
    toneProfile: params.session.blueprint.toneProfile,
  };

  if (outcome.validationError) {
    return createCompletedResponse({}, [], capturedData, blueprint, {
      validationError: outcome.validationError,
    });
  }

  if (Object.keys(outcome.extractedData).length === 0) {
    return createCompletedResponse({}, [], capturedData, blueprint, {
      validationError:
        "I couldn't tell which field to update. Try something like \"Change the server ID to YBX.\"",
    });
  }

  capturedData = attachSessionMeta(
    mergeCapturedData(capturedData, outcome.extractedData, targetSchema),
    sessionMeta,
  );

  await prisma.formSession.update({
    where: { id: params.sessionId },
    data: { capturedData },
  });

  if (isMetaBlueprint(params.session.blueprint)) {
    return createCompletedResponse(
      outcome.extractedData,
      [],
      capturedData,
      blueprint,
    );
  }

  try {
    const origin = new URL(params.request.url).origin;
    const result = await processCompletedSession(params.sessionId, { origin });

    if (result.kind === "meta_compilation") {
      return createCompletedResponse(
        outcome.extractedData,
        [],
        capturedData,
        blueprint,
      );
    }

    return createCompletedResponse(
      outcome.extractedData,
      result.actionsExecuted,
      capturedData,
      blueprint,
    );
  } catch (dispatchError) {
    console.error("Amendment automation refresh failed:", dispatchError);
    return createCompletedResponse(
      outcome.extractedData,
      [],
      capturedData,
      blueprint,
    );
  }
}

async function buildValidationErrorResponse(
  validationError: string,
  fields: SchemaFieldDefinition[],
  blueprint: {
    label: string;
    targetSchema: unknown;
    toneProfile: unknown;
  },
  capturedData: Record<string, unknown>,
  targetSchema: TargetSchema,
): Promise<NexusNextStepResponse> {
  const parsedCapturedData = stripSessionMeta(parseCapturedData(capturedData));
  const missingFields = getMissingFields(targetSchema, parseCapturedData(capturedData));

  return nexusNextStepResponseSchema.parse({
    extractedData: {},
    isCompleted: false,
    validationError: sanitizeUserFacingMessage(validationError, fields),
    blueprintContext: buildBlueprintContext({
      label: blueprint.label,
      targetSchema: blueprint.targetSchema,
      toneProfile: blueprint.toneProfile,
      capturedData: parsedCapturedData,
    }),
    missingFieldHints: buildMissingFieldHints(missingFields),
  });
}

function attachIntentGuidance(
  response: Record<string, unknown>,
  targetSchema: TargetSchema,
  capturedData: Record<string, unknown>,
): NexusNextStepResponse {
  if (response.isCompleted) {
    return nexusNextStepResponseSchema.parse(response);
  }

  const missingFields = getMissingFields(
    targetSchema,
    parseCapturedData(capturedData),
  );

  return nexusNextStepResponseSchema.parse({
    ...response,
    missingFieldHints: buildMissingFieldHints(missingFields),
  });
}

async function generateNextStepQuestion(params: {
  field: SchemaFieldDefinition;
  capturedData: Record<string, unknown>;
  toneProfile: unknown;
  blueprintSchema: TargetSchema;
  blueprintLabel: string;
  allFields: SchemaFieldDefinition[];
  sessionMeta: SessionMeta;
}): Promise<{
  response: NexusNextStepResponse;
  sessionMeta: SessionMeta;
  capturedData: ReturnType<typeof parseCapturedData>;
}> {
  const capturedDataRecord = parseCapturedData(params.capturedData);
  const isCreatorCopilot = isMetaBlueprint({ label: params.blueprintLabel });
  const promptLines = [
      "You generate one concise intake question for the next missing schema field in a dynamic form.",
      "The question must sound natural, contextual, and aligned with the tone profile.",
      "Do not reference internal schema terminology, field keys, snake_case names, or implementation details.",
      "The `questionPrompt` is shown directly to the user — write it exactly as a human interviewer would speak.",
      "",
      "CONTEXTUAL FRAMING RULE:",
      "Before generating the `questionPrompt` for the next missing field, you MUST analyze the data already stored in `capturedData`.",
      "- If previous answers indicate a negative sentiment, frustration, or low satisfaction, completely pivot the angle of your next question. Do not ask tone-deaf positive follow-ups. Instead, phrase the question around friction points, constructive changes, or supportive solutions (e.g., 'If you could change one specific thing to improve your experience, what would it be?').",
      "- If previous answers indicate high satisfaction or positive sentiment, phrase the next question to uncover what specific factors made that success possible and how to amplify them (e.g., 'What is making this experience so great for you, and how can we make it even better?').",
      "- When sentiment is neutral or mixed, stay empathetic and specific to the field while lightly acknowledging what the user already shared.",
      "",
      ...(isCreatorCopilot
        ? [
            "CREATOR CO-PILOT MODE:",
            "- You are interviewing a form creator, not an end respondent.",
            "- If `initial_rough_idea` is present in capturedData, treat it as the creator's starting point and help them sharpen it.",
            "- If `initial_rough_idea` already contains a draft questionnaire or survey (even in another language), acknowledge what they pasted, summarize your understanding, and ask a focused follow-up rather than ignoring their work.",
            "- When the field key is `ai_curated_suggestions`, your `questionPrompt` must include a brief two-sentence structural suggestion for their form, then ask for their feedback on that suggestion.",
            "- Do not use `dynamicField` injection during creator co-pilot interviews. Always set `dynamicField` to null.",
            "",
          ]
        : [
            "DYNAMIC TARGET SCHEMA MUTATION (optional field injections):",
            "If a user's answer reveals an extreme edge case (e.g., an intense safety issue, severe dissatisfaction, or an extraordinary breakthrough), you are authorized to dynamically inject an unlisted, highly contextual follow-up field into the schema flow.",
            "- To inject, populate `dynamicField` with a snake_case `fieldKey` (e.g., `remediation_steps_requested`, `key_success_factors`), a `componentType`, and a concise `fieldDescription`.",
            "- The `questionPrompt` must ask that injected follow-up immediately, capturing the deeper layer of human intent before returning to the core blueprint.",
            "- Only inject when the edge case is genuinely extreme and the extra question adds clear value. Do not inject for routine answers.",
            "- If no injection is needed, set `dynamicField` to null and write a contextual `questionPrompt` for the blueprint field below.",
            "- Never inject duplicate keys or keys that already exist in the blueprint.",
            "",
          ]),
      "Always return both `questionPrompt` and `dynamicField`. Set `dynamicField` to null when no injection is needed.",
      "",
      `Tone profile:\n${JSON.stringify(params.toneProfile, null, 2)}`,
      "",
      `Blueprint field definition:\n${buildFieldSummary(params.field)}`,
      "",
      `Captured data so far:\n${JSON.stringify(stripInternalCapturedKeys(capturedDataRecord), null, 2)}`,
    ];

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: questionGenerationResultSchema,
    prompt: promptLines.join("\n"),
  });

  const questionPrompt = sanitizeUserFacingMessage(
    object.questionPrompt?.trim() || buildFallbackQuestion(params.field),
    params.allFields,
  );

  if (!isCreatorCopilot && object.dynamicField !== null) {
    const registration = registerInjectedField(params.sessionMeta, {
      fieldKey: object.dynamicField.fieldKey,
      componentType: object.dynamicField.componentType,
      fieldDescription: object.dynamicField.fieldDescription,
      blueprintSchema: params.blueprintSchema,
    });

    if (registration.injectedField) {
      const updatedMeta = registration.meta;
      const injectedField = registration.injectedField;
      const updatedCapturedData = attachSessionMeta(capturedDataRecord, updatedMeta);
      const injectedDefinition: SchemaFieldDefinition = {
        key: injectedField.key,
        property: injectedField.property,
        priority: injectedField.priority,
        componentType: resolveComponentType(injectedField.property),
      };

      return {
        response: nexusNextStepResponseSchema.parse({
          extractedData: {},
          isCompleted: false,
          nextStep: {
            fieldKey: injectedDefinition.key,
            componentType: injectedDefinition.componentType,
            questionPrompt:
              questionPrompt || buildFallbackQuestion(injectedDefinition),
          },
        }),
        sessionMeta: updatedMeta,
        capturedData: updatedCapturedData,
      };
    }
  }

  const nextStep =
    params.field.componentType === "select" && params.field.options?.length
      ? {
          fieldKey: params.field.key,
          componentType: params.field.componentType,
          questionPrompt,
          options: params.field.options,
        }
      : {
          fieldKey: params.field.key,
          componentType: params.field.componentType,
          questionPrompt,
        };

  return {
    response: nexusNextStepResponseSchema.parse({
      extractedData: {},
      isCompleted: false,
      nextStep,
    }),
    sessionMeta: params.sessionMeta,
    capturedData: capturedDataRecord,
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const parsedBody = nexusNextStepRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body.", details: parsedBody.error.flatten() },
        { status: 400 },
      );
    }

    const { sessionId, userInput } = parsedBody.data;

    const session = await prisma.formSession.findUnique({
      where: { id: sessionId },
      include: { blueprint: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (session.status === SessionStatus.COMPLETED) {
      if (userInput && userInput.trim().length > 0) {
        return NextResponse.json(
          await handleSessionAmendment({
            sessionId,
            userInput: userInput.trim(),
            session,
            request,
          }),
        );
      }

      return NextResponse.json(
        createCompletedResponse(
          {},
          [],
          parseCapturedData(session.capturedData),
          {
            id: session.blueprintId,
            label: session.blueprint.label,
            targetSchema: session.blueprint.targetSchema,
            toneProfile: session.blueprint.toneProfile,
          },
        ),
      );
    }

    const blueprintSchema = parseTargetSchema(session.blueprint.targetSchema);
    let capturedData = parseCapturedData(session.capturedData);
    let sessionMeta = parseSessionMeta(capturedData);
    let targetSchema = buildEffectiveTargetSchema(blueprintSchema, sessionMeta);
    let extractedData: Record<string, unknown> = {};
    let skippedFields: string[] = [];
    let agentSkippedFields: string[] = [];

    if (userInput && userInput.trim().length > 0) {
      const missingFieldsBeforeExtraction = getMissingFields(
        targetSchema,
        capturedData,
      );

      if (missingFieldsBeforeExtraction.length > 0) {
        const extractionOutcome = await extractDataFromUserInput({
          userInput,
          targetSchema,
          targetSchemaSummary: buildTargetSchemaSummary(targetSchema),
          capturedData: stripSessionMeta(capturedData),
          missingFields: missingFieldsBeforeExtraction,
          toneProfile: session.blueprint.toneProfile,
        });

        if (extractionOutcome.validationError) {
          return NextResponse.json(
            await buildValidationErrorResponse(
              extractionOutcome.validationError,
              missingFieldsBeforeExtraction,
              {
                label: session.blueprint.label,
                targetSchema: session.blueprint.targetSchema,
                toneProfile: session.blueprint.toneProfile,
              },
              capturedData,
              targetSchema,
            ),
          );
        }

        extractedData = extractionOutcome.extractedData;
        skippedFields = extractionOutcome.skippedFields;
        agentSkippedFields = extractionOutcome.agentSkippedFields;
        capturedData = attachSessionMeta(
          stripInvalidRequiredFieldValues(
            targetSchema,
            mergeCapturedData(capturedData, extractedData, targetSchema),
          ),
          sessionMeta,
        );

        await prisma.formSession.update({
          where: { id: sessionId },
          data: { capturedData },
        });
      }
    }

    targetSchema = buildEffectiveTargetSchema(blueprintSchema, sessionMeta);

    if (areAllRequiredFieldsSatisfied(targetSchema, capturedData)) {
      await prisma.formSession.update({
        where: { id: sessionId },
        data: {
          capturedData,
          status: SessionStatus.COMPLETED,
        },
      });

      return NextResponse.json(
        await buildCompletedResponse(
          sessionId,
          extractedData,
          capturedData,
          {
            id: session.blueprintId,
            label: session.blueprint.label,
            targetSchema: session.blueprint.targetSchema,
            toneProfile: session.blueprint.toneProfile,
          },
          request,
        ),
      );
    }

    const nextMissingField = getMissingFields(targetSchema, capturedData)[0];

    if (!nextMissingField) {
      await prisma.formSession.update({
        where: { id: sessionId },
        data: {
          capturedData,
          status: SessionStatus.COMPLETED,
        },
      });

      return NextResponse.json(
        await buildCompletedResponse(
          sessionId,
          extractedData,
          capturedData,
          {
            id: session.blueprintId,
            label: session.blueprint.label,
            targetSchema: session.blueprint.targetSchema,
            toneProfile: session.blueprint.toneProfile,
          },
          request,
        ),
      );
    }

    const questionResult = await generateNextStepQuestion({
      field: nextMissingField,
      capturedData,
      toneProfile: session.blueprint.toneProfile,
      blueprintSchema,
      blueprintLabel: session.blueprint.label,
      allFields: getSchemaFieldDefinitions(targetSchema),
      sessionMeta,
    });

    sessionMeta = questionResult.sessionMeta;
    capturedData = questionResult.capturedData;

    if (sessionMeta.injectedFields.length > 0) {
      await prisma.formSession.update({
        where: { id: sessionId },
        data: { capturedData },
      });
    }

    return NextResponse.json(
      attachIntentGuidance(
        {
          ...questionResult.response,
          extractedData,
          skippedFields: skippedFields.length > 0 ? skippedFields : undefined,
          agentSkippedFields:
            agentSkippedFields.length > 0 ? agentSkippedFields : undefined,
          blueprintId: session.blueprintId,
          blueprintContext: buildBlueprintContext({
            label: session.blueprint.label,
            targetSchema: session.blueprint.targetSchema,
            toneProfile: session.blueprint.toneProfile,
            capturedData: stripSessionMeta(parseCapturedData(capturedData)),
          }),
        },
        targetSchema,
        capturedData,
      ),
    );
  } catch (error) {
    console.error("Nexus next-step orchestration failed:", error);
    return NextResponse.json(
      { error: "Failed to process the next intake step." },
      { status: 500 },
    );
  }
}
