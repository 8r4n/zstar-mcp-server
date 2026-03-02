#!/usr/bin/env bash
# =============================================================================
# zstar MCP server — bash implementation
#
# JSON-RPC 2.0 over stdio (newline-delimited JSON).
# Implements the Model Context Protocol (MCP) with all 22 zstar tools.
#
# Dependencies: bash ≥4, jq, tar, zstd, gpg, pv, sha512sum/shasum, nc (optional)
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SERVER_NAME="zstar-mcp-server"
SERVER_VERSION="1.0.0"
PROTOCOL_VERSION="2024-11-05"
EXEC_TIMEOUT=300

IS_MACOS=false
[[ "$(uname -s)" == "Darwin" ]] && IS_MACOS=true

# ---------------------------------------------------------------------------
# Logging (stderr only — stdout is the JSON-RPC channel)
# ---------------------------------------------------------------------------
log() { echo "[$SERVER_NAME] $*" >&2; }

# ---------------------------------------------------------------------------
# Find tarzst.sh
# ---------------------------------------------------------------------------
find_zstar_script() {
  if [[ -n "${ZSTAR_PATH:-}" ]]; then
    if [[ -f "$ZSTAR_PATH" ]]; then
      echo "$ZSTAR_PATH"
      return 0
    fi
    log "ZSTAR_PATH is set to '$ZSTAR_PATH' but the file does not exist."
    return 1
  fi
  local name p
  for name in tarzst tarzst.sh; do
    p=$(command -v "$name" 2>/dev/null || true)
    if [[ -n "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  log "Could not find tarzst.sh. Set ZSTAR_PATH or ensure 'tarzst' is on PATH."
  return 1
}

# ---------------------------------------------------------------------------
# Execute a command, capture stdout / stderr / exit-code
# After calling:  $_stdout  $_stderr  $_exit_code
# ---------------------------------------------------------------------------
_stdout="" _stderr="" _exit_code=0
run_cmd() {
  local tmp_out tmp_err
  tmp_out=$(mktemp) tmp_err=$(mktemp)
  _exit_code=0
  "$@" >"$tmp_out" 2>"$tmp_err" || _exit_code=$?
  _stdout=$(<"$tmp_out")
  _stderr=$(<"$tmp_err")
  rm -f "$tmp_out" "$tmp_err"
}

# ---------------------------------------------------------------------------
# Validate host:port target (matches TypeScript validateNetStreamTarget)
# Prints error message on failure, empty string on success.
# ---------------------------------------------------------------------------
validate_target() {
  local t="$1"
  if [[ "$t" =~ [[:space:]] ]]; then
    echo "Network target must not contain whitespace."; return 0
  fi
  local cc
  cc=$(printf '%s' "$t" | tr -cd ':' | wc -c)
  if [[ "$cc" -ne 1 ]]; then
    echo "Network target must be in host:port format with exactly one ':' separator."; return 0
  fi
  local host="${t%%:*}" port="${t##*:}"
  if [[ -z "$host" ]] || ! [[ "$host" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "Hostname must contain only alphanumeric characters, dots, underscores, and hyphens."; return 0
  fi
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "Port must be a numeric value."; return 0
  fi
  local pn=$((port))
  if (( pn < 1 || pn > 65535 )); then
    echo "Port must be in the range 1-65535."; return 0
  fi
  echo ""; return 0
}

# ---------------------------------------------------------------------------
# JSON helpers — everything through jq to avoid injection
# ---------------------------------------------------------------------------
send() { printf '%s\n' "$1"; }

# Build a text-content tool result
make_result() {
  local id_json="$1" text="$2"
  jq -nc --argjson id "$id_json" --arg t "$text" \
    '{jsonrpc:"2.0",id:$id,result:{content:[{type:"text",text:$t}]}}'
}

# Build a JSON-RPC error response
make_error() {
  local id_json="$1" code="$2" msg="$3"
  jq -nc --argjson id "$id_json" --argjson c "$code" --arg m "$msg" \
    '{jsonrpc:"2.0",id:$id,error:{code:$c,message:$m}}'
}

# Format a ZstarResult (exit_code, stdout, stderr, operation) into text
format_result() {
  local ec="$1" out="$2" err="$3" op="$4"
  local status parts
  if [[ "$ec" -eq 0 ]]; then status="SUCCESS"; else status="FAILED (exit code $ec)"; fi
  parts="${op}: ${status}"
  # trim
  local tout terr
  tout=$(printf '%s' "$out" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  terr=$(printf '%s' "$err" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  if [[ -n "$tout" ]]; then
    parts="${parts}
Output:
${tout}"
  fi
  if [[ -n "$terr" ]]; then
    if [[ "$ec" -eq 0 ]]; then
      parts="${parts}
Warnings:
${terr}"
    else
      parts="${parts}
Errors:
${terr}"
    fi
  fi
  printf '%s' "$parts"
}

# ---------------------------------------------------------------------------
# Tool-schema JSON (all 22 tools)
# ---------------------------------------------------------------------------
tools_json() {
  cat <<'TOOLS_EOF'
[
  {
    "name":"create_archive",
    "description":"Create a compressed tar.zst archive from files or directories using zstd compression with SHA-512 checksum verification and a self-extracting decompress script.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name for output files"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths"]
    }
  },
  {
    "name":"encrypt_archive",
    "description":"Create a password-encrypted (AES-256 symmetric) compressed archive. The archive is encrypted using GPG symmetric encryption.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive"},
        "password":{"type":"string","minLength":1,"description":"Symmetric encryption password"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name for output files"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","password"]
    }
  },
  {
    "name":"sign_archive",
    "description":"Create a GPG-signed compressed archive. The archive is signed with your GPG private key for authenticity verification.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive"},
        "signingKeyId":{"type":"string","minLength":1,"description":"GPG key ID for signing (e.g., email or fingerprint)"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase for the signing key"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name for output files"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","signingKeyId","passphrase"]
    }
  },
  {
    "name":"sign_and_encrypt_archive",
    "description":"Create a GPG-signed and recipient-encrypted compressed archive. Combines signing with public-key encryption for a specific recipient.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive"},
        "signingKeyId":{"type":"string","minLength":1,"description":"GPG key ID for signing (e.g., email or fingerprint)"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase for the signing key"},
        "recipientKeyId":{"type":"string","minLength":1,"description":"GPG key ID of the recipient for encryption"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name for output files"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","signingKeyId","passphrase","recipientKeyId"]
    }
  },
  {
    "name":"create_burn_after_reading_archive",
    "description":"Create an archive with a self-erase routine. After extraction, archive files are securely shredded. Ideal for sensitive one-time transfers.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name for output files"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths"]
    }
  },
  {
    "name":"extract_archive",
    "description":"Extract a zstar archive using the generated self-extracting decompress script. Handles integrity verification, decryption, and decompression automatically.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "scriptPath":{"type":"string","minLength":1,"description":"Path to the generated *_decompress.sh script"},
        "cwd":{"type":"string","description":"Working directory for extraction"}
      },
      "required":["scriptPath"]
    }
  },
  {
    "name":"list_archive",
    "description":"List the contents of a zstar archive without extracting, using the generated decompress script's 'list' mode.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "scriptPath":{"type":"string","minLength":1,"description":"Path to the generated *_decompress.sh script"},
        "cwd":{"type":"string","description":"Working directory"}
      },
      "required":["scriptPath"]
    }
  },
  {
    "name":"verify_checksum",
    "description":"Verify the SHA-512 checksum of a zstar archive to ensure its integrity. Uses the .sha512 file generated during archive creation.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "checksumFile":{"type":"string","minLength":1,"description":"Path to the .sha512 checksum file"},
        "cwd":{"type":"string","description":"Working directory"}
      },
      "required":["checksumFile"]
    }
  },
  {
    "name":"check_dependencies",
    "description":"Check whether all required system dependencies for zstar are installed (bash, tar, zstd, sha512sum, numfmt, gpg, pv) and optional dependencies (nc for network streaming). On macOS, automatically detects platform alternatives (shasum for sha512sum, gnumfmt for numfmt).",
    "inputSchema":{
      "type":"object",
      "properties":{},
      "required":[]
    }
  },
  {
    "name":"net_stream_archive",
    "description":"Stream a compressed archive directly to a remote host via netcat (nc), bypassing all disk I/O. No archive file, checksum, or decompress script is written to disk. Requires nc (netcat) installed on both sender and receiver.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive and stream"},
        "target":{"type":"string","minLength":1,"description":"Network destination in host:port format (e.g., 'remote_host:9000'). Hostname must contain only alphanumeric characters, dots, underscores, and hyphens. Port must be 1-65535."},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name (used for stream identification)"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","target"]
    }
  },
  {
    "name":"net_stream_encrypted_archive",
    "description":"Stream a password-encrypted (AES-256 symmetric) compressed archive directly to a remote host via netcat. No files are written to disk. The receiver needs the same password to decrypt.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive and stream"},
        "target":{"type":"string","minLength":1,"description":"Network destination in host:port format (e.g., 'remote_host:9000')"},
        "password":{"type":"string","minLength":1,"description":"Symmetric encryption password"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name (used for stream identification)"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","target","password"]
    }
  },
  {
    "name":"net_stream_signed_encrypted_archive",
    "description":"Stream a GPG-signed and recipient-encrypted compressed archive directly to a remote host via netcat. Uses asymmetric encryption — the sender signs with their private key and encrypts for the recipient's public key. No files are written to disk.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive and stream"},
        "target":{"type":"string","minLength":1,"description":"Network destination in host:port format (e.g., 'remote_host:9000')"},
        "signingKeyId":{"type":"string","minLength":1,"description":"GPG key ID for signing (e.g., email or fingerprint)"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase for the signing key"},
        "recipientKeyId":{"type":"string","minLength":1,"description":"GPG key ID of the recipient for encryption"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name (used for stream identification)"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","target","signingKeyId","passphrase","recipientKeyId"]
    }
  },
  {
    "name":"listen_for_stream",
    "description":"Listen for incoming streamed data using a decompress script's listen mode. The decompress script receives, decrypts (if applicable), decompresses, and extracts streamed data in real-time. Requires nc (netcat) installed. Start this before the sender streams data.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "scriptPath":{"type":"string","minLength":1,"description":"Path to the generated *_decompress.sh script"},
        "port":{"type":"integer","minimum":1,"maximum":65535,"description":"Port number to listen on (1-65535)"},
        "cwd":{"type":"string","description":"Working directory"}
      },
      "required":["scriptPath","port"]
    }
  },
  {
    "name":"gpg_init_agent_communication",
    "description":"Initialize GPG identity for encrypted agent-to-agent communication. Generates a GPG key pair for the local agent (if not already present) and exports the public key. This is the first step in establishing a secure channel between two agents. Share the exported public key with the remote agent.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "agentName":{"type":"string","minLength":1,"description":"Display name for the agent (e.g., 'Agent Alpha' or 'Build Server')"},
        "agentEmail":{"type":"string","minLength":1,"description":"Email identifier for the agent (e.g., 'agent-alpha@mcp-server.local')"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase to protect the agent's private key"},
        "keyType":{"type":"string","enum":["RSA","DSA","EDDSA"],"description":"Key type. Default: EDDSA (modern, fast)"},
        "keyLength":{"type":"integer","minimum":1024,"maximum":4096,"description":"Key length in bits (for RSA/DSA). Default: 4096"},
        "expireDate":{"type":"string","description":"Key expiry (e.g., '1y' for 1 year, '0' for no expiry). Default: '0'"},
        "outputFile":{"type":"string","description":"File path to save the exported public key (e.g., './agent_alpha_public.asc'). If omitted, the armored key is returned directly."}
      },
      "required":["agentName","agentEmail","passphrase"]
    }
  },
  {
    "name":"encrypted_agent_stream",
    "description":"Stream GPG-signed and encrypted data directly from one agent to another over the network. Validates that both agents have each other's keys, then streams a signed + recipient-encrypted compressed archive via netcat. The sender signs with their private key and encrypts for the recipient's public key. Requires prior key exchange via gpg_init_agent_communication.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "inputPaths":{"type":"array","items":{"type":"string"},"minItems":1,"description":"Files or directories to archive and stream to the remote agent"},
        "target":{"type":"string","minLength":1,"description":"Remote agent's network address in host:port format (e.g., 'agent-b-host:9000')"},
        "signingKeyId":{"type":"string","minLength":1,"description":"Local agent's GPG key ID for signing (e.g., 'agent-alpha@mcp-server.local')"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase for the local agent's signing key"},
        "recipientKeyId":{"type":"string","minLength":1,"description":"Remote agent's GPG key ID for encryption (e.g., 'agent-beta@mcp-server.local')"},
        "compressionLevel":{"type":"integer","minimum":1,"maximum":19,"description":"zstd compression level (1-19). Default: 3"},
        "outputName":{"type":"string","description":"Custom base name for stream identification"},
        "excludePatterns":{"type":"array","items":{"type":"string"},"description":"File exclusion patterns for tar"},
        "cwd":{"type":"string","description":"Working directory for the command"}
      },
      "required":["inputPaths","target","signingKeyId","passphrase","recipientKeyId"]
    }
  },
  {
    "name":"request_secure_channel",
    "description":"Request a remote agent to configure itself for secure real-time GPG-encrypted communication. Initializes the local agent's GPG identity and generates a structured request containing the public key and setup instructions that the remote agent can use to establish a bidirectional encrypted channel. This is the initiating step in automated agent-to-agent secure channel setup.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "agentName":{"type":"string","minLength":1,"description":"Display name for the requesting agent (e.g., 'Build Agent' or 'Agent Alpha')"},
        "agentEmail":{"type":"string","minLength":1,"description":"Email identifier for the requesting agent (e.g., 'agent-alpha@mcp-server.local')"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase to protect the requesting agent's private key"},
        "keyType":{"type":"string","enum":["RSA","DSA","EDDSA"],"description":"Key type. Default: EDDSA (modern, fast)"},
        "keyLength":{"type":"integer","minimum":1024,"maximum":4096,"description":"Key length in bits (for RSA/DSA). Default: 4096"},
        "expireDate":{"type":"string","description":"Key expiry (e.g., '1y' for 1 year, '0' for no expiry). Default: '0'"},
        "listeningAddress":{"type":"string","description":"Network host:port where this agent will listen for incoming encrypted streams (e.g., 'agent-alpha-host:9000')"}
      },
      "required":["agentName","agentEmail","passphrase"]
    }
  },
  {
    "name":"gpg_list_keys",
    "description":"List GPG keys in the keyring. Use this to check which keys are available for signing, encryption, and decryption. Part of the GPG key setup walkthrough.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "secretOnly":{"type":"boolean","description":"If true, list only secret (private) keys. Default: false (lists public keys)"}
      },
      "required":[]
    }
  },
  {
    "name":"gpg_generate_key",
    "description":"Generate a new GPG key pair for the user or agent. This is the first step in the GPG setup walkthrough. Creates both a public key (for others to encrypt data for you) and a private key (for decryption and signing).",
    "inputSchema":{
      "type":"object",
      "properties":{
        "name":{"type":"string","minLength":1,"description":"Real name for the key (e.g., 'Alice Smith' or 'MCP Agent')"},
        "email":{"type":"string","minLength":1,"description":"Email address for the key (e.g., 'user@example.com' or 'agent@mcp-server.local')"},
        "passphrase":{"type":"string","minLength":1,"description":"Passphrase to protect the private key"},
        "keyType":{"type":"string","enum":["RSA","DSA","EDDSA"],"description":"Key type. Default: RSA"},
        "keyLength":{"type":"integer","minimum":1024,"maximum":4096,"description":"Key length in bits (for RSA/DSA). Default: 4096"},
        "expireDate":{"type":"string","description":"Key expiry (e.g., '1y' for 1 year, '0' for no expiry). Default: '0'"}
      },
      "required":["name","email","passphrase"]
    }
  },
  {
    "name":"gpg_export_public_key",
    "description":"Export a GPG public key in armored (ASCII) format. Use this to share your public key with the other party so they can encrypt data for you. Part of the GPG key setup walkthrough.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "keyId":{"type":"string","minLength":1,"description":"Key ID, email, or fingerprint of the key to export (e.g., 'user@example.com')"},
        "outputFile":{"type":"string","description":"File path to save the exported key (e.g., './user_public.asc'). If omitted, the armored key is returned directly."}
      },
      "required":["keyId"]
    }
  },
  {
    "name":"gpg_import_key",
    "description":"Import a GPG public key from a file into the keyring. Use this to import the other party's public key so you can encrypt data for them. Part of the GPG key setup walkthrough.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "keyFile":{"type":"string","minLength":1,"description":"Path to the armored key file to import (e.g., './agent_public.asc')"}
      },
      "required":["keyFile"]
    }
  },
  {
    "name":"read_file",
    "description":"Read the content of a file and return it as text. Optionally decrypts a GPG-encrypted file before returning the content. Plain (non-GPG) reads are limited to 10 MB.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "filePath":{"type":"string","minLength":1,"description":"Path to the file to read"},
        "cwd":{"type":"string","description":"Working directory — filePath is resolved relative to this"},
        "gpgDecrypt":{"type":"boolean","description":"If true, decrypt the file with GPG before returning content"},
        "passphrase":{"type":"string","description":"Passphrase for symmetric GPG decryption"}
      },
      "required":["filePath"]
    }
  },
  {
    "name":"write_file",
    "description":"Write text content to a file. Optionally encrypts the content with GPG (public-key or signed+encrypted) before writing. Writing to critical system directories (/etc, /usr, /bin, etc.) is blocked. Existing files are not overwritten unless overwrite is set to true.",
    "inputSchema":{
      "type":"object",
      "properties":{
        "filePath":{"type":"string","minLength":1,"description":"Path where the file should be written"},
        "content":{"type":"string","description":"Text content to write to the file"},
        "cwd":{"type":"string","description":"Working directory — filePath is resolved relative to this"},
        "overwrite":{"type":"boolean","description":"If true, overwrite an existing file. Default: false"},
        "gpgRecipient":{"type":"string","description":"GPG recipient key ID for public-key encryption (e.g., 'user@example.com'). If set, the file is GPG-encrypted before writing."},
        "gpgSigner":{"type":"string","description":"GPG signing key ID. If set alongside gpgRecipient, the file is signed before encryption."},
        "gpgPassphrase":{"type":"string","description":"Passphrase for the GPG signing key"},
        "mode":{"type":"integer","description":"POSIX file permissions as an integer (e.g., 420 for 0o644)"}
      },
      "required":["filePath","content"]
    }
  }
]
TOOLS_EOF
}

