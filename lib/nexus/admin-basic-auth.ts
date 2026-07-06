const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

type AdminAuthEnvironment = {
  NODE_ENV?: string;
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
};

type SuccessfulAdminAuthResult = {
  ok: true;
};

type FailedAdminAuthResult = {
  ok: false;
  status: 401 | 503;
  body: string;
  headers: Record<string, string>;
};

export type AdminAuthResult =
  | SuccessfulAdminAuthResult
  | FailedAdminAuthResult;

function buildUnauthorizedResult(): FailedAdminAuthResult {
  return {
    ok: false,
    status: 401,
    body: "Authentication required.",
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    },
  };
}

function buildMisconfiguredResult(): FailedAdminAuthResult {
  return {
    ok: false,
    status: 503,
    body: "Admin authentication is not configured.",
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

function normalizeCredential(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function parseBasicAuthorization(
  authorization: string | null,
): { username: string; password: string } | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (extra || scheme?.toLowerCase() !== "basic" || !token) {
    return null;
  }

  try {
    const decoded = atob(token);
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

export function evaluateAdminBasicAuth(
  authorization: string | null,
  environment: AdminAuthEnvironment = process.env,
): AdminAuthResult {
  const username = normalizeCredential(environment.FOMU_NEXUS_ADMIN_USER);
  const password = normalizeCredential(environment.FOMU_NEXUS_ADMIN_PASSWORD);
  const hasPartialCredentials = Boolean(username) !== Boolean(password);

  if (hasPartialCredentials) {
    return buildMisconfiguredResult();
  }

  if (!username || !password) {
    return environment.NODE_ENV === "production"
      ? buildMisconfiguredResult()
      : { ok: true };
  }

  const parsedAuthorization = parseBasicAuthorization(authorization);

  if (
    !parsedAuthorization ||
    !constantTimeEqual(parsedAuthorization.username, username) ||
    !constantTimeEqual(parsedAuthorization.password, password)
  ) {
    return buildUnauthorizedResult();
  }

  return { ok: true };
}
