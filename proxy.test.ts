import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  evaluateAdminRouteAuth,
  isProtectedAdminPath,
} from "./lib/nexus/admin-basic-auth.ts";

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

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

afterEach(restoreEnv);

test("protected admin routes fail closed in production without credentials", () => {
  setAdminEnv({ nodeEnv: "production" });

  const decision = evaluateAdminRouteAuth({
    pathname: "/api/nexus/blueprints",
    method: "GET",
    authorizationHeader: null,
  });

  assert.equal(decision.status, "unavailable");
});

test("protected admin routes challenge missing credentials when configured", () => {
  setAdminEnv({
    nodeEnv: "production",
    user: "admin",
    password: "secret",
  });

  const decision = evaluateAdminRouteAuth({
    pathname: "/admin/blueprints",
    method: "GET",
    authorizationHeader: null,
  });

  assert.equal(decision.status, "unauthorized");
});

test("protected admin routes reject invalid credentials", () => {
  setAdminEnv({
    nodeEnv: "production",
    user: "admin",
    password: "secret",
  });

  const decision = evaluateAdminRouteAuth({
    pathname: "/api/nexus/analytics",
    method: "POST",
    authorizationHeader: basicAuth("admin", "wrong"),
  });

  assert.equal(decision.status, "unauthorized");
});

test("protected admin routes pass with valid credentials", () => {
  setAdminEnv({
    nodeEnv: "production",
    user: "admin",
    password: "secret",
  });

  const decision = evaluateAdminRouteAuth({
    pathname: "/api/nexus/analytics",
    method: "POST",
    authorizationHeader: basicAuth("admin", "secret"),
  });

  assert.equal(decision.status, "pass");
});

test("public form runtime routes are not protected by the proxy", () => {
  setAdminEnv({ nodeEnv: "production" });

  const decision = evaluateAdminRouteAuth({
    pathname: "/api/nexus/next-step",
    method: "POST",
    authorizationHeader: null,
  });

  assert.equal(decision.status, "pass");
  assert.equal(isProtectedAdminPath("/api/nexus/next-step"), false);
});

test("local development remains open when admin credentials are not configured", () => {
  setAdminEnv({ nodeEnv: "development" });

  const decision = evaluateAdminRouteAuth({
    pathname: "/api/nexus/blueprints",
    method: "GET",
    authorizationHeader: null,
  });

  assert.equal(decision.status, "pass");
});

test("partial admin credential configuration fails closed", () => {
  setAdminEnv({ nodeEnv: "development", user: "admin" });

  const decision = evaluateAdminRouteAuth({
    pathname: "/api/nexus/blueprints",
    method: "GET",
    authorizationHeader: null,
  });

  assert.equal(decision.status, "unavailable");
});

test("MCP endpoint is treated as an admin surface", () => {
  assert.equal(isProtectedAdminPath("/api/mcp"), true);
  assert.equal(isProtectedAdminPath("/api/mcp/session"), true);
});
