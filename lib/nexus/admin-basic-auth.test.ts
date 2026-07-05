import assert from "node:assert/strict";
import test from "node:test";
import { validateAdminBasicAuthHeader } from "./admin-basic-auth.ts";

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

test("allows unconfigured admin auth outside production", () => {
  const result = validateAdminBasicAuthHeader(null, {
    NODE_ENV: "development",
  });

  assert.equal(result.authorized, true);
});

test("fails closed in production when admin auth is unconfigured", () => {
  const result = validateAdminBasicAuthHeader(null, {
    NODE_ENV: "production",
  });

  assert.equal(result.authorized, false);
  if (!result.authorized) {
    assert.equal(result.status, 503);
  }
});

test("fails closed when admin auth is partially configured", () => {
  const result = validateAdminBasicAuthHeader(null, {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
  });

  assert.equal(result.authorized, false);
  if (!result.authorized) {
    assert.equal(result.status, 503);
  }
});

test("rejects missing or malformed credentials when configured", () => {
  const env = {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "secret",
  };

  const missing = validateAdminBasicAuthHeader(null, env);
  const malformed = validateAdminBasicAuthHeader("Bearer token", env);
  const invalid = validateAdminBasicAuthHeader(basicAuth("admin", "wrong"), env);

  for (const result of [missing, malformed, invalid]) {
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.status, 401);
      assert.equal(
        result.headers["WWW-Authenticate"],
        'Basic realm="Fomu Nexus Admin", charset="UTF-8"',
      );
    }
  }
});

test("accepts configured admin credentials", () => {
  const result = validateAdminBasicAuthHeader(basicAuth("admin", "secret"), {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "secret",
  });

  assert.equal(result.authorized, true);
});

test("supports colons inside the configured password", () => {
  const result = validateAdminBasicAuthHeader(basicAuth("admin", "sec:ret"), {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "sec:ret",
  });

  assert.equal(result.authorized, true);
});
