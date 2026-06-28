export type AdminAuthEnv = {
  NODE_ENV?: string;
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
};

export type AdminCredentialState =
  | {
      status: "configured";
      username: string;
      password: string;
    }
  | {
      status: "open-development";
    }
  | {
      status: "missing";
    };

const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/api/mcp",
  "/api/nexus/analytics",
  "/api/nexus/blueprints",
  "/api/nexus/create-blueprint",
  "/api/nexus/start-copilot",
  "/api/nexus/start-session",
  "/api/nexus/seed",
] as const;

export function isProtectedAdminPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getAdminCredentialState(
  env: AdminAuthEnv = process.env,
): AdminCredentialState {
  const username = env.FOMU_NEXUS_ADMIN_USER;
  const password = env.FOMU_NEXUS_ADMIN_PASSWORD;
  const hasUsername = typeof username === "string" && username.length > 0;
  const hasPassword = typeof password === "string" && password.length > 0;

  if (hasUsername && hasPassword) {
    return {
      status: "configured",
      username,
      password,
    };
  }

  if (!hasUsername && !hasPassword && env.NODE_ENV !== "production") {
    return { status: "open-development" };
  }

  return { status: "missing" };
}

function decodeBasicCredentials(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(authorizationHeader.slice("Basic ".length));
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
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

export function isAdminRequestAuthorized(
  authorizationHeader: string | null,
  env: AdminAuthEnv = process.env,
): boolean {
  const credentialState = getAdminCredentialState(env);

  if (credentialState.status === "open-development") {
    return true;
  }

  if (credentialState.status !== "configured") {
    return false;
  }

  const credentials = decodeBasicCredentials(authorizationHeader);

  if (!credentials) {
    return false;
  }

  return (
    constantTimeEqual(credentials.username, credentialState.username) &&
    constantTimeEqual(credentials.password, credentialState.password)
  );
}
