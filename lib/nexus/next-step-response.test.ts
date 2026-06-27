import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompletedResponse } from "@/lib/nexus/next-step-response";

const blueprint = {
  id: "blueprint_public_leak",
  label: "Example intake",
  targetSchema: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        description: "Your name",
      },
    },
  },
  toneProfile: {
    primary: "Neutral",
    style: "Concise",
  },
};

test("ordinary completed responses do not expose the blueprint id", () => {
  const response = createCompletedResponse(
    { name: "Ada" },
    [],
    { name: "Ada" },
    blueprint,
  );

  assert.equal(response.isCompleted, true);
  assert.equal("blueprintId" in response, false);
  assert.deepEqual(response.capturedData, { name: "Ada" });
  assert.equal(response.blueprintContext?.label, blueprint.label);
});
