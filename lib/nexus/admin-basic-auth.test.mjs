import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeAdminRequest,
  isProtectedAdminPath,
} from "./admin-basic-auth.ts";

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("admin basic auth protection", () => {
  it("matches admin pages and privileged APIs only", () => {
    assert.equal(isProtectedAdminPath("/admin"), true);
    assert.equal(isProtectedAdminPath("/admin/blueprints"), true);
    assert.equal(isProtectedAdminPath("/api/nexus/analytics"), true);
    assert.equal(isProtectedAdminPath("/api/nexus/blueprints/form_123"), true);
    assert.equal(isProtectedAdminPath("/api/nexus/next-step"), false);
    assert.equal(isProtectedAdminPath("/form/session_123"), false);
  });

  it("allows local development when credentials are entirely absent", () => {
    const decision = authorizeAdminRequest({
      pathname: "/admin",
      authorizationHeader: null,
      env: {},
      nodeEnv: "development",
    });

    assert.equal(decision.allowed, true);
  });

  it("fails closed in production when credentials are missing", () => {
    const decision = authorizeAdminRequest({
      pathname: "/admin",
      authorizationHeader: null,
      env: {},
      nodeEnv: "production",
    });

    assert.deepEqual(decision, {
      allowed: false,
      status: 503,
      body: { error: "Admin authentication is not configured." },
      headers: {
        "Cache-Control": "no-store",
      },
    });
  });

  it("fails closed when only one credential is configured", () => {
    const decision = authorizeAdminRequest({
      pathname: "/api/nexus/blueprints",
      authorizationHeader: basicAuth("admin", "secret"),
      env: { FOMU_NEXUS_ADMIN_USER: "admin" },
      nodeEnv: "development",
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.status, 503);
  });

  it("rejects missing or incorrect credentials when configured", () => {
    const missingDecision = authorizeAdminRequest({
      pathname: "/api/nexus/analytics",
      authorizationHeader: null,
      env: {
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      },
      nodeEnv: "production",
    });
    const incorrectDecision = authorizeAdminRequest({
      pathname: "/api/nexus/analytics",
      authorizationHeader: basicAuth("admin", "wrong"),
      env: {
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      },
      nodeEnv: "production",
    });

    assert.equal(missingDecision.allowed, false);
    assert.equal(missingDecision.status, 401);
    assert.equal(incorrectDecision.allowed, false);
    assert.equal(incorrectDecision.status, 401);
  });

  it("accepts the configured admin credentials", () => {
    const decision = authorizeAdminRequest({
      pathname: "/api/nexus/start-session",
      authorizationHeader: basicAuth("admin", "secret"),
      env: {
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      },
      nodeEnv: "production",
    });

    assert.equal(decision.allowed, true);
  });
});