# Cache the tools JSON on first use
_TOOLS_CACHE=""
get_tools_json() {
  if [[ -z "$_TOOLS_CACHE" ]]; then
    _TOOLS_CACHE=$(tools_json)
  fi
  printf '%s' "$_TOOLS_CACHE"
}

# ---------------------------------------------------------------------------
# Build common tarzst argument array from JSON params
# Reads: inputPaths, compressionLevel, outputName, excludePatterns
# Outputs one arg per line to be read into an array
# ---------------------------------------------------------------------------
build_create_args() {
  local args_json="$1"
  local level out_name

  level=$(printf '%s' "$args_json" | jq -r '.compressionLevel // empty')
  if [[ -n "$level" ]] && (( level >= 1 && level <= 19 )); then
    printf '%s\n' "-l"
    printf '%s\n' "$level"
  fi

  out_name=$(printf '%s' "$args_json" | jq -r '.outputName // empty')
  if [[ -n "$out_name" ]]; then
    printf '%s\n' "-o"
    printf '%s\n' "$out_name"
  fi

  # exclude patterns
  local ep_len
  ep_len=$(printf '%s' "$args_json" | jq -r '.excludePatterns | length // 0')
  if (( ep_len > 0 )); then
    local i
    for (( i=0; i<ep_len; i++ )); do
      printf '%s\n' "-e"
      printf '%s' "$args_json" | jq -r ".excludePatterns[$i]"
    done
  fi

  # input paths
  local ip_len
  ip_len=$(printf '%s' "$args_json" | jq -r '.inputPaths | length')
  local i
  for (( i=0; i<ip_len; i++ )); do
    printf '%s' "$args_json" | jq -r ".inputPaths[$i]"
  done
}

