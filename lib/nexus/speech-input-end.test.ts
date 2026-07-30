import assert from "node:assert/strict";
import test from "node:test";
import { shouldSubmitSpeechOnEnd } from "@/lib/nexus/speech-input-end";

test("user-initiated stop with transcript should submit", () => {
  assert.equal(
    shouldSubmitSpeechOnEnd({
      ignoreNextEnd: false,
      transcript: "Alex Johnson",
    }),
    true,
  );
});

test("external stop while form is submitting must not resubmit", () => {
  assert.equal(
    shouldSubmitSpeechOnEnd({
      ignoreNextEnd: true,
      transcript: "Alex Johnson",
    }),
    false,
  );
});

test("empty transcript never submits", () => {
  assert.equal(
    shouldSubmitSpeechOnEnd({
      ignoreNextEnd: false,
      transcript: "   ",
    }),
    false,
  );
});
