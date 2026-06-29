import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy.ts";

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

function setAdminEnv(options: {
  nodeEnv?: string;
  user?: string;
  password?: string;
}) {
  restoreEnv();

  if (options.nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = options.nodeEnv;
  }

  if (options.user === undefined) {
    delete process.env.FOMU_NEXUS_ADMIN_USER;
  } else {
    process.env.FOMU_NEXUS_ADMIN_USER = options.user;
  }

  if (options.password === undefined) {
    delete process.env.FOMU_NEXUS_ADMIN_PASSWORD;
  } else {
    process.env.FOMU_NEXUS_ADMIN_PASSWORD = options.password;
  }
}

function buildRequest(pathname: string, authorization?: string): NextRequest {
  const headers = new Headers();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new NextRequest(`https://example.test${pathname}`, { headers });
}

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function assertProxyPasses(response: Response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
}

afterEach(restoreEnv);

test("protected admin routes fail closed in production without credentials", () => {
  setAdminEnv({ nodeEnv: "production" });

  const response = proxy(buildRequest("/api/nexus/blueprints"));

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("protected admin routes challenge missing credentials when configured", () => {
  setAdminEnv({
    nodeEnv: "production",
    user: "admin",
    password: "secret",
  });

  const response = proxy(buildRequest("/admin/blueprints"));

  assert.equal(response.status, 401);
  assert.match(
    response.headers.get("www-authenticate") ?? "",
    /^Basic realm="Fomu Nexus Admin"/,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("protected admin routes reject invalid credentials", () => {
  setAdminEnv({
    nodeEnv: "production",
    user: "admin",
    password: "secret",
  });

  const response = proxy(
    buildRequest("/api/nexus/analytics", basicAuth("admin", "wrong")),
  );

  assert.equal(response.status, 401);
});

test("protected admin routes pass with valid credentials", () => {
  setAdminEnv({
    nodeEnv: "production",
    user: "admin",
    password: "secret",
  });

  const response = proxy(
    buildRequest("/api/nexus/analytics", basicAuth("admin", "secret")),
  );

  assertProxyPasses(response);
});

test("public form runtime routes are not protected by the proxy", () => {
  setAdminEnv({ nodeEnv: "production" });

  const response = proxy(buildRequest("/api/nexus/next-step"));

  assertProxyPasses(response);
});

test("local development remains open when admin credentials are not configured", () => {
  setAdminEnv({ nodeEnv: "development" });

  const response = proxy(buildRequest("/api/nexus/blueprints"));

  assertProxyPasses(response);
});

test("partial admin credential configuration fails closed", () => {
  setAdminEnv({ nodeEnv: "development", user: "admin" });

  const response = proxy(buildRequest("/api/nexus/blueprints"));

  assert.equal(response.status, 503);
});
