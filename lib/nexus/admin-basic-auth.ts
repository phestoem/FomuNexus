import { timingSafeEqual } from "crypto";

export const ADMIN_BASIC_AUTH_REALM = "Fomu Nexus Admin";

export const PROTECTED_ADMIN_PATHS = [
  "/admin",
  "/api/mcp",
  "/api/nexus/analytics",
  "/api/nexus/blueprints",
  "/api/nexus/create-blueprint",
  "/api/nexus/seed",
  "/api/nexus/start-copilot",
  "/api/nexus/start-session",
] as const;

type AdminCredentials =
  | {
      configured: true;
      username: string;
      password: string;
    }
  | {
      configured: false;
      partial: boolean;
    };

export type AdminAuthDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      status: 401 | 503;
      body: { error: string };
      headers: Record<string, string>;
    };

type Env = Record<string, string | undefined>;

function getAdminCredentials(env: Env): AdminCredentials {
  const username = env.FOMU_NEXUS_ADMIN_USER;
  const password = env.FOMU_NEXUS_ADMIN_PASSWORD;
  const hasUsername = typeof username === "string" && username.length > 0;
  const hasPassword = typeof password === "string" && password.length > 0;

  if (hasUsername && hasPassword) {
    return {
      configured: true,
      username,
      password,
    };
  }

  return {
    configured: false,
    partial: hasUsername || hasPassword,
  };
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBasicAuthHeader(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = authorizationHeader.slice("Basic ".length).trim();
  if (!encodedCredentials) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedCredentials, "base64").toString("utf8");
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

export function isProtectedAdminPath(pathname: string): boolean {
  return PROTECTED_ADMIN_PATHS.some(
    (protectedPath) =>
      pathname === protectedPath || pathname.startsWith(`${protectedPath}/`),
  );
}

export function authorizeAdminRequest(params: {
  pathname: string;
  authorizationHeader: string | null;
  env?: Env;
  nodeEnv?: string;
}): AdminAuthDecision {
  if (!isProtectedAdminPath(params.pathname)) {
    return { allowed: true };
  }

  const env = params.env ?? process.env;
  const nodeEnv = params.nodeEnv ?? env.NODE_ENV;
  const credentials = getAdminCredentials(env);

  if (!credentials.configured) {
    if (!credentials.partial && nodeEnv !== "production") {
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 503,
      body: { error: "Admin authentication is not configured." },
      headers: {
        "Cache-Control": "no-store",
      },
    };
  }

  const suppliedCredentials = parseBasicAuthHeader(params.authorizationHeader);
  const credentialsMatch =
    suppliedCredentials !== null &&
    timingSafeStringEqual(suppliedCredentials.username, credentials.username) &&
    timingSafeStringEqual(suppliedCredentials.password, credentials.password);

  if (credentialsMatch) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 401,
    body: { error: "Authentication required." },
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${ADMIN_BASIC_AUTH_REALM}", charset="UTF-8"`,
    },
  };
}
