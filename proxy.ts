import { NextResponse, type NextRequest } from "next/server";

const REALM = "Fomu Nexus Admin";

const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/api/mcp",
  "/api/nexus/analytics",
  "/api/nexus/blueprints",
  "/api/nexus/create-blueprint",
  "/api/nexus/seed",
  "/api/nexus/start-copilot",
  "/api/nexus/start-session",
] as const;

type AdminCredentials = {
  user: string;
  password: string;
};

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getConfiguredCredentials(): AdminCredentials | null {
  const user = process.env.FOMU_NEXUS_ADMIN_USER?.trim();
  const password = process.env.FOMU_NEXUS_ADMIN_PASSWORD?.trim();

  if (!user || !password) {
    return null;
  }

  return { user, password };
}

function hasPartialCredentialConfiguration(): boolean {
  const hasUser = Boolean(process.env.FOMU_NEXUS_ADMIN_USER?.trim());
  const hasPassword = Boolean(process.env.FOMU_NEXUS_ADMIN_PASSWORD?.trim());

  return hasUser !== hasPassword;
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
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

function parseBasicAuth(header: string | null): AdminCredentials | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = header.slice("Basic ".length).trim();

  try {
    const decoded = atob(encodedCredentials);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function credentialsMatch(
  submitted: AdminCredentials | null,
  configured: AdminCredentials,
): boolean {
  return (
    submitted?.user === configured.user &&
    submitted.password === configured.password
  );
}

export function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname) || request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const configuredCredentials = getConfiguredCredentials();

  if (!configuredCredentials) {
    if (
      process.env.NODE_ENV === "production" ||
      hasPartialCredentialConfiguration()
    ) {
      return unavailableResponse();
    }

    return NextResponse.next();
  }

  const submittedCredentials = parseBasicAuth(
    request.headers.get("authorization"),
  );

  if (!credentialsMatch(submittedCredentials, configuredCredentials)) {
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
