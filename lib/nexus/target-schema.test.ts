import assert from "node:assert/strict";
import test from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  mergeCapturedData,
  parseCapturedData,
  stripInvalidRequiredFieldValues,
  type TargetSchema,
} from "./target-schema";

const schemaWithRequiredAnswer: TargetSchema = {
  type: "object",
  required: ["answer"],
  properties: {
    answer: {
      type: "string",
      description: "A required free-text answer",
    },
  },
};

test("parseCapturedData preserves persisted user text that resembles AI sentinel output", () => {
  const capturedData = parseCapturedData({
    answer: "Not applicable to my team because we use a different workflow.",
    notes: "Unable to determine budget until finance signs off.",
  });

  assert.deepEqual(capturedData, {
    answer: "Not applicable to my team because we use a different workflow.",
    notes: "Unable to determine budget until finance signs off.",
  });
});

test("stripInvalidRequiredFieldValues does not delete legitimate sentinel-like answers", () => {
  const capturedData = stripInvalidRequiredFieldValues(schemaWithRequiredAnswer, {
    answer: "No relevant information is missing; this is the full answer.",
    initial_rough_idea: "Unable to determine scope until discovery is complete.",
  });

  assert.deepEqual(capturedData, {
    answer: "No relevant information is missing; this is the full answer.",
    initial_rough_idea: "Unable to determine scope until discovery is complete.",
  });
});

test("mergeCapturedData still rejects polluted AI extraction output", () => {
  const capturedData = mergeCapturedData(
    {},
    {
      answer: "Unable to determine from the user input.",
    },
    schemaWithRequiredAnswer,
  );

  assert.deepEqual(capturedData, {});
});

test("required fields cannot be satisfied by agent skip markers", () => {
  const skippedValue = buildAgentSkippedFieldValue("The answer was not applicable.");

  assert.equal(
    areAllRequiredFieldsSatisfied(schemaWithRequiredAnswer, { answer: skippedValue }),
    false,
  );

  assert.deepEqual(
    mergeCapturedData(
      {},
      {
        answer: skippedValue,
      },
      schemaWithRequiredAnswer,
    ),
    {},
  );

  assert.deepEqual(
    stripInvalidRequiredFieldValues(schemaWithRequiredAnswer, {
      answer: skippedValue,
    }),
    {},
  );
});
