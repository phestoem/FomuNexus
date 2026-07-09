import { NextResponse, type NextRequest } from "next/server";
import { authorizeAdminRequest } from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const decision = authorizeAdminRequest({
    pathname: request.nextUrl.pathname,
    authorizationHeader: request.headers.get("authorization"),
  });

  if (decision.allowed) {
    return NextResponse.next();
  }

  return NextResponse.json(decision.body, {
    status: decision.status,
    headers: decision.headers,
  });
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
    "/api/nexus/seed",
    "/api/nexus/start-copilot",
    "/api/nexus/start-session",
  ],
};