# ---------------------------------------------------------------------------
# Tool handlers
# Each sets _tool_text with the response text.
# ---------------------------------------------------------------------------
_tool_text=""

handle_create_archive() {
  local id_json="$1" args="$2"
  local script cwd
  script=$(find_zstar_script) || { _tool_text="Archive creation: FAILED (exit code 1)

Errors:
Could not find tarzst.sh. Set ZSTAR_PATH or ensure 'tarzst' is on PATH."; return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  local -a cmd_args=()
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Archive creation")
}

handle_encrypt_archive() {
  local id_json="$1" args="$2"
  local script cwd
  script=$(find_zstar_script) || { _tool_text="Encrypted archive creation: FAILED (exit code 1)

Errors:
Could not find tarzst.sh."; return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  local -a cmd_args=("-p")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Encrypted archive creation")
}

handle_sign_archive() {
  local id_json="$1" args="$2"
  local script cwd signing_key_id
  script=$(find_zstar_script) || { _tool_text="Signed archive creation: FAILED (exit code 1)

Errors:
Could not find tarzst.sh."; return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')
  signing_key_id=$(printf '%s' "$args" | jq -r '.signingKeyId')

  local -a cmd_args=("-s" "$signing_key_id")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Signed archive creation")
}

handle_sign_and_encrypt_archive() {
  local id_json="$1" args="$2"
  local script cwd signing_key_id recipient_key_id
  script=$(find_zstar_script) || { _tool_text="Signed and encrypted archive creation: FAILED (exit code 1)

Errors:
Could not find tarzst.sh."; return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')
  signing_key_id=$(printf '%s' "$args" | jq -r '.signingKeyId')
  recipient_key_id=$(printf '%s' "$args" | jq -r '.recipientKeyId')

  local -a cmd_args=("-s" "$signing_key_id" "-r" "$recipient_key_id")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Signed and encrypted archive creation")
}

handle_create_burn_after_reading_archive() {
  local id_json="$1" args="$2"
  local script cwd
  script=$(find_zstar_script) || { _tool_text="Burn-after-reading archive creation: FAILED (exit code 1)

Errors:
Could not find tarzst.sh."; return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  local -a cmd_args=("-b")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Burn-after-reading archive creation")
}

handle_extract_archive() {
  local id_json="$1" args="$2"
  local script_path cwd resolved
  script_path=$(printf '%s' "$args" | jq -r '.scriptPath')
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  if [[ -n "$cwd" ]]; then
    resolved=$(cd "$cwd" 2>/dev/null && realpath "$script_path" 2>/dev/null || echo "$cwd/$script_path")
  else
    resolved=$(realpath "$script_path" 2>/dev/null || echo "$script_path")
  fi

  if [[ ! -f "$resolved" ]]; then
    _tool_text=$(format_result 1 "" "Decompress script not found: $resolved" "Archive extraction")
    return
  fi

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && bash $(printf '%q' "$resolved")"
  else
    run_cmd bash "$resolved"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Archive extraction")
}

handle_list_archive() {
  local id_json="$1" args="$2"
  local script_path cwd resolved
  script_path=$(printf '%s' "$args" | jq -r '.scriptPath')
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  if [[ -n "$cwd" ]]; then
    resolved=$(cd "$cwd" 2>/dev/null && realpath "$script_path" 2>/dev/null || echo "$cwd/$script_path")
  else
    resolved=$(realpath "$script_path" 2>/dev/null || echo "$script_path")
  fi

  if [[ ! -f "$resolved" ]]; then
    _tool_text=$(format_result 1 "" "Decompress script not found: $resolved" "Archive listing")
    return
  fi

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && bash $(printf '%q' "$resolved") list"
  else
    run_cmd bash "$resolved" list
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Archive listing")
}

handle_verify_checksum() {
  local id_json="$1" args="$2"
  local checksum_file cwd resolved
  checksum_file=$(printf '%s' "$args" | jq -r '.checksumFile')
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  if [[ -n "$cwd" ]]; then
    resolved=$(cd "$cwd" 2>/dev/null && realpath "$checksum_file" 2>/dev/null || echo "$cwd/$checksum_file")
  else
    resolved=$(realpath "$checksum_file" 2>/dev/null || echo "$checksum_file")
  fi

  if [[ ! -f "$resolved" ]]; then
    _tool_text=$(format_result 1 "" "Checksum file not found: $resolved" "Checksum verification")
    return
  fi

  local verify_cwd="${cwd:-$(dirname "$resolved")}"
  if $IS_MACOS; then
    run_cmd bash -c "cd $(printf '%q' "$verify_cwd") && shasum -a 512 -c $(printf '%q' "$resolved")"
  else
    run_cmd bash -c "cd $(printf '%q' "$verify_cwd") && sha512sum -c $(printf '%q' "$resolved")"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Checksum verification")
}

handle_check_dependencies() {
  local id_json="$1"
  local deps=("bash:true" "tar:true" "zstd:true" "sha512sum:true:shasum" "numfmt:true:gnumfmt" "gpg:true" "pv:true" "nc:false")
  local lines="" all_req_ok=true

  for entry in "${deps[@]}"; do
    IFS=: read -r name required mac_alt <<< "$entry"
    local available=false
    if command -v "$name" &>/dev/null; then
      available=true
    elif $IS_MACOS && [[ -n "${mac_alt:-}" ]] && command -v "$mac_alt" &>/dev/null; then
      available=true
    fi

    local mark="✗" status="NOT FOUND" req_label=""
    if $available; then mark="✓"; status="installed"; fi
    if [[ "$required" == "true" ]]; then
      req_label=" (required)"
      if ! $available; then all_req_ok=false; fi
    else
      req_label=" (optional)"
    fi
    lines="${lines}${mark} ${name} — ${status}${req_label}
"
  done

  local summary
  if $all_req_ok; then
    summary="All required dependencies are installed."
  else
    summary="Some required dependencies are missing!"
  fi
  _tool_text="Dependency Check Results:
${lines}
${summary}"
}

# --- Network streaming tools ---

handle_net_stream_archive() {
  local id_json="$1" args="$2"
  local target verr
  target=$(printf '%s' "$args" | jq -r '.target')
  verr=$(validate_target "$target")
  if [[ -n "$verr" ]]; then
    _tool_text=$(format_result 2 "" "$verr" "Network stream")
    return
  fi
  local script cwd
  script=$(find_zstar_script) || { _tool_text=$(format_result 1 "" "Could not find tarzst.sh." "Network stream"); return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  local -a cmd_args=("-n" "$target")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Network stream")
}

handle_net_stream_encrypted_archive() {
  local id_json="$1" args="$2"
  local target verr
  target=$(printf '%s' "$args" | jq -r '.target')
  verr=$(validate_target "$target")
  if [[ -n "$verr" ]]; then
    _tool_text=$(format_result 2 "" "$verr" "Encrypted network stream")
    return
  fi
  local script cwd
  script=$(find_zstar_script) || { _tool_text=$(format_result 1 "" "Could not find tarzst.sh." "Encrypted network stream"); return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  local -a cmd_args=("-p" "-n" "$target")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Encrypted network stream")
}

handle_net_stream_signed_encrypted_archive() {
  local id_json="$1" args="$2"
  local target verr
  target=$(printf '%s' "$args" | jq -r '.target')
  verr=$(validate_target "$target")
  if [[ -n "$verr" ]]; then
    _tool_text=$(format_result 2 "" "$verr" "Signed encrypted network stream")
    return
  fi
  local script cwd signing_key_id recipient_key_id
  script=$(find_zstar_script) || { _tool_text=$(format_result 1 "" "Could not find tarzst.sh." "Signed encrypted network stream"); return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')
  signing_key_id=$(printf '%s' "$args" | jq -r '.signingKeyId')
  recipient_key_id=$(printf '%s' "$args" | jq -r '.recipientKeyId')

  local -a cmd_args=("-s" "$signing_key_id" "-r" "$recipient_key_id" "-n" "$target")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Signed encrypted network stream")
}

handle_listen_for_stream() {
  local id_json="$1" args="$2"
  local script_path port cwd resolved
  script_path=$(printf '%s' "$args" | jq -r '.scriptPath')
  port=$(printf '%s' "$args" | jq -r '.port')
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  if (( port < 1 || port > 65535 )); then
    _tool_text=$(format_result 2 "" "Port must be in the range 1-65535." "Stream listener")
    return
  fi

  if [[ -n "$cwd" ]]; then
    resolved=$(cd "$cwd" 2>/dev/null && realpath "$script_path" 2>/dev/null || echo "$cwd/$script_path")
  else
    resolved=$(realpath "$script_path" 2>/dev/null || echo "$script_path")
  fi

  if [[ ! -f "$resolved" ]]; then
    _tool_text=$(format_result 1 "" "Decompress script not found: $resolved" "Stream listener")
    return
  fi

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && bash $(printf '%q' "$resolved") listen $port"
  else
    run_cmd bash "$resolved" listen "$port"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Stream listener")
}

# --- GPG key management tools ---

do_gpg_generate_key() {
  # Generates a GPG key; sets _stdout, _stderr, _exit_code
  local name="$1" email="$2" passphrase="$3" key_type="${4:-RSA}" key_length="${5:-4096}" expire_date="${6:-0}"
  local ktp sktp len_lines

  if [[ "$key_type" == "EDDSA" ]]; then
    ktp="Key-Type: EDDSA"
    sktp="Subkey-Type: ECDH"
    len_lines="Key-Curve: ed25519
Subkey-Curve: cv25519"
  else
    ktp="Key-Type: $key_type"
    sktp="Subkey-Type: $key_type"
    len_lines="Key-Length: $key_length
Subkey-Length: $key_length"
  fi

  local batch_cfg="%no-protection
${ktp}
${len_lines}
${sktp}
Name-Real: ${name}
Name-Email: ${email}
Expire-Date: ${expire_date}
Passphrase: ${passphrase}
%commit"

  local tmp_dir batch_file
  tmp_dir=$(mktemp -d)
  batch_file="${tmp_dir}/keygen-batch.txt"
  printf '%s\n' "$batch_cfg" > "$batch_file"
  chmod 600 "$batch_file"
  run_cmd gpg --batch --gen-key "$batch_file"
  rm -rf "$tmp_dir"
}

handle_gpg_list_keys() {
  local id_json="$1" args="$2"
  local secret_only
  secret_only=$(printf '%s' "$args" | jq -r '.secretOnly // false')

  if [[ "$secret_only" == "true" ]]; then
    run_cmd gpg --list-secret-keys --keyid-format long
  else
    run_cmd gpg --list-keys --keyid-format long
  fi

  local output has_keys text
  output=$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  has_keys=false
  if [[ -n "$output" ]] && { echo "$output" | grep -qE '(pub|sec)'; }; then
    has_keys=true
  fi

  if $has_keys; then
    if [[ "$secret_only" == "true" ]]; then
      text="GPG Secret Keys:

${output}"
    else
      text="GPG Keys:

${output}"
    fi
  else
    if [[ "$secret_only" == "true" ]]; then
      text="No secret keys found in the GPG keyring. Use gpg_generate_key to create a new key pair."
    else
      text="No keys found in the GPG keyring. Use gpg_generate_key to create a new key pair."
    fi
  fi
  _tool_text="$text"
}

handle_gpg_generate_key() {
  local id_json="$1" args="$2"
  local name email passphrase key_type key_length expire_date
  name=$(printf '%s' "$args" | jq -r '.name')
  email=$(printf '%s' "$args" | jq -r '.email')
  passphrase=$(printf '%s' "$args" | jq -r '.passphrase')
  key_type=$(printf '%s' "$args" | jq -r '.keyType // "RSA"')
  key_length=$(printf '%s' "$args" | jq -r '.keyLength // 4096')
  expire_date=$(printf '%s' "$args" | jq -r '.expireDate // "0"')

  do_gpg_generate_key "$name" "$email" "$passphrase" "$key_type" "$key_length" "$expire_date"

  local parts
  if [[ "$_exit_code" -eq 0 ]]; then
    parts="GPG key pair generated successfully for ${name} <${email}>."
    local terr
    terr=$(printf '%s' "$_stderr" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ -n "$terr" ]]; then
      parts="${parts}

Details:
${terr}"
    fi
    parts="${parts}

Next steps:
1. Use gpg_list_keys to verify the new key
2. Use gpg_export_public_key to export the public key for sharing
3. Share the exported key with the other party for import"
  else
    parts="GPG key generation FAILED (exit code ${_exit_code})."
    local terr
    terr=$(printf '%s' "$_stderr" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ -n "$terr" ]]; then
      parts="${parts}

Details:
${terr}"
    fi
  fi
  _tool_text="$parts"
}

handle_gpg_export_public_key() {
  local id_json="$1" args="$2"
  local key_id output_file
  key_id=$(printf '%s' "$args" | jq -r '.keyId')
  output_file=$(printf '%s' "$args" | jq -r '.outputFile // empty')

  if [[ -n "$output_file" ]]; then
    run_cmd gpg --export --armor --output "$output_file" "$key_id"
  else
    run_cmd gpg --export --armor "$key_id"
  fi

  local parts
  if [[ "$_exit_code" -eq 0 ]] && [[ -n "$output_file" ]]; then
    parts="Public key exported to ${output_file}.

Next step: Share this file with the other party and have them run gpg_import_key to import it."
  elif [[ "$_exit_code" -eq 0 ]]; then
    local tout
    tout=$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ -n "$tout" ]]; then
      parts="Exported public key for ${key_id}:

${tout}"
    else
      parts="Public key export FAILED (exit code ${_exit_code})."
    fi
  else
    parts="Public key export FAILED (exit code ${_exit_code})."
    local terr
    terr=$(printf '%s' "$_stderr" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ -n "$terr" ]]; then
      parts="${parts}

Errors:
${terr}"
    fi
  fi
  _tool_text="$parts"
}

handle_gpg_import_key() {
  local id_json="$1" args="$2"
  local key_file resolved
  key_file=$(printf '%s' "$args" | jq -r '.keyFile')
  resolved=$(realpath "$key_file" 2>/dev/null || echo "$key_file")

  if [[ ! -f "$resolved" ]]; then
    _tool_text="Key import FAILED (exit code 1).

Errors:
Key file not found: ${resolved}"
    return
  fi

  run_cmd gpg --import "$resolved"

  local parts
  if [[ "$_exit_code" -eq 0 ]]; then
    parts="Key imported successfully."
    local terr
    terr=$(printf '%s' "$_stderr" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ -n "$terr" ]]; then
      parts="${parts}

Details:
${terr}"
    fi
    parts="${parts}

Next steps:
1. Use gpg_list_keys to verify the imported key
2. You can now use sign_and_encrypt_archive with this key as the recipientKeyId"
  else
    parts="Key import FAILED (exit code ${_exit_code})."
    local terr
    terr=$(printf '%s' "$_stderr" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [[ -n "$terr" ]]; then
      parts="${parts}

Errors:
${terr}"
    fi
  fi
  _tool_text="$parts"
}

# --- File I/O tools ---

# Restricted system directories for write operations (matches TypeScript RESTRICTED_WRITE_DIRS)
_RESTRICTED_WRITE_DIRS="/bin /boot /dev /etc /lib /lib64 /proc /run /sbin /sys /usr"

is_restricted_write_path() {
  local p="$1" dir
  for dir in $_RESTRICTED_WRITE_DIRS; do
    if [[ "$p" == "$dir" || "$p" == "$dir/"* ]]; then
      return 0
    fi
  done
  return 1
}

handle_read_file() {
  local id_json="$1" args="$2"
  local file_path cwd gpg_decrypt passphrase

  file_path=$(printf '%s' "$args" | jq -r '.filePath')
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')
  gpg_decrypt=$(printf '%s' "$args" | jq -r '.gpgDecrypt // false')
  passphrase=$(printf '%s' "$args" | jq -r '.passphrase // empty')

  # Resolve path
  local resolved
  if [[ -n "$cwd" ]]; then
    resolved=$(cd "$cwd" 2>/dev/null && realpath -m "$file_path" 2>/dev/null || echo "$file_path")
  else
    resolved=$(realpath -m "$file_path" 2>/dev/null || echo "$file_path")
  fi

  if [[ ! -f "$resolved" ]]; then
    _tool_text="Read file: FAILED (exit code 1)

Errors:
File not found: ${resolved}"
    return
  fi

  if [[ "$gpg_decrypt" == "true" ]]; then
    local -a gpg_args=("--decrypt" "--batch")
    if [[ -n "$passphrase" ]]; then
      gpg_args+=("--passphrase" "$passphrase" "--pinentry-mode" "loopback")
    fi
    gpg_args+=("$resolved")
    run_cmd gpg "${gpg_args[@]}"
    _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Read file")
    return
  fi

  # Plain read — enforce 10 MB size limit
  local max_bytes=$((10 * 1024 * 1024))
  local file_size
  file_size=$(stat -c '%s' "$resolved" 2>/dev/null || stat -f '%z' "$resolved" 2>/dev/null || echo 0)
  if (( file_size > max_bytes )); then
    _tool_text="Read file: FAILED (exit code 1)

Errors:
File too large to read (${file_size} bytes). Maximum allowed: ${max_bytes} bytes."
    return
  fi

  run_cmd cat "$resolved"
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Read file")
}

handle_write_file() {
  local id_json="$1" args="$2"
  local file_path content cwd overwrite gpg_recipient gpg_signer gpg_passphrase

  file_path=$(printf '%s' "$args" | jq -r '.filePath')
  content=$(printf '%s' "$args" | jq -r '.content')
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')
  overwrite=$(printf '%s' "$args" | jq -r '.overwrite // false')
  gpg_recipient=$(printf '%s' "$args" | jq -r '.gpgRecipient // empty')
  gpg_signer=$(printf '%s' "$args" | jq -r '.gpgSigner // empty')
  gpg_passphrase=$(printf '%s' "$args" | jq -r '.gpgPassphrase // empty')

  # Resolve path
  local resolved
  if [[ -n "$cwd" ]]; then
    resolved=$(cd "$cwd" 2>/dev/null && realpath -m "$file_path" 2>/dev/null || echo "$file_path")
  else
    resolved=$(realpath -m "$file_path" 2>/dev/null || echo "$file_path")
  fi

  # Access control: prevent writes to restricted system directories
  if is_restricted_write_path "$resolved"; then
    _tool_text="Write file: FAILED (exit code 1)

Errors:
Writing to restricted path is not allowed: ${resolved}"
    return
  fi

  # Prevent overwriting existing file unless explicitly allowed
  if [[ "$overwrite" != "true" && -e "$resolved" ]]; then
    _tool_text="Write file: FAILED (exit code 1)

Errors:
File already exists: ${resolved}. Set overwrite to true to replace it."
    return
  fi

  # Parent directory must exist
  local parent_dir
  parent_dir=$(dirname "$resolved")
  if [[ ! -d "$parent_dir" ]]; then
    _tool_text="Write file: FAILED (exit code 1)

Errors:
Parent directory does not exist: ${parent_dir}"
    return
  fi

  if [[ -n "$gpg_recipient" ]]; then
    # Write content to temp file then encrypt
    local tmp_dir tmp_input
    tmp_dir=$(mktemp -d)
    tmp_input="${tmp_dir}/input.txt"
    printf '%s' "$content" > "$tmp_input"
    chmod 600 "$tmp_input"

    local -a gpg_args=("--batch" "--yes" "--armor" "--output" "$resolved")
    if [[ -n "$gpg_passphrase" ]]; then
      gpg_args+=("--passphrase" "$gpg_passphrase" "--pinentry-mode" "loopback")
    fi
    if [[ -n "$gpg_signer" ]]; then
      gpg_args+=("--sign" "--local-user" "$gpg_signer")
    fi
    gpg_args+=("--encrypt" "--recipient" "$gpg_recipient" "$tmp_input")

    run_cmd gpg "${gpg_args[@]}"
    rm -rf "$tmp_dir"

    if [[ "$_exit_code" -eq 0 ]]; then
      _tool_text="Write file: SUCCESS

Output:
File written and encrypted: ${resolved}"
    else
      _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Write file")
    fi
    return
  fi

  # Plain write
  if printf '%s' "$content" > "$resolved" 2>/tmp/zstar-write-err; then
    _tool_text="Write file: SUCCESS

Output:
File written: ${resolved}"
  else
    local write_err
    write_err=$(<"/tmp/zstar-write-err")
    _tool_text="Write file: FAILED (exit code 1)

Errors:
Failed to write file: ${write_err}"
  fi
  rm -f /tmp/zstar-write-err
}

# --- Agent communication tools ---

handle_gpg_init_agent_communication() {
  local id_json="$1" args="$2"
  local agent_name agent_email passphrase key_type key_length expire_date output_file
  agent_name=$(printf '%s' "$args" | jq -r '.agentName')
  agent_email=$(printf '%s' "$args" | jq -r '.agentEmail')
  passphrase=$(printf '%s' "$args" | jq -r '.passphrase')
  key_type=$(printf '%s' "$args" | jq -r '.keyType // "EDDSA"')
  key_length=$(printf '%s' "$args" | jq -r '.keyLength // 4096')
  expire_date=$(printf '%s' "$args" | jq -r '.expireDate // "0"')
  output_file=$(printf '%s' "$args" | jq -r '.outputFile // empty')

  local parts=""

  # Check if key already exists
  run_cmd gpg --list-keys --keyid-format long "$agent_email"
  if [[ "$_exit_code" -eq 0 ]] && [[ -n "$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" ]]; then
    parts="GPG key already exists for ${agent_email}."
  else
    # Generate new key
    do_gpg_generate_key "$agent_name" "$agent_email" "$passphrase" "$key_type" "$key_length" "$expire_date"
    if [[ "$_exit_code" -ne 0 ]]; then
      _tool_text="Agent GPG communication initialization FAILED.

Key generation failed (exit code ${_exit_code}).
${_stderr}"
      return
    fi
    parts="GPG key pair generated for ${agent_name} <${agent_email}>."
  fi

  # Get fingerprint
  local fingerprint=""
  run_cmd gpg --with-colons --fingerprint "$agent_email"
  if [[ "$_exit_code" -eq 0 ]]; then
    fingerprint=$(printf '%s' "$_stdout" | grep '^fpr:' | head -1 | cut -d: -f10)
  fi

  # Export public key
  local public_key=""
  if [[ -n "$output_file" ]]; then
    run_cmd gpg --export --armor --output "$output_file" "$agent_email"
  else
    run_cmd gpg --export --armor "$agent_email"
  fi
  if [[ "$_exit_code" -ne 0 ]]; then
    _tool_text="Agent GPG communication initialization FAILED.

Public key export failed.
${_stderr}"
    return
  fi

  if [[ -n "$output_file" ]]; then
    parts="${parts}
Public key exported to ${output_file}."
  else
    public_key=$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    parts="${parts}
Public key exported (returned in output)."
  fi

  parts="${parts}
Fingerprint: ${fingerprint}

To complete agent-to-agent setup:
1. Share the public key with the remote agent
2. Remote agent imports it using gpg_import_key
3. Remote agent runs gpg_init_agent_communication and shares their public key back
4. Import the remote agent's public key using gpg_import_key
5. Both agents can now use encrypted_agent_stream for secure communication"

  local result_text="Agent GPG communication initialized successfully.

${parts}"

  if [[ -n "$public_key" ]]; then
    result_text="${result_text}

Public Key:
${public_key}"
  fi

  _tool_text="$result_text"
}

handle_encrypted_agent_stream() {
  local id_json="$1" args="$2"
  local target signing_key_id passphrase recipient_key_id
  target=$(printf '%s' "$args" | jq -r '.target')
  signing_key_id=$(printf '%s' "$args" | jq -r '.signingKeyId')
  passphrase=$(printf '%s' "$args" | jq -r '.passphrase')
  recipient_key_id=$(printf '%s' "$args" | jq -r '.recipientKeyId')

  # Validate target
  local verr
  verr=$(validate_target "$target")
  if [[ -n "$verr" ]]; then
    _tool_text=$(format_result 2 "" "$verr" "Encrypted agent-to-agent stream")
    return
  fi

  # Verify signing key exists
  run_cmd gpg --list-secret-keys --keyid-format long "$signing_key_id"
  if [[ "$_exit_code" -ne 0 ]] || [[ -z "$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" ]]; then
    _tool_text=$(format_result 1 "" "Signing key not found for '${signing_key_id}'. Use gpg_init_agent_communication to generate a key pair first." "Encrypted agent-to-agent stream")
    return
  fi

  # Verify recipient key exists
  run_cmd gpg --list-keys --keyid-format long "$recipient_key_id"
  if [[ "$_exit_code" -ne 0 ]] || [[ -z "$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" ]]; then
    _tool_text=$(format_result 1 "" "Recipient key not found for '${recipient_key_id}'. Import the remote agent's public key using gpg_import_key first." "Encrypted agent-to-agent stream")
    return
  fi

  # Stream
  local script cwd
  script=$(find_zstar_script) || { _tool_text=$(format_result 1 "" "Could not find tarzst.sh." "Encrypted agent-to-agent stream"); return; }
  cwd=$(printf '%s' "$args" | jq -r '.cwd // empty')

  local -a cmd_args=("-s" "$signing_key_id" "-r" "$recipient_key_id" "-n" "$target")
  while IFS= read -r a; do cmd_args+=("$a"); done < <(build_create_args "$args")

  if [[ -n "$cwd" ]]; then
    run_cmd bash -c "cd $(printf '%q' "$cwd") && $(printf '%q' "$script") $(printf '%q ' "${cmd_args[@]}")"
  else
    run_cmd "$script" "${cmd_args[@]}"
  fi
  _tool_text=$(format_result "$_exit_code" "$_stdout" "$_stderr" "Encrypted agent-to-agent stream")
}

handle_request_secure_channel() {
  local id_json="$1" args="$2"
  local agent_name agent_email passphrase key_type key_length expire_date listening_address
  agent_name=$(printf '%s' "$args" | jq -r '.agentName')
  agent_email=$(printf '%s' "$args" | jq -r '.agentEmail')
  passphrase=$(printf '%s' "$args" | jq -r '.passphrase')
  key_type=$(printf '%s' "$args" | jq -r '.keyType // "EDDSA"')
  key_length=$(printf '%s' "$args" | jq -r '.keyLength // 4096')
  expire_date=$(printf '%s' "$args" | jq -r '.expireDate // "0"')
  listening_address=$(printf '%s' "$args" | jq -r '.listeningAddress // empty')

  # Validate listening address if provided
  if [[ -n "$listening_address" ]]; then
    local verr
    verr=$(validate_target "$listening_address")
    if [[ -n "$verr" ]]; then
      _tool_text="Secure channel request FAILED.

Invalid listening address: ${verr}"
      return
    fi
  fi

  # Initialize GPG identity (reuse gpg_init handler logic inline)
  local init_parts="" fingerprint="" public_key=""

  # Check if key already exists
  run_cmd gpg --list-keys --keyid-format long "$agent_email"
  if [[ "$_exit_code" -eq 0 ]] && [[ -n "$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" ]]; then
    init_parts="GPG key already exists for ${agent_email}."
  else
    do_gpg_generate_key "$agent_name" "$agent_email" "$passphrase" "$key_type" "$key_length" "$expire_date"
    if [[ "$_exit_code" -ne 0 ]]; then
      _tool_text="Secure channel request FAILED.

GPG identity initialization failed: Key generation failed (exit code ${_exit_code}).
${_stderr}"
      return
    fi
    init_parts="GPG key pair generated for ${agent_name} <${agent_email}>."
  fi

  # Get fingerprint
  run_cmd gpg --with-colons --fingerprint "$agent_email"
  if [[ "$_exit_code" -eq 0 ]]; then
    fingerprint=$(printf '%s' "$_stdout" | grep '^fpr:' | head -1 | cut -d: -f10)
  fi

  # Export public key
  run_cmd gpg --export --armor "$agent_email"
  if [[ "$_exit_code" -ne 0 ]]; then
    _tool_text="Secure channel request FAILED.

GPG identity initialization failed: Public key export failed.
${_stderr}"
    return
  fi
  public_key=$(printf '%s' "$_stdout" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  init_parts="${init_parts}
Public key exported (returned in output).
Fingerprint: ${fingerprint}

To complete agent-to-agent setup:
1. Share the public key with the remote agent
2. Remote agent imports it using gpg_import_key
3. Remote agent runs gpg_init_agent_communication and shares their public key back
4. Import the remote agent's public key using gpg_import_key
5. Both agents can now use encrypted_agent_stream for secure communication"

  local listen_display="${listening_address:-<address to be configured>}"
  local instructions="To establish a secure channel, the remote agent should:

1. Import this agent's public key (provided below) using gpg_import_key
2. Initialize its own GPG identity using gpg_init_agent_communication
3. Share its public key back to this agent for import
4. This agent will listen on ${listen_display} for encrypted streams
5. Use encrypted_agent_stream to send signed + encrypted data between agents"

  local detail_parts="Secure channel request generated by ${agent_name} <${agent_email}>.
Fingerprint: ${fingerprint}"
  if [[ -n "$listening_address" ]]; then
    detail_parts="${detail_parts}
Listening address: ${listening_address}"
  fi
  detail_parts="${detail_parts}
${init_parts}"

  _tool_text="Secure channel request generated successfully.

${detail_parts}

${instructions}"

  if [[ -n "$public_key" ]]; then
    _tool_text="${_tool_text}

Public Key:
${public_key}"
  fi
}

# ---------------------------------------------------------------------------
# Request router
# ---------------------------------------------------------------------------
handle_request() {
  local line="$1"
  local method id_json

  method=$(printf '%s' "$line" | jq -r '.method // empty')
  id_json=$(printf '%s' "$line" | jq -c '.id // null')

  case "$method" in

    # --- MCP lifecycle -------------------------------------------------------
    initialize)
      send "$(jq -nc --argjson id "$id_json" \
        --arg pv "$PROTOCOL_VERSION" --arg sn "$SERVER_NAME" --arg sv "$SERVER_VERSION" '{
        jsonrpc:"2.0", id:$id,
        result:{
          protocolVersion: $pv,
          capabilities:{ tools:{} },
          serverInfo:{ name:$sn, version:$sv }
        }
      }')"
      ;;

    "notifications/initialized")
      # Notification — no response
      ;;

    # --- Tool discovery ------------------------------------------------------
    "tools/list")
      local tools
      tools=$(get_tools_json)
      send "$(jq -nc --argjson id "$id_json" --argjson tools "$tools" '{
        jsonrpc:"2.0", id:$id, result:{ tools:$tools }
      }')"
      ;;

    # --- Tool execution ------------------------------------------------------
    "tools/call")
      local tool_name tool_args
      tool_name=$(printf '%s' "$line" | jq -r '.params.name')
      tool_args=$(printf '%s' "$line" | jq -c '.params.arguments // {}')

      _tool_text=""

      case "$tool_name" in
        create_archive)                       handle_create_archive "$id_json" "$tool_args" ;;
        encrypt_archive)                      handle_encrypt_archive "$id_json" "$tool_args" ;;
        sign_archive)                         handle_sign_archive "$id_json" "$tool_args" ;;
        sign_and_encrypt_archive)             handle_sign_and_encrypt_archive "$id_json" "$tool_args" ;;
        create_burn_after_reading_archive)    handle_create_burn_after_reading_archive "$id_json" "$tool_args" ;;
        extract_archive)                      handle_extract_archive "$id_json" "$tool_args" ;;
        list_archive)                         handle_list_archive "$id_json" "$tool_args" ;;
        verify_checksum)                      handle_verify_checksum "$id_json" "$tool_args" ;;
        check_dependencies)                   handle_check_dependencies "$id_json" ;;
        net_stream_archive)                   handle_net_stream_archive "$id_json" "$tool_args" ;;
        net_stream_encrypted_archive)         handle_net_stream_encrypted_archive "$id_json" "$tool_args" ;;
        net_stream_signed_encrypted_archive)  handle_net_stream_signed_encrypted_archive "$id_json" "$tool_args" ;;
        listen_for_stream)                    handle_listen_for_stream "$id_json" "$tool_args" ;;
        gpg_init_agent_communication)         handle_gpg_init_agent_communication "$id_json" "$tool_args" ;;
        encrypted_agent_stream)               handle_encrypted_agent_stream "$id_json" "$tool_args" ;;
        request_secure_channel)               handle_request_secure_channel "$id_json" "$tool_args" ;;
        gpg_list_keys)                        handle_gpg_list_keys "$id_json" "$tool_args" ;;
        gpg_generate_key)                     handle_gpg_generate_key "$id_json" "$tool_args" ;;
        gpg_export_public_key)                handle_gpg_export_public_key "$id_json" "$tool_args" ;;
        gpg_import_key)                       handle_gpg_import_key "$id_json" "$tool_args" ;;
        read_file)                            handle_read_file "$id_json" "$tool_args" ;;
        write_file)                           handle_write_file "$id_json" "$tool_args" ;;
        *)
          send "$(make_error "$id_json" -32601 "Unknown tool: $tool_name")"
          return
          ;;
      esac

      send "$(make_result "$id_json" "$_tool_text")"
      ;;

    # --- Ping ----------------------------------------------------------------
    ping)
      send "$(jq -nc --argjson id "$id_json" '{jsonrpc:"2.0",id:$id,result:{}}')"
      ;;

    # --- Unknown method ------------------------------------------------------
    *)
      if [[ "$id_json" != "null" ]]; then
        send "$(make_error "$id_json" -32601 "Method not found: $method")"
      fi
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Main loop — read newline-delimited JSON-RPC from stdin
# ---------------------------------------------------------------------------
main() {
  log "Starting $SERVER_NAME v$SERVER_VERSION (bash, protocol $PROTOCOL_VERSION)"

  while IFS= read -r line; do
    # Skip empty lines
    [[ -z "${line// }" ]] && continue
    handle_request "$line"
  done

  log "stdin closed, shutting down."
}

main
