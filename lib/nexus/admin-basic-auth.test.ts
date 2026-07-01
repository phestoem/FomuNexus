import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeAdminRequest } from "./admin-basic-auth.ts";

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

describe("authorizeAdminRequest", () => {
  it("allows local development when credentials are not configured", () => {
    const result = authorizeAdminRequest(null, {
      NODE_ENV: "development",
    });

    assert.deepEqual(result, { allowed: true });
  });

  it("fails closed in production when credentials are not configured", () => {
    const result = authorizeAdminRequest(null, {
      NODE_ENV: "production",
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.status, 503);
      assert.equal(result.challenge, false);
    }
  });

  it("fails closed when only one credential is configured", () => {
    const result = authorizeAdminRequest(null, {
      FOMU_NEXUS_ADMIN_USER: "admin",
      NODE_ENV: "development",
    });

    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.status, 503);
    }
  });

  it("rejects missing or incorrect credentials when configured", () => {
    const env = {
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "correct-password",
      NODE_ENV: "production",
    };

    assert.equal(authorizeAdminRequest(null, env).allowed, false);
    assert.equal(
      authorizeAdminRequest(basicAuth("admin", "wrong-password"), env).allowed,
      false,
    );
  });

  it("accepts matching credentials when configured", () => {
    const result = authorizeAdminRequest(basicAuth("admin", "secret:token"), {
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret:token",
      NODE_ENV: "production",
    });

    assert.deepEqual(result, { allowed: true });
  });
});

