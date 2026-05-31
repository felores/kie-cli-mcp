# kie-ai-mcp-server — Streamable HTTP (remote) image for self-hosting / Coolify.
#
# Multi-stage build:
#   build   → installs all deps (incl. build tools for the native sqlite3
#             addon), compiles TypeScript, then prunes dev deps.
#   runtime → slim image with only prod node_modules + dist + curl (healthcheck).
#
# The native sqlite3 binding is built in the `build` stage and carried over, so
# the runtime image needs no compiler toolchain.

# ─── Build ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# node-gyp toolchain so sqlite3 can compile if no prebuilt binary is available
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ─── Runtime ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    PORT=3000 \
    HOST=0.0.0.0 \
    KIE_AI_DB_PATH=/data/tasks.db

# curl for the container healthcheck only
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# /data holds the SQLite task DB — mount a volume here to persist it
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/index.js"]
