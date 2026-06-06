import assert from "node:assert/strict";
import test from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  getMissingFields,
  isFieldValuePresent,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
  type JsonValue,
  type TargetSchema,
} from "./target-schema";

const targetSchema: TargetSchema = {
  type: "object",
  required: ["email", "incident_summary"],
  properties: {
    email: {
      type: "string",
      description: "Respondent email address",
    },
    incident_summary: {
      type: "string",
      description: "Summary of the incident",
    },
  },
};

test("agent-skipped values do not satisfy required schema fields", () => {
  const agentSkipped = buildAgentSkippedFieldValue(
    "The field looked irrelevant based on prior context.",
  ) as unknown as JsonValue;
  const capturedData = {
    email: "person@example.com",
    incident_summary: agentSkipped,
  };

  assert.equal(isFieldValuePresent(agentSkipped), true);
  assert.equal(isFieldValuePresent(agentSkipped, { required: true }), false);
  assert.equal(areAllRequiredFieldsSatisfied(targetSchema, capturedData), false);
  assert.deepEqual(
    getMissingFields(targetSchema, capturedData).map((field) => field.key),
    ["incident_summary"],
  );
});

test("required field cleanup removes agent-skipped placeholders", () => {
  const agentSkipped = buildAgentSkippedFieldValue(
    "The field looked irrelevant based on prior context.",
  ) as unknown as JsonValue;

  assert.deepEqual(
    mergeCapturedData(
      { email: "person@example.com" },
      { incident_summary: agentSkipped },
      targetSchema,
    ),
    { email: "person@example.com" },
  );

  assert.deepEqual(
    stripInvalidRequiredFieldValues(targetSchema, {
      email: "person@example.com",
      incident_summary: agentSkipped,
    }),
    { email: "person@example.com" },
  );
});
