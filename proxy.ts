import { NextResponse, type NextRequest } from "next/server";
import { authenticateAdminRequest } from "@/lib/nexus/admin-basic-auth";

function buildUnauthorizedResponse(
  decision: Exclude<
    ReturnType<typeof authenticateAdminRequest>,
    { authorized: true }
  >,
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });

  if (decision.wwwAuthenticate) {
    headers.set("WWW-Authenticate", decision.wwwAuthenticate);
  }

  return new NextResponse(decision.message, {
    status: decision.status,
    headers,
  });
}

export function proxy(request: NextRequest) {
  const decision = authenticateAdminRequest(
    request.headers.get("authorization"),
  );

  if (!decision.authorized) {
    return buildUnauthorizedResponse(decision);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/mcp",
    "/api/mcp/:path*",
    "/api/nexus/analytics",
    "/api/nexus/blueprints",
    "/api/nexus/blueprints/:path*",
    "/api/nexus/create-blueprint",
    "/api/nexus/seed",
    "/api/nexus/start-copilot",
  ],
};
