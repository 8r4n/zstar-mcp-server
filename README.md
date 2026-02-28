<div align="center">
  <img src="https://raw.githubusercontent.com/8r4n/zstar/main/assets/zstar-logo.png" alt="zstar logo" width="180" />

  <h1>zstar-mcp-server</h1>

  <p>
    <strong>MCP server for the <a href="https://github.com/8r4n/zstar">zstar</a> archive utility</strong><br />
    Compressed, encrypted, and signed tar archives — exposed via the Model Context Protocol.
  </p>

  <p>
    <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/License-ISC-blue.svg" alt="License: ISC" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js >= 18" /></a>
    <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-compatible-blueviolet.svg" alt="MCP Compatible" /></a>
    <a href="#openclaw-openclawjson"><img src="https://img.shields.io/badge/OpenClaw-supported-orange.svg" alt="OpenClaw Supported" /></a>
    <a href="https://github.com/8r4n/zstar"><img src="https://img.shields.io/badge/zstar-tarzst.sh-yellow.svg" alt="zstar" /></a>
  </p>
</div>

---

## Overview

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes all features of the [zstar](https://github.com/8r4n/zstar) archive utility. It allows AI assistants to create, extract, verify, encrypt, and sign compressed archives through a standardized tool interface.

The server uses **stdio transport**, compatible with [OpenClaw](https://github.com/openclaw), [Claude Desktop](https://claude.ai/download), and any other MCP client.

## Tools

The server provides **9 tools** covering every capability of the zstar utility:

| Tool | Description |
|------|-------------|
| `create_archive` | Create a compressed `.tar.zst` archive with SHA-512 checksum and self-extracting script |
| `encrypt_archive` | Create a password-encrypted archive (AES-256 symmetric via GPG) |
| `sign_archive` | Create a GPG-signed archive for authenticity verification |
| `sign_and_encrypt_archive` | Create a signed and recipient-encrypted archive (public-key encryption) |
| `create_burn_after_reading_archive` | Create an archive that securely shreds itself after extraction |
| `extract_archive` | Extract an archive using the generated decompress script |
| `list_archive` | List archive contents without extracting |
| `verify_checksum` | Verify SHA-512 integrity checksum of an archive |
| `check_dependencies` | Check whether all required system dependencies are installed |

## Quick Start

### Installation

```bash
npm install zstar-mcp-server
```

Or clone and build from source:

```bash
git clone https://github.com/8r4n/zstar-mcp-server.git
cd zstar-mcp-server
npm install
npm run build
```

### Configuration

The server locates the `tarzst.sh` script in the following order:

1. **`ZSTAR_PATH` environment variable** — set to the absolute path of `tarzst.sh`
2. **System PATH** — looks for `tarzst` or `tarzst.sh` on your `PATH`

```bash
export ZSTAR_PATH=/usr/local/bin/tarzst.sh
```

## Client Configuration

The server communicates over **stdio**, the standard transport supported by OpenClaw, Claude Desktop, and other MCP clients.

### OpenClaw (`openclaw.json`)

Add the server to the `mcpServers` section of your `openclaw.json` (typically at `~/.openclaw/openclaw.json`):

```json
{
  "mcpServers": {
    "zstar": {
      "command": "npx",
      "args": ["-y", "zstar-mcp-server"],
      "env": {
        "ZSTAR_PATH": "/path/to/tarzst.sh"
      }
    }
  }
}
```

Or if installed from source:

```json
{
  "mcpServers": {
    "zstar": {
      "command": "node",
      "args": ["/path/to/zstar-mcp-server/dist/index.js"],
      "env": {
        "ZSTAR_PATH": "/path/to/tarzst.sh"
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "zstar": {
      "command": "npx",
      "args": ["-y", "zstar-mcp-server"],
      "env": {
        "ZSTAR_PATH": "/path/to/tarzst.sh"
      }
    }
  }
}
```

## Usage

Start the server directly (it communicates over stdio):

```bash
node dist/index.js
```

## Tool Reference

#### `create_archive`

Create a compressed tar.zst archive from files or directories.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `inputPaths` | `string[]` | Yes | Files or directories to archive |
| `compressionLevel` | `number` | No | zstd compression level (1-19). Default: 3 |
| `outputName` | `string` | No | Custom base name for output files |
| `excludePatterns` | `string[]` | No | File exclusion patterns for tar |
| `cwd` | `string` | No | Working directory |

**Output files:** `<name>.tar.zst`, `<name>.tar.zst.sha512`, `<name>_decompress.sh`

---

#### `encrypt_archive`

Create a password-encrypted archive using AES-256 symmetric encryption.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `inputPaths` | `string[]` | Yes | Files or directories to archive |
| `password` | `string` | Yes | Symmetric encryption password |
| `compressionLevel` | `number` | No | zstd compression level (1-19) |
| `outputName` | `string` | No | Custom base name |
| `excludePatterns` | `string[]` | No | Exclusion patterns |
| `cwd` | `string` | No | Working directory |

---

#### `sign_archive`

Create a GPG-signed archive for authenticity verification.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `inputPaths` | `string[]` | Yes | Files or directories to archive |
| `signingKeyId` | `string` | Yes | GPG key ID (e.g., email or fingerprint) |
| `passphrase` | `string` | Yes | Passphrase for the signing key |
| `compressionLevel` | `number` | No | zstd compression level (1-19) |
| `outputName` | `string` | No | Custom base name |
| `excludePatterns` | `string[]` | No | Exclusion patterns |
| `cwd` | `string` | No | Working directory |

---

#### `sign_and_encrypt_archive`

Create a signed and recipient-encrypted archive using GPG public-key encryption.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `inputPaths` | `string[]` | Yes | Files or directories to archive |
| `signingKeyId` | `string` | Yes | GPG key ID for signing |
| `passphrase` | `string` | Yes | Passphrase for the signing key |
| `recipientKeyId` | `string` | Yes | GPG key ID of the recipient |
| `compressionLevel` | `number` | No | zstd compression level (1-19) |
| `outputName` | `string` | No | Custom base name |
| `excludePatterns` | `string[]` | No | Exclusion patterns |
| `cwd` | `string` | No | Working directory |

---

#### `create_burn_after_reading_archive`

Create an archive with a self-erase routine. After extraction, the archive files are securely shredded.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `inputPaths` | `string[]` | Yes | Files or directories to archive |
| `compressionLevel` | `number` | No | zstd compression level (1-19) |
| `outputName` | `string` | No | Custom base name |
| `excludePatterns` | `string[]` | No | Exclusion patterns |
| `cwd` | `string` | No | Working directory |

---

#### `extract_archive`

Extract a zstar archive using the generated self-extracting decompress script.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scriptPath` | `string` | Yes | Path to the `*_decompress.sh` script |
| `cwd` | `string` | No | Working directory |

---

#### `list_archive`

List the contents of a zstar archive without extracting.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scriptPath` | `string` | Yes | Path to the `*_decompress.sh` script |
| `cwd` | `string` | No | Working directory |

---

#### `verify_checksum`

Verify the SHA-512 checksum of a zstar archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `checksumFile` | `string` | Yes | Path to the `.sha512` checksum file |
| `cwd` | `string` | No | Working directory |

---

#### `check_dependencies`

Check whether all required and optional system dependencies are installed.

**Parameters:** None

**Returns:** Status of each dependency (bash, tar, zstd, sha512sum, numfmt, gpg, pv).

## Development

```bash
npm install       # Install dependencies
npm run build     # Build TypeScript
npm test          # Run all tests
npm run test:watch # Run tests in watch mode
```

## Testing

The project includes **36 tests** using [Vitest](https://vitest.dev/):

| Suite | File | Tests | Description |
|-------|------|-------|-------------|
| Unit | `test/zstar.test.ts` | 10 | Tests the zstar wrapper module directly |
| MCP Integration | `test/server.test.ts` | 16 | Tests the server via `InMemoryTransport` |
| OpenClaw Integration | `test/openclaw.test.ts` | 10 | End-to-end tests over stdio via `StdioClientTransport` |

Tests cover tool registration, schema validation, dependency checking, checksum verification (valid and corrupted files), error handling, and the full MCP protocol handshake over stdio — the same way OpenClaw launches servers.

## Prerequisites

### System Dependencies

The [zstar](https://github.com/8r4n/zstar) utility (`tarzst.sh`) must be installed. The following system tools are required:

| Dependency | Required | Notes |
|-----------|----------|-------|
| `bash` | ✅ | Version ≥ 4.0 |
| `tar` | ✅ | |
| `zstd` | ✅ | |
| `sha512sum` | ✅ | Part of coreutils |
| `numfmt` | ✅ | Part of coreutils |
| `gpg` | ❌ | Required for encryption/signing |
| `pv` | ❌ | Enables progress bars |

### Runtime

- **Node.js** ≥ 18

## License

ISC

---

<div align="center">
  <sub>Built on the <a href="https://modelcontextprotocol.io/">Model Context Protocol</a> · Powered by <a href="https://github.com/8r4n/zstar">zstar</a></sub>
</div>
