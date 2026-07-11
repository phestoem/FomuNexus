import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAdminBasicAuth } from "./admin-basic-auth.ts";

function basic(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

describe("evaluateAdminBasicAuth", () => {
  it("allows unconfigured local development", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(null, {
        nodeEnv: "development",
        adminUser: undefined,
        adminPassword: undefined,
      }),
      { type: "allow", reason: "development-unconfigured" },
    );
  });

  it("fails closed when production credentials are missing", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(null, {
        nodeEnv: "production",
        adminUser: undefined,
        adminPassword: undefined,
      }),
      { type: "misconfigured", reason: "missing-credentials" },
    );
  });

  it("fails closed when only one credential is configured", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(null, {
        nodeEnv: "development",
        adminUser: "admin",
        adminPassword: undefined,
      }),
      { type: "misconfigured", reason: "partial-credentials" },
    );
  });

  it("denies missing, malformed, and incorrect credentials", () => {
    const environment = {
      nodeEnv: "production",
      adminUser: "admin",
      adminPassword: "secret",
    };

    assert.deepEqual(evaluateAdminBasicAuth(null, environment), {
      type: "deny",
      reason: "missing",
    });
    assert.deepEqual(evaluateAdminBasicAuth("Basic not-base64", environment), {
      type: "deny",
      reason: "missing",
    });
    assert.deepEqual(evaluateAdminBasicAuth(basic("admin", "wrong"), environment), {
      type: "deny",
      reason: "invalid",
    });
  });

  it("allows valid configured credentials", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(basic("admin", "secret"), {
        nodeEnv: "production",
        adminUser: "admin",
        adminPassword: "secret",
      }),
      { type: "allow", reason: "authenticated" },
    );
  });
});
