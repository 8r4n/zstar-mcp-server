import { describe, it, expect } from "vitest";
import * as zstar from "../src/zstar.js";

describe("zstar module", () => {
  describe("findZstarScript", () => {
    it("throws when ZSTAR_PATH points to nonexistent file", () => {
      const orig = process.env.ZSTAR_PATH;
      process.env.ZSTAR_PATH = "/nonexistent/tarzst.sh";
      try {
        expect(() => zstar.findZstarScript()).toThrow("does not exist");
      } finally {
        if (orig !== undefined) {
          process.env.ZSTAR_PATH = orig;
        } else {
          delete process.env.ZSTAR_PATH;
        }
      }
    });

    it("uses ZSTAR_PATH when set to a valid file", () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-test-"));
      const scriptPath = path.join(tmpDir, "tarzst.sh");
      fs.writeFileSync(scriptPath, "#!/bin/bash\n");

      const orig = process.env.ZSTAR_PATH;
      process.env.ZSTAR_PATH = scriptPath;
      try {
        expect(zstar.findZstarScript()).toBe(scriptPath);
      } finally {
        if (orig !== undefined) {
          process.env.ZSTAR_PATH = orig;
        } else {
          delete process.env.ZSTAR_PATH;
        }
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("throws a helpful message when script not found anywhere", () => {
      const orig = process.env.ZSTAR_PATH;
      const origPath = process.env.PATH;
      delete process.env.ZSTAR_PATH;
      process.env.PATH = "/nonexistent";
      try {
        expect(() => zstar.findZstarScript()).toThrow("Could not find");
      } finally {
        if (orig !== undefined) {
          process.env.ZSTAR_PATH = orig;
        }
        process.env.PATH = origPath;
      }
    });
  });

  describe("checkDependencies", () => {
    it("returns dependency status for all tools", async () => {
      const deps = await zstar.checkDependencies();
      expect(deps.length).toBe(8);

      const names = deps.map((d) => d.name);
      expect(names).toContain("bash");
      expect(names).toContain("tar");
      expect(names).toContain("zstd");
      expect(names).toContain("sha512sum");
      expect(names).toContain("numfmt");
      expect(names).toContain("gpg");
      expect(names).toContain("pv");
      expect(names).toContain("nc");

      // 7 required tools
      const required = deps.filter((d) => d.required);
      expect(required.length).toBe(7);
      for (const dep of required) {
        expect(dep.required).toBe(true);
      }

      // nc is optional (needed only for network streaming)
      const optional = deps.filter((d) => !d.required);
      expect(optional.length).toBe(1);
      expect(optional[0].name).toBe("nc");

      // bash and tar should be available on most systems
      const bash = deps.find((d) => d.name === "bash");
      expect(bash?.available).toBe(true);

      const tar = deps.find((d) => d.name === "tar");
      expect(tar?.available).toBe(true);
    });
  });

  describe("verifyChecksum", () => {
    it("returns error when checksum file does not exist", async () => {
      const result = await zstar.verifyChecksum({
        checksumFile: "/nonexistent/file.sha512",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    it("verifies a valid checksum file", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const { execSync } = require("child_process");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-test-"));
      const testFile = path.join(tmpDir, "testfile.txt");
      fs.writeFileSync(testFile, "hello world\n");

      // Generate checksum (use shasum on macOS, sha512sum on Linux)
      const checksumCmd = process.platform === "darwin"
        ? `shasum -a 512 testfile.txt > testfile.txt.sha512`
        : `sha512sum testfile.txt > testfile.txt.sha512`;
      execSync(checksumCmd, { cwd: tmpDir });

      const result = await zstar.verifyChecksum({
        checksumFile: "testfile.txt.sha512",
        cwd: tmpDir,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("OK");

      fs.rmSync(tmpDir, { recursive: true });
    });

    it("detects a corrupted file via checksum", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const { execSync } = require("child_process");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-test-"));
      const testFile = path.join(tmpDir, "testfile.txt");
      fs.writeFileSync(testFile, "hello world\n");

      // Generate checksum, then modify the file (use shasum on macOS)
      const checksumCmd = process.platform === "darwin"
        ? `shasum -a 512 testfile.txt > testfile.txt.sha512`
        : `sha512sum testfile.txt > testfile.txt.sha512`;
      execSync(checksumCmd, { cwd: tmpDir });
      fs.writeFileSync(testFile, "modified content\n");

      const result = await zstar.verifyChecksum({
        checksumFile: "testfile.txt.sha512",
        cwd: tmpDir,
      });
      expect(result.exitCode).not.toBe(0);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe("extractArchive", () => {
    it("returns error when script does not exist", async () => {
      const result = await zstar.extractArchive({
        scriptPath: "/nonexistent/decompress.sh",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("listArchive", () => {
    it("returns error when script does not exist", async () => {
      const result = await zstar.listArchive({
        scriptPath: "/nonexistent/decompress.sh",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("createArchive", () => {
    it("creates a tar.zst archive with checksum and decompress script", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");

      // Check if tarzst.sh is available
      let scriptPath: string;
      try {
        scriptPath = zstar.findZstarScript();
      } catch {
        // Skip test if tarzst.sh is not available
        return;
      }

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-test-"));
      const inputDir = path.join(tmpDir, "input");
      fs.mkdirSync(inputDir);
      fs.writeFileSync(path.join(inputDir, "file1.txt"), "content 1");
      fs.writeFileSync(path.join(inputDir, "file2.txt"), "content 2");

      const result = await zstar.createArchive({
        inputPaths: [inputDir],
        outputName: "test-archive",
        compressionLevel: 1,
        cwd: tmpDir,
      });

      expect(result.exitCode).toBe(0);

      // Check output files exist
      const archiveExists = fs.existsSync(
        path.join(tmpDir, "test-archive.tar.zst")
      );
      const checksumExists = fs.existsSync(
        path.join(tmpDir, "test-archive.tar.zst.sha512")
      );
      const scriptExists = fs.existsSync(
        path.join(tmpDir, "test-archive_decompress.sh")
      );
      expect(archiveExists).toBe(true);
      expect(checksumExists).toBe(true);
      expect(scriptExists).toBe(true);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe("gpgListKeys", () => {
    it("returns a result without crashing", async () => {
      const result = await zstar.gpgListKeys();
      // gpg --list-keys exits 0 even if keyring is empty (or 2 if no keyring)
      expect(typeof result.exitCode).toBe("number");
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");
    });

    it("accepts secretOnly parameter", async () => {
      const result = await zstar.gpgListKeys(true);
      expect(typeof result.exitCode).toBe("number");
    });
  });

  describe("gpgImportKey", () => {
    it("returns error when key file does not exist", async () => {
      const result = await zstar.gpgImportKey({
        keyFile: "/nonexistent/key.asc",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("gpgExportPublicKey", () => {
    it("returns a result for a nonexistent key without crashing", async () => {
      const result = await zstar.gpgExportPublicKey({
        keyId: "nonexistent-key@example.com",
      });
      // gpg exits 0 but returns empty output for non-existent keys
      expect(typeof result.exitCode).toBe("number");
    });
  });

  describe("validateNetStreamTarget", () => {
    it("accepts a valid host:port target", () => {
      expect(zstar.validateNetStreamTarget("localhost:9000")).toBeNull();
    });

    it("accepts hostname with dots, hyphens, and underscores", () => {
      expect(zstar.validateNetStreamTarget("my-host.example.com:8080")).toBeNull();
      expect(zstar.validateNetStreamTarget("host_name:1")).toBeNull();
      expect(zstar.validateNetStreamTarget("192.168.1.1:65535")).toBeNull();
    });

    it("rejects target without colon separator", () => {
      const err = zstar.validateNetStreamTarget("localhost9000");
      expect(err).toContain("host:port");
    });

    it("rejects target with multiple colons", () => {
      const err = zstar.validateNetStreamTarget("a:b:c");
      expect(err).toContain("host:port");
    });

    it("rejects non-numeric port", () => {
      const err = zstar.validateNetStreamTarget("localhost:abc");
      expect(err).toContain("numeric");
    });

    it("rejects port 0 (out of range)", () => {
      const err = zstar.validateNetStreamTarget("localhost:0");
      expect(err).toContain("1-65535");
    });

    it("rejects port above 65535", () => {
      const err = zstar.validateNetStreamTarget("localhost:99999");
      expect(err).toContain("1-65535");
    });

    it("rejects target with whitespace", () => {
      const err = zstar.validateNetStreamTarget("local host:9000");
      expect(err).toContain("whitespace");
    });

    it("rejects empty hostname", () => {
      const err = zstar.validateNetStreamTarget(":9000");
      expect(err).toContain("Hostname");
    });

    it("rejects hostname with invalid characters", () => {
      const err = zstar.validateNetStreamTarget("host@name:9000");
      expect(err).toContain("Hostname");
    });
  });

  describe("netStreamArchive", () => {
    it("returns validation error for invalid target", async () => {
      const result = await zstar.netStreamArchive({
        inputPaths: ["/tmp"],
        target: "invalid",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("host:port");
    });

    it("returns validation error for port out of range", async () => {
      const result = await zstar.netStreamArchive({
        inputPaths: ["/tmp"],
        target: "localhost:0",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("1-65535");
    });

    it("returns validation error for whitespace in target", async () => {
      const result = await zstar.netStreamArchive({
        inputPaths: ["/tmp"],
        target: "local host:9000",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("whitespace");
    });
  });

  describe("netStreamEncryptedArchive", () => {
    it("returns validation error for invalid target", async () => {
      const result = await zstar.netStreamEncryptedArchive({
        inputPaths: ["/tmp"],
        target: "a:b:c",
        password: "test",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("host:port");
    });
  });

  describe("netStreamSignedEncryptedArchive", () => {
    it("returns validation error for invalid target", async () => {
      const result = await zstar.netStreamSignedEncryptedArchive({
        inputPaths: ["/tmp"],
        target: "localhost:abc",
        signingKeyId: "test@example.com",
        passphrase: "pass",
        recipientKeyId: "other@example.com",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("numeric");
    });
  });

  describe("listenForStream", () => {
    it("returns error when script does not exist", async () => {
      const result = await zstar.listenForStream({
        scriptPath: "/nonexistent/decompress.sh",
        port: 9000,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    it("returns error for port out of range (0)", async () => {
      const result = await zstar.listenForStream({
        scriptPath: "/tmp/decompress.sh",
        port: 0,
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("1-65535");
    });

    it("returns error for port out of range (70000)", async () => {
      const result = await zstar.listenForStream({
        scriptPath: "/tmp/decompress.sh",
        port: 70000,
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("1-65535");
    });
  });

  describe("gpgInitAgentCommunication", () => {
    it("returns a result object with expected fields", async () => {
      const result = await zstar.gpgInitAgentCommunication({
        agentName: "Test Agent",
        agentEmail: `test-init-${Date.now()}@zstar-test.local`,
        passphrase: "test-passphrase",
        keyType: "EDDSA",
      });
      // Result should have the expected shape regardless of success/failure
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.publicKey).toBe("string");
      expect(typeof result.fingerprint).toBe("string");
      expect(typeof result.details).toBe("string");
    });

    it("generates key and exports public key on success", async () => {
      const email = `agent-init-${Date.now()}@zstar-test.local`;
      const result = await zstar.gpgInitAgentCommunication({
        agentName: "Init Test Agent",
        agentEmail: email,
        passphrase: "test-passphrase-123",
        keyType: "EDDSA",
      });
      expect(result.success).toBe(true);
      expect(result.fingerprint.length).toBeGreaterThan(0);
      expect(result.details).toContain(email);
      expect(result.details).toContain("Fingerprint:");
      expect(result.details).toContain("agent-to-agent setup");
      // Public key should be returned when no output file specified
      if (result.publicKey) {
        expect(result.publicKey).toContain("BEGIN PGP PUBLIC KEY BLOCK");
      }
    });

    it("reuses existing key if already generated for the email", async () => {
      const email = `agent-reuse-${Date.now()}@zstar-test.local`;
      // First call: generate key
      const first = await zstar.gpgInitAgentCommunication({
        agentName: "Reuse Agent",
        agentEmail: email,
        passphrase: "reuse-pass",
        keyType: "EDDSA",
      });
      expect(first.success).toBe(true);

      // Second call: should reuse existing key
      const second = await zstar.gpgInitAgentCommunication({
        agentName: "Reuse Agent",
        agentEmail: email,
        passphrase: "reuse-pass",
        keyType: "EDDSA",
      });
      expect(second.success).toBe(true);
      expect(second.details).toContain("already exists");
      expect(second.fingerprint).toBe(first.fingerprint);
    });
  });

  describe("encryptedAgentStream", () => {
    it("returns validation error for invalid target", async () => {
      const result = await zstar.encryptedAgentStream({
        inputPaths: ["/tmp"],
        target: "invalid-no-port",
        signingKeyId: "sender@test.local",
        passphrase: "pass",
        recipientKeyId: "recipient@test.local",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("host:port");
    });

    it("returns error when signing key does not exist", async () => {
      const result = await zstar.encryptedAgentStream({
        inputPaths: ["/tmp"],
        target: "localhost:9000",
        signingKeyId: "nonexistent-sender@test.local",
        passphrase: "pass",
        recipientKeyId: "nonexistent-recipient@test.local",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Signing key not found");
      expect(result.stderr).toContain("gpg_init_agent_communication");
    });

    it("returns error when recipient key does not exist", async () => {
      // First generate a signing key so we get past the first check
      const signerEmail = `stream-signer-${Date.now()}@zstar-test.local`;
      const initResult = await zstar.gpgInitAgentCommunication({
        agentName: "Stream Signer",
        agentEmail: signerEmail,
        passphrase: "signer-pass",
        keyType: "EDDSA",
      });
      expect(initResult.success).toBe(true);

      const result = await zstar.encryptedAgentStream({
        inputPaths: ["/tmp"],
        target: "localhost:9000",
        signingKeyId: signerEmail,
        passphrase: "signer-pass",
        recipientKeyId: "nonexistent-recipient@test.local",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Recipient key not found");
      expect(result.stderr).toContain("gpg_import_key");
    });
  });

  describe("agent-to-agent key exchange (end-to-end)", () => {
    it("completes full key exchange between two agents", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-a2a-"));

      const alphaEmail = `alpha-e2e-${Date.now()}@zstar-test.local`;
      const betaEmail = `beta-e2e-${Date.now()}@zstar-test.local`;

      try {
        // Phase 1: Both agents initialize GPG identities
        const alphaInit = await zstar.gpgInitAgentCommunication({
          agentName: "Agent Alpha",
          agentEmail: alphaEmail,
          passphrase: "alpha-pass",
          keyType: "EDDSA",
        });
        expect(alphaInit.success).toBe(true);
        expect(alphaInit.fingerprint.length).toBeGreaterThan(0);
        expect(alphaInit.publicKey).toContain("BEGIN PGP PUBLIC KEY BLOCK");

        const betaInit = await zstar.gpgInitAgentCommunication({
          agentName: "Agent Beta",
          agentEmail: betaEmail,
          passphrase: "beta-pass",
          keyType: "EDDSA",
        });
        expect(betaInit.success).toBe(true);
        expect(betaInit.fingerprint.length).toBeGreaterThan(0);
        expect(betaInit.publicKey).toContain("BEGIN PGP PUBLIC KEY BLOCK");

        // Phase 2: Each agent imports the other's public key (via file)
        const alphaKeyFile = path.join(tmpDir, "alpha_public.asc");
        const betaKeyFile = path.join(tmpDir, "beta_public.asc");
        fs.writeFileSync(alphaKeyFile, alphaInit.publicKey);
        fs.writeFileSync(betaKeyFile, betaInit.publicKey);

        const alphaImport = await zstar.gpgImportKey({ keyFile: betaKeyFile });
        expect(alphaImport.exitCode).toBe(0);

        const betaImport = await zstar.gpgImportKey({ keyFile: alphaKeyFile });
        expect(betaImport.exitCode).toBe(0);

        // Phase 3: Verify encrypted agent stream passes key validation
        // The stream may fail because tarzst.sh is not available or no listener,
        // but key validation (signing key + recipient key) should pass.
        try {
          const streamResult = await zstar.encryptedAgentStream({
            inputPaths: ["/tmp"],
            target: "localhost:19876",
            signingKeyId: alphaEmail,
            passphrase: "alpha-pass",
            recipientKeyId: betaEmail,
          });
          expect(streamResult.stderr).not.toContain("Signing key not found");
          expect(streamResult.stderr).not.toContain("Recipient key not found");
        } catch (e: unknown) {
          // tarzst.sh not found is acceptable — key validation is the focus
          const msg = e instanceof Error ? e.message : String(e);
          expect(msg).toContain("Could not find tarzst");
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });

    it("supports bidirectional communication after key exchange", async () => {
      const alphaEmail = `alpha-bidir-${Date.now()}@zstar-test.local`;
      const betaEmail = `beta-bidir-${Date.now()}@zstar-test.local`;

      // Both agents init
      const alphaInit = await zstar.gpgInitAgentCommunication({
        agentName: "Alpha Bidir",
        agentEmail: alphaEmail,
        passphrase: "alpha-pass",
        keyType: "EDDSA",
      });
      expect(alphaInit.success).toBe(true);

      const betaInit = await zstar.gpgInitAgentCommunication({
        agentName: "Beta Bidir",
        agentEmail: betaEmail,
        passphrase: "beta-pass",
        keyType: "EDDSA",
      });
      expect(betaInit.success).toBe(true);

      // Exchange keys via exported public keys
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zstar-bidir-"));

      try {
        const alphaKeyFile = path.join(tmpDir, "alpha.asc");
        const betaKeyFile = path.join(tmpDir, "beta.asc");
        fs.writeFileSync(alphaKeyFile, alphaInit.publicKey);
        fs.writeFileSync(betaKeyFile, betaInit.publicKey);

        await zstar.gpgImportKey({ keyFile: betaKeyFile });
        await zstar.gpgImportKey({ keyFile: alphaKeyFile });

        // Alpha → Beta: passes key validation
        try {
          const alphaStream = await zstar.encryptedAgentStream({
            inputPaths: ["/tmp"],
            target: "localhost:19877",
            signingKeyId: alphaEmail,
            passphrase: "alpha-pass",
            recipientKeyId: betaEmail,
          });
          expect(alphaStream.stderr).not.toContain("Signing key not found");
          expect(alphaStream.stderr).not.toContain("Recipient key not found");
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          expect(msg).toContain("Could not find tarzst");
        }

        // Beta → Alpha: passes key validation (reverse direction)
        try {
          const betaStream = await zstar.encryptedAgentStream({
            inputPaths: ["/tmp"],
            target: "localhost:19878",
            signingKeyId: betaEmail,
            passphrase: "beta-pass",
            recipientKeyId: alphaEmail,
          });
          expect(betaStream.stderr).not.toContain("Signing key not found");
          expect(betaStream.stderr).not.toContain("Recipient key not found");
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          expect(msg).toContain("Could not find tarzst");
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true });
      }
    });
  });

  describe("requestSecureChannel", () => {
    it("returns a result object with expected fields", async () => {
      const result = await zstar.requestSecureChannel({
        agentName: "Channel Test Agent",
        agentEmail: `channel-test-${Date.now()}@zstar-test.local`,
        passphrase: "channel-passphrase",
        keyType: "EDDSA",
      });
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.publicKey).toBe("string");
      expect(typeof result.fingerprint).toBe("string");
      expect(typeof result.agentName).toBe("string");
      expect(typeof result.agentEmail).toBe("string");
      expect(typeof result.instructions).toBe("string");
      expect(typeof result.details).toBe("string");
    });

    it("generates secure channel request with public key on success", async () => {
      const email = `channel-gen-${Date.now()}@zstar-test.local`;
      const result = await zstar.requestSecureChannel({
        agentName: "Channel Gen Agent",
        agentEmail: email,
        passphrase: "gen-passphrase",
        keyType: "EDDSA",
      });
      expect(result.success).toBe(true);
      expect(result.fingerprint.length).toBeGreaterThan(0);
      expect(result.agentName).toBe("Channel Gen Agent");
      expect(result.agentEmail).toBe(email);
      expect(result.instructions).toContain("gpg_import_key");
      expect(result.instructions).toContain("gpg_init_agent_communication");
      expect(result.instructions).toContain("encrypted_agent_stream");
      if (result.publicKey) {
        expect(result.publicKey).toContain("BEGIN PGP PUBLIC KEY BLOCK");
      }
    });

    it("includes listening address in request when provided", async () => {
      const email = `channel-listen-${Date.now()}@zstar-test.local`;
      const result = await zstar.requestSecureChannel({
        agentName: "Listening Agent",
        agentEmail: email,
        passphrase: "listen-pass",
        keyType: "EDDSA",
        listeningAddress: "agent-host:9000",
      });
      expect(result.success).toBe(true);
      expect(result.listeningAddress).toBe("agent-host:9000");
      expect(result.details).toContain("agent-host:9000");
      expect(result.instructions).toContain("agent-host:9000");
    });

    it("returns validation error for invalid listening address", async () => {
      const result = await zstar.requestSecureChannel({
        agentName: "Invalid Agent",
        agentEmail: `invalid-${Date.now()}@zstar-test.local`,
        passphrase: "pass",
        listeningAddress: "bad-address",
      });
      expect(result.success).toBe(false);
      expect(result.details).toContain("Invalid listening address");
    });
  });
});
