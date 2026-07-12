import type { ComponentType } from "@/lib/nexus/schemas";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type { JsonValue };

export interface TargetSchemaProperty {
  type?: string | string[];
  enum?: string[];
  format?: string;
  description?: string;
  "x-priority"?: number;
  "x-injected"?: boolean;
}

export interface SessionInjectedField {
  key: string;
  property: TargetSchemaProperty;
  priority: number;
}

export interface SessionMeta {
  injectedFields: SessionInjectedField[];
}

export interface TargetSchema {
  type?: string;
  properties?: Record<string, TargetSchemaProperty>;
  required?: string[];
}

export interface SchemaFieldDefinition {
  key: string;
  property: TargetSchemaProperty;
  priority: number;
  componentType: ComponentType;
  options?: string[];
}

export const SKIPPED_FIELD_VALUE = "Not Provided";
export const AGENT_SKIPPED_STATUS = "skipped_by_agent";
export const NEXUS_META_KEY = "__nexus_meta__";
const MAX_INJECTED_FIELDS = 3;
const INJECTED_FIELD_PRIORITY_BASE = -1000;

function asRecord(value: unknown): Record<string, JsonValue> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }

  return {};
}

export function parseTargetSchema(value: unknown): TargetSchema {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { type: "object", properties: {}, required: [] };
  }

  const schema = value as TargetSchema;
  return {
    type: schema.type ?? "object",
    properties: schema.properties ?? {},
    required: schema.required ?? [],
  };
}

export function parseCapturedData(value: unknown): Record<string, JsonValue> {
  return stripPollutedCapturedData(asRecord(value));
}

export function parseSessionMeta(
  capturedData: Record<string, JsonValue>,
): SessionMeta {
  const rawMeta = capturedData[NEXUS_META_KEY];

  if (
    typeof rawMeta !== "object" ||
    rawMeta === null ||
    Array.isArray(rawMeta) ||
    !Array.isArray((rawMeta as unknown as SessionMeta).injectedFields)
  ) {
    return { injectedFields: [] };
  }

  const meta = rawMeta as unknown as SessionMeta;
  return {
    injectedFields: (meta.injectedFields ?? []).filter(
      (field) =>
        typeof field.key === "string" &&
        typeof field.property === "object" &&
        field.property !== null,
    ),
  };
}

export function stripSessionMeta(
  capturedData: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const { [NEXUS_META_KEY]: _meta, ...rest } = capturedData;
  return rest;
}

export function attachSessionMeta(
  capturedData: Record<string, JsonValue>,
  meta: SessionMeta,
): Record<string, JsonValue> {
  if (meta.injectedFields.length === 0) {
    return stripSessionMeta(capturedData);
  }

  return {
    ...stripSessionMeta(capturedData),
    [NEXUS_META_KEY]: meta as unknown as JsonValue,
  };
}

function sanitizeInjectedFieldKey(fieldKey: string): string | null {
  const normalized = fieldKey.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return null;
  }

  if (normalized === NEXUS_META_KEY) {
    return null;
  }

  return normalized;
}

export function registerInjectedField(
  meta: SessionMeta,
  params: {
    fieldKey: string;
    componentType: ComponentType;
    fieldDescription: string;
    blueprintSchema: TargetSchema;
  },
): { meta: SessionMeta; injectedField: SessionInjectedField | null } {
  const sanitizedKey = sanitizeInjectedFieldKey(params.fieldKey);
  if (!sanitizedKey) {
    return { meta, injectedField: null };
  }

  const blueprintProperties = params.blueprintSchema.properties ?? {};
  if (
    blueprintProperties[sanitizedKey] ||
    meta.injectedFields.some((field) => field.key === sanitizedKey)
  ) {
    return { meta, injectedField: null };
  }

  if (meta.injectedFields.length >= MAX_INJECTED_FIELDS) {
    return { meta, injectedField: null };
  }

  const injectedField: SessionInjectedField = {
    key: sanitizedKey,
    property: {
      type: params.componentType === "number" ? "number" : "string",
      description: params.fieldDescription.trim(),
      "x-priority": INJECTED_FIELD_PRIORITY_BASE - meta.injectedFields.length,
      "x-injected": true,
    },
    priority: INJECTED_FIELD_PRIORITY_BASE - meta.injectedFields.length,
  };

  return {
    meta: {
      injectedFields: [...meta.injectedFields, injectedField],
    },
    injectedField,
  };
}

