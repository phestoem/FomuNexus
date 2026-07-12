import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBasicAuthChallengeHeaders,
  evaluateAdminBasicAuth,
} from "./admin-basic-auth.ts";

function basic(username, password) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

describe("evaluateAdminBasicAuth", () => {
  it("allows local development only when both credentials are absent", () => {
    assert.deepEqual(evaluateAdminBasicAuth(null, { NODE_ENV: "development" }), {
      status: "open-dev",
    });
  });

  it("fails closed in production when credentials are absent", () => {
    assert.deepEqual(evaluateAdminBasicAuth(null, { NODE_ENV: "production" }), {
      status: "misconfigured",
    });
  });

  it("fails closed when only one credential is configured", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(null, {
        NODE_ENV: "development",
        FOMU_NEXUS_ADMIN_USER: "admin",
      }),
      { status: "misconfigured" },
    );
  });

  it("authorizes matching Basic credentials", () => {
    assert.deepEqual(
      evaluateAdminBasicAuth(basic("admin", "secret"), {
        NODE_ENV: "production",
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      }),
      { status: "authorized" },
    );
  });

  it("rejects missing, malformed, and incorrect credentials", () => {
    const env = {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
    };

    assert.deepEqual(evaluateAdminBasicAuth(null, env), {
      status: "unauthorized",
    });
    assert.deepEqual(evaluateAdminBasicAuth("Basic not-base64", env), {
      status: "unauthorized",
    });
    assert.deepEqual(evaluateAdminBasicAuth(basic("admin", "wrong"), env), {
      status: "unauthorized",
    });
  });
});

describe("buildBasicAuthChallengeHeaders", () => {
  it("sets a Basic challenge and disables caching", () => {
    const headers = buildBasicAuthChallengeHeaders();

    assert.equal(
      headers.get("WWW-Authenticate"),
      'Basic realm="Fomu Nexus Admin"',
    );
    assert.equal(headers.get("Cache-Control"), "no-store");
  });
});
