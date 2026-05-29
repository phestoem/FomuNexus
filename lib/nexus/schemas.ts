import { z } from "zod";

export const componentTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
]);

export const nextStepSchema = z.object({
  fieldKey: z.string(),
  componentType: componentTypeSchema,
  questionPrompt: z.string(),
  options: z.array(z.string()).nullable().optional(),
});

export const actionDestinationSchema = z.enum([
  "SLACK_ALERTS",
  "EMAIL_DISPATCH",
  "CRM_DATABASE",
]);

export const actionPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const actionPayloadFieldSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const actionExecutedSchema = z.object({
  destination: actionDestinationSchema,
  reasoning: z.string(),
  payload: z.record(z.string(), z.unknown()),
  priority: actionPrioritySchema,
});

export const dispatchedActionSchema = z.object({
  destination: actionDestinationSchema,
  reasoning: z.string(),
  priority: actionPrioritySchema,
  payloadFields: z.array(actionPayloadFieldSchema),
});

export const actionDispatchResultSchema = z.object({
  actions: z.array(dispatchedActionSchema),
});

export const compiledBlueprintResultSchema = z.object({
  blueprintId: z.string(),
  sessionId: z.string(),
  label: z.string(),
  formUrl: z.string(),
  analyticsUrl: z.string(),
});

export const blueprintContextSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const missingFieldHintSchema = z.object({
  key: z.string(),
  label: z.string(),
});

export const nexusNextStepResponseSchema = z.object({
  extractedData: z.record(z.string(), z.unknown()),
  isCompleted: z.boolean(),
  nextStep: nextStepSchema.optional(),
  actionsExecuted: z.array(actionExecutedSchema).optional(),
  capturedData: z.record(z.string(), z.unknown()).optional(),
  blueprintId: z.string().optional(),
  blueprintContext: blueprintContextSchema.optional(),
  missingFieldHints: z.array(missingFieldHintSchema).optional(),
  validationError: z.string().optional(),
  skippedFields: z.array(z.string()).optional(),
  agentSkippedFields: z.array(z.string()).optional(),
  compiledBlueprint: compiledBlueprintResultSchema.optional(),
});

export const extractedFieldSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const notApplicableFieldSchema = z.object({
  key: z.string(),
  reason: z.string().min(1),
});

export const extractionResultSchema = z.object({
  fields: z.array(extractedFieldSchema),
  skippedFields: z.array(z.string()),
  notApplicableFields: z.array(notApplicableFieldSchema),
  validationError: z.union([z.string(), z.null()]),
});

export const dynamicFieldInjectionSchema = z.object({
  fieldKey: z.string().min(1),
  componentType: componentTypeSchema,
  fieldDescription: z.string().min(1),
});

export const questionGenerationResultSchema = z.object({
  questionPrompt: z.string(),
  dynamicField: z.union([dynamicFieldInjectionSchema, z.null()]),
});

export const nexusNextStepRequestSchema = z.object({
  sessionId: z.string().min(1),
  userInput: z.string().optional(),
});

export const toneProfileSchema = z.object({
  primary: z.string(),
  style: z.string(),
});

export const targetSchemaPropertySchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string(),
  enum: z.array(z.string()).optional(),
});

export const targetSchemaDefinitionSchema = z.object({
  type: z.literal("object"),
  required: z.array(z.string()),
  properties: z.record(z.string(), targetSchemaPropertySchema),
});

export const createBlueprintRequestSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
});

export const startCopilotRequestSchema = z.object({
  title: z.string().min(1),
  roughIdea: z.string().min(1),
});

export const analyticsRequestSchema = z.object({
  blueprintId: z.string().min(1),
  query: z.string().min(1),
});

export const restartSessionRequestSchema = z.object({
  sessionId: z.string().min(1),
});

export const startSessionRequestSchema = z.object({
  blueprintId: z.string().min(1),
});

export const listBlueprintsQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sort: z
    .enum(["updated_desc", "updated_asc", "name_asc", "name_desc"])
    .default("updated_desc"),
});

export const updateBlueprintRequestSchema = z.object({
  archived: z.boolean(),
});

export const manageBlueprintsRequestSchema = z.object({
  action: z.enum(["archive", "restore", "delete"]),
  blueprintIds: z.array(z.string().min(1)).min(1).max(100),
});

export const generatedBlueprintFieldSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().min(1),
  enumOptions: z.array(z.string()).nullable(),
});

export const generatedBlueprintSchema = z.object({
  toneProfile: toneProfileSchema,
  fields: z.array(generatedBlueprintFieldSchema).min(1),
});

export type ComponentType = z.infer<typeof componentTypeSchema>;
export type NextStep = z.infer<typeof nextStepSchema>;
export type NexusNextStepResponse = z.infer<typeof nexusNextStepResponseSchema>;
export type NexusNextStepRequest = z.infer<typeof nexusNextStepRequestSchema>;
export type GeneratedBlueprintField = z.infer<typeof generatedBlueprintFieldSchema>;
export type TargetSchemaDefinition = z.infer<typeof targetSchemaDefinitionSchema>;
export type ToneProfile = z.infer<typeof toneProfileSchema>;
export type ActionExecuted = z.infer<typeof actionExecutedSchema>;
export type BlueprintContext = z.infer<typeof blueprintContextSchema>;
export type MissingFieldHint = z.infer<typeof missingFieldHintSchema>;
export type CompiledBlueprintResult = z.infer<typeof compiledBlueprintResultSchema>;
export type StartCopilotRequest = z.infer<typeof startCopilotRequestSchema>;
