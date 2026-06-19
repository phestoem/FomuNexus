import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PASSWORD_ENV,
  ADMIN_USER_ENV,
  getAdminAuthDecision,
  parseBasicAuthHeader,
} from "./admin-basic-auth";

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("parseBasicAuthHeader decodes valid Basic credentials", () => {
  assert.deepEqual(parseBasicAuthHeader(basic("admin", "secret:with-colon")), {
    username: "admin",
    password: "secret:with-colon",
  });
});

test("parseBasicAuthHeader rejects missing or malformed credentials", () => {
  assert.equal(parseBasicAuthHeader(null), null);
  assert.equal(parseBasicAuthHeader("Bearer token"), null);
  assert.equal(
    parseBasicAuthHeader(`Basic ${Buffer.from("missing-separator").toString("base64")}`),
    null,
  );
});

test("getAdminAuthDecision bypasses local development when credentials are unset", () => {
  assert.deepEqual(getAdminAuthDecision(null, { NODE_ENV: "development" }), {
    authorized: true,
    bypassed: true,
  });
});

test("getAdminAuthDecision fails closed in production when credentials are unset", () => {
  assert.deepEqual(getAdminAuthDecision(null, { NODE_ENV: "production" }), {
    authorized: false,
    status: 503,
    message: "Admin authentication is not configured.",
  });
});

test("getAdminAuthDecision fails closed when only one credential is configured", () => {
  assert.deepEqual(
    getAdminAuthDecision(null, {
      NODE_ENV: "development",
      [ADMIN_USER_ENV]: "admin",
    }),
    {
      authorized: false,
      status: 503,
      message: "Admin authentication is not configured.",
    },
  );

  assert.deepEqual(
    getAdminAuthDecision(null, {
      NODE_ENV: "development",
      [ADMIN_PASSWORD_ENV]: "secret",
    }),
    {
      authorized: false,
      status: 503,
      message: "Admin authentication is not configured.",
    },
  );
});

test("getAdminAuthDecision rejects missing and incorrect credentials", () => {
  const env = {
    NODE_ENV: "production",
    [ADMIN_USER_ENV]: "admin",
    [ADMIN_PASSWORD_ENV]: "secret",
  };

  assert.deepEqual(getAdminAuthDecision(null, env), {
    authorized: false,
    status: 401,
    message: "Authentication required.",
  });

  assert.deepEqual(getAdminAuthDecision(basic("admin", "wrong"), env), {
    authorized: false,
    status: 401,
    message: "Authentication required.",
  });
});

test("getAdminAuthDecision accepts matching configured credentials", () => {
  assert.deepEqual(
    getAdminAuthDecision(basic("admin", "secret"), {
      NODE_ENV: "production",
      [ADMIN_USER_ENV]: "admin",
      [ADMIN_PASSWORD_ENV]: "secret",
    }),
    {
      authorized: true,
      bypassed: false,
    },
  );
});
