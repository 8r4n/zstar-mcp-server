import { execFile, ExecFileOptions } from "child_process";
import * as fs from "fs";
import * as path from "path";

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
  return execCommand("sha512sum", ["-c", checksumPath], { cwd });
}

/**
 * Check availability of system dependencies.
 */
export async function checkDependencies(): Promise<DependencyStatus[]> {
  const deps: Array<{ name: string; required: boolean }> = [
    { name: "bash", required: true },
    { name: "tar", required: true },
    { name: "zstd", required: true },
    { name: "sha512sum", required: true },
    { name: "numfmt", required: true },
    { name: "gpg", required: true },
    { name: "pv", required: false },
  ];

  const results: DependencyStatus[] = [];
  for (const dep of deps) {
    const result = await execCommand("which", [dep.name]);
    results.push({
      name: dep.name,
      available: result.exitCode === 0,
      required: dep.required,
    });
  }

  return results;
}
