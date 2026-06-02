import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAdminRequest } from "@/lib/nexus/admin-auth";

export function proxy(request: NextRequest) {
  const authResponse = validateAdminRequest(request);

  if (authResponse) {
    return authResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
  ],
};
