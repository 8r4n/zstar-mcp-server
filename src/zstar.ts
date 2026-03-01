import { execFile, ExecFileOptions } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** Whether the current platform is macOS. */
const isMacOS = process.platform === "darwin";

/**
 * Result of executing a zstar command.
 */
export interface ZstarResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Options for creating a zstar archive.
 */
export interface CreateArchiveOptions {
  /** Input files or directories to archive. */
  inputPaths: string[];
  /** zstd compression level (1-19). Default: 3. */
  compressionLevel?: number;
  /** Custom base name for output files. */
  outputName?: string;
  /** File exclusion patterns. */
  excludePatterns?: string[];
  /** Working directory for the command. */
  cwd?: string;
}

/**
 * Options for creating a password-encrypted archive.
 */
export interface EncryptArchiveOptions extends CreateArchiveOptions {
  /** Symmetric encryption password. */
  password: string;
}

/**
 * Options for creating a GPG-signed archive.
 */
export interface SignArchiveOptions extends CreateArchiveOptions {
  /** GPG key ID for signing (e.g., email or key fingerprint). */
  signingKeyId: string;
  /** Passphrase for the signing key. */
  passphrase: string;
}

/**
 * Options for creating a signed and recipient-encrypted archive.
 */
export interface SignAndEncryptArchiveOptions extends SignArchiveOptions {
  /** GPG key ID of the recipient for encryption. */
  recipientKeyId: string;
}

/**
 * Options for streaming an archive to a network destination.
 */
export interface NetStreamOptions extends CreateArchiveOptions {
  /** Network destination in host:port format (e.g., "remote_host:9000"). */
  target: string;
}

/**
 * Options for streaming a password-encrypted archive to a network destination.
 */
export interface NetStreamEncryptedOptions extends NetStreamOptions {
  /** Symmetric encryption password. */
  password: string;
}

/**
 * Options for streaming a signed and recipient-encrypted archive to a network destination.
 */
export interface NetStreamSignedEncryptedOptions extends NetStreamOptions {
  /** GPG key ID for signing (e.g., email or key fingerprint). */
  signingKeyId: string;
  /** Passphrase for the signing key. */
  passphrase: string;
  /** GPG key ID of the recipient for encryption. */
  recipientKeyId: string;
}

/**
 * Options for listening for incoming streamed data using a decompress script.
 */
export interface ListenForStreamOptions {
  /** Path to the generated decompress script. */
  scriptPath: string;
  /** Port number to listen on (1-65535). */
  port: number;
  /** Working directory. */
  cwd?: string;
}

/**
 * Options for initializing GPG agent communication.
 * Generates a key pair and exports the public key in one step.
 */
export interface GpgInitAgentOptions {
  /** Display name for the agent (e.g., "Agent Alpha"). */
  agentName: string;
  /** Email identifier for the agent (e.g., "agent-alpha@mcp-server.local"). */
  agentEmail: string;
  /** Passphrase to protect the private key. */
  passphrase: string;
  /** Key type. Default: EDDSA (modern, fast). */
  keyType?: "RSA" | "DSA" | "EDDSA";
  /** Key length in bits (for RSA/DSA). Default: 4096. */
  keyLength?: number;
  /** Key expiry (e.g., "1y", "0" for no expiry). Default: "0". */
  expireDate?: string;
  /** Output file path for the exported public key. If omitted, key is returned in stdout. */
  outputFile?: string;
}

/**
 * Result of initializing GPG agent communication.
 */
export interface GpgInitAgentResult {
  /** Whether the initialization was successful. */
  success: boolean;
  /** The agent's public key in armored (ASCII) format. */
  publicKey: string;
  /** The agent's key fingerprint. */
  fingerprint: string;
  /** Combined output details. */
  details: string;
  /** Output file path if the public key was saved to a file. */
  outputFile?: string;
}

/**
 * Options for encrypted agent-to-agent streaming.
 */
