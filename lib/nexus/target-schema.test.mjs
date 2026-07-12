import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areAllRequiredFieldsSatisfied,
  buildAgentSkippedFieldValue,
  getMissingFields,
  isFieldValuePresent,
  mergeCapturedData,
  stripInvalidRequiredFieldValues,
} from "./target-schema.ts";

const targetSchema = {
  type: "object",
  required: ["name"],
  properties: {
    name: {
      type: "string",
      description: "Respondent name",
    },
    nickname: {
      type: "string",
      description: "Optional nickname",
    },
  },
};

describe("required agent-skipped fields", () => {
  it("treats agent-skipped placeholders as missing for required fields", () => {
    const skipped = buildAgentSkippedFieldValue("Not relevant");

    assert.equal(isFieldValuePresent(skipped, { required: true }), false);
    assert.equal(isFieldValuePresent(skipped, { required: false }), true);
    assert.equal(
      areAllRequiredFieldsSatisfied(targetSchema, { name: skipped }),
      false,
    );
    assert.deepEqual(
      getMissingFields(targetSchema, { name: skipped }).map((field) => field.key),
      ["name"],
    );
  });

  it("does not merge agent-skipped placeholders into required fields", () => {
    const skipped = buildAgentSkippedFieldValue("Not relevant");
    const merged = mergeCapturedData({}, { name: skipped }, targetSchema);

    assert.deepEqual(merged, {});
  });

  it("strips legacy agent-skipped placeholders from required fields", () => {
    const skipped = buildAgentSkippedFieldValue("Not relevant");
    const cleaned = stripInvalidRequiredFieldValues(targetSchema, {
      name: skipped,
      nickname: skipped,
    });

    assert.deepEqual(cleaned, { nickname: skipped });
  });
});
