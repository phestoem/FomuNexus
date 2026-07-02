const ADMIN_REALM = "Fomu Nexus Admin";

export type AdminAuthDecision =
  | { action: "allow" }
  | { action: "challenge"; status: 401; realm: string }
  | { action: "unavailable"; status: 503; message: string };

export type AdminAuthInput = {
  pathname: string;
  method?: string;
  authorizationHeader: string | null;
  nodeEnv: string | undefined;
  adminUser: string | undefined;
  adminPassword: string | undefined;
};

const PROTECTED_EXACT_PATHS = new Set([
  "/api/mcp",
  "/api/nexus/analytics",
  "/api/nexus/blueprints",
  "/api/nexus/create-blueprint",
  "/api/nexus/seed",
  "/api/nexus/start-copilot",
  "/api/nexus/start-session",
]);

const PROTECTED_PREFIXES = ["/admin/", "/api/mcp/", "/api/nexus/blueprints/"];

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function decodeBasicAuth(header: string | null): {
  username: string;
  password: string;
} | null {
  const prefix = "Basic ";

  if (!header?.startsWith(prefix)) {
    return null;
  }

  try {
    const decoded = atob(header.slice(prefix.length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
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

function constantTimeEqual(actual: string, expected: string): boolean {
  const maxLength = Math.max(actual.length, expected.length);
  let diff = actual.length ^ expected.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |=
      (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return diff === 0;
}

export function isAdminProtectedPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    PROTECTED_EXACT_PATHS.has(pathname) ||
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function evaluateAdminBasicAuth(input: AdminAuthInput): AdminAuthDecision {
  if (!isAdminProtectedPath(input.pathname)) {
    return { action: "allow" };
  }

  const adminUser = input.adminUser;
  const adminPassword = input.adminPassword;
  const hasUser = hasValue(adminUser);
  const hasPassword = hasValue(adminPassword);

  if (!hasUser && !hasPassword && input.nodeEnv !== "production") {
    return { action: "allow" };
  }

  if (!hasUser || !hasPassword) {
    return {
      action: "unavailable",
      status: 503,
      message: "Admin credentials are not configured.",
    };
  }

  const credentials = decodeBasicAuth(input.authorizationHeader);

  if (
    credentials &&
    constantTimeEqual(credentials.username, adminUser) &&
    constantTimeEqual(credentials.password, adminPassword)
  ) {
    return { action: "allow" };
  }

  return {
    action: "challenge",
    status: 401,
    realm: ADMIN_REALM,
  };
}
