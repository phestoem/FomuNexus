import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  isFieldValuePresent,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
  type TargetSchema,
} from "./target-schema.ts";

const schema = {
  type: "object",
  required: ["must_answer"],
  properties: {
    must_answer: {
      type: "string",
      description: "Mandatory answer",
    },
    optional_context: {
      type: "string",
      description: "Optional context",
    },
  },
} satisfies TargetSchema;

describe("required field completion", () => {
  it("does not treat agent-skipped placeholders as satisfying required fields", () => {
    const skipped = buildAgentSkippedFieldValue("Not relevant from context");

    assert.equal(isFieldValuePresent(skipped, { required: true }), false);
    assert.equal(areAllRequiredFieldsSatisfied(schema, { must_answer: skipped }), false);
  });

  it("removes legacy required agent-skipped placeholders during cleanup", () => {
    const skipped = buildAgentSkippedFieldValue("Not relevant from context");

    assert.deepEqual(
      stripInvalidRequiredFieldValues(schema, {
        must_answer: skipped,
        optional_context: skipped,
      }),
      {
        optional_context: skipped,
      },
    );
  });

  it("does not merge agent-skipped placeholders into required fields", () => {
    const skipped = buildAgentSkippedFieldValue("Not relevant from context");

    assert.deepEqual(
      mergeCapturedData({}, { must_answer: skipped }, schema),
      {},
    );
    assert.deepEqual(
      mergeCapturedData({}, { optional_context: skipped }, schema),
      {
        optional_context: skipped,
      },
    );
  });
});
