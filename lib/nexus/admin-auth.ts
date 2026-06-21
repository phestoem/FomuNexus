import { timingSafeEqual } from "node:crypto";

export const ADMIN_AUTH_REALM = "Fomu Nexus Admin";

type AdminAuthEnvironment = {
  NODE_ENV?: string;
  FOMU_NEXUS_ADMIN_USER?: string;
  FOMU_NEXUS_ADMIN_PASSWORD?: string;
};

export type AdminAuthDecision =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 503;
      error: string;
    };

function configuredCredentials(environment: AdminAuthEnvironment) {
  const username = environment.FOMU_NEXUS_ADMIN_USER?.trim() ?? "";
  const password = environment.FOMU_NEXUS_ADMIN_PASSWORD ?? "";

  return {
    username,
    password,
    hasUsername: username.length > 0,
    hasPassword: password.length > 0,
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length, 1);
  const paddedLeft = new Uint8Array(maxLength);
  const paddedRight = new Uint8Array(maxLength);

  paddedLeft.set(leftBytes.slice(0, maxLength));
  paddedRight.set(rightBytes.slice(0, maxLength));

  return (
    timingSafeEqual(paddedLeft, paddedRight) &&
    leftBytes.length === rightBytes.length
  );
}

function decodeBasicCredentials(
  authorizationHeader: string | null,
): { username: string; password: string } | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, encodedCredentials] = authorizationHeader.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "basic" || !encodedCredentials) {
    return null;
  }

  let decoded: string;

  try {
    decoded = Buffer.from(encodedCredentials, "base64").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function validateAdminBasicAuth(
  request: Pick<Request, "headers">,
  environment: AdminAuthEnvironment = process.env,
): AdminAuthDecision {
  const credentials = configuredCredentials(environment);
  const credentialsConfigured = credentials.hasUsername && credentials.hasPassword;

  if (!credentialsConfigured) {
    if (
      environment.NODE_ENV !== "production" &&
      !credentials.hasUsername &&
      !credentials.hasPassword
    ) {
      return { ok: true };
    }

    return {
      ok: false,
      status: 503,
      error: "Admin authentication is not configured.",
    };
  }

  const suppliedCredentials = decodeBasicCredentials(
    request.headers.get("authorization"),
  );

  if (!suppliedCredentials) {
    return {
      ok: false,
      status: 401,
      error: "Admin authentication is required.",
    };
  }

  const usernameMatches = constantTimeEqual(
    suppliedCredentials.username,
    credentials.username,
  );
  const passwordMatches = constantTimeEqual(
    suppliedCredentials.password,
    credentials.password,
  );

  if (!usernameMatches || !passwordMatches) {
    return {
      ok: false,
      status: 401,
      error: "Admin authentication is required.",
    };
  }

  return { ok: true };
}

export function createAdminAuthResponse(
  decision: Exclude<AdminAuthDecision, { ok: true }>,
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });

  if (decision.status === 401) {
    headers.set(
      "WWW-Authenticate",
      `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    );
  }

  return new Response(JSON.stringify({ error: decision.error }), {
    status: decision.status,
    headers,
  });
}
