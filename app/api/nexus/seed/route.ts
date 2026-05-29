import { NextResponse } from "next/server";
import { SessionStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const CASUAL_RSVP_LABEL = "Summer Block Party BBQ";
const CLINICAL_INCIDENT_LABEL = "Hardware Server Failure Log";

const SEED_BLUEPRINTS = {
  casual: {
    label: CASUAL_RSVP_LABEL,
    toneProfile: {
      primary: "playful",
      style: "warm and highly casual, use emojis",
    },
    targetSchema: {
      type: "object",
      required: ["guest_name", "attending", "dietary_pref", "hype_song"],
      properties: {
        guest_name: {
          type: "string",
          description: "Full name of the attendee",
        },
        attending: {
          type: "boolean",
          description: "Whether they are coming or not",
        },
        dietary_pref: {
          type: "string",
          enum: ["None", "Vegetarian", "Vegan", "Gluten-Free"],
        },
        hype_song: {
          type: "string",
          description: "A song that gets them on the dance floor",
        },
      },
    },
  },
  clinical: {
    label: CLINICAL_INCIDENT_LABEL,
    toneProfile: {
      primary: "clinical",
      style: "strictly professional, direct, urgent, no fluff",
    },
    targetSchema: {
      type: "object",
      required: ["server_id", "severity_level", "downtime_start"],
      properties: {
        server_id: {
          type: "string",
          description: "The alpha-numeric asset tag on the rack",
        },
        severity_level: {
          type: "string",
          enum: ["Low", "Degraded", "Critical Outage"],
        },
        downtime_start: {
          type: "string",
          description: "The date and approximate time the error began",
        },
      },
    },
  },
} as const;

type SeedBlueprintKey = keyof typeof SEED_BLUEPRINTS;

async function ensureBlueprint(seedKey: SeedBlueprintKey) {
  const seed = SEED_BLUEPRINTS[seedKey];

  const existingBlueprint = await prisma.formBlueprint.findFirst({
    where: { label: seed.label },
  });

  if (existingBlueprint) {
    return existingBlueprint;
  }

  return prisma.formBlueprint.create({
    data: {
      label: seed.label,
      toneProfile: seed.toneProfile,
      targetSchema: seed.targetSchema,
    },
  });
}

async function createFreshSession(blueprintId: string) {
  return prisma.formSession.create({
    data: {
      blueprintId,
      capturedData: {},
      status: SessionStatus.ACTIVE,
    },
  });
}

function buildFormUrl(sessionId: string, request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.origin}/form/${sessionId}`;
}

function buildSeedPayload(
  casualBlueprint: { id: string },
  casualSession: { id: string },
  clinicalBlueprint: { id: string },
  clinicalSession: { id: string },
  request: Request,
) {
  return {
    casual: {
      blueprintId: casualBlueprint.id,
      sessionId: casualSession.id,
      url: buildFormUrl(casualSession.id, request),
    },
    clinical: {
      blueprintId: clinicalBlueprint.id,
      sessionId: clinicalSession.id,
      url: buildFormUrl(clinicalSession.id, request),
    },
  };
}

function buildSeedHtml(payload: ReturnType<typeof buildSeedPayload>): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Fomu Nexus Seed</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.5; }
      h1 { font-size: 1.5rem; }
      a { color: #2563eb; }
      pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow: auto; }
      .card { border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; margin: 16px 0; }
    </style>
  </head>
  <body>
    <h1>Fomu Nexus test sessions ready</h1>
    <div class="card">
      <h2>Casual RSVP</h2>
      <p><a href="${payload.casual.url}">${payload.casual.url}</a></p>
      <p>Session ID: <code>${payload.casual.sessionId}</code></p>
    </div>
    <div class="card">
      <h2>Clinical Incident Report</h2>
      <p><a href="${payload.clinical.url}">${payload.clinical.url}</a></p>
      <p>Session ID: <code>${payload.clinical.sessionId}</code></p>
    </div>
    <h2>JSON</h2>
    <pre>${JSON.stringify(payload, null, 2)}</pre>
  </body>
</html>`;
}

export async function GET(request: Request) {
  try {
    const [casualBlueprint, clinicalBlueprint] = await Promise.all([
      ensureBlueprint("casual"),
      ensureBlueprint("clinical"),
    ]);

    const [casualSession, clinicalSession] = await Promise.all([
      createFreshSession(casualBlueprint.id),
      createFreshSession(clinicalBlueprint.id),
    ]);

    const payload = buildSeedPayload(
      casualBlueprint,
      casualSession,
      clinicalBlueprint,
      clinicalSession,
      request,
    );

    const acceptHeader = request.headers.get("accept") ?? "";

    if (acceptHeader.includes("text/html")) {
      return new NextResponse(buildSeedHtml(payload), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Nexus seed failed:", error);
    return NextResponse.json(
      { error: "Failed to seed test blueprints and sessions." },
      { status: 500 },
    );
  }
}
