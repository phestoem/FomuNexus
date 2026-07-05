import { NextResponse, type NextRequest } from "next/server";
import {
  createAdminAuthFailureResponse,
  validateAdminBasicAuthHeader,
} from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const authResult = validateAdminBasicAuthHeader(
    request.headers.get("authorization"),
  );

  if (!authResult.authorized) {
    return createAdminAuthFailureResponse(authResult);
  }

  return NextResponse.next();
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
