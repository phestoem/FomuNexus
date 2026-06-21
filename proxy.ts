import { NextResponse, type NextRequest } from "next/server";
import {
  createAdminAuthResponse,
  validateAdminBasicAuth,
} from "@/lib/nexus/admin-auth";

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const authDecision = validateAdminBasicAuth(request);

  if (!authDecision.ok) {
    return createAdminAuthResponse(authDecision);
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
    "/api/nexus/seed",
    "/api/nexus/start-copilot",
  ],
};
