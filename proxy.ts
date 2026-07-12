import { NextResponse, type NextRequest } from "next/server";
import {
  buildBasicAuthChallengeHeaders,
  evaluateAdminBasicAuth,
} from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const authStatus = evaluateAdminBasicAuth(
    request.headers.get("authorization"),
  );

  if (authStatus.status === "authorized" || authStatus.status === "open-dev") {
    return NextResponse.next();
  }

  if (authStatus.status === "misconfigured") {
    return NextResponse.json(
      { error: "Admin authentication is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: buildBasicAuthChallengeHeaders(),
  });
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
