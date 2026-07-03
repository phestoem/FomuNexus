export type AdminAuthDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 401 | 503;
      error: string;
      challenge?: string;
    };

export type AdminAuthHeaders = Pick<Headers, "get">;

const ADMIN_REALM = "Fomu Nexus Admin";

function hasConfiguredCredentials(username?: string, password?: string): boolean {
  return Boolean(username && password);
}

function hasPartialCredentials(username?: string, password?: string): boolean {
  return Boolean(username || password) && !hasConfiguredCredentials(username, password);
}

function decodeBasicCredentials(value: string): { username: string; password: string } | null {
  const [scheme, encoded] = value.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "basic" || !encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded);
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

function timingSafeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    const rightCode = index < right.length ? right.charCodeAt(index) : 0;
    mismatch |= leftCode ^ rightCode;
  }

  return mismatch === 0;
}

function unauthorizedDecision(): AdminAuthDecision {
  return {
    allowed: false,
    status: 401,
    error: "Authentication required.",
    challenge: `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
  };
}

export function evaluateAdminBasicAuth(params: {
  headers: AdminAuthHeaders;
  username?: string;
  password?: string;
  nodeEnv?: string;
}): AdminAuthDecision {
  const username = params.username?.trim();
  const password = params.password;
  const isProduction = params.nodeEnv === "production";

  if (hasPartialCredentials(username, password)) {
    return {
      allowed: false,
      status: 503,
      error: "Admin authentication is misconfigured.",
    };
  }

  if (!hasConfiguredCredentials(username, password)) {
    if (isProduction) {
      return {
        allowed: false,
        status: 503,
        error: "Admin authentication is not configured.",
      };
    }

    return { allowed: true };
  }

  const credentials = decodeBasicCredentials(params.headers.get("authorization") ?? "");

  if (!credentials) {
    return unauthorizedDecision();
  }

  if (
    !timingSafeEqual(credentials.username, username ?? "") ||
    !timingSafeEqual(credentials.password, password ?? "")
  ) {
    return unauthorizedDecision();
  }

  return { allowed: true };
}
