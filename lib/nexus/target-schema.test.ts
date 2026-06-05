import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  getMissingFields,
  isFieldValuePresent,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
  type TargetSchema,
} from "./target-schema";

const targetSchema: TargetSchema = {
  type: "object",
  required: ["required_answer"],
  properties: {
    required_answer: {
      type: "string",
      description: "A required response",
    },
    optional_answer: {
      type: "string",
      description: "An optional response",
    },
  },
};

describe("required field completion", () => {
  it("does not treat agent-skipped required fields as present", () => {
    const agentSkippedValue = buildAgentSkippedFieldValue(
      "Context made this field seem irrelevant.",
    );

    assert.equal(isFieldValuePresent(agentSkippedValue, { required: true }), false);
    assert.equal(isFieldValuePresent(agentSkippedValue, { required: false }), true);
  });

  it("keeps a required field missing when it contains an agent-skip sentinel", () => {
    const capturedData = {
      required_answer: buildAgentSkippedFieldValue(
        "Context made this field seem irrelevant.",
      ),
    };

    assert.equal(areAllRequiredFieldsSatisfied(targetSchema, capturedData), false);
    assert.deepEqual(
      getMissingFields(targetSchema, capturedData).map((field) => field.key),
      ["required_answer"],
    );
  });

  it("does not persist agent-skip sentinels for required fields", () => {
    const requiredSkip = buildAgentSkippedFieldValue(
      "Context made this field seem irrelevant.",
    );
    const optionalSkip = buildAgentSkippedFieldValue(
      "The optional field is not relevant.",
    );

    assert.deepEqual(
      mergeCapturedData(
        {},
        {
          required_answer: requiredSkip,
          optional_answer: optionalSkip,
        },
        targetSchema,
      ),
      {
        optional_answer: optionalSkip,
      },
    );

    assert.deepEqual(
      stripInvalidRequiredFieldValues(targetSchema, {
        required_answer: requiredSkip,
        optional_answer: optionalSkip,
      }),
      {
        optional_answer: optionalSkip,
      },
    );
  });
});
