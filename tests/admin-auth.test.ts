import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { validateAdminRequest } from "../lib/nexus/admin-auth.ts";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  FOMU_NEXUS_ADMIN_USERNAME: process.env.FOMU_NEXUS_ADMIN_USERNAME,
  FOMU_NEXUS_ADMIN_PASSWORD: process.env.FOMU_NEXUS_ADMIN_PASSWORD,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function resetAdminEnv() {
  delete process.env.FOMU_NEXUS_ADMIN_USERNAME;
  delete process.env.FOMU_NEXUS_ADMIN_PASSWORD;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

afterEach(restoreEnv);

test("allows local development when no admin password is configured", () => {
  resetAdminEnv();
  process.env.NODE_ENV = "development";

  const response = validateAdminRequest(
    new Request("http://localhost/admin/blueprints"),
  );

  assert.equal(response, null);
});

test("fails closed in production when no admin password is configured", async () => {
  resetAdminEnv();
  process.env.NODE_ENV = "production";

  const response = validateAdminRequest(
    new Request("https://example.com/api/nexus/analytics"),
  );

  assert.ok(response);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("www-authenticate"), null);
  assert.deepEqual(await response.json(), {
    error: "Admin authentication is not configured.",
  });
});

test("challenges requests when an admin password is configured", async () => {
  resetAdminEnv();
  process.env.NODE_ENV = "production";
  process.env.FOMU_NEXUS_ADMIN_PASSWORD = "correct-horse-battery-staple";

  const response = validateAdminRequest(
    new Request("https://example.com/api/nexus/blueprints"),
  );

  assert.ok(response);
  assert.equal(response.status, 401);
  assert.equal(
    response.headers.get("www-authenticate"),
    'Basic realm="Fomu Nexus Admin"',
  );
  assert.deepEqual(await response.json(), {
    error: "Admin authentication required.",
  });
});

test("accepts valid configured credentials", () => {
  resetAdminEnv();
  process.env.NODE_ENV = "production";
  process.env.FOMU_NEXUS_ADMIN_USERNAME = "owner";
  process.env.FOMU_NEXUS_ADMIN_PASSWORD = "correct-horse-battery-staple";

  const response = validateAdminRequest(
    new Request("https://example.com/admin/new", {
      headers: {
        authorization: basicAuth("owner", "correct-horse-battery-staple"),
      },
    }),
  );

  assert.equal(response, null);
});

test("rejects invalid credentials", () => {
  resetAdminEnv();
  process.env.NODE_ENV = "production";
  process.env.FOMU_NEXUS_ADMIN_USERNAME = "owner";
  process.env.FOMU_NEXUS_ADMIN_PASSWORD = "correct-horse-battery-staple";

  const response = validateAdminRequest(
    new Request("https://example.com/admin/new", {
      headers: {
        authorization: basicAuth("owner", "wrong-password"),
      },
    }),
  );

  assert.ok(response);
  assert.equal(response.status, 401);
});
