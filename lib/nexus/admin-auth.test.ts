import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminAuthResponse,
  validateAdminBasicAuth,
  type AdminAuthDecision,
} from "./admin-auth";

function requestWithAuthorization(
  authorization?: string,
): Pick<Request, "headers"> {
  const headers = new Headers();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  return { headers };
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  )}`;
}

function assertRejected(
  decision: AdminAuthDecision,
): asserts decision is Extract<AdminAuthDecision, { ok: false }> {
  assert.equal(decision.ok, false);
}

test("admin auth is open in local development when credentials are absent", () => {
  const decision = validateAdminBasicAuth(requestWithAuthorization(), {
    NODE_ENV: "development",
  });

  assert.deepEqual(decision, { ok: true });
});

test("admin auth fails closed in production when credentials are absent", () => {
  const decision = validateAdminBasicAuth(requestWithAuthorization(), {
    NODE_ENV: "production",
  });

  assertRejected(decision);
  assert.equal(decision.status, 503);
});

test("admin auth fails closed when credentials are partially configured", () => {
  const decision = validateAdminBasicAuth(requestWithAuthorization(), {
    NODE_ENV: "development",
    FOMU_NEXUS_ADMIN_USER: "admin",
  });

  assertRejected(decision);
  assert.equal(decision.status, 503);
});

test("admin auth requires a Basic authorization header when configured", () => {
  const decision = validateAdminBasicAuth(requestWithAuthorization(), {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "secret",
  });

  assertRejected(decision);
  assert.equal(decision.status, 401);
});

test("admin auth rejects invalid Basic credentials", () => {
  const decision = validateAdminBasicAuth(
    requestWithAuthorization(basicAuthorization("admin", "wrong")),
    {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
    },
  );

  assertRejected(decision);
  assert.equal(decision.status, 401);
});

test("admin auth accepts matching Basic credentials", () => {
  const decision = validateAdminBasicAuth(
    requestWithAuthorization(basicAuthorization("admin", "secret")),
    {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
    },
  );

  assert.deepEqual(decision, { ok: true });
});

test("admin auth challenge responses include a Basic realm", () => {
  const response = createAdminAuthResponse({
    ok: false,
    status: 401,
    error: "Admin authentication is required.",
  });

  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") ?? "", /^Basic /);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
