import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminCredentialState,
  isAdminRequestAuthorized,
  isProtectedAdminPath,
} from "@/lib/nexus/admin-basic-auth";

const AUTHENTICATE_HEADER = 'Basic realm="Fomu Nexus Admin"';

function missingCredentialsResponse(): NextResponse {
  return new NextResponse("Admin credentials are not configured.", {
    status: 503,
  });
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": AUTHENTICATE_HEADER,
    },
  });
}

export function proxy(request: NextRequest) {
  if (!isProtectedAdminPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (getAdminCredentialState().status === "missing") {
    return missingCredentialsResponse();
  }

  if (!isAdminRequestAuthorized(request.headers.get("authorization"))) {
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
    "/api/nexus/create-blueprint",
    "/api/nexus/start-copilot",
    "/api/nexus/start-session",
    "/api/nexus/seed",
  ],
};
