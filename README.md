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

## GPG Encryption Scenarios

The following scenarios demonstrate how the zstar MCP server enables secure, encrypted communication between an AI agent and a user. These workflows show the real-world utility of the server: **the agent never handles plaintext secrets**, and the user retains full control over who can access their data.

### Prerequisites for GPG Scenarios

Both the user and the agent environment need GPG keys. In practice the agent's key pair lives on the server where the MCP server runs.

```bash
# User generates their key pair (if they don't already have one)
gpg --full-generate-key          # follow prompts; e.g., user@example.com

# Agent environment generates its own key pair
gpg --full-generate-key          # e.g., agent@mcp-server.local

# Exchange public keys so each side can encrypt for the other
gpg --export --armor user@example.com      > user_public.asc
gpg --export --armor agent@mcp-server.local > agent_public.asc

# Import the other party's public key
gpg --import agent_public.asc    # user imports agent's public key
gpg --import user_public.asc     # agent imports user's public key
```

After this one-time setup both sides can encrypt data that **only the intended recipient can decrypt**.

---

### Scenario 1 — Bidirectional Encrypted Data Exchange

This scenario demonstrates a full round-trip: the user sends encrypted data to the agent, the agent processes it and returns encrypted results — all without plaintext ever being exposed on disk in an unprotected form.

#### How it works

```
┌────────┐                                          ┌────────┐
│  User  │                                          │  Agent │
│        │  1. sign_and_encrypt_archive ──────────► │  (MCP) │
│        │     signed with: user@example.com        │        │
│        │     encrypted for: agent@mcp-server.local│        │
│        │                                          │        │
│        │  2. Agent decrypts with its private key  │        │
│        │     Agent verifies user's signature      │        │
│        │     Agent processes the data             │        │
│        │                                          │        │
│        │  3. sign_and_encrypt_archive ◄────────── │        │
│        │     signed with: agent@mcp-server.local  │        │
│        │     encrypted for: user@example.com      │        │
│        │                                          │        │
│        │  4. User decrypts with their private key │        │
│        │     User verifies agent's signature      │        │
└────────┘                                          └────────┘
```

#### Step 1 — User sends encrypted data to the agent

The user creates an archive signed with their key and encrypted for the agent:

```
User → Agent (via MCP tool call):

sign_and_encrypt_archive({
  inputPaths:    ["./financial-report.csv", "./projections/"],
  signingKeyId:  "user@example.com",
  passphrase:    "users-gpg-passphrase",
  recipientKeyId: "agent@mcp-server.local",
  outputName:    "data-for-agent"
})
```

**Output files:**
- `data-for-agent.tar.zst.gpg` — encrypted; only the agent's private key can decrypt
- `data-for-agent.tar.zst.sha512` — integrity checksum
- `data-for-agent_decompress.sh` — self-extracting script (handles decryption + verification)

#### Step 2 — Agent decrypts and processes

The agent extracts the archive using its own GPG private key. The decompress script automatically verifies the user's signature:

```
Agent (MCP tool call):

extract_archive({
  scriptPath: "./data-for-agent_decompress.sh"
})
```

The agent now has the plaintext files and can process them (analyze data, generate reports, etc.).

#### Step 3 — Agent returns encrypted results to the user

The agent packages its results and encrypts them for the user:

```
Agent → User (via MCP tool call):

sign_and_encrypt_archive({
  inputPaths:    ["./analysis-results/"],
  signingKeyId:  "agent@mcp-server.local",
  passphrase:    "agents-gpg-passphrase",
  recipientKeyId: "user@example.com",
  outputName:    "results-for-user"
})
```

#### Step 4 — User decrypts the results

The user runs the decompress script, which decrypts with their private key and verifies the agent's signature:

```bash
bash results-for-user_decompress.sh
# → Decrypts, verifies agent signature, extracts analysis-results/
```

#### Why this matters

| Property | Guarantee |
|----------|-----------|
| **Confidentiality** | Data is encrypted at rest — only the intended recipient's private key can decrypt |
| **Authenticity** | GPG signatures prove the sender's identity; tampering is detected |
| **Integrity** | SHA-512 checksums catch any corruption in transit or on disk |
| **Non-repudiation** | The sender cannot deny having created the archive (signature is tied to their key) |

---

### Scenario 2 — User-Controlled Private Data with Authorized Access

