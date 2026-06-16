import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseBasicAuthHeader,
  resolveAdminAuthState,
  validateAdminBasicAuth,
} from "./admin-basic-auth";

function basicAuthHeader(credentials: string): string {
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

describe("admin Basic Auth", () => {
  it("is disabled outside production when credentials are not configured", () => {
    assert.deepEqual(resolveAdminAuthState({ NODE_ENV: "development" }), {
      mode: "disabled",
    });
  });

  it("fails closed in production when credentials are not configured", () => {
    assert.deepEqual(resolveAdminAuthState({ NODE_ENV: "production" }), {
      mode: "misconfigured",
    });
  });

  it("requires both configured credentials", () => {
    assert.deepEqual(
      resolveAdminAuthState({
        NODE_ENV: "production",
        FOMU_NEXUS_ADMIN_USER: "admin",
      }),
      { mode: "misconfigured" },
    );
  });

  it("parses Basic credentials and preserves colons in the password", () => {
    assert.deepEqual(parseBasicAuthHeader(basicAuthHeader("admin:p:a:s:s")), {
      username: "admin",
      password: "p:a:s:s",
    });
  });

  it("rejects missing or invalid credentials when auth is enabled", () => {
    const authState = {
      mode: "enabled" as const,
      username: "admin",
      password: "secret",
    };

    assert.deepEqual(validateAdminBasicAuth(null, authState), {
      ok: false,
      reason: "invalid_credentials",
    });
    assert.deepEqual(
      validateAdminBasicAuth(basicAuthHeader("admin:wrong"), authState),
      {
        ok: false,
        reason: "invalid_credentials",
      },
    );
  });

  it("accepts matching credentials when auth is enabled", () => {
    assert.deepEqual(
      validateAdminBasicAuth(basicAuthHeader("admin:secret"), {
        mode: "enabled",
        username: "admin",
        password: "secret",
      }),
      { ok: true },
    );
  });
});
