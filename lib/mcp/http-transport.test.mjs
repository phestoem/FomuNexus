import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleStatelessMcpRequest } from "./http-transport.ts";

function createServer() {
  const server = new McpServer({
    name: "transport-test",
    version: "1.0.0",
  });

  server.registerTool(
    "ping",
    {
      description: "Returns a static response.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text", text: "pong" }],
    }),
  );

  return server;
}

function createMcpRequest(body) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify(body),
  });
}

test("accepts independent client initializations without retaining sessions", async () => {
  const initializeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "transport-test-client",
        version: "1.0.0",
      },
    },
  };

  const responses = await Promise.all([
    handleStatelessMcpRequest(createMcpRequest(initializeRequest), createServer),
    handleStatelessMcpRequest(createMcpRequest(initializeRequest), createServer),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("mcp-session-id"), null);
    assert.match(await response.text(), /"protocolVersion"/);
  }
});

test("handles later protocol requests without process-local session state", async () => {
  const response = await handleStatelessMcpRequest(
    createMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
    createServer,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("mcp-session-id"), null);
  assert.match(await response.text(), /"ping"/);
});
