import { NextResponse, type NextRequest } from "next/server";

const ADMIN_AUTH_REALM = "Fomu Nexus Admin";
const BASIC_AUTH_PREFIX = "Basic ";

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

function getConfiguredAdminCredentials():
  | { username: string; password: string }
  | null {
  const username = process.env.FOMU_NEXUS_ADMIN_USER;
  const password = process.env.FOMU_NEXUS_ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function shouldEnforceAdminAuth(): boolean {
  return (
    Boolean(getConfiguredAdminCredentials()) || process.env.NODE_ENV === "production"
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function decodeBasicAuthHeader(header: string | null):
  | { username: string; password: string }
  | null {
  if (!header?.startsWith(BASIC_AUTH_PREFIX)) {
    return null;
  }

  try {
    const decoded = atob(header.slice(BASIC_AUTH_PREFIX.length));
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

export function isProtectedAdminPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function hasValidAdminCredentials(request: NextRequest): boolean {
  const configuredCredentials = getConfiguredAdminCredentials();

  if (!configuredCredentials) {
    return false;
  }

  const suppliedCredentials = decodeBasicAuthHeader(
    request.headers.get("authorization"),
  );

  if (!suppliedCredentials) {
    return false;
  }

  return (
    constantTimeEqual(suppliedCredentials.username, configuredCredentials.username) &&
    constantTimeEqual(suppliedCredentials.password, configuredCredentials.password)
  );
}

function buildUnauthorizedResponse(): Response {
  return NextResponse.json(
    { error: "Authentication required." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
      },
    },
  );
}

function buildAuthNotConfiguredResponse(): Response {
  return NextResponse.json(
    { error: "Admin authentication is not configured." },
    { status: 503 },
  );
}

export function proxy(request: NextRequest) {
  if (!isProtectedAdminPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const configuredCredentials = getConfiguredAdminCredentials();

  if (!configuredCredentials) {
    if (shouldEnforceAdminAuth()) {
      return buildAuthNotConfiguredResponse();
    }

    return NextResponse.next();
  }

  if (!hasValidAdminCredentials(request)) {
    return buildUnauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/mcp/:path*",
    "/api/nexus/analytics",
    "/api/nexus/blueprints/:path*",
    "/api/nexus/create-blueprint",
    "/api/nexus/seed",
    "/api/nexus/start-copilot",
    "/api/nexus/start-session",
  ],
};