export function buildEffectiveTargetSchema(
  blueprintSchema: TargetSchema,
  sessionMeta: SessionMeta,
): TargetSchema {
  if (sessionMeta.injectedFields.length === 0) {
    return blueprintSchema;
  }

  const properties = {
    ...(blueprintSchema.properties ?? {}),
  };
  const required = [...(blueprintSchema.required ?? [])];

  for (const injectedField of sessionMeta.injectedFields) {
    properties[injectedField.key] = injectedField.property;

    if (!required.includes(injectedField.key)) {
      required.push(injectedField.key);
    }
  }

  return {
    ...blueprintSchema,
    properties,
    required,
  };
}

export function getRequiredFieldKeys(targetSchema: TargetSchema): Set<string> {
  return new Set(targetSchema.required ?? []);
}

export function isRequiredField(
  targetSchema: TargetSchema,
  fieldKey: string,
): boolean {
  return getRequiredFieldKeys(targetSchema).has(fieldKey);
}

export function isSkippedPlaceholderValue(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase() === SKIPPED_FIELD_VALUE.toLowerCase()
  );
}

const POLLUTED_FIELD_VALUE_PATTERNS = [
  /^not applicable\b/i,
  /^the input does not\b/i,
  /^the user(?:'s| did not)? input does not\b/i,
  /^no relevant information\b/i,
  /^does not mention\b/i,
  /^could not be determined\b/i,
  /^not mentioned in\b/i,
  /^unable to (?:find|determine|extract)\b/i,
];

export function isPollutedFieldValue(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  return POLLUTED_FIELD_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function stripPollutedCapturedData(
  capturedData: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const cleaned: Record<string, JsonValue> = {};

  for (const [fieldKey, value] of Object.entries(capturedData)) {
    if (fieldKey === NEXUS_META_KEY) {
      cleaned[fieldKey] = value;
      continue;
    }

    if (isPollutedFieldValue(value)) {
      continue;
    }

    cleaned[fieldKey] = value;
  }

  return cleaned;
}

export interface AgentSkippedFieldValue {
  status: typeof AGENT_SKIPPED_STATUS;
  reason: string;
}

export function isAgentSkippedFieldValue(
  value: unknown,
): value is AgentSkippedFieldValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as AgentSkippedFieldValue).status === AGENT_SKIPPED_STATUS &&
    typeof (value as AgentSkippedFieldValue).reason === "string" &&
    (value as AgentSkippedFieldValue).reason.trim().length > 0
  );
}

export function buildAgentSkippedFieldValue(reason: string): AgentSkippedFieldValue {
  const trimmedReason = reason.trim();
  return {
    status: AGENT_SKIPPED_STATUS,
    reason:
      trimmedReason.length > 0
        ? trimmedReason
        : "Contextually irrelevant based on previous user sentiment",
  };
}

