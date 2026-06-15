import { NextResponse, type NextRequest } from "next/server";
import {
  getConfiguredAdminCredentials,
  isProductionEnvironment,
  isValidBasicAuthorization,
} from "@/lib/nexus/admin-basic-auth";

const ADMIN_REALM = "Fomu Nexus Admin";

function unauthorizedResponse(status = 401): NextResponse {
  return new NextResponse("Admin authentication required.", {
    status,
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(request: NextRequest) {
  const credentials = getConfiguredAdminCredentials();

  if (!credentials) {
    if (!isProductionEnvironment()) {
      return NextResponse.next();
    }

    return unauthorizedResponse(503);
  }

  if (!isValidBasicAuthorization(request.headers.get("authorization"), credentials)) {
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
