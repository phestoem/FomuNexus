const ADMIN_USER_ENV = "FOMU_NEXUS_ADMIN_USER";
const ADMIN_PASSWORD_ENV = "FOMU_NEXUS_ADMIN_PASSWORD";

export type AdminAuthStatus =
  | { status: "open-dev" }
  | { status: "misconfigured" }
  | { status: "unauthorized" }
  | { status: "authorized" };

function getConfiguredCredentials(env: NodeJS.ProcessEnv = process.env):
  | { configured: false; misconfigured: false }
  | { configured: false; misconfigured: true }
  | { configured: true; username: string; password: string } {
  const username = env[ADMIN_USER_ENV]?.trim() ?? "";
  const password = env[ADMIN_PASSWORD_ENV] ?? "";
  const hasUsername = username.length > 0;
  const hasPassword = password.length > 0;

  if (!hasUsername && !hasPassword) {
    return { configured: false, misconfigured: false };
  }

  if (!hasUsername || !hasPassword) {
    return { configured: false, misconfigured: true };
  }

  return { configured: true, username, password };
}

function decodeBasicAuth(header: string | null): {
  username: string;
  password: string;
} | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(header.slice("Basic ".length));
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

function constantTimeEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

export function evaluateAdminBasicAuth(
  authorizationHeader: string | null,
  env: NodeJS.ProcessEnv = process.env,
): AdminAuthStatus {
  const credentials = getConfiguredCredentials(env);

  if (!credentials.configured) {
    if (credentials.misconfigured || env.NODE_ENV === "production") {
      return { status: "misconfigured" };
    }

    return { status: "open-dev" };
  }

  const parsed = decodeBasicAuth(authorizationHeader);
  if (!parsed) {
    return { status: "unauthorized" };
  }

  if (
    constantTimeEqual(parsed.username, credentials.username) &&
    constantTimeEqual(parsed.password, credentials.password)
  ) {
    return { status: "authorized" };
  }

  return { status: "unauthorized" };
}

export function buildBasicAuthChallengeHeaders(): Headers {
  const headers = new Headers();
  headers.set("WWW-Authenticate", 'Basic realm="Fomu Nexus Admin"');
  headers.set("Cache-Control", "no-store");
  return headers;
}
