import { timingSafeEqual } from "node:crypto";

const ADMIN_REALM = "Fomu Nexus Admin";

type AdminCredentials =
  | {
      enabled: true;
      username: string;
      password: string;
    }
  | {
      enabled: false;
      reason: "development-bypass" | "missing-production-secret";
    };

function resolveAdminCredentials(): AdminCredentials {
  const password =
    process.env.FOMU_NEXUS_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;

  if (!password) {
    return {
      enabled: false,
      reason:
        process.env.NODE_ENV === "production"
          ? "missing-production-secret"
          : "development-bypass",
    };
  }

  return {
    enabled: true,
    username:
      process.env.FOMU_NEXUS_ADMIN_USERNAME ??
      process.env.ADMIN_USERNAME ??
      "admin",
    password,
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBasicAuthHeader(
  authorization: string | null,
): { username: string; password: string } | null {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = Buffer.from(authorization.slice("Basic ".length), "base64")
      .toString("utf8");
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

function prefersJson(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  const accept = request.headers.get("accept") ?? "";

  return pathname.startsWith("/api/") || accept.includes("application/json");
}

function buildAuthResponse(
  request: Request,
  status: number,
  message: string,
  authenticate: boolean,
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });

  if (authenticate) {
    headers.set("WWW-Authenticate", `Basic realm="${ADMIN_REALM}"`);
  }

  if (prefersJson(request)) {
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers,
    });
  }

  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(message, {
    status,
    headers,
  });
}

export function validateAdminRequest(request: Request): Response | null {
  const credentials = resolveAdminCredentials();

  if (!credentials.enabled) {
    if (credentials.reason === "development-bypass") {
      return null;
    }

    return buildAuthResponse(
      request,
      503,
      "Admin authentication is not configured.",
      false,
    );
  }

  const provided = parseBasicAuthHeader(request.headers.get("authorization"));

  if (
    provided &&
    safeEqual(provided.username, credentials.username) &&
    safeEqual(provided.password, credentials.password)
  ) {
    return null;
  }

  return buildAuthResponse(
    request,
    401,
    "Admin authentication required.",
    true,
  );
}
