/**
 * Bash MCP server integration test suite.
 *
 * Validates that the bash-based zstar MCP server (mcp-server.sh) works
 * correctly when launched as a child process over stdio — the same way
 * Docker containers communicate with MCP clients.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

const SERVER_SCRIPT = path.resolve(__dirname, "../mcp-server.sh");
const ZSTAR_PATH = path.resolve(__dirname, "../zstar/tarzst-project/tarzst.sh");

describe("Bash MCP server (stdio transport)", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "bash",
      args: [SERVER_SCRIPT],
      env: {
        ...process.env,
        ZSTAR_PATH,
      },
      stderr: "pipe",
    });

    client = new Client({ name: "bash-test-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  // --- Protocol handshake ---------------------------------------------------

  describe("MCP protocol handshake", () => {
    it("server reports its identity after connection", async () => {
      const { tools } = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  // --- Tool discovery --------------------------------------------------------

  describe("tool discovery", () => {
    it("lists all 22 zstar tools", async () => {
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
      expect(names).toContain("net_stream_archive");
      expect(names).toContain("net_stream_encrypted_archive");
      expect(names).toContain("net_stream_signed_encrypted_archive");
      expect(names).toContain("listen_for_stream");
      expect(names).toContain("gpg_init_agent_communication");
      expect(names).toContain("encrypted_agent_stream");
      expect(names).toContain("request_secure_channel");
      expect(names).toContain("gpg_list_keys");
      expect(names).toContain("gpg_generate_key");
      expect(names).toContain("gpg_export_public_key");
      expect(names).toContain("gpg_import_key");
      expect(names).toContain("write_file");
      expect(names).toContain("read_file");
      expect(tools.length).toBe(22);
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

  // --- Tool schemas ----------------------------------------------------------

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
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("signingKeyId");
      expect(required).toContain("passphrase");
    });

    it("sign_and_encrypt_archive requires recipientKeyId", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "sign_and_encrypt_archive");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("recipientKeyId");
    });

    it("net_stream_archive requires inputPaths and target", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "net_stream_archive");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("inputPaths");
      expect(required).toContain("target");
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

    it("gpg_init_agent_communication requires agentName, agentEmail, and passphrase", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "gpg_init_agent_communication");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("agentName");
      expect(required).toContain("agentEmail");
      expect(required).toContain("passphrase");
    });

    it("request_secure_channel requires agentName, agentEmail, and passphrase", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "request_secure_channel");
      expect(tool).toBeDefined();
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("agentName");
      expect(required).toContain("agentEmail");
      expect(required).toContain("passphrase");
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
      expect(text).toContain("nc");
      expect(text).toContain("Dependency Check Results:");
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

    it("verify_checksum succeeds with a valid checksum file", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bash-srv-test-"));
      try {
        fs.writeFileSync(path.join(tmpDir, "data.bin"), "bash server test\n");
        const checksumCmd = process.platform === "darwin"
          ? "shasum -a 512 data.bin > data.bin.sha512"
          : "sha512sum data.bin > data.bin.sha512";
        execSync(checksumCmd, { cwd: tmpDir });

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

    it("net_stream_archive returns validation error for invalid target", async () => {
      const result = await client.callTool({
        name: "net_stream_archive",
        arguments: {
          inputPaths: ["/tmp"],
          target: "no-port-here",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("host:port");
    });

    it("net_stream_encrypted_archive returns validation error for invalid target", async () => {
      const result = await client.callTool({
        name: "net_stream_encrypted_archive",
        arguments: {
          inputPaths: ["/tmp"],
          target: "host:abc",
          password: "testpass",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("numeric");
    });

    it("net_stream_signed_encrypted_archive returns validation error for invalid target", async () => {
      const result = await client.callTool({
        name: "net_stream_signed_encrypted_archive",
        arguments: {
          inputPaths: ["/tmp"],
          target: "a:b:c",
          signingKeyId: "sender@example.com",
          passphrase: "pass",
          recipientKeyId: "recipient@example.com",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("host:port");
    });

    it("listen_for_stream returns FAILED for nonexistent script", async () => {
      const result = await client.callTool({
        name: "listen_for_stream",
        arguments: {
          scriptPath: "/nonexistent/decompress.sh",
          port: 9000,
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("gpg_list_keys returns key listing or empty message", async () => {
      const result = await client.callTool({
        name: "gpg_list_keys",
        arguments: {},
      });
      expect(result.content).toHaveLength(1);
      const text = (result.content[0] as { type: string; text: string }).text;
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

    it("encrypted_agent_stream returns validation error for invalid target", async () => {
      const result = await client.callTool({
        name: "encrypted_agent_stream",
        arguments: {
          inputPaths: ["/tmp"],
          target: "bad-target",
          signingKeyId: "agent@test.local",
          passphrase: "pass",
          recipientKeyId: "other@test.local",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("host:port");
    });

    it("encrypted_agent_stream returns error when signing key is missing", async () => {
      const result = await client.callTool({
        name: "encrypted_agent_stream",
        arguments: {
          inputPaths: ["/tmp"],
          target: "localhost:9000",
          signingKeyId: "nonexistent-bash@test.local",
          passphrase: "pass",
          recipientKeyId: "other@test.local",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("Signing key not found");
    });

    it("request_secure_channel returns error for invalid listening address", async () => {
      const result = await client.callTool({
        name: "request_secure_channel",
        arguments: {
          agentName: "Test Agent",
          agentEmail: `bash-channel-${Date.now()}@test.local`,
          passphrase: "pass",
          listeningAddress: "no-port",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("Invalid listening address");
    });

    it("request_secure_channel generates request successfully", async () => {
      const email = `bash-channel-ok-${Date.now()}@test.local`;
      const result = await client.callTool({
        name: "request_secure_channel",
        arguments: {
          agentName: "Bash Channel Agent",
          agentEmail: email,
          passphrase: "channel-pass",
          listeningAddress: "bash-host:9000",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("generated successfully");
      expect(text).toContain("gpg_import_key");
      expect(text).toContain("gpg_init_agent_communication");
      expect(text).toContain("bash-host:9000");
    });

    it("write_file returns error for nonexistent file", async () => {
      const result = await client.callTool({
        name: "write_file",
        arguments: {
          filePath: "/nonexistent/secret.txt",
          signingKeyId: "signer@example.com",
          passphrase: "pass",
          recipientKeyId: "recipient@example.com",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });

    it("read_file returns error for nonexistent file", async () => {
      const result = await client.callTool({
        name: "read_file",
        arguments: { filePath: "/nonexistent/secret.txt.gpg" },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("not found");
    });
  });
});
