import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdminBasicAuth } from "./admin-basic-auth.ts";

function headers(authorization?: string): Headers {
  const result = new Headers();

  if (authorization) {
    result.set("authorization", authorization);
  }

  return result;
}

function basic(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

test("allows local development when admin credentials are not configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      headers: headers(),
      nodeEnv: "development",
    }),
    { allowed: true },
  );
});

test("fails closed in production when admin credentials are not configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      headers: headers(),
      nodeEnv: "production",
    }),
    {
      allowed: false,
      status: 503,
      error: "Admin authentication is not configured.",
    },
  );
});

test("fails closed when only one admin credential is configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      headers: headers(),
      username: "admin",
      nodeEnv: "development",
    }),
    {
      allowed: false,
      status: 503,
      error: "Admin authentication is misconfigured.",
    },
  );
});

test("challenges requests without valid Basic credentials", () => {
  const decision = evaluateAdminBasicAuth({
    headers: headers(basic("admin", "wrong")),
    username: "admin",
    password: "correct",
    nodeEnv: "production",
  });

  assert.equal(decision.allowed, false);

  if (!decision.allowed) {
    assert.equal(decision.status, 401);
    assert.equal(decision.challenge, 'Basic realm="Fomu Nexus Admin", charset="UTF-8"');
  }
});

test("allows requests with matching Basic credentials", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      headers: headers(basic("admin", "correct")),
      username: "admin",
      password: "correct",
      nodeEnv: "production",
    }),
    { allowed: true },
  );
});