export interface EncryptedAgentStreamOptions {
  /** Files or directories to archive and stream. */
  inputPaths: string[];
  /** Network destination in host:port format (e.g., "remote_host:9000"). */
  target: string;
  /** Signing agent's GPG key ID (e.g., email). */
  signingKeyId: string;
  /** Passphrase for the signing key. */
  passphrase: string;
  /** Recipient agent's GPG key ID (e.g., email). */
  recipientKeyId: string;
  /** zstd compression level (1-19). Default: 3. */
  compressionLevel?: number;
  /** Custom base name for stream identification. */
  outputName?: string;
  /** File exclusion patterns. */
  excludePatterns?: string[];
  /** Working directory for the command. */
  cwd?: string;
}

/**
 * Options for requesting a secure channel with a remote agent.
 */
export interface RequestSecureChannelOptions {
  /** Display name for the requesting agent. */
  agentName: string;
  /** Email identifier for the requesting agent. */
  agentEmail: string;
  /** Passphrase to protect the requesting agent's private key. */
  passphrase: string;
  /** Key type. Default: EDDSA (modern, fast). */
  keyType?: "RSA" | "DSA" | "EDDSA";
  /** Key length in bits (for RSA/DSA). Default: 4096. */
  keyLength?: number;
  /** Key expiry (e.g., "1y", "0" for no expiry). Default: "0". */
  expireDate?: string;
  /** Network host:port where the requesting agent will listen. */
  listeningAddress?: string;
}

/**
 * Result of a secure channel request.
 */
export interface SecureChannelRequest {
  /** Whether the request was generated successfully. */
  success: boolean;
  /** The requesting agent's public key in armored format. */
  publicKey: string;
  /** The requesting agent's key fingerprint. */
  fingerprint: string;
  /** Agent name for identification. */
  agentName: string;
  /** Agent email used as GPG key ID. */
  agentEmail: string;
  /** Network address where the requesting agent will listen (if provided). */
  listeningAddress?: string;
  /** Instructions for the remote agent to complete the secure channel setup. */
  instructions: string;
  /** Combined details of the operation. */
  details: string;
}

/**
 * Options for decompressing/extracting an archive.
 */
export interface ExtractArchiveOptions {
  /** Path to the generated decompress script. */
  scriptPath: string;
  /** Working directory for extraction. */
  cwd?: string;
}

/**
 * Options for listing archive contents.
 */
export interface ListArchiveOptions {
  /** Path to the generated decompress script. */
  scriptPath: string;
  /** Working directory. */
  cwd?: string;
}

/**
 * Options for verifying a checksum.
 */
export interface VerifyChecksumOptions {
  /** Path to the .sha512 checksum file. */
  checksumFile: string;
  /** Working directory. */
  cwd?: string;
}

/**
 * Dependency check result.
 */
export interface DependencyStatus {
  name: string;
  available: boolean;
  required: boolean;
}

const EXEC_TIMEOUT = 300_000; // 5 minutes

/**
 * Find the tarzst.sh script. Looks for it in the following order:
 * 1. ZSTAR_PATH environment variable
 * 2. 'tarzst' or 'tarzst.sh' on PATH
 */
