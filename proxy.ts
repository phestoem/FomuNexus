import { NextResponse, type NextRequest } from "next/server";
import { evaluateAdminBasicAuth } from "@/lib/nexus/admin-basic-auth";

export function proxy(request: NextRequest) {
  const decision = evaluateAdminBasicAuth({
    pathname: request.nextUrl.pathname,
    authorizationHeader: request.headers.get("authorization"),
    nodeEnv: process.env.NODE_ENV,
    adminUser: process.env.FOMU_NEXUS_ADMIN_USER,
    adminPassword: process.env.FOMU_NEXUS_ADMIN_PASSWORD,
  });

  if (decision.action === "allow") {
    return NextResponse.next();
  }

  if (decision.action === "unavailable") {
    return new NextResponse(decision.message, {
      status: decision.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse("Authentication required.", {
    status: decision.status,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${decision.realm}", charset="UTF-8"`,
    },
  });
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
    "/api/nexus/create-blueprint/:path*",
    "/api/nexus/seed",
    "/api/nexus/seed/:path*",
    "/api/nexus/start-copilot",
    "/api/nexus/start-copilot/:path*",
    "/api/nexus/start-session",
    "/api/nexus/start-session/:path*",
  ],
};
