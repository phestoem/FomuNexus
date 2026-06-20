import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyticsRequestSchema,
  createBlueprintRequestSchema,
  MAX_ANALYTICS_QUERY_LENGTH,
  MAX_CREATOR_PROMPT_LENGTH,
  MAX_CREATOR_TITLE_LENGTH,
  MAX_INTAKE_USER_INPUT_LENGTH,
  MAX_NEXUS_ID_LENGTH,
  nexusNextStepRequestSchema,
  startCopilotRequestSchema,
} from "./schemas";

function stringOfLength(length: number): string {
  return "x".repeat(length);
}

describe("Nexus request schemas", () => {
  it("accepts bounded AI-backed request inputs", () => {
    assert.equal(
      nexusNextStepRequestSchema.safeParse({
        sessionId: stringOfLength(MAX_NEXUS_ID_LENGTH),
        userInput: stringOfLength(MAX_INTAKE_USER_INPUT_LENGTH),
      }).success,
      true,
    );

    assert.equal(
      createBlueprintRequestSchema.safeParse({
        title: stringOfLength(MAX_CREATOR_TITLE_LENGTH),
        prompt: stringOfLength(MAX_CREATOR_PROMPT_LENGTH),
      }).success,
      true,
    );

    assert.equal(
      startCopilotRequestSchema.safeParse({
        title: stringOfLength(MAX_CREATOR_TITLE_LENGTH),
        roughIdea: stringOfLength(MAX_CREATOR_PROMPT_LENGTH),
      }).success,
      true,
    );

    assert.equal(
      analyticsRequestSchema.safeParse({
        blueprintId: stringOfLength(MAX_NEXUS_ID_LENGTH),
        query: stringOfLength(MAX_ANALYTICS_QUERY_LENGTH),
      }).success,
      true,
    );
  });

  it("rejects oversized AI-backed request inputs before model calls", () => {
    assert.equal(
      nexusNextStepRequestSchema.safeParse({
        sessionId: "session",
        userInput: stringOfLength(MAX_INTAKE_USER_INPUT_LENGTH + 1),
      }).success,
      false,
    );

    assert.equal(
      createBlueprintRequestSchema.safeParse({
        title: "title",
        prompt: stringOfLength(MAX_CREATOR_PROMPT_LENGTH + 1),
      }).success,
      false,
    );

    assert.equal(
      startCopilotRequestSchema.safeParse({
        title: stringOfLength(MAX_CREATOR_TITLE_LENGTH + 1),
        roughIdea: "idea",
      }).success,
      false,
    );

    assert.equal(
      analyticsRequestSchema.safeParse({
        blueprintId: "blueprint",
        query: stringOfLength(MAX_ANALYTICS_QUERY_LENGTH + 1),
      }).success,
      false,
    );
  });
});
