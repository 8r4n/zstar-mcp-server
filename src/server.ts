import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as zstar from "./zstar.js";

/**
 * Create and configure the zstar MCP server with all tools.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "zstar-mcp-server",
    version: "1.0.0",
  });

  // --- Tool: create_archive ---
  server.tool(
    "create_archive",
    "Create a compressed tar.zst archive from files or directories using zstd compression with SHA-512 checksum verification and a self-extracting decompress script.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name for output files"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.createArchive({
        inputPaths: params.inputPaths,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Archive creation");
    }
  );

  // --- Tool: encrypt_archive ---
  server.tool(
    "encrypt_archive",
    "Create a password-encrypted (AES-256 symmetric) compressed archive. The archive is encrypted using GPG symmetric encryption.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive"),
      password: z.string().min(1).describe("Symmetric encryption password"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name for output files"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.encryptArchive({
        inputPaths: params.inputPaths,
        password: params.password,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Encrypted archive creation");
    }
  );

  // --- Tool: sign_archive ---
  server.tool(
    "sign_archive",
    "Create a GPG-signed compressed archive. The archive is signed with your GPG private key for authenticity verification.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive"),
      signingKeyId: z
        .string()
        .min(1)
        .describe("GPG key ID for signing (e.g., email or fingerprint)"),
      passphrase: z.string().min(1).describe("Passphrase for the signing key"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name for output files"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.signArchive({
        inputPaths: params.inputPaths,
        signingKeyId: params.signingKeyId,
        passphrase: params.passphrase,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Signed archive creation");
    }
  );

  // --- Tool: sign_and_encrypt_archive ---
  server.tool(
    "sign_and_encrypt_archive",
    "Create a GPG-signed and recipient-encrypted compressed archive. Combines signing with public-key encryption for a specific recipient.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive"),
      signingKeyId: z
        .string()
        .min(1)
        .describe("GPG key ID for signing (e.g., email or fingerprint)"),
      passphrase: z.string().min(1).describe("Passphrase for the signing key"),
      recipientKeyId: z
        .string()
        .min(1)
        .describe("GPG key ID of the recipient for encryption"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name for output files"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.signAndEncryptArchive({
        inputPaths: params.inputPaths,
        signingKeyId: params.signingKeyId,
        passphrase: params.passphrase,
        recipientKeyId: params.recipientKeyId,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Signed and encrypted archive creation");
    }
  );

  // --- Tool: create_burn_after_reading_archive ---
  server.tool(
    "create_burn_after_reading_archive",
    "Create an archive with a self-erase routine. After extraction, archive files are securely shredded. Ideal for sensitive one-time transfers.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name for output files"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.createBurnAfterReadingArchive({
        inputPaths: params.inputPaths,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Burn-after-reading archive creation");
    }
  );

  // --- Tool: extract_archive ---
  server.tool(
    "extract_archive",
    "Extract a zstar archive using the generated self-extracting decompress script. Handles integrity verification, decryption, and decompression automatically.",
    {
      scriptPath: z
        .string()
        .min(1)
        .describe("Path to the generated *_decompress.sh script"),
      cwd: z.string().optional().describe("Working directory for extraction"),
    },
    async (params) => {
      const result = await zstar.extractArchive({
        scriptPath: params.scriptPath,
        cwd: params.cwd,
      });
      return formatResult(result, "Archive extraction");
    }
  );

  // --- Tool: list_archive ---
  server.tool(
    "list_archive",
    "List the contents of a zstar archive without extracting, using the generated decompress script's 'list' mode.",
    {
      scriptPath: z
        .string()
        .min(1)
        .describe("Path to the generated *_decompress.sh script"),
      cwd: z.string().optional().describe("Working directory"),
    },
    async (params) => {
      const result = await zstar.listArchive({
        scriptPath: params.scriptPath,
        cwd: params.cwd,
      });
      return formatResult(result, "Archive listing");
    }
  );

  // --- Tool: verify_checksum ---
  server.tool(
    "verify_checksum",
    "Verify the SHA-512 checksum of a zstar archive to ensure its integrity. Uses the .sha512 file generated during archive creation.",
    {
      checksumFile: z
        .string()
        .min(1)
        .describe("Path to the .sha512 checksum file"),
      cwd: z.string().optional().describe("Working directory"),
    },
    async (params) => {
      const result = await zstar.verifyChecksum({
        checksumFile: params.checksumFile,
        cwd: params.cwd,
      });
      return formatResult(result, "Checksum verification");
    }
  );

  // --- Tool: check_dependencies ---
  server.tool(
    "check_dependencies",
    "Check whether all required system dependencies for zstar are installed (bash, tar, zstd, sha512sum, numfmt, gpg, pv) and optional dependencies (nc for network streaming). On macOS, automatically detects platform alternatives (shasum for sha512sum, gnumfmt for numfmt).",
    {},
    async () => {
      const deps = await zstar.checkDependencies();
      const lines = deps.map(
        (d) =>
          `${d.available ? "✓" : "✗"} ${d.name} — ${d.available ? "installed" : "NOT FOUND"}${d.required ? " (required)" : " (optional)"}`
      );
      const allRequired = deps
        .filter((d) => d.required)
        .every((d) => d.available);
      const summary = allRequired
        ? "All required dependencies are installed."
        : "Some required dependencies are missing!";
      return {
        content: [
          {
            type: "text" as const,
            text: `Dependency Check Results:\n${lines.join("\n")}\n\n${summary}`,
          },
        ],
      };
    }
  );

  // --- Tool: net_stream_archive ---
  server.tool(
    "net_stream_archive",
    "Stream a compressed archive directly to a remote host via netcat (nc), bypassing all disk I/O. No archive file, checksum, or decompress script is written to disk. Requires nc (netcat) installed on both sender and receiver.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive and stream"),
      target: z
        .string()
        .min(1)
        .describe(
          "Network destination in host:port format (e.g., 'remote_host:9000'). Hostname must contain only alphanumeric characters, dots, underscores, and hyphens. Port must be 1-65535."
        ),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name (used for stream identification)"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.netStreamArchive({
        inputPaths: params.inputPaths,
        target: params.target,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Network stream");
    }
  );

  // --- Tool: net_stream_encrypted_archive ---
  server.tool(
    "net_stream_encrypted_archive",
    "Stream a password-encrypted (AES-256 symmetric) compressed archive directly to a remote host via netcat. No files are written to disk. The receiver needs the same password to decrypt.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive and stream"),
      target: z
        .string()
        .min(1)
        .describe(
          "Network destination in host:port format (e.g., 'remote_host:9000')"
        ),
      password: z.string().min(1).describe("Symmetric encryption password"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name (used for stream identification)"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.netStreamEncryptedArchive({
        inputPaths: params.inputPaths,
        target: params.target,
        password: params.password,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Encrypted network stream");
    }
  );

  // --- Tool: net_stream_signed_encrypted_archive ---
  server.tool(
    "net_stream_signed_encrypted_archive",
    "Stream a GPG-signed and recipient-encrypted compressed archive directly to a remote host via netcat. Uses asymmetric encryption — the sender signs with their private key and encrypts for the recipient's public key. No files are written to disk.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive and stream"),
      target: z
        .string()
        .min(1)
        .describe(
          "Network destination in host:port format (e.g., 'remote_host:9000')"
        ),
      signingKeyId: z
        .string()
        .min(1)
        .describe("GPG key ID for signing (e.g., email or fingerprint)"),
      passphrase: z.string().min(1).describe("Passphrase for the signing key"),
      recipientKeyId: z
        .string()
        .min(1)
        .describe("GPG key ID of the recipient for encryption"),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name (used for stream identification)"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.netStreamSignedEncryptedArchive({
        inputPaths: params.inputPaths,
        target: params.target,
        signingKeyId: params.signingKeyId,
        passphrase: params.passphrase,
        recipientKeyId: params.recipientKeyId,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Signed encrypted network stream");
    }
  );

  // --- Tool: listen_for_stream ---
  server.tool(
    "listen_for_stream",
    "Listen for incoming streamed data using a decompress script's listen mode. The decompress script receives, decrypts (if applicable), decompresses, and extracts streamed data in real-time. Requires nc (netcat) installed. Start this before the sender streams data.",
    {
      scriptPath: z
        .string()
        .min(1)
        .describe("Path to the generated *_decompress.sh script"),
      port: z
        .number()
        .int()
        .min(1)
        .max(65535)
        .describe("Port number to listen on (1-65535)"),
      cwd: z.string().optional().describe("Working directory"),
    },
    async (params) => {
      const result = await zstar.listenForStream({
        scriptPath: params.scriptPath,
        port: params.port,
        cwd: params.cwd,
      });
      return formatResult(result, "Stream listener");
    }
  );

  // --- Tool: gpg_init_agent_communication ---
  server.tool(
    "gpg_init_agent_communication",
    "Initialize GPG identity for encrypted agent-to-agent communication. Generates a GPG key pair for the local agent (if not already present) and exports the public key. This is the first step in establishing a secure channel between two agents. Share the exported public key with the remote agent.",
    {
      agentName: z
        .string()
        .min(1)
        .describe(
          "Display name for the agent (e.g., 'Agent Alpha' or 'Build Server')"
        ),
      agentEmail: z
        .string()
        .min(1)
        .describe(
          "Email identifier for the agent (e.g., 'agent-alpha@mcp-server.local')"
        ),
      passphrase: z
        .string()
        .min(1)
        .describe("Passphrase to protect the agent's private key"),
      keyType: z
        .enum(["RSA", "DSA", "EDDSA"])
        .optional()
        .describe("Key type. Default: EDDSA (modern, fast)"),
      keyLength: z
        .number()
        .int()
        .min(1024)
        .max(4096)
        .optional()
        .describe("Key length in bits (for RSA/DSA). Default: 4096"),
      expireDate: z
        .string()
        .optional()
        .describe(
          "Key expiry (e.g., '1y' for 1 year, '0' for no expiry). Default: '0'"
        ),
      outputFile: z
        .string()
        .optional()
        .describe(
          "File path to save the exported public key (e.g., './agent_alpha_public.asc'). If omitted, the armored key is returned directly."
        ),
    },
    async (params) => {
      const result = await zstar.gpgInitAgentCommunication({
        agentName: params.agentName,
        agentEmail: params.agentEmail,
        passphrase: params.passphrase,
        keyType: params.keyType,
        keyLength: params.keyLength,
        expireDate: params.expireDate,
        outputFile: params.outputFile,
      });

      const parts: string[] = [];
      parts.push(
        result.success
          ? "Agent GPG communication initialized successfully."
          : "Agent GPG communication initialization FAILED."
      );
      parts.push(`\n${result.details}`);

      if (result.success && result.publicKey) {
        parts.push(`\nPublic Key:\n${result.publicKey}`);
      }

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    }
  );

  // --- Tool: encrypted_agent_stream ---
  server.tool(
    "encrypted_agent_stream",
    "Stream GPG-signed and encrypted data directly from one agent to another over the network. Validates that both agents have each other's keys, then streams a signed + recipient-encrypted compressed archive via netcat. The sender signs with their private key and encrypts for the recipient's public key. Requires prior key exchange via gpg_init_agent_communication.",
    {
      inputPaths: z
        .array(z.string())
        .min(1)
        .describe("Files or directories to archive and stream to the remote agent"),
      target: z
        .string()
        .min(1)
        .describe(
          "Remote agent's network address in host:port format (e.g., 'agent-b-host:9000')"
        ),
      signingKeyId: z
        .string()
        .min(1)
        .describe(
          "Local agent's GPG key ID for signing (e.g., 'agent-alpha@mcp-server.local')"
        ),
      passphrase: z
        .string()
        .min(1)
        .describe("Passphrase for the local agent's signing key"),
      recipientKeyId: z
        .string()
        .min(1)
        .describe(
          "Remote agent's GPG key ID for encryption (e.g., 'agent-beta@mcp-server.local')"
        ),
      compressionLevel: z
        .number()
        .int()
        .min(1)
        .max(19)
        .optional()
        .describe("zstd compression level (1-19). Default: 3"),
      outputName: z
        .string()
        .optional()
        .describe("Custom base name for stream identification"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("File exclusion patterns for tar"),
      cwd: z.string().optional().describe("Working directory for the command"),
    },
    async (params) => {
      const result = await zstar.encryptedAgentStream({
        inputPaths: params.inputPaths,
        target: params.target,
        signingKeyId: params.signingKeyId,
        passphrase: params.passphrase,
        recipientKeyId: params.recipientKeyId,
        compressionLevel: params.compressionLevel,
        outputName: params.outputName,
        excludePatterns: params.excludePatterns,
        cwd: params.cwd,
      });
      return formatResult(result, "Encrypted agent-to-agent stream");
    }
  );

  // --- Tool: gpg_list_keys ---
  server.tool(
    "gpg_list_keys",
    "List GPG keys in the keyring. Use this to check which keys are available for signing, encryption, and decryption. Part of the GPG key setup walkthrough.",
    {
      secretOnly: z
        .boolean()
        .optional()
        .describe(
          "If true, list only secret (private) keys. Default: false (lists public keys)"
        ),
    },
    async (params) => {
      const result = await zstar.gpgListKeys(params.secretOnly ?? false);
      const output = result.stdout.trim();
      const hasKeys = output.length > 0 && output.includes("pub") || output.includes("sec");
      return {
        content: [
          {
            type: "text" as const,
            text: hasKeys
              ? `GPG ${params.secretOnly ? "Secret " : ""}Keys:\n\n${output}`
              : `No ${params.secretOnly ? "secret " : ""}keys found in the GPG keyring. Use gpg_generate_key to create a new key pair.`,
          },
        ],
      };
    }
  );

  // --- Tool: gpg_generate_key ---
  server.tool(
    "gpg_generate_key",
    "Generate a new GPG key pair for the user or agent. This is the first step in the GPG setup walkthrough. Creates both a public key (for others to encrypt data for you) and a private key (for decryption and signing).",
    {
      name: z.string().min(1).describe("Real name for the key (e.g., 'Alice Smith' or 'MCP Agent')"),
      email: z
        .string()
        .min(1)
        .describe(
          "Email address for the key (e.g., 'user@example.com' or 'agent@mcp-server.local')"
        ),
      passphrase: z
        .string()
        .min(1)
        .describe("Passphrase to protect the private key"),
      keyType: z
        .enum(["RSA", "DSA", "EDDSA"])
        .optional()
        .describe("Key type. Default: RSA"),
      keyLength: z
        .number()
        .int()
        .min(1024)
        .max(4096)
        .optional()
        .describe("Key length in bits (for RSA/DSA). Default: 4096"),
      expireDate: z
        .string()
        .optional()
        .describe(
          "Key expiry (e.g., '1y' for 1 year, '0' for no expiry). Default: '0'"
        ),
    },
    async (params) => {
      const result = await zstar.gpgGenerateKey({
        name: params.name,
        email: params.email,
        passphrase: params.passphrase,
        keyType: params.keyType,
        keyLength: params.keyLength,
        expireDate: params.expireDate,
      });
      const success = result.exitCode === 0;
      const parts: string[] = [];
      parts.push(
        success
          ? `GPG key pair generated successfully for ${params.name} <${params.email}>.`
          : `GPG key generation FAILED (exit code ${result.exitCode}).`
      );
      if (result.stderr.trim()) {
        parts.push(`\nDetails:\n${result.stderr.trim()}`);
      }
      if (success) {
        parts.push(
          `\nNext steps:\n1. Use gpg_list_keys to verify the new key\n2. Use gpg_export_public_key to export the public key for sharing\n3. Share the exported key with the other party for import`
        );
      }
      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    }
  );

  // --- Tool: gpg_export_public_key ---
  server.tool(
    "gpg_export_public_key",
    "Export a GPG public key in armored (ASCII) format. Use this to share your public key with the other party so they can encrypt data for you. Part of the GPG key setup walkthrough.",
    {
      keyId: z
        .string()
        .min(1)
        .describe(
          "Key ID, email, or fingerprint of the key to export (e.g., 'user@example.com')"
        ),
      outputFile: z
        .string()
        .optional()
        .describe(
          "File path to save the exported key (e.g., './user_public.asc'). If omitted, the armored key is returned directly."
        ),
    },
    async (params) => {
      const result = await zstar.gpgExportPublicKey({
        keyId: params.keyId,
        outputFile: params.outputFile,
      });
      const success = result.exitCode === 0;
      const parts: string[] = [];
      if (success && params.outputFile) {
        parts.push(
          `Public key exported to ${params.outputFile}.\n\nNext step: Share this file with the other party and have them run gpg_import_key to import it.`
        );
      } else if (success && result.stdout.trim()) {
        parts.push(
          `Exported public key for ${params.keyId}:\n\n${result.stdout.trim()}`
        );
      } else {
        parts.push(
          `Public key export FAILED (exit code ${result.exitCode}).`
        );
        if (result.stderr.trim()) {
          parts.push(`\nErrors:\n${result.stderr.trim()}`);
        }
      }
      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    }
  );

  // --- Tool: gpg_import_key ---
  server.tool(
    "gpg_import_key",
    "Import a GPG public key from a file into the keyring. Use this to import the other party's public key so you can encrypt data for them. Part of the GPG key setup walkthrough.",
    {
      keyFile: z
        .string()
        .min(1)
        .describe(
          "Path to the armored key file to import (e.g., './agent_public.asc')"
        ),
    },
    async (params) => {
      const result = await zstar.gpgImportKey({ keyFile: params.keyFile });
      const success = result.exitCode === 0;
      const parts: string[] = [];
      if (success) {
        parts.push(`Key imported successfully.`);
        if (result.stderr.trim()) {
          parts.push(`\nDetails:\n${result.stderr.trim()}`);
        }
        parts.push(
          `\nNext steps:\n1. Use gpg_list_keys to verify the imported key\n2. You can now use sign_and_encrypt_archive with this key as the recipientKeyId`
        );
      } else {
        parts.push(
          `Key import FAILED (exit code ${result.exitCode}).`
        );
        if (result.stderr.trim()) {
          parts.push(`\nErrors:\n${result.stderr.trim()}`);
        }
      }
      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    }
  );

  return server;
}

/**
 * Format a ZstarResult into MCP tool response.
 */
function formatResult(
  result: zstar.ZstarResult,
  operation: string
): { content: Array<{ type: "text"; text: string }> } {
  const success = result.exitCode === 0;
  const parts: string[] = [];

  parts.push(`${operation}: ${success ? "SUCCESS" : "FAILED (exit code " + result.exitCode + ")"}`);

  if (result.stdout.trim()) {
    parts.push(`\nOutput:\n${result.stdout.trim()}`);
  }

  if (result.stderr.trim()) {
    parts.push(`\n${success ? "Warnings" : "Errors"}:\n${result.stderr.trim()}`);
  }

  return {
    content: [{ type: "text" as const, text: parts.join("\n") }],
  };
}
