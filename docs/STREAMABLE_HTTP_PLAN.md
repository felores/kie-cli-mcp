# Plan: Streamable HTTP transport for the MCP server

**Status:** ✅ implemented (v3.5.0) · **Date:** 2026-06-06 · **SDK:** `@modelcontextprotocol/sdk` ^1.29.0 · **Spec rev:** 2025-11-25

Goal: add a remote **Streamable HTTP** transport to `@felores/kie-ai-mcp-server`
while keeping **stdio as the default**. This is the capability closed/unmerged
PR #3 (`feat/remote-streamable-http`) tried to add against the pre-monorepo
layout; this plan reimplements it cleanly in the monorepo.

## Reference docs (fetched 2026-06-06, live)
- `docs/mcp/streamable_http_transport.md` — spec concepts (single endpoint, POST + GET/SSE, `Mcp-Session-Id`, resumability)
- `docs/mcp/streamable_http_ts_sdk.md` — TS SDK API + complete express examples (stateful / stateless / JSON)
- `docs/mcp/streamable_http_security.md` — Origin validation, DNS-rebinding protection, OAuth/bearer

## Current state (verified)
- `packages/mcp/src/index.ts`: class `KieAiMcpServer` holds a single low-level
  `Server` (`this.server`), wires tools/resources/prompts via `setRequestHandler`,
  and `run()` connects **only** `StdioServerTransport` (line ~1162).
- Core context (`client`, `db`, `getCallbackUrl`, `toolContext`) is built in the
  constructor from `@felores/kie-ai-core`.
- `mcp` deps: sdk, sqlite3, zod. **No HTTP framework dependency yet.**
- Bundling: esbuild bundles core in; `sqlite3` external. Bin `kie-ai-mcp-server`.

## The core constraint
An SDK `Server` instance connects to exactly one transport. Stdio = one process =
one session = fine. **Stateful HTTP serves many concurrent sessions**, each needing
its own transport, so each session needs its **own `Server` instance**.

→ **Refactor:** extract server construction into a factory
`createKieServer(): Server` (tools/resources/prompts wiring + shared
`client`/`db`/`toolContext`). `client` and `db` can be shared singletons across
sessions (DB is per-task keyed); only the `Server` + transport are per-session.

## Key decisions (need sign-off before implementation)

