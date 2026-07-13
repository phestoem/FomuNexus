import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_AUTH_PASSWORD_ENV,
  ADMIN_AUTH_USER_ENV,
  evaluateAdminBasicAuth,
} from "./admin-basic-auth.ts";

function env(
  values: Partial<
    Record<
      typeof ADMIN_AUTH_USER_ENV | typeof ADMIN_AUTH_PASSWORD_ENV | "NODE_ENV",
      string
    >
  >,
) {
  return {
    NODE_ENV: values.NODE_ENV,
    [ADMIN_AUTH_USER_ENV]: values[ADMIN_AUTH_USER_ENV],
    [ADMIN_AUTH_PASSWORD_ENV]: values[ADMIN_AUTH_PASSWORD_ENV],
  };
}

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("admin auth is disabled only for unconfigured non-production environments", () => {
  assert.deepEqual(evaluateAdminBasicAuth(null, env({ NODE_ENV: "development" })), {
    kind: "disabled",
  });
  assert.deepEqual(evaluateAdminBasicAuth(null, env({ NODE_ENV: "production" })), {
    kind: "unavailable",
  });
});

test("admin auth fails closed when credentials are partially configured", () => {
  assert.deepEqual(
    evaluateAdminBasicAuth(
      null,
      env({ NODE_ENV: "development", [ADMIN_AUTH_USER_ENV]: "admin" }),
    ),
    { kind: "unavailable" },
  );
});

test("admin auth accepts only matching Basic credentials", () => {
  const configured = env({
    NODE_ENV: "production",
    [ADMIN_AUTH_USER_ENV]: "admin",
    [ADMIN_AUTH_PASSWORD_ENV]: "correct-password",
  });

  assert.deepEqual(evaluateAdminBasicAuth(null, configured), {
    kind: "unauthorized",
  });
  assert.deepEqual(
    evaluateAdminBasicAuth(basic("admin", "wrong-password"), configured),
    { kind: "unauthorized" },
  );
  assert.deepEqual(
    evaluateAdminBasicAuth(basic("admin", "correct-password"), configured),
    { kind: "authorized" },
  );
});
