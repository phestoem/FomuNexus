import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_AUTH_REALM,
  getAdminAuthDecision,
} from "@/lib/nexus/admin-basic-auth";

function buildUnauthorizedResponse(status: 401 | 503, message: string) {
  const response = NextResponse.json({ error: message }, { status });
  response.headers.set("Cache-Control", "no-store");

  if (status === 401) {
    response.headers.set(
      "WWW-Authenticate",
      `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    );
  }

  return response;
}

export function proxy(request: NextRequest) {
  const decision = getAdminAuthDecision(request.headers.get("authorization"));

  if (decision.authorized) {
    return NextResponse.next();
  }

  return buildUnauthorizedResponse(decision.status, decision.message);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/mcp/:path*",
    "/api/nexus/analytics/:path*",
    "/api/nexus/blueprints/:path*",
    "/api/nexus/create-blueprint/:path*",
    "/api/nexus/seed/:path*",
    "/api/nexus/start-copilot/:path*",
  ],
};
