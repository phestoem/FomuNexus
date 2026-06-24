type AdminAuthEnv = Pick<NodeJS.ProcessEnv, "NODE_ENV"> & {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
};

const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/api/mcp",
  "/api/nexus/analytics",
  "/api/nexus/blueprints",
  "/api/nexus/create-blueprint",
  "/api/nexus/seed",
  "/api/nexus/start-copilot",
] as const;

export function shouldProtectAdminPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function hasAdminAuthCredentials(env: AdminAuthEnv = process.env): boolean {
  return Boolean(
    env.FOMU_NEXUS_ADMIN_USER?.trim() &&
      env.FOMU_NEXUS_ADMIN_PASSWORD?.trim(),
  );
}

export function shouldEnforceAdminAuth(env: AdminAuthEnv = process.env): boolean {
  return (
    env.NODE_ENV === "production" ||
    Boolean(env.FOMU_NEXUS_ADMIN_USER || env.FOMU_NEXUS_ADMIN_PASSWORD)
  );
}

function decodeBasicAuthHeader(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader?.toLowerCase().startsWith("basic ")) {
    return null;
  }

  const encodedCredentials = authorizationHeader.slice("Basic ".length).trim();
  if (!encodedCredentials) {
    return null;
  }

  let decodedCredentials: string;
  try {
    decodedCredentials = atob(encodedCredentials);
  } catch {
    return null;
  }

  const separatorIndex = decodedCredentials.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decodedCredentials.slice(0, separatorIndex),
    password: decodedCredentials.slice(separatorIndex + 1),
  };
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

export function isValidAdminAuthorization(
  authorizationHeader: string | null,
  env: AdminAuthEnv = process.env,
): boolean {
  const expectedUsername = env.FOMU_NEXUS_ADMIN_USER?.trim();
  const expectedPassword = env.FOMU_NEXUS_ADMIN_PASSWORD?.trim();

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const credentials = decodeBasicAuthHeader(authorizationHeader);
  if (!credentials) {
    return false;
  }

  return (
    timingSafeEqual(credentials.username, expectedUsername) &&
    timingSafeEqual(credentials.password, expectedPassword)
  );
}
