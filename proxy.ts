import { NextResponse, type NextRequest } from "next/server";
import { evaluateAdminBasicAuth } from "@/lib/nexus/admin-basic-auth";

function buildDeniedResponse(
  decision: Exclude<ReturnType<typeof evaluateAdminBasicAuth>, { allowed: true }>,
) {
  const headers = new Headers();

  if (decision.challenge) {
    headers.set("WWW-Authenticate", decision.challenge);
  }

  return NextResponse.json(
    { error: decision.error },
    {
      status: decision.status,
      headers,
    },
  );
}

export function proxy(request: NextRequest) {
  const decision = evaluateAdminBasicAuth({
    headers: request.headers,
    username: process.env.FOMU_NEXUS_ADMIN_USER,
    password: process.env.FOMU_NEXUS_ADMIN_PASSWORD,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!decision.allowed) {
    return buildDeniedResponse(decision);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/mcp",
    "/api/mcp/:path*",
    "/api/nexus/analytics",
    "/api/nexus/analytics/:path*",
    "/api/nexus/blueprints",
    "/api/nexus/blueprints/:path*",
    "/api/nexus/create-blueprint",
    "/api/nexus/create-blueprint/:path*",
    "/api/nexus/seed",
    "/api/nexus/seed/:path*",
    "/api/nexus/start-session",
    "/api/nexus/start-session/:path*",
    "/api/nexus/start-copilot",
    "/api/nexus/start-copilot/:path*",
  ],
};
