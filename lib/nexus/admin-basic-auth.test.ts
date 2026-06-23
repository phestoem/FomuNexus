import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdminAuthDecision } from "./admin-basic-auth";

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

describe("getAdminAuthDecision", () => {
  it("allows local development when admin credentials are absent", () => {
    assert.equal(
      getAdminAuthDecision(null, {
        NODE_ENV: "development",
      }),
      "disabled",
    );
  });

  it("fails closed in production when credentials are absent", () => {
    assert.equal(
      getAdminAuthDecision(null, {
        NODE_ENV: "production",
      }),
      "misconfigured",
    );
  });

  it("accepts matching basic auth credentials", () => {
    assert.equal(
      getAdminAuthDecision(basicAuth("admin", "correct:horse"), {
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "correct:horse",
        NODE_ENV: "production",
      }),
      "authorized",
    );
  });

  it("rejects malformed or incorrect credentials", () => {
    const env = {
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      NODE_ENV: "production",
    };

    assert.equal(getAdminAuthDecision("Bearer token", env), "unauthorized");
    assert.equal(
      getAdminAuthDecision(basicAuth("admin", "wrong"), env),
      "unauthorized",
    );
  });
});
