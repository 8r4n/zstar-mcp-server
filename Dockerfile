FROM ubuntu:24.04

LABEL org.opencontainers.image.source="https://github.com/8r4n/zstar-mcp-server"
LABEL org.opencontainers.image.description="MCP server for the zstar archive utility — compressed, encrypted, signed tar archives"
LABEL org.opencontainers.image.licenses="MIT"

RUN apt-get update && apt-get install -y --no-install-recommends \
      bash \
      tar \
      zstd \
      coreutils \
      gnupg \
      pv \
      netcat-openbsd \
      jq \
    && rm -rf /var/lib/apt/lists/*

COPY zstar/tarzst-project/tarzst.sh /usr/local/bin/tarzst.sh
RUN chmod +x /usr/local/bin/tarzst.sh

COPY mcp-server.sh /usr/local/bin/mcp-server.sh
RUN chmod +x /usr/local/bin/mcp-server.sh

ENV ZSTAR_PATH=/usr/local/bin/tarzst.sh

ENTRYPOINT ["/usr/local/bin/mcp-server.sh"]