export function isFieldValuePresent(
  value: JsonValue | undefined,
  options?: { required?: boolean },
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (isAgentSkippedFieldValue(value)) {
    return options?.required === true ? false : true;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return false;
    }

    if (isSkippedPlaceholderValue(value)) {
      return options?.required === true ? false : true;
    }

    if (isPollutedFieldValue(value)) {
      return false;
    }

    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export function resolveComponentType(
  property: TargetSchemaProperty,
): ComponentType {
  if (Array.isArray(property.enum) && property.enum.length > 0) {
    return "select";
  }

  const primaryType = Array.isArray(property.type)
    ? property.type[0]
    : property.type;

  if (primaryType === "number" || primaryType === "integer") {
    return "number";
  }

  if (
    primaryType === "date" ||
    property.format === "date" ||
    property.format === "date-time"
  ) {
    return "date";
  }

  if (primaryType === "boolean") {
    return "select";
  }

  return "text";
}

function resolveFieldPriority(
  fieldKey: string,
  targetSchema: TargetSchema,
  property: TargetSchemaProperty,
): number {
  if (typeof property["x-priority"] === "number") {
    return property["x-priority"];
  }

  const requiredIndex = targetSchema.required?.indexOf(fieldKey) ?? -1;
  if (requiredIndex >= 0) {
    return requiredIndex;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function getSchemaFieldDefinitions(
  targetSchema: TargetSchema,
): SchemaFieldDefinition[] {
  const properties = targetSchema.properties ?? {};
  const requiredKeys = new Set(targetSchema.required ?? Object.keys(properties));

  return Object.entries(properties)
    .filter(([fieldKey]) => requiredKeys.has(fieldKey))
    .map(([fieldKey, property]) => {
      const primaryType = Array.isArray(property.type)
        ? property.type[0]
        : property.type;
      const componentType = resolveComponentType(property);
      const options =
        componentType === "select"
          ? primaryType === "boolean"
            ? ["Yes", "No"]
            : Array.isArray(property.enum)
              ? property.enum
              : undefined
          : undefined;

      return {
        key: fieldKey,
        property,
        priority: resolveFieldPriority(fieldKey, targetSchema, property),
        componentType,
        options,
      };
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      return left.key.localeCompare(right.key);
    });
}

export function getMissingFields(
  targetSchema: TargetSchema,
  capturedData: Record<string, JsonValue>,
): SchemaFieldDefinition[] {
  const requiredKeys = getRequiredFieldKeys(targetSchema);

  return getSchemaFieldDefinitions(targetSchema).filter((field) => {
    const isRequired = requiredKeys.has(field.key);
    return !isFieldValuePresent(capturedData[field.key], { required: isRequired });
  });
}

export function areAllRequiredFieldsSatisfied(
  targetSchema: TargetSchema,
  capturedData: Record<string, JsonValue>,
): boolean {
  return getMissingFields(targetSchema, capturedData).length === 0;
}

export function mergeCapturedData(
  currentData: Record<string, JsonValue>,
  extractedData: Record<string, unknown>,
  targetSchema?: TargetSchema,
): Record<string, JsonValue> {
  const merged: Record<string, JsonValue> = { ...currentData };
  const requiredKeys = targetSchema ? getRequiredFieldKeys(targetSchema) : null;

  for (const [fieldKey, fieldValue] of Object.entries(extractedData)) {
    if (fieldKey === NEXUS_META_KEY || fieldValue === undefined) {
      continue;
    }

    if (
      requiredKeys?.has(fieldKey) &&
      (isAgentSkippedFieldValue(fieldValue) ||
        fieldValue === null ||
        (typeof fieldValue === "string" &&
          (fieldValue.trim().length === 0 ||
            isSkippedPlaceholderValue(fieldValue) ||
            isPollutedFieldValue(fieldValue))))
    ) {
      continue;
    }

    if (isPollutedFieldValue(fieldValue)) {
      continue;
    }

    merged[fieldKey] = fieldValue as JsonValue;
  }

  return merged;
}

export function stripInvalidRequiredFieldValues(
  targetSchema: TargetSchema,
  capturedData: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const requiredKeys = getRequiredFieldKeys(targetSchema);
  const cleaned: Record<string, JsonValue> = { ...capturedData };

  for (const fieldKey of requiredKeys) {
    const value = cleaned[fieldKey];

    if (isAgentSkippedFieldValue(value)) {
      delete cleaned[fieldKey];
      continue;
    }

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" &&
        (value.trim().length === 0 ||
          isSkippedPlaceholderValue(value) ||
          isPollutedFieldValue(value)))
    ) {
      delete cleaned[fieldKey];
    }
  }

  for (const [fieldKey, value] of Object.entries(cleaned)) {
    if (fieldKey === NEXUS_META_KEY) {
      continue;
    }

    if (isPollutedFieldValue(value)) {
      delete cleaned[fieldKey];
    }
  }

  return cleaned;
}

export function buildFieldSummary(field: SchemaFieldDefinition): string {
  const lines = [
    `key: ${field.key}`,
    `componentType: ${field.componentType}`,
    `type: ${Array.isArray(field.property.type) ? field.property.type.join(" | ") : (field.property.type ?? "string")}`,
  ];

  if (field.property.description) {
    lines.push(`description: ${field.property.description}`);
  }

  if (field.property.format) {
    lines.push(`format: ${field.property.format}`);
  }

  if (field.options?.length) {
    lines.push(`options: ${field.options.join(", ")}`);
  }

  return lines.join("\n");
}

export function buildTargetSchemaSummary(targetSchema: TargetSchema): string {
  return getSchemaFieldDefinitions(targetSchema)
    .map((field) => buildFieldSummary(field))
    .join("\n\n");
}
