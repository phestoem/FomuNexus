import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildFormUrl } from "@/lib/nexus/app-url";
import { createBlueprintFromPrompt } from "@/lib/nexus/create-blueprint-from-prompt";
import {
  formatIntakeSnapshotJson,
  getIntakeSessionSnapshot,
} from "@/lib/mcp/intake-session";
import {
  parseRequestHumanIntakeInput,
  requestHumanIntakeInputShape,
} from "@/lib/mcp/request-human-intake-input";
import { SessionStatus } from "@/app/generated/prisma/client";

export function createNexusMcpServer(origin: string): McpServer {
  const server = new McpServer(
    {
      name: "fomu-nexus",
      version: "0.1.0",
    },
    {
      instructions: [
        "Fomu Nexus exposes human-in-the-loop intake as MCP tools and resources.",
        "Call request_human_intake with formTitle and roughIntakeGoal to spin up a live form.",
        "Share the returned url with a human, then poll by calling request_human_intake again with sessionId,",
        "or read the nexus://intake/{sessionId} resource until awaiting_input is false.",
      ].join(" "),
    },
  );

  server.registerTool(
    "request_human_intake",
    {
      title: "Request human intake",
      description:
        "Creates a live Fomu Nexus intake form (or polls an existing session). Returns a shareable form URL with awaiting_input until the human completes the session, then returns capturedData.",
      inputSchema: requestHumanIntakeInputShape,
    },
    async (args) => {
      try {
        const parsed = parseRequestHumanIntakeInput(args);

        if (parsed.mode === "invalid") {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: parsed.error }),
              },
            ],
          };
        }

        if (parsed.mode === "poll") {
          const snapshot = await getIntakeSessionSnapshot(parsed.sessionId, origin);

          if (!snapshot) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: `Session "${parsed.sessionId}" was not found.`,
                  }),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: formatIntakeSnapshotJson(snapshot),
              },
            ],
          };
        }

        const { session } = await createBlueprintFromPrompt({
          title: parsed.formTitle,
          prompt: parsed.roughIntakeGoal,
        });

        const snapshot = {
          sessionId: session.id,
          blueprintId: session.blueprintId,
          url: buildFormUrl(session.id, origin),
          status: SessionStatus.ACTIVE,
          awaiting_input: true,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "request_human_intake failed.";

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }),
            },
          ],
        };
      }
    },
  );

  server.registerResource(
    "intake_session",
    new ResourceTemplate("nexus://intake/{sessionId}", {
      list: undefined,
    }),
    {
      description:
        "Poll intake session status. When status is COMPLETED, capturedData contains the human's final answers.",
      mimeType: "application/json",
    },
    async (_uri, { sessionId: sessionIdVariable }) => {
      const sessionId = Array.isArray(sessionIdVariable)
        ? sessionIdVariable[0]
        : sessionIdVariable;

      if (!sessionId) {
        throw new Error("sessionId is required.");
      }

      const snapshot = await getIntakeSessionSnapshot(sessionId, origin);

      if (!snapshot) {
        throw new Error(`Session "${sessionId}" was not found.`);
      }

      return {
        contents: [
          {
            uri: `nexus://intake/${sessionId}`,
            mimeType: "application/json",
            text: formatIntakeSnapshotJson(snapshot),
          },
        ],
      };
    },
  );

  return server;
}
