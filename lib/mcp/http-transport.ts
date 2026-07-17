import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

type McpServerFactory = () => McpServer;

export async function handleStatelessMcpRequest(
  request: Request,
  createServer: McpServerFactory,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createServer();

  await server.connect(transport);
  return transport.handleRequest(request);
}
