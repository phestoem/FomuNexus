type AdminAuthEnvironment = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

export type AdminAuthState =
  | {
      mode: "disabled";
    }
  | {
      mode: "misconfigured";
    }
  | {
      mode: "enabled";
      username: string;
      password: string;
    };

export type AdminAuthResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "missing_credentials" | "invalid_credentials";
    };

export function resolveAdminAuthState(
  env: AdminAuthEnvironment = process.env,
): AdminAuthState {
  const username = env.FOMU_NEXUS_ADMIN_USER?.trim() ?? "";
  const password = env.FOMU_NEXUS_ADMIN_PASSWORD ?? "";

  if (username.length > 0 && password.length > 0) {
    return {
      mode: "enabled",
      username,
      password,
    };
  }

  if (env.NODE_ENV === "production") {
    return { mode: "misconfigured" };
  }

  return { mode: "disabled" };
}

function decodeBasicAuthCredentials(value: string): string | null {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function parseBasicAuthHeader(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, encodedCredentials] = authorizationHeader.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "basic" || !encodedCredentials) {
    return null;
  }

  const decodedCredentials = decodeBasicAuthCredentials(encodedCredentials);
  if (!decodedCredentials) {
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

function constantTimeEquals(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

export function validateAdminBasicAuth(
  authorizationHeader: string | null,
  authState: AdminAuthState = resolveAdminAuthState(),
): AdminAuthResult {
  if (authState.mode === "disabled") {
    return { ok: true };
  }

  if (authState.mode === "misconfigured") {
    return { ok: false, reason: "missing_credentials" };
  }

  const credentials = parseBasicAuthHeader(authorizationHeader);

  if (
    credentials &&
    constantTimeEquals(credentials.username, authState.username) &&
    constantTimeEquals(credentials.password, authState.password)
  ) {
    return { ok: true };
  }

  return { ok: false, reason: "invalid_credentials" };
}
