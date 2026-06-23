import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_AUTH_REALM,
  getAdminAuthDecision,
} from "@/lib/nexus/admin-basic-auth";

function buildUnauthorizedResponse(request: NextRequest): NextResponse {
  const headers = {
    "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
  };

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers },
    );
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers,
  });
}

export function proxy(request: NextRequest) {
  const decision = getAdminAuthDecision(request.headers.get("authorization"));

  if (decision === "authorized" || decision === "disabled") {
    return NextResponse.next();
  }

  if (decision === "misconfigured") {
    return NextResponse.json(
      { error: "Admin authentication is not configured." },
      { status: 503 },
    );
  }

  return buildUnauthorizedResponse(request);
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
