import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAdminBasicAuth,
  isAdminProtectedPath,
} from "./admin-basic-auth.ts";

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  )}`;
}

test("identifies admin and sensitive API paths", () => {
  assert.equal(isAdminProtectedPath("/admin"), true);
  assert.equal(isAdminProtectedPath("/admin/blueprints"), true);
  assert.equal(isAdminProtectedPath("/api/nexus/blueprints/abc"), true);
  assert.equal(isAdminProtectedPath("/api/nexus/analytics"), true);
  assert.equal(isAdminProtectedPath("/api/mcp"), true);
  assert.equal(isAdminProtectedPath("/form/session_123"), false);
  assert.equal(isAdminProtectedPath("/api/nexus/next-step"), false);
  assert.equal(isAdminProtectedPath("/api/nexus/restart-session"), false);
});

test("allows local development when no credentials are configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/admin",
      authorizationHeader: null,
      nodeEnv: "development",
      adminUser: undefined,
      adminPassword: undefined,
    }),
    { action: "allow" },
  );
});

test("fails closed in production when credentials are missing", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/api/nexus/blueprints",
      authorizationHeader: null,
      nodeEnv: "production",
      adminUser: undefined,
      adminPassword: undefined,
    }),
    {
      action: "unavailable",
      status: 503,
      message: "Admin credentials are not configured.",
    },
  );
});

test("fails closed when only one credential is configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/api/nexus/blueprints",
      authorizationHeader: null,
      nodeEnv: "production",
      adminUser: "admin",
      adminPassword: undefined,
    }),
    {
      action: "unavailable",
      status: 503,
      message: "Admin credentials are not configured.",
    },
  );
});

test("challenges protected requests with missing or invalid credentials", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/api/nexus/analytics",
      authorizationHeader: null,
      nodeEnv: "production",
      adminUser: "admin",
      adminPassword: "secret",
    }),
    { action: "challenge", status: 401, realm: "Fomu Nexus Admin" },
  );

  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/api/nexus/analytics",
      authorizationHeader: basic("admin", "wrong"),
      nodeEnv: "production",
      adminUser: "admin",
      adminPassword: "secret",
    }),
    { action: "challenge", status: 401, realm: "Fomu Nexus Admin" },
  );
});

test("allows protected requests with valid credentials", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/api/nexus/analytics",
      authorizationHeader: basic("admin", "secret"),
      nodeEnv: "production",
      adminUser: "admin",
      adminPassword: "secret",
    }),
    { action: "allow" },
  );
});

test("always allows unprotected public intake paths", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth({
      pathname: "/api/nexus/next-step",
      authorizationHeader: null,
      nodeEnv: "production",
      adminUser: undefined,
      adminPassword: undefined,
    }),
    { action: "allow" },
  );
});
