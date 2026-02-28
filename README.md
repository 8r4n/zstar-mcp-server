# zstar-mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes all features of the [zstar](https://github.com/8r4n/zstar) archive utility. It allows AI assistants to create, extract, verify, encrypt, and sign compressed archives through a standardized tool interface.

## Features

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

## Prerequisites

### System Dependencies

The zstar utility (`tarzst.sh`) must be installed and available on the system. The following dependencies are required:

**Required:**
- `bash` (≥ 4.0)
- `tar`
- `zstd`
- `sha512sum` (part of coreutils)
- `numfmt` (part of coreutils)

**Optional:**
- `gpg` (gnupg) — required for encryption/signing features
- `pv` — enables progress bars

### Runtime

- Node.js ≥ 18

## Installation

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

## Configuration

### Setting the zstar script path

The server locates the `tarzst.sh` script in the following order:

1. **`ZSTAR_PATH` environment variable** — set to the absolute path of `tarzst.sh`
2. **System PATH** — looks for `tarzst` or `tarzst.sh` on your `PATH`

Example:

```bash
export ZSTAR_PATH=/usr/local/bin/tarzst.sh
```

### MCP Client Configuration

Add the server to your MCP client configuration. For example, in Claude Desktop's `claude_desktop_config.json`:

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

## Usage

### Running the server

The server communicates over **stdio** following the MCP standard:

```bash
node dist/index.js
```

### Tool Reference

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
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Testing

The project includes comprehensive tests using [Vitest](https://vitest.dev/):

- **Unit tests** (`test/zstar.test.ts`) — test the zstar wrapper module directly
- **Integration tests** (`test/server.test.ts`) — test the MCP server via the in-memory transport

Tests cover:
- Tool registration and schema validation
- Dependency checking
- Checksum verification (valid and corrupted files)
- Error handling for missing files/scripts
- Archive creation (when `tarzst.sh` is available)

## License

ISC
