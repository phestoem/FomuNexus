import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldApplyIntakeResponse } from "./intake-session-client.ts";

describe("shouldApplyIntakeResponse", () => {
  it("accepts responses from the active session generation", () => {
    assert.equal(shouldApplyIntakeResponse(3, 3), true);
  });

  it("rejects stale responses after the session binding advances", () => {
    assert.equal(shouldApplyIntakeResponse(2, 3), false);
    assert.equal(shouldApplyIntakeResponse(3, 2), false);
  });
});
