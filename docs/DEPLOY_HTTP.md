# Remote deployment — Streamable HTTP transport

Since v3.5.0 the MCP server can run over **Streamable HTTP** (MCP spec
2025-11-25) for remote access, in addition to the default stdio transport.
This guide covers running it locally, via Docker, and on Coolify.

## Transport selection

The server is **stdio by default**. Enable HTTP with either:

- `MCP_TRANSPORT=http` (env), or
- the `--http` CLI flag.

It exposes a single `/mcp` endpoint (POST + GET/SSE + DELETE) plus an
unauthenticated `GET /health`.

## Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `MCP_TRANSPORT` | `stdio` | set to `http` to enable the HTTP transport |
| `MCP_HTTP_HOST` | `127.0.0.1` | use `0.0.0.0` only inside a container / behind a proxy |
| `MCP_HTTP_PORT` | `3000` | listen port |
| `KIE_MCP_HTTP_TOKEN` | _(unset)_ | when set, clients must send `Authorization: Bearer <token>`; 401 otherwise. Unset = no auth (only safe on loopback) |
| `MCP_ALLOWED_HOSTS` | _(unset)_ | comma-separated Host header allowlist. Enables DNS-rebinding protection. **Required** when binding beyond loopback |
| `KIE_AI_API_KEY` | _(required)_ | Kie.ai key |
| `KIE_AI_DB_PATH` | `./tasks.db` | task DB; put on a persistent volume in containers |

Security defaults follow the MCP spec: bind loopback locally, validate the
`Origin`/`Host` headers when `MCP_ALLOWED_HOSTS` is set, and require a bearer
token for any non-loopback deployment.

## Run locally

```bash
npm run build
KIE_AI_API_KEY=sk-... MCP_TRANSPORT=http MCP_HTTP_PORT=3000 \
  node packages/mcp/dist/index.js
# health
curl http://127.0.0.1:3000/health
# → {"status":"ok","transport":"streamable-http","sessions":0,"version":"3.5.0"}
```

## Run with Docker

The Dockerfile build context is the **monorepo root**:

```bash
docker build -f packages/mcp/Dockerfile -t kie-ai-mcp-http .
docker run -d --name kie-mcp -p 3000:3000 \
  -e KIE_AI_API_KEY=sk-... \
  -e KIE_MCP_HTTP_TOKEN=$(openssl rand -hex 16) \
  -e MCP_ALLOWED_HOSTS=your-host.example.com \
  -v kie-mcp-data:/data \
  kie-ai-mcp-http
```

The image runs the HTTP transport on `0.0.0.0:3000`, persists the task DB at
`/data/tasks.db`, and ships a `HEALTHCHECK` that curls `/health`.

## Deploy on Coolify

1. **New Resource → Docker Compose**, point at `docker-compose.coolify.yml`.
2. Set secrets: `KIE_AI_API_KEY`, `KIE_MCP_HTTP_TOKEN`, and `MCP_ALLOWED_HOSTS`
   (the public host Coolify assigns, e.g. `kie-mcp.example.com`).
3. Coolify provisions TLS and proxies `:3000`. The compose file declares a
   persistent volume (`kie-mcp-data`) for the task DB and a `/health` probe.

## Connect a client

Point any Streamable-HTTP MCP client at `https://<host>/mcp` and send the bearer
token. Quick manual check (initialize → capture session → list tools):

```bash
H='Content-Type: application/json'
A='Accept: application/json, text/event-stream'
AUTH='Authorization: Bearer <token>'
SID=$(curl -s -D - -o /dev/null -X POST https://<host>/mcp -H "$H" -H "$A" -H "$AUTH" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"c","version":"0"}}}' \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}')
curl -s -X POST https://<host>/mcp -H "$H" -H "$A" -H "$AUTH" -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## Notes & limits

- **Stateful sessions**: each `Mcp-Session-Id` maps to its own MCP `Server`; the
  Kie.ai client and task DB are shared across sessions. `DELETE /mcp` (or client
  disconnect) evicts the session.
- **Not implemented yet**: OAuth 2.0 (RFC 9728) auth, and `eventStore`-based
  stream resumability. The transport supports adding both later.
- stdio remains the default and is unaffected; the CLI package is unaffected.
