export type AdminCredentials = {
  username: string;
  password: string;
};

type AdminCredentialEnv = {
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
  NODE_ENV?: string;
};

export function getConfiguredAdminCredentials(
  env: AdminCredentialEnv = process.env,
): AdminCredentials | null {
  const username = env.FOMU_NEXUS_ADMIN_USER;
  const password = env.FOMU_NEXUS_ADMIN_PASSWORD;

  if (!username?.trim() || !password?.trim()) {
    return null;
  }

  return { username, password };
}

export function isProductionEnvironment(env: AdminCredentialEnv = process.env) {
  return env.NODE_ENV === "production";
}

export function isValidBasicAuthorization(
  authorizationHeader: string | null,
  credentials: AdminCredentials,
): boolean {
  const parsed = parseBasicAuthorization(authorizationHeader);

  if (!parsed) {
    return false;
  }

  return (
    constantTimeEqual(parsed.username, credentials.username) &&
    constantTimeEqual(parsed.password, credentials.password)
  );
}

function parseBasicAuthorization(
  authorizationHeader: string | null,
): AdminCredentials | null {
  const match = authorizationHeader?.match(/^Basic\s+(.+)$/i);

  if (!match) {
    return null;
  }

  try {
    const decoded = atob(match[1]);
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

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length;
  }

  const maxLength = Math.max(left.length, right.length, 1);
  let difference = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      left.charCodeAt(index % left.length) ^
      right.charCodeAt(index % right.length);
  }

  return difference === 0;
}
