import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminCredentialState,
  isAdminRequestAuthorized,
  isProtectedAdminPath,
  type AdminAuthEnv,
} from "./admin-basic-auth.ts";

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

test("protects admin and admin API paths only", () => {
  const protectedPaths = [
    "/admin",
    "/admin/new",
    "/api/mcp",
    "/api/nexus/analytics",
    "/api/nexus/blueprints",
    "/api/nexus/blueprints/abc123",
    "/api/nexus/create-blueprint",
    "/api/nexus/start-copilot",
    "/api/nexus/start-session",
    "/api/nexus/seed",
  ];

  const publicPaths = [
    "/",
    "/form/session123",
    "/api/nexus/next-step",
    "/api/nexus/restart-session",
    "/api/nexus/analytics-public",
    "/api/nexus/blueprints-public",
  ];

  for (const pathname of protectedPaths) {
    assert.equal(isProtectedAdminPath(pathname), true, pathname);
  }

  for (const pathname of publicPaths) {
    assert.equal(isProtectedAdminPath(pathname), false, pathname);
  }
});

test("opens local development when admin credentials are unset", () => {
  const env: AdminAuthEnv = { NODE_ENV: "development" };

  assert.deepEqual(getAdminCredentialState(env), {
    status: "open-development",
  });
  assert.equal(isAdminRequestAuthorized(null, env), true);
});

test("fails closed when credentials are missing in production", () => {
  const env: AdminAuthEnv = { NODE_ENV: "production" };

  assert.deepEqual(getAdminCredentialState(env), { status: "missing" });
  assert.equal(isAdminRequestAuthorized(null, env), false);
  assert.equal(isAdminRequestAuthorized(basicAuth("admin", "password"), env), false);
});

test("fails closed when only one credential is configured", () => {
  const usernameOnly: AdminAuthEnv = {
    NODE_ENV: "development",
    FOMU_NEXUS_ADMIN_USER: "admin",
  };
  const passwordOnly: AdminAuthEnv = {
    NODE_ENV: "development",
    FOMU_NEXUS_ADMIN_PASSWORD: "password",
  };

  assert.deepEqual(getAdminCredentialState(usernameOnly), { status: "missing" });
  assert.deepEqual(getAdminCredentialState(passwordOnly), { status: "missing" });
  assert.equal(isAdminRequestAuthorized(basicAuth("admin", "password"), usernameOnly), false);
  assert.equal(isAdminRequestAuthorized(basicAuth("admin", "password"), passwordOnly), false);
});

test("accepts only matching configured Basic Auth credentials", () => {
  const env: AdminAuthEnv = {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "p:a:s:s",
  };

  assert.equal(isAdminRequestAuthorized(null, env), false);
  assert.equal(isAdminRequestAuthorized("Bearer token", env), false);
  assert.equal(isAdminRequestAuthorized("Basic not-base64", env), false);
  assert.equal(isAdminRequestAuthorized(basicAuth("admin", "wrong"), env), false);
  assert.equal(isAdminRequestAuthorized(basicAuth("wrong", "p:a:s:s"), env), false);
  assert.equal(isAdminRequestAuthorized(basicAuth("admin", "p:a:s:s"), env), true);
});
