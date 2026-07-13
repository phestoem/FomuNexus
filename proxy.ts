import { NextResponse, type NextRequest } from "next/server";
import { evaluateAdminBasicAuth } from "@/lib/nexus/admin-basic-auth";

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Fomu Nexus Admin", charset="UTF-8"',
      },
    },
  );
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Administrative authentication is not configured." },
    { status: 503 },
  );
}

export function proxy(request: NextRequest) {
  const decision = evaluateAdminBasicAuth(request.headers.get("authorization"));

  if (decision.kind === "authorized" || decision.kind === "disabled") {
    return NextResponse.next();
  }

  if (decision.kind === "unavailable") {
    return unavailableResponse();
  }

  return unauthorizedResponse();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/mcp/:path*",
    "/api/nexus/analytics/:path*",
    "/api/nexus/blueprints/:path*",
    "/api/nexus/create-blueprint",
    "/api/nexus/seed",
    "/api/nexus/start-copilot",
    "/api/nexus/start-session",
  ],
};
