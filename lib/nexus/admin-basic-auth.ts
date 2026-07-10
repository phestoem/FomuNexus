export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";
export const ADMIN_USER_ENV = "FOMU_NEXUS_ADMIN_USER";
export const ADMIN_PASSWORD_ENV = "FOMU_NEXUS_ADMIN_PASSWORD";

export type AdminAuthDecision =
  | { kind: "allow" }
  | { kind: "unauthorized" }
  | { kind: "misconfigured" };

type AdminAuthEnvironment = {
  NODE_ENV?: string;
  [ADMIN_USER_ENV]?: string;
  [ADMIN_PASSWORD_ENV]?: string;
};

type ConfiguredCredentials =
  | { state: "configured"; username: string; password: string }
  | { state: "disabled-local" }
  | { state: "misconfigured" };

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function getConfiguredCredentials(
  env: AdminAuthEnvironment,
): ConfiguredCredentials {
  const username = env[ADMIN_USER_ENV];
  const password = env[ADMIN_PASSWORD_ENV];
  const hasUsername = hasValue(username);
  const hasPassword = hasValue(password);

  if (hasUsername && hasPassword) {
    return { state: "configured", username, password };
  }

  if (!hasUsername && !hasPassword && env.NODE_ENV !== "production") {
    return { state: "disabled-local" };
  }

  return { state: "misconfigured" };
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function decodeBasicCredentials(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = authorizationHeader.slice("Basic ".length).trim();

  try {
    const decoded =
      typeof atob === "function"
        ? atob(encodedCredentials)
        : Buffer.from(encodedCredentials, "base64").toString("utf8");
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
  authorizationHeader: string | null,
  env: AdminAuthEnvironment = process.env,
): AdminAuthDecision {
  const configuredCredentials = getConfiguredCredentials(env);

  if (configuredCredentials.state === "disabled-local") {
    return { kind: "allow" };
  }

  if (configuredCredentials.state === "misconfigured") {
    return { kind: "misconfigured" };
  }

  const requestCredentials = decodeBasicCredentials(authorizationHeader);

  if (!requestCredentials) {
    return { kind: "unauthorized" };
  }

  const usernameMatches = timingSafeStringEqual(
    requestCredentials.username,
    configuredCredentials.username,
  );
  const passwordMatches = timingSafeStringEqual(
    requestCredentials.password,
    configuredCredentials.password,
  );

  return usernameMatches && passwordMatches
    ? { kind: "allow" }
    : { kind: "unauthorized" };
}
