export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

type AdminAuthEnv = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

type AdminAuthConfig =
  | {
      mode: "configured";
      username: string;
      password: string;
    }
  | {
      mode: "disabled";
    }
  | {
      mode: "unavailable";
    };

export type AdminAuthResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      status: 401 | 503;
      error: string;
      challenge: boolean;
    };

function getAdminAuthConfig(env: AdminAuthEnv): AdminAuthConfig {
  const username = env.FOMU_NEXUS_ADMIN_USER;
  const password = env.FOMU_NEXUS_ADMIN_PASSWORD;
  const hasUsername = typeof username === "string" && username.length > 0;
  const hasPassword = typeof password === "string" && password.length > 0;

  if (hasUsername && hasPassword) {
    return {
      mode: "configured",
      username,
      password,
    };
  }

  if (!hasUsername && !hasPassword && env.NODE_ENV !== "production") {
    return { mode: "disabled" };
  }

  return { mode: "unavailable" };
}

function decodeBasicCredentials(authorizationHeader: string | null): {
  username: string;
  password: string;
} | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, encodedCredentials] = authorizationHeader.split(/\s+/, 2);
  if (
    !scheme ||
    scheme.toLowerCase() !== "basic" ||
    !encodedCredentials ||
    encodedCredentials.length === 0
  ) {
    return null;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(encodedCredentials, "base64").toString("utf8");
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
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

export function authorizeAdminRequest(
  authorizationHeader: string | null,
  env: AdminAuthEnv = process.env,
): AdminAuthResult {
  const config = getAdminAuthConfig(env);

  if (config.mode === "disabled") {
    return { allowed: true };
  }

  if (config.mode === "unavailable") {
    return {
      allowed: false,
      status: 503,
      error: "Admin authentication is not configured.",
      challenge: false,
    };
  }

  const credentials = decodeBasicCredentials(authorizationHeader);
  if (
    !credentials ||
    !constantTimeEqual(credentials.username, config.username) ||
    !constantTimeEqual(credentials.password, config.password)
  ) {
    return {
      allowed: false,
      status: 401,
      error: "Authentication required.",
      challenge: true,
    };
  }

  return { allowed: true };
}

