import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStatus } from "@/app/generated/prisma/client";
import {
  type AnalyticsDataClient,
  fetchBlueprintAnalyticsData,
} from "@/lib/nexus/analytics";

test("analytics lookup does not resolve a form session ID to blueprint data", async () => {
  let sessionLookupCalled = false;
  let completedSessionQueryCalled = false;

  const dataClient = {
    formBlueprint: {
      findUnique: async () => null,
    },
    formSession: {
      findUnique: async () => {
        sessionLookupCalled = true;
        return { blueprintId: "blueprint-from-session" };
      },
      findMany: async () => {
        completedSessionQueryCalled = true;
        return [];
      },
    },
  } as unknown as AnalyticsDataClient;

  const data = await fetchBlueprintAnalyticsData(
    "respondent-session-id",
    dataClient,
  );

  assert.equal(data, null);
  assert.equal(sessionLookupCalled, false);
  assert.equal(completedSessionQueryCalled, false);
});

test("analytics lookup still loads completed submissions for a blueprint ID", async () => {
  const completedAt = new Date("2026-06-12T10:00:00.000Z");

  const dataClient: AnalyticsDataClient = {
    formBlueprint: {
      findUnique: async (args) => {
        assert.deepEqual(args, { where: { id: "blueprint-id" } });

        return {
          id: "blueprint-id",
          label: "Schema-driven intake",
        };
      },
    },
    formSession: {
      findMany: async (args) => {
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
      },
    },
  };

  const data = await fetchBlueprintAnalyticsData("blueprint-id", dataClient);

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
