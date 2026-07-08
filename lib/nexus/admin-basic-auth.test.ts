import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_AUTH_REALM, authorizeAdminRequest } from "./admin-basic-auth.ts";

function authorizationHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

test("allows local development when admin credentials are absent", () => {
  const result = authorizeAdminRequest(new Headers(), { NODE_ENV: "development" });

  assert.equal(result.ok, true);
});

test("fails closed in production when admin credentials are absent", () => {
  const result = authorizeAdminRequest(new Headers(), { NODE_ENV: "production" });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 503);
    assert.match(result.message, /not configured/i);
  }
});

test("fails closed when only one admin credential is configured", () => {
  const result = authorizeAdminRequest(new Headers(), {
    NODE_ENV: "development",
    FOMU_NEXUS_ADMIN_USER: "admin",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 503);
    assert.match(result.message, /partially configured/i);
  }
});

test("requires Basic Auth when admin credentials are configured", () => {
  const result = authorizeAdminRequest(new Headers(), {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "correct-password",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
    assert.equal(
      result.headers["WWW-Authenticate"],
      `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    );
  }
});

test("rejects invalid Basic Auth credentials", () => {
  const headers = new Headers({
    authorization: authorizationHeader("admin", "wrong-password"),
  });

  const result = authorizeAdminRequest(headers, {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "correct-password",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
  }
});

test("accepts valid Basic Auth credentials", () => {
  const headers = new Headers({
    authorization: authorizationHeader("admin", "correct-password"),
  });

  const result = authorizeAdminRequest(headers, {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "correct-password",
  });

  assert.equal(result.ok, true);
});

test("supports passwords containing colons", () => {
  const headers = new Headers({
    authorization: authorizationHeader("admin", "pa:ss:word"),
  });

  const result = authorizeAdminRequest(headers, {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "pa:ss:word",
  });

  assert.equal(result.ok, true);
});
