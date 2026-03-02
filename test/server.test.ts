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
      expect(toolNames).toContain("net_stream_archive");
      expect(toolNames).toContain("net_stream_encrypted_archive");
      expect(toolNames).toContain("net_stream_signed_encrypted_archive");
      expect(toolNames).toContain("listen_for_stream");
      expect(toolNames).toContain("gpg_init_agent_communication");
      expect(toolNames).toContain("encrypted_agent_stream");
      expect(toolNames).toContain("request_secure_channel");
      expect(toolNames).toContain("gpg_list_keys");
      expect(toolNames).toContain("gpg_generate_key");
      expect(toolNames).toContain("gpg_export_public_key");
      expect(toolNames).toContain("gpg_import_key");
      expect(toolNames).toContain("write_file");
      expect(toolNames).toContain("read_file");
      expect(tools.length).toBe(22);
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

    it("net_stream_archive requires inputPaths and target", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "net_stream_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("inputPaths");
      expect(props).toHaveProperty("target");
      expect(props).toHaveProperty("compressionLevel");
      expect(props).toHaveProperty("excludePatterns");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("inputPaths");
      expect(required).toContain("target");
    });

    it("net_stream_encrypted_archive requires inputPaths, target, and password", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "net_stream_encrypted_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("password");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("inputPaths");
      expect(required).toContain("target");
      expect(required).toContain("password");
    });

    it("net_stream_signed_encrypted_archive requires signing and recipient keys", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "net_stream_signed_encrypted_archive");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("signingKeyId");
      expect(props).toHaveProperty("passphrase");
      expect(props).toHaveProperty("recipientKeyId");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("inputPaths");
      expect(required).toContain("target");
      expect(required).toContain("signingKeyId");
      expect(required).toContain("passphrase");
      expect(required).toContain("recipientKeyId");
    });

    it("listen_for_stream requires scriptPath and port", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "listen_for_stream");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("scriptPath");
      expect(props).toHaveProperty("port");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("scriptPath");
      expect(required).toContain("port");
    });

    it("gpg_init_agent_communication requires agentName, agentEmail, and passphrase", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "gpg_init_agent_communication");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("agentName");
      expect(props).toHaveProperty("agentEmail");
      expect(props).toHaveProperty("passphrase");
      expect(props).toHaveProperty("keyType");
      expect(props).toHaveProperty("outputFile");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("agentName");
      expect(required).toContain("agentEmail");
      expect(required).toContain("passphrase");
    });

    it("encrypted_agent_stream requires inputPaths, target, signing and recipient keys", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "encrypted_agent_stream");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("inputPaths");
      expect(props).toHaveProperty("target");
      expect(props).toHaveProperty("signingKeyId");
      expect(props).toHaveProperty("passphrase");
      expect(props).toHaveProperty("recipientKeyId");
      expect(props).toHaveProperty("compressionLevel");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("inputPaths");
      expect(required).toContain("target");
      expect(required).toContain("signingKeyId");
      expect(required).toContain("passphrase");
      expect(required).toContain("recipientKeyId");
    });

    it("request_secure_channel requires agentName, agentEmail, and passphrase", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "request_secure_channel");
      expect(tool).toBeDefined();
      const props = tool!.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty("agentName");
      expect(props).toHaveProperty("agentEmail");
      expect(props).toHaveProperty("passphrase");
      expect(props).toHaveProperty("keyType");
      expect(props).toHaveProperty("listeningAddress");
      const required = tool!.inputSchema.required as string[];
      expect(required).toContain("agentName");
      expect(required).toContain("agentEmail");
      expect(required).toContain("passphrase");
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
      const checksumCmd = process.platform === "darwin"
        ? `shasum -a 512 testfile.txt > testfile.txt.sha512`
        : `sha512sum testfile.txt > testfile.txt.sha512`;
      execSync(checksumCmd, { cwd: tmpDir });

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

    it("net_stream_archive returns validation error for invalid target", async () => {
      const result = await client.callTool({
        name: "net_stream_archive",
        arguments: {
          inputPaths: ["/tmp"],
          target: "invalid-no-port",
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

    it("listen_for_stream returns error for nonexistent script", async () => {
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

    it("check_dependencies includes nc in output", async () => {
      const result = await client.callTool({
        name: "check_dependencies",
        arguments: {},
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("nc");
    });

    it("encrypted_agent_stream returns validation error for invalid target", async () => {
      const result = await client.callTool({
        name: "encrypted_agent_stream",
        arguments: {
          inputPaths: ["/tmp"],
          target: "invalid-target",
          signingKeyId: "sender@example.com",
          passphrase: "pass",
          recipientKeyId: "recipient@example.com",
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
          signingKeyId: "nonexistent-agent@test.local",
          passphrase: "pass",
          recipientKeyId: "other-agent@test.local",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("Signing key not found");
    });

    it("agent-to-agent key exchange and encrypted stream validation (end-to-end)", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-mcp-a2a-"));

      const alphaEmail = `mcp-alpha-${Date.now()}@zstar-test.local`;
      const betaEmail = `mcp-beta-${Date.now()}@zstar-test.local`;

      try {
        // Phase 1: Both agents initialize GPG identities via MCP tools
        const alphaInit = await client.callTool({
          name: "gpg_init_agent_communication",
          arguments: {
            agentName: "MCP Alpha",
            agentEmail: alphaEmail,
            passphrase: "alpha-mcp-pass",
          },
        });
        const alphaText = (alphaInit.content[0] as { type: string; text: string }).text;
        expect(alphaText).toContain("initialized successfully");

        const betaInit = await client.callTool({
          name: "gpg_init_agent_communication",
          arguments: {
            agentName: "MCP Beta",
            agentEmail: betaEmail,
            passphrase: "beta-mcp-pass",
          },
        });
        const betaText = (betaInit.content[0] as { type: string; text: string }).text;
        expect(betaText).toContain("initialized successfully");

        // Phase 2: Export keys via gpg_export_public_key and import via gpg_import_key
        const alphaExport = await client.callTool({
          name: "gpg_export_public_key",
          arguments: { keyId: alphaEmail },
        });
        const alphaExportText = (alphaExport.content[0] as { type: string; text: string }).text;
        expect(alphaExportText).toContain("BEGIN PGP PUBLIC KEY BLOCK");

        const betaExport = await client.callTool({
          name: "gpg_export_public_key",
          arguments: { keyId: betaEmail },
        });
        const betaExportText = (betaExport.content[0] as { type: string; text: string }).text;
        expect(betaExportText).toContain("BEGIN PGP PUBLIC KEY BLOCK");

        // Write keys to files for import
        const alphaKeyFile = path.join(tmpDir, "alpha_public.asc");
        const betaKeyFile = path.join(tmpDir, "beta_public.asc");
        // Extract the PGP block from the export output
        const extractPgpBlock = (text: string) => {
          const start = text.indexOf("-----BEGIN PGP PUBLIC KEY BLOCK-----");
          const end = text.indexOf("-----END PGP PUBLIC KEY BLOCK-----");
          return text.substring(start, end + "-----END PGP PUBLIC KEY BLOCK-----".length);
        };
        fs.writeFileSync(alphaKeyFile, extractPgpBlock(alphaExportText));
        fs.writeFileSync(betaKeyFile, extractPgpBlock(betaExportText));

        const alphaImport = await client.callTool({
          name: "gpg_import_key",
          arguments: { keyFile: betaKeyFile },
        });
        const alphaImportText = (alphaImport.content[0] as { type: string; text: string }).text;
        expect(alphaImportText).toContain("imported successfully");

        const betaImport = await client.callTool({
          name: "gpg_import_key",
          arguments: { keyFile: alphaKeyFile },
        });
        const betaImportText = (betaImport.content[0] as { type: string; text: string }).text;
        expect(betaImportText).toContain("imported successfully");

        // Phase 3: Verify encrypted_agent_stream passes key validation
        const streamResult = await client.callTool({
          name: "encrypted_agent_stream",
          arguments: {
            inputPaths: ["/tmp"],
            target: "localhost:19879",
            signingKeyId: alphaEmail,
            passphrase: "alpha-mcp-pass",
            recipientKeyId: betaEmail,
          },
        });
        const streamText = (streamResult.content[0] as { type: string; text: string }).text;
        // Key validation should pass — no "Signing key not found" or "Recipient key not found"
        expect(streamText).not.toContain("Signing key not found");
        expect(streamText).not.toContain("Recipient key not found");
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("request_secure_channel generates request successfully", async () => {
      const email = `mcp-channel-${Date.now()}@zstar-test.local`;
      const result = await client.callTool({
        name: "request_secure_channel",
        arguments: {
          agentName: "Channel Requester",
          agentEmail: email,
          passphrase: "channel-pass",
          listeningAddress: "requester-host:9000",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("generated successfully");
      expect(text).toContain("gpg_import_key");
      expect(text).toContain("gpg_init_agent_communication");
      expect(text).toContain("requester-host:9000");
    });

    it("request_secure_channel returns error for invalid listening address", async () => {
      const result = await client.callTool({
        name: "request_secure_channel",
        arguments: {
          agentName: "Bad Address Agent",
          agentEmail: `bad-addr-${Date.now()}@zstar-test.local`,
          passphrase: "pass",
          listeningAddress: "invalid-no-port",
        },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      expect(text).toContain("FAILED");
      expect(text).toContain("Invalid listening address");
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
