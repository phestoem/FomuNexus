export function resolveAppOrigin(request?: Request): string {
  if (request) {
    return new URL(request.url).origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function buildFormUrl(sessionId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/form/${sessionId}`;
}
