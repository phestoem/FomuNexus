import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { hasValidAdminCredentials, isProtectedAdminPath, proxy } from "./proxy.ts";

const ORIGINAL_ENV = {
  FOMU_NEXUS_ADMIN_USER: process.env.FOMU_NEXUS_ADMIN_USER,
  FOMU_NEXUS_ADMIN_PASSWORD: process.env.FOMU_NEXUS_ADMIN_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
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

function withEnv(env, callback) {
  restoreEnv();

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    restoreEnv();
  }
}

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function makeRequest(pathname, authorization) {
  const headers = new Headers();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new NextRequest(`https://example.test${pathname}`, { headers });
}

test("protects admin, analytics, blueprint, MCP, and creator management paths", () => {
  assert.equal(isProtectedAdminPath("/admin/blueprints"), true);
  assert.equal(isProtectedAdminPath("/api/nexus/analytics"), true);
  assert.equal(isProtectedAdminPath("/api/nexus/blueprints/form_123"), true);
  assert.equal(isProtectedAdminPath("/api/nexus/start-session"), true);
  assert.equal(isProtectedAdminPath("/api/mcp"), true);

  assert.equal(isProtectedAdminPath("/form/session_123"), false);
  assert.equal(isProtectedAdminPath("/api/nexus/next-step"), false);
  assert.equal(isProtectedAdminPath("/api/nexus/restart-session"), false);
});

test("rejects missing or invalid admin credentials on protected routes", () => {
  withEnv(
    {
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      NODE_ENV: "production",
    },
    () => {
      const missingResponse = proxy(makeRequest("/api/nexus/analytics"));
      assert.equal(missingResponse.status, 401);
      assert.match(
        missingResponse.headers.get("www-authenticate") ?? "",
        /^Basic /,
      );

      const invalidResponse = proxy(
        makeRequest("/admin/blueprints", basicAuth("admin", "wrong")),
      );
      assert.equal(invalidResponse.status, 401);
    },
  );
});

test("allows valid admin credentials on protected routes", () => {
  withEnv(
    {
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
      NODE_ENV: "production",
    },
    () => {
      const request = makeRequest(
        "/api/nexus/blueprints",
        basicAuth("admin", "secret"),
      );

      assert.equal(hasValidAdminCredentials(request), true);
      assert.equal(proxy(request).status, 200);
    },
  );
});

test("fails closed in production when admin credentials are not configured", () => {
  withEnv(
    {
      FOMU_NEXUS_ADMIN_USER: undefined,
      FOMU_NEXUS_ADMIN_PASSWORD: undefined,
      NODE_ENV: "production",
    },
    () => {
      assert.equal(proxy(makeRequest("/admin/blueprints")).status, 503);
    },
  );
});

test("keeps local development open when admin credentials are absent", () => {
  withEnv(
    {
      FOMU_NEXUS_ADMIN_USER: undefined,
      FOMU_NEXUS_ADMIN_PASSWORD: undefined,
      NODE_ENV: "development",
    },
    () => {
      assert.equal(proxy(makeRequest("/admin/blueprints")).status, 200);
    },
  );
});
