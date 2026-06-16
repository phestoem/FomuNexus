import { NextResponse, type NextRequest } from "next/server";
import { validateAdminBasicAuth } from "@/lib/nexus/admin-basic-auth";

const BASIC_AUTH_CHALLENGE = 'Basic realm="Fomu Nexus Admin", charset="UTF-8"';

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": BASIC_AUTH_CHALLENGE,
    },
  });
}

function missingCredentialsResponse(): NextResponse {
  return new NextResponse("Admin credentials are not configured.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(request: NextRequest) {
  const authResult = validateAdminBasicAuth(
    request.headers.get("authorization"),
  );

  if (authResult.ok) {
    return NextResponse.next();
  }

  if (authResult.reason === "missing_credentials") {
    return missingCredentialsResponse();
  }

  return unauthorizedResponse();
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
    "/api/nexus/create-blueprint/:path*",
    "/api/nexus/seed",
    "/api/nexus/seed/:path*",
    "/api/nexus/start-copilot",
    "/api/nexus/start-copilot/:path*",
  ],
};
