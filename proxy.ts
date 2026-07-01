import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_AUTH_REALM,
  authorizeAdminRequest,
} from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const authResult = authorizeAdminRequest(
    request.headers.get("authorization"),
  );

  if (authResult.allowed) {
    return NextResponse.next();
  }

  const headers = new Headers({
    "Cache-Control": "no-store",
  });

  if (authResult.challenge) {
    headers.set(
      "WWW-Authenticate",
      `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    );
  }

  return NextResponse.json(
    { error: authResult.error },
    {
      status: authResult.status,
      headers,
    },
  );
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

