FROM registry.access.redhat.com/ubi9/ubi-minimal:latest

LABEL org.opencontainers.image.source="https://github.com/8r4n/zstar-mcp-server"
LABEL org.opencontainers.image.description="MCP server for the zstar archive utility — compressed, encrypted, signed tar archives (hardened Red Hat UBI 9 base)"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.base.name="registry.access.redhat.com/ubi9/ubi-minimal"

RUN microdnf install -y --nodocs --setopt=install_weak_deps=0 \
      bash \
      tar \
      zstd \
      coreutils-single \
      gnupg2 \
      nmap-ncat \
      jq \
    && rpm -ivh https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && microdnf install -y --nodocs --setopt=install_weak_deps=0 pv \
    && rpm -e epel-release \
    && ln -sf /usr/bin/ncat /usr/bin/nc \
    && microdnf clean all \
    && rm -rf /var/cache/yum

COPY zstar/tarzst-project/tarzst.sh /usr/local/bin/tarzst.sh
RUN chmod +x /usr/local/bin/tarzst.sh

COPY mcp-server.sh /usr/local/bin/mcp-server.sh
RUN chmod +x /usr/local/bin/mcp-server.sh

ENV ZSTAR_PATH=/usr/local/bin/tarzst.sh

ENTRYPOINT ["/usr/local/bin/mcp-server.sh"]
