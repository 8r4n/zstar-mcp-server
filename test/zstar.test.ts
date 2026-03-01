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
});
