export type AdminAuthDecision =
  | { kind: "authorized" }
  | { kind: "disabled" }
  | { kind: "unauthorized" }
  | { kind: "unavailable" };

export const ADMIN_AUTH_USER_ENV = "FOMU_NEXUS_ADMIN_USER";
export const ADMIN_AUTH_PASSWORD_ENV = "FOMU_NEXUS_ADMIN_PASSWORD";

type AdminAuthEnv = Pick<NodeJS.ProcessEnv, "NODE_ENV"> &
  Partial<
    Record<
      typeof ADMIN_AUTH_USER_ENV | typeof ADMIN_AUTH_PASSWORD_ENV,
      string
    >
  >;

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function decodeBasicCredentials(authorization: string | null): {
  username: string;
  password: string;
} | null {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  const encoded = authorization.slice("Basic ".length).trim();
  if (!encoded) {
    return null;
  }

  let decoded: string;
  try {
    decoded = atob(encoded);
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

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

export function evaluateAdminBasicAuth(
  authorization: string | null,
  env: AdminAuthEnv = process.env,
): AdminAuthDecision {
  const configuredUser = env[ADMIN_AUTH_USER_ENV];
  const configuredPassword = env[ADMIN_AUTH_PASSWORD_ENV];
  const hasUser = hasValue(configuredUser);
  const hasPassword = hasValue(configuredPassword);

  if (!hasUser && !hasPassword && env.NODE_ENV !== "production") {
    return { kind: "disabled" };
  }

  if (!hasUser || !hasPassword) {
    return { kind: "unavailable" };
  }

  const credentials = decodeBasicCredentials(authorization);
  if (!credentials) {
    return { kind: "unauthorized" };
  }

  if (
    constantTimeEqual(credentials.username, configuredUser) &&
    constantTimeEqual(credentials.password, configuredPassword)
  ) {
    return { kind: "authorized" };
  }

  return { kind: "unauthorized" };
}
