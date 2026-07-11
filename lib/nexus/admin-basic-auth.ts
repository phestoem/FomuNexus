export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

export type AdminAuthEnvironment = {
  nodeEnv?: string;
  adminUser?: string;
  adminPassword?: string;
};

export type AdminAuthDecision =
  | { type: "allow"; reason: "development-unconfigured" | "authenticated" }
  | { type: "deny"; reason: "missing" | "invalid" }
  | { type: "misconfigured"; reason: "missing-credentials" | "partial-credentials" };

function isConfigured(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function decodeBasicCredentials(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(authorizationHeader.slice("Basic ".length).trim());
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

export function evaluateAdminBasicAuth(
  authorizationHeader: string | null,
  environment: AdminAuthEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    adminUser: process.env.FOMU_NEXUS_ADMIN_USER,
    adminPassword: process.env.FOMU_NEXUS_ADMIN_PASSWORD,
  },
): AdminAuthDecision {
  const adminUser = environment.adminUser;
  const adminPassword = environment.adminPassword;
  const hasUser = isConfigured(adminUser);
  const hasPassword = isConfigured(adminPassword);

  if (!hasUser && !hasPassword) {
    if (environment.nodeEnv === "production") {
      return { type: "misconfigured", reason: "missing-credentials" };
    }

    return { type: "allow", reason: "development-unconfigured" };
  }

  if (!hasUser || !hasPassword) {
    return { type: "misconfigured", reason: "partial-credentials" };
  }

  const credentials = decodeBasicCredentials(authorizationHeader);

  if (!credentials) {
    return { type: "deny", reason: "missing" };
  }

  if (
    safeEqual(credentials.username, adminUser) &&
    safeEqual(credentials.password, adminPassword)
  ) {
    return { type: "allow", reason: "authenticated" };
  }

  return { type: "deny", reason: "invalid" };
}
