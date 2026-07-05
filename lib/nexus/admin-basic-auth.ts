const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

type AdminAuthEnvironment = {
  NODE_ENV?: string;
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
};

type AdminAuthSuccess = {
  authorized: true;
};

type AdminAuthFailure = {
  authorized: false;
  status: 401 | 503;
  message: string;
  headers: Record<string, string>;
};

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function unauthorized(message = "Admin authentication is required."): AdminAuthFailure {
  return {
    authorized: false,
    status: 401,
    message,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    },
  };
}

function unavailable(message: string): AdminAuthFailure {
  return {
    authorized: false,
    status: 503,
    message,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

function decodeBasicCredentials(authorizationHeader: string): string | null {
  const match = authorizationHeader.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return null;
  }

  try {
    return atob(match[1]);
  } catch {
    return null;
  }
}

function constantTimeEquals(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    const rightCode = index < right.length ? right.charCodeAt(index) : 0;
    diff |= leftCode ^ rightCode;
  }

  return diff === 0;
}

export function validateAdminBasicAuthHeader(
  authorizationHeader: string | null,
  env: AdminAuthEnvironment = process.env,
): AdminAuthResult {
  const configuredUser = env.FOMU_NEXUS_ADMIN_USER;
  const configuredPassword = env.FOMU_NEXUS_ADMIN_PASSWORD;
  const hasUser = !isBlank(configuredUser);
  const hasPassword = !isBlank(configuredPassword);

  if (!hasUser && !hasPassword) {
    if (env.NODE_ENV === "production") {
      return unavailable(
        "Admin authentication is not configured. Set FOMU_NEXUS_ADMIN_USER and FOMU_NEXUS_ADMIN_PASSWORD.",
      );
    }

    return { authorized: true };
  }

  if (!hasUser || !hasPassword) {
    return unavailable(
      "Admin authentication is partially configured. Set both FOMU_NEXUS_ADMIN_USER and FOMU_NEXUS_ADMIN_PASSWORD.",
    );
  }

  if (!authorizationHeader) {
    return unauthorized();
  }

  const decoded = decodeBasicCredentials(authorizationHeader);
  if (!decoded) {
    return unauthorized("Invalid admin authentication header.");
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return unauthorized("Invalid admin authentication credentials.");
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (
    constantTimeEquals(username, configuredUser ?? "") &&
    constantTimeEquals(password, configuredPassword ?? "")
  ) {
    return { authorized: true };
  }

  return unauthorized("Invalid admin authentication credentials.");
}

export function createAdminAuthFailureResponse(result: AdminAuthResult): Response {
  if (result.authorized) {
    throw new Error("Cannot create an auth failure response for an authorized result.");
  }

  return Response.json(
    { error: result.message },
    {
      status: result.status,
      headers: result.headers,
    },
  );
}
