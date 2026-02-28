# Contributing to zstar-mcp-server

Thank you for your interest in contributing to **zstar-mcp-server**! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## How to Contribute

### Reporting Bugs

If you find a bug, please [open an issue](https://github.com/8r4n/zstar-mcp-server/issues/new?labels=bug&template=bug_report.md) with:

- **Description** — A clear summary of the problem
- **Steps to reproduce** — Minimal steps to trigger the bug
- **Expected behavior** — What you expected to happen
- **Actual behavior** — What actually happened
- **Environment** — OS, Node.js version, zstar version, GPG version
- **Logs/output** — Any error messages or stack traces

### Requesting Features

[Open a feature request issue](https://github.com/8r4n/zstar-mcp-server/issues/new?labels=enhancement) with:

- **Use case** — What problem does the feature solve?
- **Proposed solution** — How you envision it working
- **Alternatives considered** — Other approaches you explored

### Submitting Pull Requests

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Make your changes** — keep commits focused and descriptive
5. **Build** and verify there are no TypeScript errors:
   ```bash
   npm run build
   ```
6. **Run all tests** and ensure they pass:
   ```bash
   npm test
   ```
7. **Push** your branch and open a pull request against `main`

#### PR Guidelines

- **One concern per PR** — Don't mix unrelated changes
- **Add tests** for new tools or behavior changes
- **Update documentation** if your change affects the README, tool descriptions, or schemas
- **Keep backwards compatibility** — Avoid breaking existing tool interfaces
- **Follow existing code style** — Match the patterns in `src/server.ts` and `src/zstar.ts`

## Development Setup

### Prerequisites

| Dependency | Required | Linux | macOS |
|---|---|---|---|
| Node.js ≥ 18 | ✅ | `apt install nodejs` | `brew install node` |
| `bash` | ✅ | Pre-installed | `brew install bash` (≥ v4) |
| `tar` | ✅ | Pre-installed | Pre-installed |
| `zstd` | ✅ | `apt install zstd` | `brew install zstd` |
| `sha512sum` | ✅ | Part of coreutils | `shasum` pre-installed; or `brew install coreutils` |
| `numfmt` | ✅ | Part of coreutils | `brew install coreutils` (provides `gnumfmt`) |
| `gpg` | ✅ | `apt install gnupg` | `brew install gnupg` |
| `pv` | ✅ | `apt install pv` | `brew install pv` |
| [tarzst.sh](https://github.com/8r4n/zstar) | ✅ | See repo | See repo |

> **Note:** The MCP server automatically detects macOS and uses platform-appropriate commands (`shasum -a 512` instead of `sha512sum`, `gnumfmt` instead of `numfmt`).

### Build & Test

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

### Project Structure

```
src/
├── index.ts      # Entry point (stdio transport)
├── server.ts     # MCP tool definitions (13 tools)
└── zstar.ts      # zstar wrapper + GPG key management
test/
├── zstar.test.ts    # Unit tests
├── server.test.ts   # Integration tests (InMemoryTransport)
└── openclaw.test.ts # OpenClaw integration tests (StdioClientTransport)
```

### Adding a New Tool

1. Add the implementation function in `src/zstar.ts`
2. Register the tool with its schema in `src/server.ts`
3. Add unit tests in `test/zstar.test.ts`
4. Add integration tests in `test/server.test.ts`
5. Update the README tool table

## Questions?

If you have questions about contributing, feel free to [open a discussion issue](https://github.com/8r4n/zstar-mcp-server/issues/new?labels=question).