This scenario demonstrates how a user can encrypt sensitive data and selectively authorize the agent to access it using GPG public-key encryption. The user retains full control: **only archives explicitly encrypted for the agent's public key are accessible**.

#### The principle

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER'S DATA VAULT                             │
│                                                                  │
│  personal-taxes.tar.zst.gpg     ← encrypted for user only       │
│  medical-records.tar.zst.gpg    ← encrypted for user only       │
│  project-data.tar.zst.gpg       ← encrypted for user + agent ✓  │
│  credentials.tar.zst.gpg        ← encrypted for user only       │
│                                                                  │
│  The agent can ONLY decrypt project-data.tar.zst.gpg because     │
│  it is the only archive encrypted for agent@mcp-server.local     │
└──────────────────────────────────────────────────────────────────┘
```

#### Step 1 — User encrypts private data (agent has NO access)

The user creates encrypted archives for their own use. These are encrypted with the user's own key — the agent **cannot** decrypt them:

```
encrypt_archive({
  inputPaths: ["./tax-returns/"],
  password:   "users-secret-password",
  outputName: "personal-taxes"
})
```

Or using GPG public-key encryption for the user only:

```
sign_and_encrypt_archive({
  inputPaths:    ["./medical-records/"],
  signingKeyId:  "user@example.com",
  passphrase:    "users-gpg-passphrase",
  recipientKeyId: "user@example.com",   ← encrypted for self
  outputName:    "medical-records"
})
```

The agent has no way to decrypt either of these archives. The private keys belong solely to the user.

#### Step 2 — User grants the agent access to specific data

When the user decides to share specific data with the agent, they encrypt it for the agent's public key:

```
sign_and_encrypt_archive({
  inputPaths:    ["./project-data/"],
  signingKeyId:  "user@example.com",
  passphrase:    "users-gpg-passphrase",
  recipientKeyId: "agent@mcp-server.local",   ← authorized for agent
  outputName:    "project-data"
})
```

This is the explicit authorization step. The user is making a conscious decision: *"I want the agent to be able to read this specific data."*

#### Step 3 — Agent accesses only the authorized data

```
# ✓ This succeeds — the agent's private key can decrypt it
extract_archive({ scriptPath: "./project-data_decompress.sh" })

# ✗ This fails — the agent does not have the decryption key
extract_archive({ scriptPath: "./personal-taxes_decompress.sh" })
#   → GPG error: no secret key available for decryption
```

#### Step 4 — User revokes access

Access revocation is straightforward: the user simply stops encrypting new data for the agent's key. Previously shared archives remain encrypted — but no new data flows to the agent. For stronger revocation, the user can rotate their own keys.

#### The burn-after-reading option

For maximum security, use `create_burn_after_reading_archive` for one-time data sharing. After the agent extracts the data, the archive self-shreds:

```
create_burn_after_reading_archive({
  inputPaths: ["./one-time-credentials/"],
  outputName: "temp-access"
})
```

After extraction, the `.tar.zst`, `.sha512`, and `_decompress.sh` files are securely overwritten and deleted. The data exists only in the extracted form — there is no archive to re-extract or forward.

---

### Why the MCP Server Matters for Data Protection

The zstar MCP server bridges the gap between **powerful encryption tools** and **AI agent workflows**. Without it, an agent would need raw shell access, credential handling, and deep knowledge of GPG and tar commands. The MCP server provides:

| Capability | Without MCP Server | With zstar MCP Server |
|-----------|-------------------|----------------------|
| **Encryption** | Agent runs raw `gpg` commands, handles passphrases in shell history | Structured API with parameter validation; no shell injection risk |
| **Key management** | Agent must know GPG internals | Agent calls `sign_and_encrypt_archive` with key IDs |
| **Integrity** | Agent must manually run `sha512sum` | Automatic SHA-512 checksums on every archive |
| **Access control** | No boundary between "agent data" and "user data" | GPG public-key encryption enforces cryptographic access boundaries |
| **Audit trail** | None | Each archive is signed — provenance is verifiable |
| **Secure disposal** | Agent must know `shred` semantics | `create_burn_after_reading_archive` handles secure deletion |
| **Error handling** | Raw shell errors | Structured success/failure responses with exit codes |

The server turns GPG-based encryption from a manual, error-prone process into a **safe, auditable, tool-call API** that AI agents can use without ever needing direct access to private keys, shell commands, or filesystem internals.

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
