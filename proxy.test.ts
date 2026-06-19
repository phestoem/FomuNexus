import assert from "node:assert/strict";
import test from "node:test";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import {
  ADMIN_AUTH_REALM,
  ADMIN_PASSWORD_ENV,
  ADMIN_USER_ENV,
} from "@/lib/nexus/admin-basic-auth";
import { config, proxy } from "./proxy";

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

async function withEnvironment(
  values: Record<string, string | undefined>,
  callback: () => Promise<void> | void,
) {
  const keys = new Set([
    "NODE_ENV",
    ADMIN_USER_ENV,
    ADMIN_PASSWORD_ENV,
    ...Object.keys(values),
  ]);
  const previous = new Map<string, string | undefined>();

  for (const key of keys) {
    previous.set(key, process.env[key]);
    const nextValue = values[key];
    if (nextValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = nextValue;
    }
  }

  try {
    await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function doesProxyMatch(url: string): boolean {
  return unstable_doesProxyMatch({
    config,
    nextConfig: {},
    url,
  });
}

test("proxy matcher covers admin and privileged control/data endpoints", () => {
  assert.equal(doesProxyMatch("/admin"), true);
  assert.equal(doesProxyMatch("/admin/blueprints/form-id/analytics"), true);
  assert.equal(doesProxyMatch("/api/mcp"), true);
  assert.equal(doesProxyMatch("/api/nexus/analytics"), true);
  assert.equal(doesProxyMatch("/api/nexus/blueprints"), true);
  assert.equal(doesProxyMatch("/api/nexus/blueprints/form-id"), true);
  assert.equal(doesProxyMatch("/api/nexus/create-blueprint"), true);
  assert.equal(doesProxyMatch("/api/nexus/seed"), true);
  assert.equal(doesProxyMatch("/api/nexus/start-copilot"), true);
});

test("proxy matcher leaves public respondent endpoints open", () => {
  assert.equal(doesProxyMatch("/"), false);
  assert.equal(doesProxyMatch("/form/session-id"), false);
  assert.equal(doesProxyMatch("/api/nexus/next-step"), false);
  assert.equal(doesProxyMatch("/api/nexus/restart-session"), false);
  assert.equal(doesProxyMatch("/api/nexus/start-session"), false);
});

test("proxy challenges protected requests when credentials are configured", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      [ADMIN_USER_ENV]: "admin",
      [ADMIN_PASSWORD_ENV]: "secret",
    },
    () => {
      const response = proxy(new NextRequest("https://example.com/admin"));

      assert.equal(response.status, 401);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(
        response.headers.get("WWW-Authenticate"),
        `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
      );
    },
  );
});

test("proxy accepts matching Basic credentials", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      [ADMIN_USER_ENV]: "admin",
      [ADMIN_PASSWORD_ENV]: "secret",
    },
    () => {
      const request = new NextRequest("https://example.com/admin", {
        headers: {
          authorization: basic("admin", "secret"),
        },
      });
      const response = proxy(request);

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("WWW-Authenticate"), null);
    },
  );
});

test("proxy fails closed in production when credentials are missing", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      [ADMIN_USER_ENV]: undefined,
      [ADMIN_PASSWORD_ENV]: undefined,
    },
    async () => {
      const response = proxy(
        new NextRequest("https://example.com/api/nexus/analytics"),
      );
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(response.headers.get("WWW-Authenticate"), null);
      assert.deepEqual(body, { error: "Admin authentication is not configured." });
    },
  );
});

test("proxy bypasses local development when credentials are not configured", async () => {
  await withEnvironment(
    {
      NODE_ENV: "development",
      [ADMIN_USER_ENV]: undefined,
      [ADMIN_PASSWORD_ENV]: undefined,
    },
    () => {
      const response = proxy(new NextRequest("https://example.com/admin"));

      assert.equal(response.status, 200);
    },
  );
});
