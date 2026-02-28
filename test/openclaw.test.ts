/**
 * OpenClaw integration test suite.
 *
 * Validates that the zstar MCP server works correctly when launched as a
 * child process over stdio — the same way OpenClaw spawns MCP servers
 * configured in openclaw.json.
 *
 * Each test mirrors real OpenClaw behaviour:
 *   command: "node"
 *   args:    ["dist/index.js"]
 *   transport: stdio
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

const SERVER_ENTRY = path.resolve(__dirname, "../dist/index.js");

describe("OpenClaw integration (stdio transport)", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Launch server exactly the way openclaw.json would
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_ENTRY],
      stderr: "pipe",
    });

    client = new Client({ name: "openclaw-test-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  // --- Protocol handshake ---------------------------------------------------

  describe("MCP protocol handshake", () => {
    it("server reports its identity after connection", async () => {
      // If we got here, initialize/initialized handshake already succeeded.
      // Verify the client is connected and functional by listing tools.
      const { tools } = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  // --- Tool discovery --------------------------------------------------------

  describe("tool discovery", () => {
    it("lists all 13 zstar tools", async () => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);

      expect(names).toContain("create_archive");
      expect(names).toContain("encrypt_archive");
      expect(names).toContain("sign_archive");
      expect(names).toContain("sign_and_encrypt_archive");
      expect(names).toContain("create_burn_after_reading_archive");
      expect(names).toContain("extract_archive");
      expect(names).toContain("list_archive");
      expect(names).toContain("verify_checksum");
      expect(names).toContain("check_dependencies");
      expect(names).toContain("gpg_list_keys");
      expect(names).toContain("gpg_generate_key");
      expect(names).toContain("gpg_export_public_key");
      expect(names).toContain("gpg_import_key");
      expect(tools.length).toBe(13);
    });

    it("every tool has a non-empty description", async () => {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.description!.length).toBeGreaterThan(10);
      }
    });

    it("every tool has an object input schema", async () => {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
    });
  });

  // --- Tool execution --------------------------------------------------------

  describe("tool execution", () => {
    it("check_dependencies returns dependency status", async () => {
      const result = await client.callTool({
        name: "check_dependencies",
        arguments: {},
      });
      expect(result.content).toHaveLength(1);

      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("bash");
      expect(text).toContain("tar");
      expect(text).toContain("zstd");
      expect(text).toContain("sha512sum");
      expect(text).toContain("gpg");
      expect(text).toContain("pv");
      expect(text).toContain("Dependency Check Results:");
    });

    it("verify_checksum succeeds with a valid checksum file", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "data.bin"), "openclaw test data\n");
        execSync("sha512sum data.bin > data.bin.sha512", { cwd: tmpDir });

        const result = await client.callTool({
          name: "verify_checksum",
          arguments: {
            checksumFile: path.join(tmpDir, "data.bin.sha512"),
            cwd: tmpDir,
          },
        });

        const text = (result.content[0] as { type: string; text: string }).text;
        expect(text).toContain("SUCCESS");
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("verify_checksum detects a corrupted file", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-test-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "data.bin"), "original\n");
        execSync("sha512sum data.bin > data.bin.sha512", { cwd: tmpDir });
        fs.writeFileSync(path.join(tmpDir, "data.bin"), "tampered\n");

        const result = await client.callTool({
          name: "verify_checksum",
          arguments: {
            checksumFile: path.join(tmpDir, "data.bin.sha512"),
            cwd: tmpDir,
          },
        });

        const text = (result.content[0] as { type: string; text: string }).text;
        expect(text).toContain("FAILED");
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  // --- Error handling --------------------------------------------------------

  describe("error handling", () => {
    it("verify_checksum returns FAILED for nonexistent file", async () => {
      const result = await client.callTool({
        name: "verify_checksum",
        arguments: { checksumFile: "/nonexistent/file.sha512" },
      });

      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("extract_archive returns FAILED for nonexistent script", async () => {
      const result = await client.callTool({
        name: "extract_archive",
        arguments: { scriptPath: "/nonexistent/decompress.sh" },
      });

      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("list_archive returns FAILED for nonexistent script", async () => {
      const result = await client.callTool({
        name: "list_archive",
        arguments: { scriptPath: "/nonexistent/decompress.sh" },
      });

      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });
  });
});