export function findZstarScript(): string {
  if (process.env.ZSTAR_PATH) {
    const envPath = process.env.ZSTAR_PATH;
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    throw new Error(
      `ZSTAR_PATH is set to '${envPath}' but the file does not exist.`
    );
  }

  // Check PATH for 'tarzst' or 'tarzst.sh'
  const pathDirs = (process.env.PATH || "").split(path.delimiter);
  for (const name of ["tarzst", "tarzst.sh"]) {
    for (const dir of pathDirs) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error(
    "Could not find tarzst.sh. Set the ZSTAR_PATH environment variable or ensure 'tarzst' is on your PATH."
  );
}

/**
 * Execute a command and return the result.
 */
function execCommand(
  command: string,
  args: string[],
  options: ExecFileOptions = {}
): Promise<ZstarResult> {
  return new Promise((resolve) => {
    const opts: ExecFileOptions = {
      timeout: EXEC_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      ...options,
    };

    execFile(command, args, opts, (error, stdout, stderr) => {
      const exitCode = error && "code" in error ? (error.code as number) : 0;
      resolve({
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        exitCode: typeof exitCode === "number" ? exitCode : 1,
      });
    });
  });
}

/**
 * Build the argument list for creating an archive.
 */
function buildCreateArgs(options: CreateArchiveOptions): string[] {
  const args: string[] = [];

  if (
    options.compressionLevel !== undefined &&
    options.compressionLevel >= 1 &&
    options.compressionLevel <= 19
  ) {
    args.push("-l", String(options.compressionLevel));
  }

  if (options.outputName) {
    args.push("-o", options.outputName);
  }

  if (options.excludePatterns) {
    for (const pattern of options.excludePatterns) {
      args.push("-e", pattern);
    }
  }

  args.push("--", ...options.inputPaths);
  return args;
}

/**
 * Create a compressed tar.zst archive.
 */
export async function createArchive(
  options: CreateArchiveOptions
): Promise<ZstarResult> {
  const script = findZstarScript();
  const args = buildCreateArgs(options);
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Create a password-encrypted archive.
 */
export async function encryptArchive(
  options: EncryptArchiveOptions
): Promise<ZstarResult> {
  const script = findZstarScript();
  const args = ["-p", ...buildCreateArgs(options)];
  return execCommand(script, args, {
    cwd: options.cwd,
    env: { ...process.env },
    // Password is piped via stdin
  });
}

/**
 * Create a GPG-signed archive.
 */
export async function signArchive(
  options: SignArchiveOptions
): Promise<ZstarResult> {
  const script = findZstarScript();
  const args = ["-s", options.signingKeyId, ...buildCreateArgs(options)];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Create a signed and recipient-encrypted archive.
 */
export async function signAndEncryptArchive(
  options: SignAndEncryptArchiveOptions
): Promise<ZstarResult> {
  const script = findZstarScript();
  const args = [
    "-s",
    options.signingKeyId,
    "-r",
    options.recipientKeyId,
    ...buildCreateArgs(options),
  ];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Create an archive with burn-after-reading flag.
 */
export async function createBurnAfterReadingArchive(
  options: CreateArchiveOptions
): Promise<ZstarResult> {
  const script = findZstarScript();
  const args = ["-b", ...buildCreateArgs(options)];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Validate a network streaming target in host:port format.
 * Returns null if valid, or an error message string if invalid.
 *
 * Validation rules (matching tarzst.sh):
 * - Exactly one ':' separator
 * - Hostname restricted to [a-zA-Z0-9._-]
 * - Port must be numeric, in range 1-65535
 * - No whitespace allowed
 */
export function validateNetStreamTarget(target: string): string | null {
  if (/\s/.test(target)) {
    return "Network target must not contain whitespace.";
  }
  const parts = target.split(":");
  if (parts.length !== 2) {
    return "Network target must be in host:port format with exactly one ':' separator.";
  }
  const [host, portStr] = parts;
  if (!host || !/^[a-zA-Z0-9._-]+$/.test(host)) {
    return "Hostname must contain only alphanumeric characters, dots, underscores, and hyphens.";
  }
  if (!/^\d+$/.test(portStr)) {
    return "Port must be a numeric value.";
  }
  const port = parseInt(portStr, 10);
  if (port < 1 || port > 65535) {
    return "Port must be in the range 1-65535.";
  }
  return null;
}

/**
 * Stream a compressed archive directly to a network destination via netcat.
 * No archive file, checksum, or decompress script is written to disk.
 */
export async function netStreamArchive(
  options: NetStreamOptions
): Promise<ZstarResult> {
  const validationError = validateNetStreamTarget(options.target);
  if (validationError) {
    return { stdout: "", stderr: validationError, exitCode: 2 };
  }
  const script = findZstarScript();
  const args = ["-n", options.target, ...buildCreateArgs(options)];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Stream a password-encrypted compressed archive to a network destination.
 */
export async function netStreamEncryptedArchive(
  options: NetStreamEncryptedOptions
): Promise<ZstarResult> {
  const validationError = validateNetStreamTarget(options.target);
  if (validationError) {
    return { stdout: "", stderr: validationError, exitCode: 2 };
  }
  const script = findZstarScript();
  const args = ["-p", "-n", options.target, ...buildCreateArgs(options)];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Stream a signed and recipient-encrypted archive to a network destination.
 */
export async function netStreamSignedEncryptedArchive(
  options: NetStreamSignedEncryptedOptions
): Promise<ZstarResult> {
  const validationError = validateNetStreamTarget(options.target);
  if (validationError) {
    return { stdout: "", stderr: validationError, exitCode: 2 };
  }
  const script = findZstarScript();
  const args = [
    "-s", options.signingKeyId,
    "-r", options.recipientKeyId,
    "-n", options.target,
    ...buildCreateArgs(options),
  ];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Listen for incoming streamed data using a decompress script's listen mode.
 * The decompress script's `listen <port>` subcommand receives, decrypts (if applicable),
 * decompresses, and extracts streamed data in real-time.
 */
export async function listenForStream(
  options: ListenForStreamOptions
): Promise<ZstarResult> {
  if (options.port < 1 || options.port > 65535) {
    return { stdout: "", stderr: "Port must be in the range 1-65535.", exitCode: 2 };
  }
  const scriptPath = path.resolve(options.cwd || ".", options.scriptPath);
  if (!fs.existsSync(scriptPath)) {
    return {
      stdout: "",
      stderr: `Decompress script not found: ${scriptPath}`,
      exitCode: 1,
    };
  }
  return execCommand("bash", [scriptPath, "listen", String(options.port)], {
    cwd: options.cwd,
  });
}

/**
 * Initialize GPG communication for an agent.
 * Generates a GPG key pair (if one does not already exist for the given email)
 * and exports the public key. This is the first step in establishing encrypted
 * agent-to-agent communication.
 */
export async function gpgInitAgentCommunication(
  options: GpgInitAgentOptions
): Promise<GpgInitAgentResult> {
  const parts: string[] = [];

  // Check if a key already exists for this email
  const existingKeys = await execCommand("gpg", [
    "--list-keys",
    "--keyid-format",
    "long",
    options.agentEmail,
  ]);

  let fingerprint = "";

  if (existingKeys.exitCode === 0 && existingKeys.stdout.trim().length > 0) {
    parts.push(`GPG key already exists for ${options.agentEmail}.`);
  } else {
    // Generate new key pair
    const genResult = await gpgGenerateKey({
      name: options.agentName,
      email: options.agentEmail,
      passphrase: options.passphrase,
      keyType: options.keyType || "EDDSA",
      keyLength: options.keyLength,
      expireDate: options.expireDate,
    });

    if (genResult.exitCode !== 0) {
      return {
        success: false,
        publicKey: "",
        fingerprint: "",
        details: `Key generation failed (exit code ${genResult.exitCode}).\n${genResult.stderr}`,
      };
    }
    parts.push(`GPG key pair generated for ${options.agentName} <${options.agentEmail}>.`);
  }

  // Get the fingerprint
  const fpResult = await execCommand("gpg", [
    "--with-colons",
    "--fingerprint",
    options.agentEmail,
  ]);
  if (fpResult.exitCode === 0) {
    const fpLine = fpResult.stdout.split("\n").find((l) => l.startsWith("fpr:"));
    if (fpLine) {
      fingerprint = fpLine.split(":")[9] || "";
    }
  }

  // Export the public key
  const exportResult = await gpgExportPublicKey({
    keyId: options.agentEmail,
    outputFile: options.outputFile,
  });

  if (exportResult.exitCode !== 0) {
    return {
      success: false,
      publicKey: "",
      fingerprint,
      details: `Public key export failed.\n${exportResult.stderr}`,
    };
  }

  const publicKey = options.outputFile ? "" : exportResult.stdout.trim();

  if (options.outputFile) {
    parts.push(`Public key exported to ${options.outputFile}.`);
  } else {
    parts.push("Public key exported (returned in output).");
  }

  parts.push(`Fingerprint: ${fingerprint}`);
  parts.push(
    "\nTo complete agent-to-agent setup:\n" +
    "1. Share the public key with the remote agent\n" +
    "2. Remote agent imports it using gpg_import_key\n" +
    "3. Remote agent runs gpg_init_agent_communication and shares their public key back\n" +
    "4. Import the remote agent's public key using gpg_import_key\n" +
    "5. Both agents can now use encrypted_agent_stream for secure communication"
  );

  return {
    success: true,
    publicKey,
    fingerprint,
    details: parts.join("\n"),
    outputFile: options.outputFile,
  };
}

/**
 * Stream encrypted data between agents. Validates that the signing and recipient
 * keys exist in the keyring, then streams a signed + recipient-encrypted archive
 * to the target host via netcat.
 */
export async function encryptedAgentStream(
  options: EncryptedAgentStreamOptions
): Promise<ZstarResult> {
  // Validate target format
  const validationError = validateNetStreamTarget(options.target);
  if (validationError) {
    return { stdout: "", stderr: validationError, exitCode: 2 };
  }

  // Verify the signing key (local agent's private key) exists
  const signingCheck = await execCommand("gpg", [
    "--list-secret-keys",
    "--keyid-format",
    "long",
    options.signingKeyId,
  ]);
  if (signingCheck.exitCode !== 0 || signingCheck.stdout.trim().length === 0) {
    return {
      stdout: "",
      stderr: `Signing key not found for '${options.signingKeyId}'. ` +
        "Use gpg_init_agent_communication to generate a key pair first.",
      exitCode: 1,
    };
  }

  // Verify the recipient key (remote agent's public key) exists
  const recipientCheck = await execCommand("gpg", [
    "--list-keys",
    "--keyid-format",
    "long",
    options.recipientKeyId,
  ]);
  if (recipientCheck.exitCode !== 0 || recipientCheck.stdout.trim().length === 0) {
    return {
      stdout: "",
      stderr: `Recipient key not found for '${options.recipientKeyId}'. ` +
        "Import the remote agent's public key using gpg_import_key first.",
      exitCode: 1,
    };
  }

  // Stream the signed + encrypted archive
  const script = findZstarScript();
  const args = [
    "-s", options.signingKeyId,
    "-r", options.recipientKeyId,
    "-n", options.target,
    ...buildCreateArgs({
      inputPaths: options.inputPaths,
      compressionLevel: options.compressionLevel,
      outputName: options.outputName,
      excludePatterns: options.excludePatterns,
    }),
  ];
  return execCommand(script, args, { cwd: options.cwd });
}

/**
 * Request a secure communication channel with a remote agent.
 * Initializes the local agent's GPG identity (if not already present) and
 * packages the public key and agent info into a structured request that the
 * remote agent can use to configure itself for encrypted communication.
 *
 * The remote agent should:
 * 1. Import the requesting agent's public key using gpg_import_key
 * 2. Run gpg_init_agent_communication to initialize its own identity
 * 3. Share its public key back to the requesting agent
 *
 * This enables one agent to programmatically ask another to set up a secure channel.
 */
export async function requestSecureChannel(
  options: RequestSecureChannelOptions
): Promise<SecureChannelRequest> {
  // Validate listening address if provided
  if (options.listeningAddress) {
    const validationError = validateNetStreamTarget(options.listeningAddress);
    if (validationError) {
      return {
        success: false,
        publicKey: "",
        fingerprint: "",
        agentName: options.agentName,
        agentEmail: options.agentEmail,
        instructions: "",
        details: `Invalid listening address: ${validationError}`,
      };
    }
  }

  // Initialize the requesting agent's GPG identity
  const initResult = await gpgInitAgentCommunication({
    agentName: options.agentName,
    agentEmail: options.agentEmail,
    passphrase: options.passphrase,
    keyType: options.keyType,
    keyLength: options.keyLength,
    expireDate: options.expireDate,
  });

  if (!initResult.success) {
    return {
      success: false,
      publicKey: "",
      fingerprint: "",
      agentName: options.agentName,
      agentEmail: options.agentEmail,
      instructions: "",
      details: `GPG identity initialization failed: ${initResult.details}`,
    };
  }

  // Build instructions for the remote agent
  const steps: string[] = [
    "To establish a secure channel, the remote agent should:",
    "",
    "1. Import this agent's public key (provided below) using gpg_import_key",
    "2. Initialize its own GPG identity using gpg_init_agent_communication",
    "3. Share its public key back to this agent for import",
    `4. This agent will listen on ${options.listeningAddress || "<address to be configured>"} for encrypted streams`,
    "5. Use encrypted_agent_stream to send signed + encrypted data between agents",
  ];

  const parts: string[] = [];
  parts.push(`Secure channel request generated by ${options.agentName} <${options.agentEmail}>.`);
  parts.push(`Fingerprint: ${initResult.fingerprint}`);
  if (options.listeningAddress) {
    parts.push(`Listening address: ${options.listeningAddress}`);
  }
  parts.push(initResult.details);

  return {
    success: true,
    publicKey: initResult.publicKey,
    fingerprint: initResult.fingerprint,
    agentName: options.agentName,
    agentEmail: options.agentEmail,
    listeningAddress: options.listeningAddress,
    instructions: steps.join("\n"),
    details: parts.join("\n"),
  };
}

/**
 * Extract an archive using the generated decompress script.
 */
export async function extractArchive(
  options: ExtractArchiveOptions
): Promise<ZstarResult> {
  const scriptPath = path.resolve(options.cwd || ".", options.scriptPath);
  if (!fs.existsSync(scriptPath)) {
    return {
      stdout: "",
      stderr: `Decompress script not found: ${scriptPath}`,
      exitCode: 1,
    };
  }
  return execCommand("bash", [scriptPath], { cwd: options.cwd });
}

/**
 * List archive contents without extracting.
 */
export async function listArchive(
  options: ListArchiveOptions
): Promise<ZstarResult> {
  const scriptPath = path.resolve(options.cwd || ".", options.scriptPath);
  if (!fs.existsSync(scriptPath)) {
    return {
      stdout: "",
      stderr: `Decompress script not found: ${scriptPath}`,
      exitCode: 1,
    };
  }
  return execCommand("bash", [scriptPath, "list"], { cwd: options.cwd });
}

/**
 * Verify SHA-512 checksum of an archive.
 * Uses sha512sum on Linux and shasum -a 512 on macOS.
 */
export async function verifyChecksum(
  options: VerifyChecksumOptions
): Promise<ZstarResult> {
  const checksumPath = path.resolve(options.cwd || ".", options.checksumFile);
  if (!fs.existsSync(checksumPath)) {
    return {
      stdout: "",
      stderr: `Checksum file not found: ${checksumPath}`,
      exitCode: 1,
    };
  }
  const cwd = options.cwd || path.dirname(checksumPath);
  if (isMacOS) {
    return execCommand("shasum", ["-a", "512", "-c", checksumPath], { cwd });
  }
  return execCommand("sha512sum", ["-c", checksumPath], { cwd });
}

/**
 * Result of listing GPG keys.
 */
export interface GpgKeyInfo {
  type: "pub" | "sec";
  keyId: string;
  uid: string;
  fingerprint: string;
  created: string;
  expires: string;
}

/**
 * Options for generating a GPG key.
 */
export interface GenerateGpgKeyOptions {
  /** Real name for the key. */
  name: string;
  /** Email address for the key. */
  email: string;
  /** Passphrase for the key. */
  passphrase: string;
  /** Key type. Default: RSA. */
  keyType?: "RSA" | "DSA" | "EDDSA";
  /** Key length in bits (for RSA/DSA). Default: 4096. */
  keyLength?: number;
  /** Key expiry (e.g., "1y", "0" for no expiry). Default: "0". */
  expireDate?: string;
}

/**
 * Options for exporting a GPG public key.
 */
export interface ExportGpgKeyOptions {
  /** Key ID, email, or fingerprint to export. */
  keyId: string;
  /** Output file path. If omitted, returns armored key in stdout. */
  outputFile?: string;
}

/**
 * Options for importing a GPG key.
 */
export interface ImportGpgKeyOptions {
  /** Path to the key file to import. */
  keyFile: string;
}

/**
 * List GPG keys in the keyring.
 */
export async function gpgListKeys(
  secretOnly: boolean = false
): Promise<ZstarResult> {
  const args = secretOnly
    ? ["--list-secret-keys", "--keyid-format", "long"]
    : ["--list-keys", "--keyid-format", "long"];
  return execCommand("gpg", args);
}

/**
 * Generate a new GPG key pair using batch mode.
 */
export async function gpgGenerateKey(
  options: GenerateGpgKeyOptions
): Promise<ZstarResult> {
  const keyType = options.keyType || "RSA";
  const keyLength = options.keyLength || 4096;
  const expireDate = options.expireDate || "0";

  let keyTypeParam: string;
  let subkeyTypeParam: string;
  let lengthLines: string;

  if (keyType === "EDDSA") {
    keyTypeParam = "Key-Type: EDDSA";
    subkeyTypeParam = "Subkey-Type: ECDH";
    lengthLines = "Key-Curve: ed25519\nSubkey-Curve: cv25519";
  } else {
    keyTypeParam = `Key-Type: ${keyType}`;
    subkeyTypeParam = `Subkey-Type: ${keyType}`;
    lengthLines = `Key-Length: ${keyLength}\nSubkey-Length: ${keyLength}`;
  }

  const batchConfig = [
    "%no-protection",
    keyTypeParam,
    lengthLines,
    subkeyTypeParam,
    `Name-Real: ${options.name}`,
    `Name-Email: ${options.email}`,
    `Expire-Date: ${expireDate}`,
    `Passphrase: ${options.passphrase}`,
    "%commit",
  ].join("\n");

  // Write batch config to a temp file for gpg to read
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "zstar-gpg-"));
  const batchFile = path.join(tmpDir, "keygen-batch.txt");
  try {
    fs.writeFileSync(batchFile, batchConfig, { mode: 0o600 });
    const result = await execCommand("gpg", ["--batch", "--gen-key", batchFile]);
    return result;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Export a GPG public key in armored format.
 */
export async function gpgExportPublicKey(
  options: ExportGpgKeyOptions
): Promise<ZstarResult> {
  const args = ["--export", "--armor", options.keyId];
  if (options.outputFile) {
    args.push("--output", options.outputFile);
  }
  return execCommand("gpg", args);
}

/**
 * Import a GPG key from a file.
 */
export async function gpgImportKey(
  options: ImportGpgKeyOptions
): Promise<ZstarResult> {
  const keyPath = path.resolve(options.keyFile);
  if (!fs.existsSync(keyPath)) {
    return {
      stdout: "",
      stderr: `Key file not found: ${keyPath}`,
      exitCode: 1,
    };
  }
  return execCommand("gpg", ["--import", keyPath]);
}

/**
 * Check availability of system dependencies.
 * On macOS, checks for platform-specific alternatives (e.g., shasum for sha512sum,
 * gnumfmt for numfmt) when the standard command is not found.
 */
export async function checkDependencies(): Promise<DependencyStatus[]> {
  const deps: Array<{ name: string; required: boolean; macAlternative?: string }> = [
    { name: "bash", required: true },
    { name: "tar", required: true },
    { name: "zstd", required: true },
    { name: "sha512sum", required: true, macAlternative: "shasum" },
    { name: "numfmt", required: true, macAlternative: "gnumfmt" },
    { name: "gpg", required: true },
    { name: "pv", required: true },
    { name: "nc", required: false },
  ];

  const results: DependencyStatus[] = [];
  for (const dep of deps) {
    const result = await execCommand("which", [dep.name]);
    let available = result.exitCode === 0;

    // On macOS, check for platform-specific alternatives
    if (!available && isMacOS && dep.macAlternative) {
      const altResult = await execCommand("which", [dep.macAlternative]);
      available = altResult.exitCode === 0;
    }

    results.push({
      name: dep.name,
      available,
      required: dep.required,
    });
  }

  return results;
}
