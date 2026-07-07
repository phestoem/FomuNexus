type AuthEnvironment = Record<string, string | undefined>;

type AdminAuthDecision =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 503;
      body: string;
      headers: Record<string, string>;
    };

const ADMIN_AUTH_REALM = "Fomu Nexus Admin";
const ADMIN_USER_ENV = "FOMU_NEXUS_ADMIN_USER";
const ADMIN_PASSWORD_ENV = "FOMU_NEXUS_ADMIN_PASSWORD";

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function getConfiguredCredentials(env: AuthEnvironment) {
  const username = env[ADMIN_USER_ENV];
  const password = env[ADMIN_PASSWORD_ENV];

  return {
    username,
    password,
    hasUsername: hasValue(username),
    hasPassword: hasValue(password),
  };
}

function buildUnauthorizedDecision(): AdminAuthDecision {
  return {
    ok: false,
    status: 401,
    body: "Authentication required.",
    headers: {
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  };
}

function buildMisconfiguredDecision(): AdminAuthDecision {
  return {
    ok: false,
    status: 503,
    body: "Admin authentication is not configured.",
    headers: {
      "Cache-Control": "no-store",
    },
  };
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

export function getAdminAuthDecision(
  request: Pick<Request, "headers">,
  env: AuthEnvironment = process.env,
): AdminAuthDecision {
  const { username, password, hasUsername, hasPassword } =
    getConfiguredCredentials(env);
  const hasCompleteCredentials = hasUsername && hasPassword;

  if (!hasCompleteCredentials) {
    const credentialsFullyAbsent = !hasUsername && !hasPassword;

    if (env.NODE_ENV !== "production" && credentialsFullyAbsent) {
      return { ok: true };
    }

    return buildMisconfiguredDecision();
  }

  const credentials = decodeBasicCredentials(request.headers.get("authorization"));

  if (
    credentials &&
    credentials.username === username &&
    credentials.password === password
  ) {
    return { ok: true };
  }

  return buildUnauthorizedDecision();
}
