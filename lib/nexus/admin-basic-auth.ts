export type AdminAuthDecision =
  | { authorized: true }
  | {
      authorized: false;
      status: 401 | 503;
      message: string;
      wwwAuthenticate?: string;
    };

type AdminAuthEnvironment = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

const ADMIN_REALM = "Fomu Nexus Admin";

function decodeBasicCredentials(headerValue: string): {
  username: string;
  password: string;
} | null {
  if (!headerValue.startsWith("Basic ")) {
    return null;
  }

  const encoded = headerValue.slice("Basic ".length).trim();
  if (!encoded) {
    return null;
  }

  try {
    const decoded =
      typeof atob === "function"
        ? atob(encoded)
        : Buffer.from(encoded, "base64").toString("utf8");
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

function timingSafeEqual(actual: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  const maxLength = Math.max(actualBytes.length, expectedBytes.length);
  let diff = actualBytes.length ^ expectedBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return diff === 0;
}

function credentialsConfigured(env: AdminAuthEnvironment): env is Required<
  Pick<
    AdminAuthEnvironment,
    "FOMU_NEXUS_ADMIN_USER" | "FOMU_NEXUS_ADMIN_PASSWORD"
  >
> &
  AdminAuthEnvironment {
  return Boolean(
    env.FOMU_NEXUS_ADMIN_USER && env.FOMU_NEXUS_ADMIN_PASSWORD,
  );
}

export function authenticateAdminRequest(
  authorizationHeader: string | null,
  env: AdminAuthEnvironment = process.env,
): AdminAuthDecision {
  if (!credentialsConfigured(env)) {
    if (env.NODE_ENV === "production") {
      return {
        authorized: false,
        status: 503,
        message: "Admin authentication is not configured.",
      };
    }

    return { authorized: true };
  }

  const credentials = authorizationHeader
    ? decodeBasicCredentials(authorizationHeader)
    : null;

  if (
    credentials &&
    timingSafeEqual(credentials.username, env.FOMU_NEXUS_ADMIN_USER) &&
    timingSafeEqual(credentials.password, env.FOMU_NEXUS_ADMIN_PASSWORD)
  ) {
    return { authorized: true };
  }

  return {
    authorized: false,
    status: 401,
    message: "Authentication required.",
    wwwAuthenticate: `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
  };
}
