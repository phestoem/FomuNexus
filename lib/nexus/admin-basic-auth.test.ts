import assert from "node:assert/strict";
import test from "node:test";
import { authenticateAdminRequest } from "./admin-basic-auth";

function basicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  )}`;
}

test("allows local development when admin credentials are not configured", () => {
  assert.deepEqual(
    authenticateAdminRequest(null, {
      NODE_ENV: "development",
    }),
    { authorized: true },
  );
});

test("fails closed in production when admin credentials are missing", () => {
  assert.deepEqual(
    authenticateAdminRequest(null, {
      NODE_ENV: "production",
    }),
    {
      authorized: false,
      status: 503,
      message: "Admin authentication is not configured.",
    },
  );
});

test("accepts matching admin basic auth credentials", () => {
  assert.deepEqual(
    authenticateAdminRequest(basicAuth("admin", "correct horse"), {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "correct horse",
    }),
    { authorized: true },
  );
});

test("rejects invalid admin basic auth credentials", () => {
  const decision = authenticateAdminRequest(basicAuth("admin", "wrong"), {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "correct horse",
  });

  assert.equal(decision.authorized, false);
  if (!decision.authorized) {
    assert.equal(decision.status, 401);
    assert.equal(decision.message, "Authentication required.");
    assert.match(decision.wwwAuthenticate ?? "", /^Basic realm=/);
  }
});
