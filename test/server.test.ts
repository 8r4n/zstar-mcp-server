import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

describe("zstar MCP server", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  describe("tool listing", () => {
    it("lists all registered tools", async () => {
      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("create_archive");
      expect(toolNames).toContain("encrypt_archive");
      expect(toolNames).toContain("sign_archive");
      expect(toolNames).toContain("sign_and_encrypt_archive");
      expect(toolNames).toContain("create_burn_after_reading_archive");
      expect(toolNames).toContain("extract_archive");
      expect(toolNames).toContain("list_archive");
      expect(toolNames).toContain("verify_checksum");
      expect(toolNames).toContain("check_dependencies");
      expect(toolNames).toContain("gpg_list_keys");
      expect(toolNames).toContain("gpg_generate_key");
      expect(toolNames).toContain("gpg_export_public_key");
      expect(toolNames).toContain("gpg_import_key");
      expect(tools.length).toBe(13);
    });

    it("each tool has a description", async () => {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.description!.length).toBeGreaterThan(10);
      }
    });

    it("each tool has an input schema", async () => {
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
    });
  });

  describe("tool schemas", () => {
    it("create_archive has correct parameters", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "create_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("inputPaths");
      expect(props).toHaveProperty("compressionLevel");
      expect(props).toHaveProperty("outputName");
      expect(props).toHaveProperty("excludePatterns");
      expect(props).toHaveProperty("cwd");
    });

    it("encrypt_archive requires password", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "encrypt_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("password");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("inputPaths");
      expect(required).toContain("password");
    });

    it("sign_archive requires signingKeyId and passphrase", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "sign_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("signingKeyId");
      expect(props).toHaveProperty("passphrase");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("signingKeyId");
      expect(required).toContain("passphrase");
    });

    it("sign_and_encrypt_archive requires recipientKeyId", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "sign_and_encrypt_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("recipientKeyId");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("recipientKeyId");
    });

    it("extract_archive requires scriptPath", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "extract_archive");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("scriptPath");
    });

    it("list_archive requires scriptPath", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "list_archive");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("scriptPath");
    });

    it("verify_checksum requires checksumFile", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "verify_checksum");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("checksumFile");
    });

    it("check_dependencies has no required parameters", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "check_dependencies");
      expect(tool).toBeDefined();
      // check_dependencies takes no parameters
      const props = tool!.inputSchema.properties as
        | Record<string, unknown>
        | undefined;
      if (props) {
        expect(Object.keys(props).length).toBe(0);
      }
    });

    it("gpg_generate_key requires name, email, and passphrase", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "gpg_generate_key");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("name");
      expect(required).toContain("email");
      expect(required).toContain("passphrase");
    });

    it("gpg_export_public_key requires keyId", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "gpg_export_public_key");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("keyId");
    });

    it("gpg_import_key requires keyFile", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "gpg_import_key");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("keyFile");
    });
  });

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
    });

    it("verify_checksum returns error for nonexistent file", async () => {
      const result = await client.callTool({
        name: "verify_checksum",
        arguments: { checksumFile: "/nonexistent/file.sha512" },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("extract_archive returns error for nonexistent script", async () => {
      const result = await client.callTool({
        name: "extract_archive",
        arguments: { scriptPath: "/nonexistent/decompress.sh" },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("list_archive returns error for nonexistent script", async () => {
      const result = await client.callTool({
        name: "list_archive",
        arguments: { scriptPath: "/nonexistent/decompress.sh" },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("verify_checksum succeeds with valid checksum", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const { execSync } = require("child_process");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-test-"));
      fs.writeFileSync(path.join(tmpDir, "testfile.txt"), "hello world\n");
      execSync(`sha512sum testfile.txt > testfile.txt.sha512`, { cwd: tmpDir });

      const result = await client.callTool({
        name: "verify_checksum",
        arguments: {
          checksumFile: path.join(tmpDir, "testfile.txt.sha512"),
          cwd: tmpDir,
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("SUCCESS");

      fs.rmSync(tmpDir, { recursive: true });
    });

    it("gpg_list_keys returns key listing or empty message", async () => {
      const result = await client.callTool({
        name: "gpg_list_keys",
        arguments: {},
      });
      expect(result.content).toHaveLength(1);
      const text = (result.content[0] as { type: string; text: string }).text;
      // Should return either key listing or empty message
      expect(text.length).toBeGreaterThan(0);
    });

    it("gpg_import_key returns error for nonexistent file", async () => {
      const result = await client.callTool({
        name: "gpg_import_key",
        arguments: { keyFile: "/nonexistent/key.asc" },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });
  });
});