| # | Decision | Options | Recommended |
|---|----------|---------|-------------|
| D1 | Session model | Stateful (`Mcp-Session-Id`, multi-turn) vs Stateless (new server per request) | **Stateful** — matches polling/long tasks; resumable later |
| D2 | HTTP layer | `createMcpExpressApp()` helper (DNS-rebind protection by default) vs hand-rolled express vs node `http` | **express** (explicit `/mcp` handler) for control + matches SDK examples |
| D3 | Auth | None (localhost only) vs static bearer token (`Authorization: Bearer`) vs full OAuth | **Static bearer via env** (`KIE_MCP_HTTP_TOKEN`); OAuth out of scope |
| D4 | Activation | Separate bin vs same bin + `--http`/env flag | **Same bin**, `MCP_TRANSPORT=http` or `--http`; stdio default |
| D5 | Deployment | Ship Dockerfile + Coolify compose now (as PR #3 did) vs code-only | **IN SCOPE** ✅ — ship Dockerfile + Coolify compose + `.dockerignore` in this work |

All five decisions **accepted as recommended** (2026-06-06). D5 confirmed in
scope; health endpoint confirmed required.

## Proposed file layout (monorepo)
```text
packages/mcp/src/
  index.ts            # entry: pick transport by env/flag (stdio default)
  server-factory.ts   # createKieServer() — extracted wiring (D1 enables reuse)
  http-transport.ts   # express app, /mcp POST+GET+DELETE, /health, session map, auth, security
packages/mcp/
  Dockerfile          # node:20-alpine, build + bundle, runs http transport (D5)
  .dockerignore
docker-compose.coolify.yml   # repo root — Coolify one-click deploy (D5)
```

## Implementation outline (for the eventual build, not this turn)
1. **Extract** `createKieServer()` from the current constructor/`run()` into
   `server-factory.ts`. Stdio path becomes: `const s = createKieServer(); s.connect(new StdioServerTransport())`. No behavior change — verify with existing flow.
2. **Add deps** to `packages/mcp`: `express` (+ `@types/express` dev). Confirm
   esbuild bundles express or mark external; keep `sqlite3` external as today.
3. **`http-transport.ts`**: express app with a single `/mcp` route:
   - `POST`: if `Mcp-Session-Id` present → reuse stored transport; if absent and
     body is `initialize` → create `new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: store, onsessionclosed: evict, enableDnsRebindingProtection: true, allowedHosts: [...] })`, `createKieServer().connect(transport)`, then `handleRequest`.
   - `GET`: resume SSE stream for an existing session via `handleRequest`.
   - `DELETE`: terminate session, `transport.close()`, evict from map.
   - Auth middleware: check `KIE_MCP_HTTP_TOKEN` bearer when set; 401 otherwise.
   - **`GET /health`** → `200 {"status":"ok","transport":"streamable-http","sessions":<n>,"version":"x.y.z"}`. **Unauthenticated** (so Coolify/uptime probes work without the token) and **exempt from DNS-rebind/Origin checks**. Used as the container `HEALTHCHECK` and Coolify health probe.
4. **`index.ts`**: branch on `MCP_TRANSPORT`/`--http`. Default stdio.
5. **Env**: `MCP_HTTP_PORT` (default 3000), `MCP_HTTP_HOST` (default `127.0.0.1`),
   `KIE_MCP_HTTP_TOKEN`, `MCP_ALLOWED_HOSTS`. Document in README + `.env.example`.
6. **Security defaults** (from `streamable_http_security.md`): bind `127.0.0.1` by
   default, `enableDnsRebindingProtection: true` with `allowedHosts`, validate
   `Origin`. Only bind `0.0.0.0` when explicitly configured (with a warning).
7. **Deployment (D5)**:
   - `packages/mcp/Dockerfile`: `node:20-alpine`, `npm ci`, `npm run build -w @felores/kie-ai-core && npm run bundle -w @felores/kie-ai-mcp-server`, run `dist/index.js` with `MCP_TRANSPORT=http`, `EXPOSE 3000`, `HEALTHCHECK` curling `/health`. Bind `0.0.0.0` inside the container (it's the explicit-opt-in case) — protection then relies on `allowedHosts` + bearer token, document this.
   - `docker-compose.coolify.yml`: service + `KIE_AI_API_KEY`, `KIE_MCP_HTTP_TOKEN`, `MCP_ALLOWED_HOSTS`, persistent volume for the SQLite task DB (`KIE_AI_DB_PATH`), health probe on `/health`.
   - `docs/DEPLOY_HTTP.md`: how to deploy on Coolify + run locally via Docker + connect a client.
8. **Test**: MCP Inspector against `http://127.0.0.1:3000/mcp`; verify
   initialize → list_tools → call a tool → get_task_status across requests
   (proves session reuse). `curl /health` → 200. `docker build` + run container,
   re-test through the published port.

## Versioning & docs (per CLAUDE.md)
- **Minor bump** `packages/mcp` (new feature, backwards compatible): 3.4.0 → 3.5.0.
  Update `package.json`, `src/index.ts` Server `version`, `CHANGELOG.md`, README.
- README: new "Remote / HTTP transport" section + env table + health endpoint.
- `docs/DEPLOY_HTTP.md`: Docker + Coolify deploy guide (D5, in scope).
- `.env.example`: add HTTP env vars.

## Out of scope (explicit)
- OAuth 2.0 / RFC 9728 protected-resource-metadata flow (the 2025-11-25 auth spec).
- Resumability/`eventStore` redelivery (can add later; transport supports it).
- CLI package (`@felores/kie-cli`) — unaffected; stdio/registry only.
- SDK v2 (split packages, RC) — stay on v1.29.x.
