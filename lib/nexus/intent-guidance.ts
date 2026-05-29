import { formatFieldLabel } from "@/lib/nexus/display-utils";
import type { ComponentType } from "@/lib/nexus/schemas";
import type { SchemaFieldDefinition } from "@/lib/nexus/target-schema";

export type MissingFieldHint = {
  key: string;
  label: string;
};

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function resolveIntentLabel(field: SchemaFieldDefinition): string {
  const description = field.property.description?.trim();

  if (description && !description.endsWith("?") && description.length <= 48) {
    const cleaned = description
      .replace(/^the\s+/i, "")
      .replace(/\.$/, "")
      .trim();

    if (cleaned.length > 0) {
      return titleCase(cleaned);
    }
  }

  if (field.componentType === "select" && field.options?.length) {
    return formatFieldLabel(field.key);
  }

  return formatFieldLabel(field.key);
}

export function buildMissingFieldHints(
  missingFields: SchemaFieldDefinition[],
): MissingFieldHint[] {
  return missingFields.map((field) => ({
    key: field.key,
    label: resolveIntentLabel(field),
  }));
}

function exampleFragment(
  field: MissingFieldHint,
  componentType?: ComponentType,
): string {
  const key = field.key.toLowerCase();
  const label = field.label.toLowerCase();

  if (key.includes("server") || key.includes("asset") || label.includes("asset")) {
    return "Server B-102";
  }

  if (key.includes("severity") || label.includes("severity")) {
    return "a critical outage";
  }

  if (key.includes("downtime") || key.includes("date") || key.includes("time")) {
    return "it started yesterday around 3 PM";
  }

  if (key.includes("name") || label.includes("name")) {
    return "Alex Johnson";
  }

  if (key.includes("email")) {
    return "alex@company.com";
  }

  if (key.includes("phone")) {
    return "555-0100";
  }

  if (componentType === "number") {
    return "42";
  }

  if (componentType === "date") {
    return "2026-05-27";
  }

  if (componentType === "select") {
    return field.label.toLowerCase();
  }

  return field.label.toLowerCase();
}

export function buildOmniPlaceholder(
  hints: MissingFieldHint[],
  fieldsByKey?: Map<string, SchemaFieldDefinition>,
): string {
  if (hints.length === 0) {
    return "Type or paste your answer…";
  }

  if (hints.length === 1) {
    const field = hints[0];
    const componentType = fieldsByKey?.get(field.key)?.componentType;
    const fragment = exampleFragment(field, componentType);

    if (componentType === "number" || componentType === "date") {
      return `e.g., ${fragment}`;
    }

    return `e.g., "${fragment}"`;
  }

  const fragments = hints
    .slice(0, 3)
    .map((hint) =>
      exampleFragment(hint, fieldsByKey?.get(hint.key)?.componentType),
    );

  if (fragments.length === 2) {
    const [first, second] = fragments;
    if (second.startsWith("a ") || second.startsWith("an ")) {
      return `e.g., "${first} has ${second}…"`;
    }
    return `e.g., "${first}, ${second}…"`;
  }

  return `e.g., "${fragments.join(", ")}…"`;
}
