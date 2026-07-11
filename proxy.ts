import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_AUTH_REALM,
  evaluateAdminBasicAuth,
} from "@/lib/nexus/admin-basic-auth";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    },
  });
}

function misconfiguredResponse(): NextResponse {
  return new NextResponse("Admin authentication is not configured.", {
    status: 503,
  });
}

export function proxy(request: NextRequest) {
  const decision = evaluateAdminBasicAuth(request.headers.get("authorization"));

  if (decision.type === "allow") {
    return NextResponse.next();
  }

  if (decision.type === "misconfigured") {
    return misconfiguredResponse();
  }

  return unauthorizedResponse();
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
    "/api/nexus/start-session/:path*",
  ],
};
