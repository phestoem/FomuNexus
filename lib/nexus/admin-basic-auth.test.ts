import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_PASSWORD_ENV,
  ADMIN_USER_ENV,
  evaluateAdminBasicAuth,
} from "./admin-basic-auth.ts";

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

describe("evaluateAdminBasicAuth", () => {
  it("allows local development when no admin credentials are configured", () => {
    assert.deepEqual(evaluateAdminBasicAuth(null, { NODE_ENV: "development" }), {
      kind: "allow",
    });
  });

  it("fails closed in production when credentials are missing", () => {
    assert.deepEqual(evaluateAdminBasicAuth(null, { NODE_ENV: "production" }), {
      kind: "misconfigured",
    });
  });

  it("fails closed when only one credential is configured", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(null, {
        NODE_ENV: "development",
        [ADMIN_USER_ENV]: "admin",
      }),
      { kind: "misconfigured" },
    );

    assert.deepEqual(
      evaluateAdminBasicAuth(null, {
        NODE_ENV: "development",
        [ADMIN_PASSWORD_ENV]: "secret",
      }),
      { kind: "misconfigured" },
    );
  });

  it("requires matching Basic Auth credentials when configured", () => {
    const env = {
      NODE_ENV: "production",
      [ADMIN_USER_ENV]: "admin",
      [ADMIN_PASSWORD_ENV]: "secret",
    };

    assert.deepEqual(evaluateAdminBasicAuth(null, env), {
      kind: "unauthorized",
    });
    assert.deepEqual(
      evaluateAdminBasicAuth(basicAuthHeader("admin", "wrong"), env),
      { kind: "unauthorized" },
    );
    assert.deepEqual(
      evaluateAdminBasicAuth(basicAuthHeader("admin", "secret"), env),
      { kind: "allow" },
    );
  });
});
