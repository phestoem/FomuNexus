import { createNexusMcpServer } from "@/lib/mcp/nexus-mcp-server";
import { handleStatelessMcpRequest } from "@/lib/mcp/http-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function buildCorsHeaders(request: Request, base?: Headers): Headers {
  const headers = new Headers(base);
  const origin = request.headers.get("origin") ?? "*";
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id, Mcp-Protocol-Version",
  );
  return headers;
}

function withCors(request: Request, response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildCorsHeaders(request, response.headers),
  });
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const origin = resolveOrigin(request);
  const response = await handleStatelessMcpRequest(request, () =>
    createNexusMcpServer(origin),
  );
  return withCors(request, response);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS(request: Request) {
  const headers = buildCorsHeaders(request);
  headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  const requested = request.headers.get("access-control-request-headers");
  headers.set(
    "Access-Control-Allow-Headers",
    requested && requested.trim().length > 0
      ? requested
      : "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  );
  return new Response(null, { status: 204, headers });
}
