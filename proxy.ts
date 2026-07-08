import { NextResponse, type NextRequest } from "next/server";
import { authorizeAdminRequest } from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const authResult = authorizeAdminRequest(request.headers, process.env);

  if (authResult.ok) {
    return NextResponse.next();
  }

  return new NextResponse(authResult.message, {
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
