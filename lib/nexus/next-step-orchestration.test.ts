import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveQuestionPromptAfterInjectionAttempt } from "./next-step-orchestration.ts";

describe("resolveQuestionPromptAfterInjectionAttempt", () => {
  it("keeps the model prompt when no injection was requested", () => {
    assert.equal(
      resolveQuestionPromptAfterInjectionAttempt({
        injectionRequested: false,
        injectionAccepted: false,
        modelQuestionPrompt: "What is your budget?",
        blueprintFieldFallback: "Please provide budget.",
      }),
      "What is your budget?",
    );
  });

  it("keeps the model prompt when injection is accepted", () => {
    assert.equal(
      resolveQuestionPromptAfterInjectionAttempt({
        injectionRequested: true,
        injectionAccepted: true,
        modelQuestionPrompt: "What remediation steps do you need?",
        blueprintFieldFallback: "Please provide budget.",
      }),
      "What remediation steps do you need?",
    );
  });

  it("falls back to the blueprint field prompt when injection is rejected", () => {
    assert.equal(
      resolveQuestionPromptAfterInjectionAttempt({
        injectionRequested: true,
        injectionAccepted: false,
        modelQuestionPrompt: "What remediation steps do you need?",
        blueprintFieldFallback: "Please provide budget.",
      }),
      "Please provide budget.",
    );
  });
});
