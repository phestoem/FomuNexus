import assert from "node:assert/strict";
import test from "node:test";
import {
  applySessionRevisionWrite,
  SessionWriteConflictError,
} from "./session-write-guard.ts";

test("advances the revision after exactly one session row is updated", async () => {
  let writes = 0;

  const revision = await applySessionRevisionWrite(4, async () => {
    writes += 1;
    return { count: 1 };
  });

  assert.equal(writes, 1);
  assert.equal(revision, 5);
});

test("rejects a stale write that no longer matches a session row", async () => {
  await assert.rejects(
    applySessionRevisionWrite(4, async () => ({ count: 0 })),
    SessionWriteConflictError,
  );
});
