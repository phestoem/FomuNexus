import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  getMissingFields,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
  type TargetSchema,
} from "./target-schema";

const schema: TargetSchema = {
  type: "object",
  required: ["email"],
  properties: {
    email: {
      type: "string",
      description: "Email address",
    },
    notes: {
      type: "string",
      description: "Optional notes",
    },
  },
};

describe("required field integrity", () => {
  it("does not satisfy required fields with agent skip markers", () => {
    const capturedData = {
      email: buildAgentSkippedFieldValue("Not relevant"),
    };

    assert.equal(areAllRequiredFieldsSatisfied(schema, capturedData), false);
    assert.deepEqual(
      getMissingFields(schema, capturedData).map((field) => field.key),
      ["email"],
    );
  });

  it("does not merge agent skip markers into required fields", () => {
    const merged = mergeCapturedData(
      {},
      { email: buildAgentSkippedFieldValue("Not relevant") },
      schema,
    );

    assert.deepEqual(merged, {});
  });

  it("strips legacy agent skip markers from required fields", () => {
    const cleaned = stripInvalidRequiredFieldValues(schema, {
      email: buildAgentSkippedFieldValue("Not relevant"),
      notes: buildAgentSkippedFieldValue("Optional follow-up is irrelevant"),
    });

    assert.deepEqual(cleaned, {
      notes: buildAgentSkippedFieldValue("Optional follow-up is irrelevant"),
    });
  });
});
