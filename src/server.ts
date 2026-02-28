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
    "Check whether all required and optional system dependencies for zstar are installed (bash, tar, zstd, sha512sum, numfmt, gpg, pv).",
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
