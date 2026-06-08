import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SessionStatus } from "@/app/generated/prisma/client";
import {
  fetchBlueprintAnalyticsData,
  type AnalyticsDataClient,
} from "@/lib/nexus/analytics-data";

describe("fetchBlueprintAnalyticsData", () => {
  it("returns analytics for an existing blueprint id", async () => {
    const client: AnalyticsDataClient = {
      formBlueprint: {
        async findUnique(args) {
          assert.deepEqual(args, {
            where: { id: "blueprint_123" },
            select: { id: true, label: true },
          });

          return {
            id: "blueprint_123",
            label: "Operational Intake",
          };
        },
      },
      formSession: {
        async findMany(args) {
          assert.deepEqual(args, {
            where: {
              blueprintId: "blueprint_123",
              status: SessionStatus.COMPLETED,
            },
            orderBy: { updatedAt: "desc" },
            select: { id: true, capturedData: true, updatedAt: true },
          });

          return [
            {
              id: "session_completed",
              capturedData: { contact_name: "Ada", score: 9 },
              updatedAt: new Date("2026-06-08T11:00:00.000Z"),
            },
          ];
        },
      },
    };

    const data = await fetchBlueprintAnalyticsData("blueprint_123", client);

    assert.deepEqual(data, {
      blueprint: {
        id: "blueprint_123",
        label: "Operational Intake",
      },
      submissions: [
        {
          sessionId: "session_completed",
          completedAt: "2026-06-08T11:00:00.000Z",
          capturedData: { contact_name: "Ada", score: 9 },
        },
      ],
      submissionCount: 1,
      inputId: "blueprint_123",
    });
  });

  it("does not resolve analytics from a form session id", async () => {
    let submissionLookupCount = 0;
    const client: AnalyticsDataClient = {
      formBlueprint: {
        async findUnique(args) {
          assert.deepEqual(args, {
            where: { id: "session_123" },
            select: { id: true, label: true },
          });

          return null;
        },
      },
      formSession: {
        async findMany() {
          submissionLookupCount += 1;
          throw new Error("Session IDs must not be expanded to analytics data.");
        },
      },
    };

    const data = await fetchBlueprintAnalyticsData("session_123", client);

    assert.equal(data, null);
    assert.equal(submissionLookupCount, 0);
  });
});
