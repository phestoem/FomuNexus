import { NextResponse, type NextRequest } from "next/server";
import {
  hasAdminAuthCredentials,
  isValidAdminAuthorization,
  shouldEnforceAdminAuth,
  shouldProtectAdminPath,
} from "@/lib/nexus/admin-auth";

const AUTHENTICATE_HEADER = 'Basic realm="Fomu Nexus Admin", charset="UTF-8"';

function noStoreResponse(body: string, status: number, headers?: HeadersInit) {
  return new NextResponse(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function proxy(request: NextRequest) {
  if (!shouldProtectAdminPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!shouldEnforceAdminAuth()) {
    return NextResponse.next();
  }

  if (!hasAdminAuthCredentials()) {
    return noStoreResponse("Admin authentication is not configured.", 503);
  }

  if (!isValidAdminAuthorization(request.headers.get("authorization"))) {
    return noStoreResponse("Authentication required.", 401, {
      "WWW-Authenticate": AUTHENTICATE_HEADER,
    });
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
  ],
};
