export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

export const PROTECTED_ADMIN_PATH_PREFIXES = [
  "/admin",
  "/api/mcp",
  "/api/nexus/analytics",
  "/api/nexus/blueprints",
  "/api/nexus/create-blueprint",
  "/api/nexus/seed",
  "/api/nexus/start-copilot",
  "/api/nexus/start-session",
] as const;

type AdminCredentials = {
  user: string;
  password: string;
};

type AdminAuthEnvironment = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

type AdminRouteAuthRequest = {
  pathname: string;
  method: string;
  authorizationHeader: string | null;
  env?: AdminAuthEnvironment;
};

type AdminRouteAuthDecision =
  | { status: "pass" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export function isProtectedAdminPath(pathname: string): boolean {
  return PROTECTED_ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getConfiguredCredentials(
  env: AdminAuthEnvironment,
): AdminCredentials | null {
  const user = env.FOMU_NEXUS_ADMIN_USER?.trim();
  const password = env.FOMU_NEXUS_ADMIN_PASSWORD?.trim();

  if (!user || !password) {
    return null;
  }

  return { user, password };
}

function hasPartialCredentialConfiguration(env: AdminAuthEnvironment): boolean {
  const hasUser = Boolean(env.FOMU_NEXUS_ADMIN_USER?.trim());
  const hasPassword = Boolean(env.FOMU_NEXUS_ADMIN_PASSWORD?.trim());

  return hasUser !== hasPassword;
}

function parseBasicAuth(header: string | null): AdminCredentials | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = header.slice("Basic ".length).trim();

  try {
    const decoded = atob(encodedCredentials);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function credentialsMatch(
  submitted: AdminCredentials | null,
  configured: AdminCredentials,
): boolean {
  return (
    submitted?.user === configured.user &&
    submitted.password === configured.password
  );
}

export function evaluateAdminRouteAuth({
  pathname,
  method,
  authorizationHeader,
  env = process.env,
}: AdminRouteAuthRequest): AdminRouteAuthDecision {
  if (!isProtectedAdminPath(pathname) || method === "OPTIONS") {
    return { status: "pass" };
  }

  const configuredCredentials = getConfiguredCredentials(env);

  if (!configuredCredentials) {
    if (
      env.NODE_ENV === "production" ||
      hasPartialCredentialConfiguration(env)
    ) {
      return { status: "unavailable" };
    }

    return { status: "pass" };
  }

  const submittedCredentials = parseBasicAuth(authorizationHeader);

  if (!credentialsMatch(submittedCredentials, configuredCredentials)) {
    return { status: "unauthorized" };
  }

  return { status: "pass" };
}
