import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdminBasicAuth } from "./admin-basic-auth.ts";

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("allows local development when admin credentials are not configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth(null, { NODE_ENV: "development" }),
    { ok: true },
  );
});

test("fails closed in production when admin credentials are not configured", () => {
  const result = evaluateAdminBasicAuth(null, { NODE_ENV: "production" });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("fails closed when only one admin credential is configured", () => {
  const result = evaluateAdminBasicAuth(null, {
    NODE_ENV: "development",
    FOMU_NEXUS_ADMIN_USER: "admin",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("challenges requests without valid basic credentials", () => {
  const environment = {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "correct-password",
  };

  const missingResult = evaluateAdminBasicAuth(null, environment);
  const wrongResult = evaluateAdminBasicAuth(
    basicAuthorization("admin", "wrong-password"),
    environment,
  );

  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.status, 401);
  assert.match(
    missingResult.headers["WWW-Authenticate"],
    /^Basic realm="Fomu Nexus Admin"/,
  );
  assert.equal(wrongResult.ok, false);
  assert.equal(wrongResult.status, 401);
});

test("allows requests with matching basic credentials", () => {
  const result = evaluateAdminBasicAuth(
    basicAuthorization("admin", "correct:password"),
    {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "correct:password",
    },
  );

  assert.deepEqual(result, { ok: true });
});
