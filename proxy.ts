import { NextResponse, type NextRequest } from "next/server";

const ADMIN_REALM = "Fomu Nexus Admin";
const DEFAULT_ADMIN_USERNAME = "admin";

function getExpectedAdminCredentials():
  | { configured: false; allowInsecureLocalDev: boolean }
  | { configured: true; username: string; password: string } {
  const password = process.env.FOMU_NEXUS_ADMIN_PASSWORD;

  if (!password) {
    return {
      configured: false,
      allowInsecureLocalDev: process.env.NODE_ENV !== "production",
    };
  }

  return {
    configured: true,
    username: process.env.FOMU_NEXUS_ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME,
    password,
  };
}

function parseBasicAuthorization(
  authorization: string | null,
): { username: string; password: string } | null {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function unauthorizedResponse() {
  return new NextResponse("Admin authentication is required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
    },
  });
}

function adminNotConfiguredResponse() {
  return new NextResponse(
    "Admin access is disabled until FOMU_NEXUS_ADMIN_PASSWORD is configured.",
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function proxy(request: NextRequest) {
  const expected = getExpectedAdminCredentials();

  if (!expected.configured) {
    return expected.allowInsecureLocalDev
      ? NextResponse.next()
      : adminNotConfiguredResponse();
  }

  const provided = parseBasicAuthorization(request.headers.get("authorization"));

  if (
    !provided ||
    provided.username !== expected.username ||
    provided.password !== expected.password
  ) {
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
  ],
};
