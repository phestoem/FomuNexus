import assert from "node:assert/strict";
import test from "node:test";
import { getAdminAuthDecision } from "./admin-basic-auth.ts";

function buildRequest(authorization?: string): Pick<Request, "headers"> {
  const headers = new Headers();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  return { headers };
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

test("allows local development when admin credentials are fully absent", () => {
  const decision = getAdminAuthDecision(buildRequest(), {
    NODE_ENV: "development",
  });

  assert.equal(decision.ok, true);
});

test("fails closed in production when admin credentials are absent", () => {
  const decision = getAdminAuthDecision(buildRequest(), {
    NODE_ENV: "production",
  });

  assert.equal(decision.ok, false);

  if (!decision.ok) {
    assert.equal(decision.status, 503);
    assert.equal(decision.headers["Cache-Control"], "no-store");
  }
});

test("fails closed when only one admin credential is configured", () => {
  const decision = getAdminAuthDecision(buildRequest(), {
    NODE_ENV: "development",
    FOMU_NEXUS_ADMIN_USER: "admin",
  });

  assert.equal(decision.ok, false);

  if (!decision.ok) {
    assert.equal(decision.status, 503);
  }
});

test("rejects requests without a valid Basic Auth header", () => {
  const decision = getAdminAuthDecision(buildRequest("Bearer token"), {
    NODE_ENV: "production",
    FOMU_NEXUS_ADMIN_USER: "admin",
    FOMU_NEXUS_ADMIN_PASSWORD: "secret",
  });

  assert.equal(decision.ok, false);

  if (!decision.ok) {
    assert.equal(decision.status, 401);
    assert.match(decision.headers["WWW-Authenticate"], /Basic realm=/);
  }
});

test("rejects incorrect Basic Auth credentials", () => {
  const decision = getAdminAuthDecision(
    buildRequest(basicAuthorization("admin", "wrong")),
    {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret",
    },
  );

  assert.equal(decision.ok, false);

  if (!decision.ok) {
    assert.equal(decision.status, 401);
  }
});

test("accepts matching Basic Auth credentials", () => {
  const decision = getAdminAuthDecision(
    buildRequest(basicAuthorization("admin", "secret:with-colon")),
    {
      NODE_ENV: "production",
      FOMU_NEXUS_ADMIN_USER: "admin",
      FOMU_NEXUS_ADMIN_PASSWORD: "secret:with-colon",
    },
  );

  assert.equal(decision.ok, true);
});
