import { NextResponse, type NextRequest } from "next/server";
import { evaluateAdminBasicAuth } from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const authResult = evaluateAdminBasicAuth(
    request.headers.get("authorization"),
  );

  if (authResult.ok) {
    return NextResponse.next();
  }

  return new NextResponse(authResult.body, {
    status: authResult.status,
    headers: authResult.headers,
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
