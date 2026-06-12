import assert from "node:assert/strict";
import { after, test } from "node:test";
import { SessionStatus } from "@/app/generated/prisma/client";
import { fetchBlueprintAnalyticsData } from "@/lib/nexus/analytics";
import { prisma } from "@/lib/prisma";

after(async () => {
  await prisma.$disconnect();
});

test("analytics lookup does not resolve a form session ID to blueprint data", async (t) => {
  let sessionLookupCalled = false;
  let completedSessionQueryCalled = false;

  t.mock.method(prisma.formBlueprint, "findUnique", async () => null);
  t.mock.method(prisma.formSession, "findUnique", async () => {
    sessionLookupCalled = true;
    return { blueprintId: "blueprint-from-session" };
  });
  t.mock.method(prisma.formSession, "findMany", async () => {
    completedSessionQueryCalled = true;
    return [];
  });

  const data = await fetchBlueprintAnalyticsData("respondent-session-id");

  assert.equal(data, null);
  assert.equal(sessionLookupCalled, false);
  assert.equal(completedSessionQueryCalled, false);
});

test("analytics lookup still loads completed submissions for a blueprint ID", async (t) => {
  const completedAt = new Date("2026-06-12T10:00:00.000Z");

  t.mock.method(prisma.formBlueprint, "findUnique", async (args) => {
    assert.deepEqual(args, { where: { id: "blueprint-id" } });

    return {
      id: "blueprint-id",
      label: "Schema-driven intake",
    };
  });

  t.mock.method(prisma.formSession, "findMany", async (args) => {
    assert.deepEqual(args, {
      where: {
        blueprintId: "blueprint-id",
        status: SessionStatus.COMPLETED,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        capturedData: true,
        updatedAt: true,
      },
    });

    return [
      {
        id: "completed-session-id",
        capturedData: { name: "Ada" },
        updatedAt: completedAt,
      },
    ];
  });

  const data = await fetchBlueprintAnalyticsData("blueprint-id");

  assert.deepEqual(data, {
    blueprint: {
      id: "blueprint-id",
      label: "Schema-driven intake",
    },
    submissions: [
      {
        sessionId: "completed-session-id",
        completedAt: completedAt.toISOString(),
        capturedData: { name: "Ada" },
      },
    ],
    submissionCount: 1,
  });
});
