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
} from "@/lib/nexus/target-schema";

const schema: TargetSchema = {
  type: "object",
  required: ["server_id"],
  properties: {
    server_id: {
      type: "string",
      description: "Server asset identifier",
    },
  },
};

test("agent-skipped placeholders do not satisfy required fields", () => {
  const skippedValue = buildAgentSkippedFieldValue("Context made it seem irrelevant");

  assert.equal(isFieldValuePresent(skippedValue, { required: true }), false);
  assert.equal(areAllRequiredFieldsSatisfied(schema, { server_id: skippedValue }), false);
  assert.deepEqual(
    getMissingFields(schema, { server_id: skippedValue }).map((field) => field.key),
    ["server_id"],
  );
});

test("required agent-skipped placeholders are not merged into captured data", () => {
  const skippedValue = buildAgentSkippedFieldValue("Context made it seem irrelevant");

  assert.deepEqual(
    mergeCapturedData({}, { server_id: skippedValue }, schema),
    {},
  );
});

test("legacy required agent-skipped placeholders are stripped before completion", () => {
  const skippedValue = buildAgentSkippedFieldValue("Context made it seem irrelevant");

  assert.deepEqual(
    stripInvalidRequiredFieldValues(schema, { server_id: skippedValue }),
    {},
  );
});

test("agent-skipped placeholders can still satisfy non-required fields", () => {
  const skippedValue = buildAgentSkippedFieldValue("Not relevant to this respondent");

  assert.equal(isFieldValuePresent(skippedValue), true);
});
