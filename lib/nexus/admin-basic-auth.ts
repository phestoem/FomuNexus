export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

export type AdminAuthDecision =
  | "authorized"
  | "disabled"
  | "misconfigured"
  | "unauthorized";

type AdminAuthEnvironment = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

type ParsedBasicAuth = {
  username: string;
  password: string;
};

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function parseBasicAuthHeader(
  authorizationHeader: string | null,
): ParsedBasicAuth | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return null;
  }

  try {
    const decoded = atob(match[1]);
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

function constantTimeEquals(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

export function getAdminAuthDecision(
  authorizationHeader: string | null,
  env: AdminAuthEnvironment = process.env,
): AdminAuthDecision {
  const configuredUsername = env.FOMU_NEXUS_ADMIN_USER;
  const configuredPassword = env.FOMU_NEXUS_ADMIN_PASSWORD;
  const hasUsername = isPresent(configuredUsername);
  const hasPassword = isPresent(configuredPassword);

  if (!hasUsername && !hasPassword && env.NODE_ENV !== "production") {
    return "disabled";
  }

  if (!hasUsername || !hasPassword) {
    return "misconfigured";
  }

  const parsedAuth = parseBasicAuthHeader(authorizationHeader);
  if (!parsedAuth) {
    return "unauthorized";
  }

  return constantTimeEquals(parsedAuth.username, configuredUsername) &&
    constantTimeEquals(parsedAuth.password, configuredPassword)
    ? "authorized"
    : "unauthorized";
}
