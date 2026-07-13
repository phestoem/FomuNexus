import assert from "node:assert/strict";
import test from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  getMissingFields,
  isFieldValuePresent,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
  type TargetSchema,
} from "./target-schema.ts";

const schema: TargetSchema = {
  type: "object",
  required: ["mandatory_answer"],
  properties: {
    mandatory_answer: {
      type: "string",
      description: "Mandatory answer",
    },
    optional_answer: {
      type: "string",
      description: "Optional answer",
    },
  },
};

test("agent-skipped placeholders do not satisfy required schema fields", () => {
  const skipped = buildAgentSkippedFieldValue("Context did not apply");

  assert.equal(isFieldValuePresent(skipped, { required: true }), false);
  assert.equal(isFieldValuePresent(skipped, { required: false }), true);
  assert.equal(
    areAllRequiredFieldsSatisfied(schema, { mandatory_answer: skipped }),
    false,
  );
  assert.deepEqual(
    getMissingFields(schema, { mandatory_answer: skipped }).map(
      (field) => field.key,
    ),
    ["mandatory_answer"],
  );
});

test("required agent-skipped placeholders are not merged or retained", () => {
  const skipped = buildAgentSkippedFieldValue("Context did not apply");

  assert.deepEqual(
    mergeCapturedData({}, { mandatory_answer: skipped }, schema),
    {},
  );
  assert.deepEqual(
    stripInvalidRequiredFieldValues(schema, {
      mandatory_answer: skipped,
      optional_answer: skipped,
    }),
    { optional_answer: skipped },
  );
});
