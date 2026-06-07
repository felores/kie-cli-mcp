# Streamable HTTP transport image for @felores/kie-ai-mcp-server.
# Build context MUST be the monorepo root (it needs packages/core + workspaces):
#   docker build -f packages/mcp/Dockerfile -t kie-ai-mcp-http .
FROM node:20-alpine AS build
WORKDIR /app

# Copy the whole workspace (sources included) so npm wires the workspace symlinks
# against real packages, then install dev deps for the build.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages packages
RUN npm ci

# Build core, then esbuild-bundle the MCP server into a self-contained dist/.
RUN npm run build -w @felores/kie-ai-core \
  && npm run bundle -w @felores/kie-ai-mcp-server

# --- runtime image -------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3000 \
    KIE_AI_DB_PATH=/data/tasks.db

# The bundle's external runtime deps (sqlite3 native, @modelcontextprotocol/sdk,
# zod, express) are reused from the build stage's node_modules — same alpine
# base, so the compiled sqlite3 binary is binary-compatible (no native rebuild).
COPY packages/mcp/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/mcp/dist ./dist

# Task DB lives on a volume so completed tasks survive restarts. Run as a
# non-root user since this transport is exposed over the network.
RUN mkdir -p /data \
  && addgroup -S mcp && adduser -S mcp -G mcp \
  && chown -R mcp:mcp /app /data
VOLUME /data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MCP_HTTP_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER mcp
CMD ["node", "dist/index.js"]
