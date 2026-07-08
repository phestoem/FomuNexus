import { timingSafeEqual } from "node:crypto";

export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

type AdminAuthEnvironment = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

type AdminAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 503;
      message: string;
      headers: Record<string, string>;
    };

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function safeCompare(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length === expectedBuffer.length) {
    return timingSafeEqual(actualBuffer, expectedBuffer);
  }

  const paddedActual = Buffer.alloc(expectedBuffer.length);
  actualBuffer.copy(paddedActual, 0, 0, expectedBuffer.length);
  timingSafeEqual(paddedActual, expectedBuffer);
  return false;
}

function unauthorized(message = "Authentication required."): AdminAuthResult {
  return {
    ok: false,
    status: 401,
    message,
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  };
}

function serviceUnavailable(message: string): AdminAuthResult {
  return {
    ok: false,
    status: 503,
    message,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

function parseBasicAuthorization(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return null;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function authorizeAdminRequest(
  headers: Pick<Headers, "get">,
  environment: AdminAuthEnvironment,
): AdminAuthResult {
  const expectedUsername = environment.FOMU_NEXUS_ADMIN_USER;
  const expectedPassword = environment.FOMU_NEXUS_ADMIN_PASSWORD;
  const hasUsername = hasValue(expectedUsername);
  const hasPassword = hasValue(expectedPassword);

  if (hasUsername !== hasPassword) {
    return serviceUnavailable("Admin authentication is partially configured.");
  }

  if (!hasUsername || !hasPassword) {
    if (environment.NODE_ENV === "production") {
      return serviceUnavailable("Admin authentication is not configured.");
    }

    return { ok: true };
  }

  const credentials = parseBasicAuthorization(headers.get("authorization"));
  if (!credentials) {
    return unauthorized();
  }

  const validUsername = safeCompare(credentials.username, expectedUsername);
  const validPassword = safeCompare(credentials.password, expectedPassword);

  if (!validUsername || !validPassword) {
    return unauthorized("Invalid credentials.");
  }

  return { ok: true };
}
