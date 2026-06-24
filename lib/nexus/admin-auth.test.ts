import assert from "node:assert/strict";
import test from "node:test";
import {
  hasAdminAuthCredentials,
  isValidAdminAuthorization,
  shouldEnforceAdminAuth,
  shouldProtectAdminPath,
} from "@/lib/nexus/admin-auth";

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

test("protects admin and sensitive Nexus API routes", () => {
  assert.equal(shouldProtectAdminPath("/admin"), true);
  assert.equal(shouldProtectAdminPath("/admin/blueprints"), true);
  assert.equal(shouldProtectAdminPath("/api/nexus/analytics"), true);
  assert.equal(shouldProtectAdminPath("/api/nexus/blueprints/form_123"), true);
  assert.equal(shouldProtectAdminPath("/api/mcp"), true);

  assert.equal(shouldProtectAdminPath("/form/session_123"), false);
  assert.equal(shouldProtectAdminPath("/api/nexus/next-step"), false);
  assert.equal(shouldProtectAdminPath("/api/nexus/start-session"), false);
});

test("requires credentials in production and when partially configured", () => {
  assert.equal(
    shouldEnforceAdminAuth({
      NODE_ENV: "production",
    }),
    true,
  );
  assert.equal(
    shouldEnforceAdminAuth({
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    shouldEnforceAdminAuth({
      NODE_ENV: "development",
      FOMU_NEXUS_ADMIN_USER: "admin",
    }),
    true,
  );
});

test("detects complete admin auth credentials", () => {
  assert.equal(
    hasAdminAuthCredentials({
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
    }),
    true,
  );
  assert.equal(
    hasAdminAuthCredentials({
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
    }),
    false,
  );
});

test("validates Basic Auth credentials exactly", () => {
  const env = {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "secret",
  };

  assert.equal(isValidAdminAuthorization(basicAuth("admin", "secret"), env), true);
  assert.equal(isValidAdminAuthorization(basicAuth("admin", "wrong"), env), false);
  assert.equal(isValidAdminAuthorization("Bearer token", env), false);
  assert.equal(isValidAdminAuthorization("Basic not-base64", env), false);
});
