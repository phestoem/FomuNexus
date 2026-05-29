import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  actionDispatchResultSchema,
  type ActionExecuted,
  type CompiledBlueprintResult,
} from "@/lib/nexus/schemas";
import {
  stripInternalCapturedKeys,
  isMetaBlueprint,
} from "@/lib/nexus/meta-blueprint-shared";
import { compileCreatorBlueprint } from "@/lib/nexus/meta-blueprint";
import { prisma } from "@/lib/prisma";
import { parseCapturedData } from "@/lib/nexus/target-schema";
import { SessionStatus } from "@/app/generated/prisma/client";

const OPENAI_MODEL = "gpt-4o-mini";

export type SessionCompletionResult =
  | {
      kind: "standard";
      actionsExecuted: ActionExecuted[];
    }
  | {
      kind: "meta_compilation";
      compiledBlueprint: CompiledBlueprintResult;
    };

export const SYSTEM_DESTINATIONS = {
  SLACK_ALERTS: {
    id: "SLACK_ALERTS" as const,
    label: "Slack Alerts",
    purpose:
      "Mock webhook for urgent operational notifications and high-priority incident broadcasts.",
    mockEndpoint: "https://mock.fomu.nexus/webhooks/slack-alerts",
  },
  EMAIL_DISPATCH: {
    id: "EMAIL_DISPATCH" as const,
    label: "Email Dispatch",
    purpose:
      "Mock SMTP dispatcher for friendly confirmations, summaries, and participant receipts.",
    mockEndpoint: "https://mock.fomu.nexus/smtp/dispatch",
  },
  CRM_DATABASE: {
    id: "CRM_DATABASE" as const,
    label: "CRM Database",
    purpose:
      "Mock external endpoint for structured customer or participant record ingestion.",
    mockEndpoint: "https://mock.fomu.nexus/crm/records",
  },
} as const;

function payloadFieldsToRecord(
  fields: Array<{
    key: string;
    value: string | number | boolean | null;
  }>,
): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.key, field.value]));
}

function buildDestinationCatalog(): string {
  return Object.values(SYSTEM_DESTINATIONS)
    .map(
      (destination) =>
        `- ${destination.id}: ${destination.purpose} (${destination.mockEndpoint})`,
    )
    .join("\n");
}

function logDispatchedActions(params: {
  sessionId: string;
  formLabel: string;
  capturedData: Record<string, unknown>;
  actionsExecuted: ActionExecuted[];
}) {
  const border = "═".repeat(78);
  const subBorder = "─".repeat(78);

  console.log(`\n${border}`);
  console.log("FOMU NEXUS · AGENTIC POST-PROCESSING DISPATCH");
  console.log(border);
  console.log(`Session ID     : ${params.sessionId}`);
  console.log(`Form Label     : ${params.formLabel}`);
  console.log(`Actions Routed : ${params.actionsExecuted.length}`);
  console.log(subBorder);
  console.log("Captured Payload:");
  console.log(JSON.stringify(params.capturedData, null, 2));
  console.log(subBorder);

  if (params.actionsExecuted.length === 0) {
    console.log("No autonomous destinations were selected.");
    console.log(`${border}\n`);
    return;
  }

  params.actionsExecuted.forEach((action, index) => {
    console.log(`Action #${index + 1}`);
    console.log(`  Destination : ${action.destination}`);
    console.log(`  Priority    : ${action.priority}`);
    console.log(`  Reasoning   : ${action.reasoning}`);
    console.log(`  Mock Target : ${SYSTEM_DESTINATIONS[action.destination].mockEndpoint}`);
    console.log("  Custom Payload:");
    console.log(
      JSON.stringify(action.payload, null, 2)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n"),
    );
    console.log(subBorder);
  });

  console.log(`${border}\n`);
}

export async function processCompletedSession(
  sessionId: string,
  options?: { origin?: string },
): Promise<SessionCompletionResult> {
  const session = await prisma.formSession.findUnique({
    where: { id: sessionId },
    include: { blueprint: true },
  });

  if (!session) {
    throw new Error(`Session "${sessionId}" was not found.`);
  }

  if (session.status !== SessionStatus.COMPLETED) {
    throw new Error(`Session "${sessionId}" is not completed yet.`);
  }

  const capturedData = parseCapturedData(session.capturedData);
  const formLabel = session.blueprint.label;

  if (isMetaBlueprint(session.blueprint)) {
    const origin =
      options?.origin ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";

    const compiledBlueprint = await compileCreatorBlueprint({
      capturedData,
      origin,
    });

    console.log(
      `\nFOMU NEXUS · CREATOR CO-PILOT COMPILATION COMPLETE\nBlueprint: ${compiledBlueprint.label}\nForm URL: ${compiledBlueprint.formUrl}\n`,
    );

    return {
      kind: "meta_compilation",
      compiledBlueprint,
    };
  }

  const { object } = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: actionDispatchResultSchema,
    prompt: [
      "You are an autonomous post-processing dispatcher for a completed intake session.",
      "Analyze the captured data payload and determine which destination tool(s) are relevant.",
      "Generate a highly customized payload or message specifically tailored to each destination's native purpose.",
      "You may trigger multiple destinations when appropriate.",
      "",
      "Examples:",
      "- Urgent server crash data -> SLACK_ALERTS with dramatic high-priority language.",
      "- Casual event registration -> EMAIL_DISPATCH with a friendly confirmation tone.",
      "- Structured participant or account data -> CRM_DATABASE with normalized record fields.",
      "",
      "Use payloadFields as key/value pairs for each destination-specific body.",
      "Set priority to HIGH for urgent operational incidents, MEDIUM for standard workflows, LOW for casual confirmations.",
      "",
      `Form label:\n${formLabel}`,
      "",
      `Captured data:\n${JSON.stringify(capturedData, null, 2)}`,
      "",
      "Available destinations:",
      buildDestinationCatalog(),
    ].join("\n"),
  });

  const actionsExecuted: ActionExecuted[] = object.actions.map((action) => ({
    destination: action.destination,
    reasoning: action.reasoning,
    priority: action.priority,
    payload: payloadFieldsToRecord(action.payloadFields),
  }));

  logDispatchedActions({
    sessionId,
    formLabel,
    capturedData,
    actionsExecuted,
  });

  return {
    kind: "standard",
    actionsExecuted,
  };
}
