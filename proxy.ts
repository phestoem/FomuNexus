import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuthDecision } from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const decision = getAdminAuthDecision(request);

  if (decision.ok) {
    return NextResponse.next();
  }

  return new NextResponse(decision.body, {
    status: decision.status,
    headers: decision.headers,
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
