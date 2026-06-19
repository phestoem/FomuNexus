export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";
export const ADMIN_USER_ENV = "FOMU_NEXUS_ADMIN_USER";
export const ADMIN_PASSWORD_ENV = "FOMU_NEXUS_ADMIN_PASSWORD";

type AdminAuthEnvironment = Pick<
  NodeJS.ProcessEnv,
  "NODE_ENV" | typeof ADMIN_USER_ENV | typeof ADMIN_PASSWORD_ENV
>;

export type AdminAuthDecision =
  | { authorized: true; bypassed: boolean }
  | { authorized: false; status: 401 | 503; message: string };

export function parseBasicAuthHeader(
  authorization: string | null,
): { username: string; password: string } | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Basic\s+(.+)$/i);
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

function hasCredential(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function constantTimeEqual(actual: string, expected: string): boolean {
  let difference = actual.length ^ expected.length;
  const maxLength = Math.max(actual.length, expected.length);

  for (let index = 0; index < maxLength; index += 1) {
    const actualCode = index < actual.length ? actual.charCodeAt(index) : 0;
    const expectedCode = index < expected.length ? expected.charCodeAt(index) : 0;
    difference |= actualCode ^ expectedCode;
  }

  return difference === 0;
}

export function getAdminAuthDecision(
  authorization: string | null,
  env: AdminAuthEnvironment = process.env,
): AdminAuthDecision {
  const configuredUser = env[ADMIN_USER_ENV];
  const configuredPassword = env[ADMIN_PASSWORD_ENV];
  const hasUser = hasCredential(configuredUser);
  const hasPassword = hasCredential(configuredPassword);

  if (!hasUser && !hasPassword) {
    if (env.NODE_ENV === "production") {
      return {
        authorized: false,
        status: 503,
        message: "Admin authentication is not configured.",
      };
    }

    return { authorized: true, bypassed: true };
  }

  if (!hasUser || !hasPassword) {
    return {
      authorized: false,
      status: 503,
      message: "Admin authentication is not configured.",
    };
  }

  const parsed = parseBasicAuthHeader(authorization);
  const credentialsMatch =
    parsed !== null &&
    constantTimeEqual(parsed.username, configuredUser) &&
    constantTimeEqual(parsed.password, configuredPassword);

  if (!credentialsMatch) {
    return {
      authorized: false,
      status: 401,
      message: "Authentication required.",
    };
  }

  return { authorized: true, bypassed: false };
}
