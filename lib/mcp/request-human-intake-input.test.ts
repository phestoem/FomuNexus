import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRequestHumanIntakeInput,
  requestHumanIntakeInputSchema,
} from "@/lib/mcp/request-human-intake-input";

test("schema accepts sessionId-only poll arguments", () => {
  const parsed = requestHumanIntakeInputSchema.safeParse({
    sessionId: "session_123",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parseRequestHumanIntakeInput(parsed.data), {
      mode: "poll",
      sessionId: "session_123",
    });
  }
});

test("schema accepts create arguments without sessionId", () => {
  const parsed = requestHumanIntakeInputSchema.safeParse({
    formTitle: "Facility intake",
    roughIntakeGoal: "Collect access constraints for the site visit.",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parseRequestHumanIntakeInput(parsed.data), {
      mode: "create",
      formTitle: "Facility intake",
      roughIntakeGoal: "Collect access constraints for the site visit.",
    });
  }
});

test("create mode requires both formTitle and roughIntakeGoal", () => {
  const parsed = requestHumanIntakeInputSchema.safeParse({
    formTitle: "Facility intake",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parseRequestHumanIntakeInput(parsed.data), {
      mode: "invalid",
      error:
        "Provide formTitle and roughIntakeGoal to create an intake, or sessionId to poll an existing session.",
    });
  }
});

test("sessionId wins when create fields are also present", () => {
  assert.deepEqual(
    parseRequestHumanIntakeInput({
      formTitle: "Facility intake",
      roughIntakeGoal: "Collect access constraints for the site visit.",
      sessionId: "session_123",
    }),
    { mode: "poll", sessionId: "session_123" },
  );
});
