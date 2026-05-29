import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createNexusMcpServer } from "@/lib/mcp/nexus-mcp-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();
let mcpServer: McpServer | null = null;

function resolveOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function getOrCreateMcpServer(origin: string): McpServer {
  if (!mcpServer) {
    mcpServer = createNexusMcpServer(origin);
  }
  return mcpServer;
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

function jsonRpcErrorResponse(
  request: Request,
  status: number,
  message: string,
): Response {
  const headers = buildCorsHeaders(request);
  headers.set("Content-Type", "application/json");

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    }),
    {
      status,
      headers,
    },
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const origin = resolveOrigin(request);
  const server = getOrCreateMcpServer(origin);
  const parsedBody = await readJsonBody(request);
  const sessionId = request.headers.get("mcp-session-id");

  if (parsedBody && isInitializeRequest(parsedBody)) {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
      onsessionclosed: (id) => {
        transports.delete(id);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        transports.delete(id);
      }
    };

    await server.connect(transport);

    const response = await transport.handleRequest(request, { parsedBody });
    if (transport.sessionId && !transports.has(transport.sessionId)) {
      transports.set(transport.sessionId, transport);
    }

    return withCors(request, response);
  }

  if (!sessionId || !transports.has(sessionId)) {
    return jsonRpcErrorResponse(
      request,
      400,
      "Bad Request: No valid session ID provided",
    );
  }

  const transport = transports.get(sessionId)!;
  const response = await transport.handleRequest(request, { parsedBody });
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
