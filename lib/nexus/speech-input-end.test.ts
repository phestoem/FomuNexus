import assert from "node:assert/strict";
import test from "node:test";
import { shouldSubmitSpeechOnEnd } from "@/lib/nexus/speech-input-end";

test("user-initiated stop with transcript should submit", () => {
  assert.equal(
    shouldSubmitSpeechOnEnd({
      recognitionFailed: false,
      transcript: "Alex Johnson",
    }),
    true,
  );
});

test("recognition error must not auto-submit a partial transcript", () => {
  assert.equal(
    shouldSubmitSpeechOnEnd({
      recognitionFailed: true,
      transcript: "Alex",
    }),
    false,
  );
});

test("empty transcript never submits", () => {
  assert.equal(
    shouldSubmitSpeechOnEnd({
      recognitionFailed: false,
      transcript: "   ",
    }),
    false,
  );
});
