import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  getMissingFields,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
  type TargetSchema,
} from "@/lib/nexus/target-schema";

const schema: TargetSchema = {
  type: "object",
  required: ["critical_answer"],
  properties: {
    critical_answer: {
      type: "string",
      description: "Critical answer",
    },
  },
};

test("agent-skipped values do not satisfy required schema fields", () => {
  const capturedData = {
    critical_answer: buildAgentSkippedFieldValue("Context suggested this was irrelevant."),
  };

  assert.equal(areAllRequiredFieldsSatisfied(schema, capturedData), false);
  assert.deepEqual(
    getMissingFields(schema, capturedData).map((field) => field.key),
    ["critical_answer"],
  );
});

test("required agent-skipped values are rejected during merge and cleanup", () => {
  const agentSkip = buildAgentSkippedFieldValue("Context suggested this was irrelevant.");

  assert.deepEqual(
    mergeCapturedData({}, { critical_answer: agentSkip }, schema),
    {},
  );

  assert.deepEqual(
    stripInvalidRequiredFieldValues(schema, { critical_answer: agentSkip }),
    {},
  );
});
