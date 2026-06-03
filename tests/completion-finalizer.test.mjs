import assert from "node:assert/strict";
import test from "node:test";
import { finalizeSessionCompletion } from "../lib/nexus/completion-finalizer.ts";

test("finalizeSessionCompletion returns the completed response after successful post-processing", async () => {
  const capturedData = { response: "complete" };
  const events = [];

  const response = await finalizeSessionCompletion({
    capturedData,
    markCompleted: async (data) => {
      events.push(["completed", data]);
    },
    restoreActive: async (data) => {
      events.push(["active", data]);
    },
    buildResponse: async () => ({ isCompleted: true }),
  });

  assert.deepEqual(response, { isCompleted: true });
  assert.deepEqual(events, [["completed", capturedData]]);
});

test("finalizeSessionCompletion restores active state when post-processing fails", async () => {
  const capturedData = { response: "complete" };
  const completionError = new Error("post-processing failed");
  const events = [];
  const completionErrors = [];
  const rollbackErrors = [];

  await assert.rejects(
    finalizeSessionCompletion({
      capturedData,
      markCompleted: async (data) => {
        events.push(["completed", data]);
      },
      restoreActive: async (data) => {
        events.push(["active", data]);
      },
      buildResponse: async () => {
        throw completionError;
      },
      onCompletionError: (error) => {
        completionErrors.push(error);
      },
      onRollbackError: (error) => {
        rollbackErrors.push(error);
      },
    }),
    completionError,
  );

  assert.deepEqual(events, [
    ["completed", capturedData],
    ["active", capturedData],
  ]);
  assert.deepEqual(completionErrors, [completionError]);
  assert.deepEqual(rollbackErrors, []);
});
