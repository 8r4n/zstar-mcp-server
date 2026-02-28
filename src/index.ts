#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running on stdio and will handle MCP messages
}

main().catch((error) => {
  console.error("Fatal error starting zstar MCP server:", error);
  process.exit(1);
});
