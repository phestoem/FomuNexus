import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_AUTH_REALM,
  evaluateAdminRouteAuth,
} from "@/lib/nexus/admin-basic-auth";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Admin authentication is not configured." },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function proxy(request: NextRequest) {
  const decision = evaluateAdminRouteAuth({
    pathname: request.nextUrl.pathname,
    method: request.method,
    authorizationHeader: request.headers.get("authorization"),
  });

  if (decision.status === "unavailable") {
    return unavailableResponse();
  }

  if (decision.status === "unauthorized") {
    return unauthorizedResponse();
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
