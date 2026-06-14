import assert from "node:assert/strict";
import test from "node:test";
import { SessionStatus } from "../../app/generated/prisma/client";
import { fetchBlueprintAnalyticsData } from "./analytics-data";

test("fetchBlueprintAnalyticsData does not resolve public session IDs", async () => {
  let sessionAnalyticsQueried = false;

  const data = await fetchBlueprintAnalyticsData("public-session-id", {
    formBlueprint: {
      async findUnique(args) {
        assert.deepEqual(args, {
          where: { id: "public-session-id" },
          select: { id: true, label: true },
        });
        return null;
      },
    },
    formSession: {
      async findMany() {
        sessionAnalyticsQueried = true;
        return [];
      },
    },
  });

  assert.equal(data, null);
  assert.equal(sessionAnalyticsQueried, false);
});

test("fetchBlueprintAnalyticsData returns completed submissions for a blueprint", async () => {
  const completedAt = new Date("2026-06-14T10:00:00.000Z");
  let queryStatus: SessionStatus | null = null;

  const data = await fetchBlueprintAnalyticsData("blueprint-id", {
    formBlueprint: {
      async findUnique(args) {
        assert.deepEqual(args, {
          where: { id: "blueprint-id" },
          select: { id: true, label: true },
        });
        return { id: "blueprint-id", label: "Customer intake" };
      },
    },
    formSession: {
      async findMany(args) {
        queryStatus = args.where.status;
        assert.deepEqual(args.where, {
          blueprintId: "blueprint-id",
          status: SessionStatus.COMPLETED,
        });
        return [
          {
            id: "session-id",
            capturedData: { name: "Ada" },
            updatedAt: completedAt,
          },
        ];
      },
    },
  });

  assert.equal(queryStatus, SessionStatus.COMPLETED);
  assert.deepEqual(data, {
    blueprint: {
      id: "blueprint-id",
      label: "Customer intake",
    },
    submissions: [
      {
        sessionId: "session-id",
        completedAt: completedAt.toISOString(),
        capturedData: { name: "Ada" },
      },
    ],
    submissionCount: 1,
  });
});
