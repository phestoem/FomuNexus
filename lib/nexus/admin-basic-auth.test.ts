import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getConfiguredAdminCredentials,
  isProductionEnvironment,
  isValidBasicAuthorization,
} from "./admin-basic-auth";

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  )}`;
}

describe("admin basic auth helpers", () => {
  it("requires both configured admin credential values", () => {
    assert.equal(getConfiguredAdminCredentials({}), null);
    assert.equal(
      getConfiguredAdminCredentials({
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "   ",
      }),
      null,
    );
    assert.deepEqual(
      getConfiguredAdminCredentials({
        FOMU_NEXUS_ADMIN_USER: "admin",
        FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      }),
      { username: "admin", password: "secret" },
    );
  });

  it("accepts only matching Basic credentials", () => {
    const credentials = { username: "admin", password: "secret" };

    assert.equal(
      isValidBasicAuthorization(basicAuthorization("admin", "secret"), credentials),
      true,
    );
    assert.equal(
      isValidBasicAuthorization(basicAuthorization("admin", "wrong"), credentials),
      false,
    );
    assert.equal(
      isValidBasicAuthorization(`Bearer ${basicAuthorization("admin", "secret")}`, credentials),
      false,
    );
    assert.equal(isValidBasicAuthorization("Basic not-base64", credentials), false);
    assert.equal(isValidBasicAuthorization(null, credentials), false);
  });

  it("allows colons in the password portion", () => {
    assert.equal(
      isValidBasicAuthorization(basicAuthorization("admin", "one:two"), {
        username: "admin",
        password: "one:two",
      }),
      true,
    );
  });

  it("detects production mode exactly", () => {
    assert.equal(isProductionEnvironment({ NODE_ENV: "production" }), true);
    assert.equal(isProductionEnvironment({ NODE_ENV: "development" }), false);
    assert.equal(isProductionEnvironment({}), false);
  });
});
