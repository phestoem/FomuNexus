import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
  properties: {
    incident_id: {
      type: "string",
      description: "Incident identifier",
    },
    follow_up_notes: {
      type: "string",
      description: "Optional follow-up notes",
    },
  },
  required: ["incident_id"],
};

describe("required-field agent skip handling", () => {
  it("does not treat an agent skip marker as a present required value", () => {
    const skippedValue = buildAgentSkippedFieldValue("Context says this is irrelevant.");

    assert.equal(isFieldValuePresent(skippedValue, { required: true }), false);
    assert.equal(isFieldValuePresent(skippedValue, { required: false }), true);
  });

  it("keeps required agent-skipped fields missing so sessions cannot complete", () => {
    const capturedData = {
      incident_id: buildAgentSkippedFieldValue("The user seemed frustrated."),
    };

    assert.deepEqual(
      getMissingFields(targetSchema, capturedData).map((field) => field.key),
      ["incident_id"],
    );
    assert.equal(areAllRequiredFieldsSatisfied(targetSchema, capturedData), false);
  });

  it("does not merge agent skip markers into required fields", () => {
    const merged = mergeCapturedData(
      {},
      {
        incident_id: buildAgentSkippedFieldValue("Context says this is irrelevant."),
        follow_up_notes: buildAgentSkippedFieldValue("No follow-up applies."),
      },
      targetSchema,
    );

    assert.equal("incident_id" in merged, false);
    assert.deepEqual(
      merged.follow_up_notes,
      buildAgentSkippedFieldValue("No follow-up applies."),
    );
  });

  it("strips previously stored required agent skip markers", () => {
    const cleaned = stripInvalidRequiredFieldValues(targetSchema, {
      incident_id: buildAgentSkippedFieldValue("Legacy skip marker."),
      follow_up_notes: buildAgentSkippedFieldValue("No follow-up applies."),
    });

    assert.equal("incident_id" in cleaned, false);
    assert.deepEqual(
      cleaned.follow_up_notes,
      buildAgentSkippedFieldValue("No follow-up applies."),
    );
  });
});
