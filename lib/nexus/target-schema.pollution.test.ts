import assert from "node:assert/strict";
import test from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  isPollutedFieldValue,
  mergeCapturedData,
  type TargetSchema,
} from "./target-schema";

const requiredAnswerSchema: TargetSchema = {
  type: "object",
  required: ["answer", "exception_reason"],
  properties: {
    answer: {
      type: "string",
      description: "Free-text answer",
    },
    exception_reason: {
      type: "string",
      enum: ["Not applicable", "Schedule conflict", "Other"],
      description: "Why the respondent is exempt",
    },
  },
};

test("bare and domain 'Not applicable' answers are not treated as polluted", () => {
  assert.equal(isPollutedFieldValue("Not applicable"), false);
  assert.equal(
    isPollutedFieldValue(
      "Not applicable to my team because we use a different workflow.",
    ),
    false,
  );
  assert.equal(
    isPollutedFieldValue("Unable to determine the root cause of the outage."),
    false,
  );
  assert.equal(isPollutedFieldValue("Could not be determined"), false);
  assert.equal(
    isPollutedFieldValue(
      "No relevant information is missing; this is the full answer.",
    ),
    false,
  );
});

test("AI meta-explanations remain polluted", () => {
  assert.equal(
    isPollutedFieldValue(
      "Not applicable - the user did not provide this information.",
    ),
    true,
  );
  assert.equal(
    isPollutedFieldValue("The input does not contain a usable date."),
    true,
  );
  assert.equal(
    isPollutedFieldValue("Unable to determine from the user input."),
    true,
  );
  assert.equal(
    isPollutedFieldValue(
      "Could not be determined from the provided information.",
    ),
    true,
  );
  assert.equal(
    isPollutedFieldValue("No relevant information in the user input."),
    true,
  );
});

test("mergeCapturedData stores legitimate sentinel-like respondent answers", () => {
  const capturedData = mergeCapturedData(
    {},
    {
      answer: "Unable to determine the root cause of the outage.",
      exception_reason: "Not applicable",
    },
    requiredAnswerSchema,
  );

  assert.deepEqual(capturedData, {
    answer: "Unable to determine the root cause of the outage.",
    exception_reason: "Not applicable",
  });
  assert.equal(areAllRequiredFieldsSatisfied(requiredAnswerSchema, capturedData), true);
});

test("mergeCapturedData still rejects AI extraction refusals", () => {
  const capturedData = mergeCapturedData(
    {},
    {
      answer: "Unable to determine from the user input.",
      exception_reason: "Not applicable - the user did not provide this information.",
    },
    requiredAnswerSchema,
  );

  assert.deepEqual(capturedData, {});
  assert.equal(areAllRequiredFieldsSatisfied(requiredAnswerSchema, capturedData), false);
});
