# MCP Streamable HTTP — Authorization & Transport Security

> Sources (fetched 2026-06-06):
> - Authorization spec: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
> - Security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
> - Transport security warning: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#security-warning
>
> Protocol revision: **2025-11-25**. Authorization applies to **HTTP-based transports** (Streamable HTTP). stdio transports do NOT use this OAuth flow — they pass credentials via environment.

---

## 1. Transport security (DNS rebinding, Origin, binding)

From the Streamable HTTP spec security warning — when implementing the transport:

1. Servers **MUST** validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks. If `Origin` is present and invalid → respond **HTTP 403 Forbidden** (body MAY be a JSON-RPC error with no `id`).
2. When running locally, servers **SHOULD** bind only to **localhost (`127.0.0.1`)**, not all interfaces (`0.0.0.0`).
3. Servers **SHOULD** implement proper authentication for all connections.

Without these, attackers can use DNS rebinding to reach local MCP servers from remote websites.

### TS SDK (v1.29.0) controls
- `createMcpExpressApp()` enables DNS-rebinding (Host header) protection **by default** when host is loopback (`127.0.0.1` / `localhost`); **disabled** when bound to `0.0.0.0`.
- Per-transport options (default **disabled** for backwards compat):
  ```typescript
  new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableDnsRebindingProtection: true,
    allowedHosts: ['127.0.0.1', 'localhost'],
    allowedOrigins: ['https://your-app.example.com'],
  });
  ```
- Standalone middleware: `hostHeaderValidation(['localhost', '127.0.0.1', 'myhost.local'])`.

---

## 2. Authorization (OAuth 2.1) — protocol requirements

- Authorization is **OPTIONAL**. HTTP-based transports **SHOULD** conform to this spec; stdio transports **SHOULD NOT** use it (use environment credentials).
- Authorization servers **MUST** implement **OAuth 2.1** with appropriate security (PKCE for all clients).
- MCP servers (as OAuth Resource Servers) **MUST** implement **OAuth 2.0 Protected Resource Metadata (RFC 9728)**.
- MCP clients **MUST** use Protected Resource Metadata for authorization-server discovery.
- Authorization servers **MUST** provide OAuth 2.0 Authorization Server Metadata (RFC 8414) and/or OpenID Connect Discovery; clients **MUST** support both discovery mechanisms.

### Bearer tokens & 401 challenge
- Clients send the access token in the HTTP `Authorization: Bearer <token>` header on every request.
- On unauthorized requests the MCP server returns **HTTP 401 Unauthorized** and **MUST** advertise its resource metadata via one of:
  1. `WWW-Authenticate` header with `resource_metadata` (RFC 9728 §5.1), or
  2. the well-known URI `/.well-known/oauth-protected-resource`.

Example 401 response:
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                  scope="mcp:tools"
```

- Clients **MUST** parse `WWW-Authenticate` and respond to 401s; if `resource_metadata` is present use it, otherwise fall back to the well-known URIs.

### Resource indicators (token audience binding)
- Clients **MUST** use **RFC 8707 Resource Indicators** to bind tokens to the specific MCP server (the `resource` parameter / `aud` claim). Servers SHOULD validate the audience and reject tokens not issued for them. This prevents token reuse across servers.

### Client registration approaches (2025-11-25)
- **Client ID Metadata Documents** (preferred new mechanism): client hosts metadata at an HTTPS `client_id` URL; AS advertises support via `"client_id_metadata_document_supported": true`.
- **Preregistration** (static client ID/credentials).
- **Dynamic Client Registration (RFC 7591)** — MAY be supported; kept for backwards compatibility with earlier auth spec versions.

### TS SDK auth helpers (`@modelcontextprotocol/sdk/server/auth/...`)
- `requireBearerAuth({ verifier, requiredScopes, resourceMetadataUrl })` — Express middleware guarding `/mcp`.
- `mcpAuthMetadataRouter({ oauthMetadata, resourceServerUrl, scopesSupported, resourceName })` — serves RFC 9728 / 8414 metadata.
- `getOAuthProtectedResourceMetadataUrl(mcpServerUrl)`.
- A token verifier implements `verifyAccessToken(token) => AuthInfo { token, clientId, scopes, expiresAt }`. With strict resource checking, verify `data.aud` via `checkResourceAllowed(...)`.

```typescript
const authMiddleware = requireBearerAuth({
  verifier: tokenVerifier,
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});
app.post('/mcp', authMiddleware, mcpPostHandler);
app.get('/mcp', authMiddleware, mcpGetHandler);
app.delete('/mcp', authMiddleware, mcpDeleteHandler);
```

---

## 3. Security best-practices (attacks & mitigations)

### Confused Deputy
When an MCP server proxies to a third-party AS using a static client ID, an attacker can skip user consent via a pre-existing consent cookie. Mitigation: the proxy **MUST** obtain user consent for each dynamically registered client before forwarding to the third-party AS.

### Token Passthrough (forbidden)
An MCP server **MUST NOT** accept tokens that were not explicitly issued for it, and **MUST NOT** pass through client tokens to downstream APIs. Validate the token audience (`aud`) against this server. Passthrough breaks audience restrictions, trust boundaries, and accountability.

### Session Hijacking — mitigations
- MCP servers that implement authorization **MUST** verify all inbound requests, and **MUST NOT** use sessions for authentication.
- **MUST** use secure, non-deterministic session IDs (UUIDs from a secure RNG); avoid predictable/sequential IDs; rotation/expiry helps.
- **SHOULD** bind session IDs to user-specific info — store as `<user_id>:<session_id>` where `user_id` is derived from the verified token (never client-provided). So even a guessed session ID cannot impersonate another user.

### SSRF (Server-Side Request Forgery)
If the server fetches user-supplied URLs: reject `http://` except loopback; block private/internal IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, link-local, loopback), block cloud metadata endpoints; re-validate after DNS resolution (DNS rebinding) and on redirects.

### Local MCP server compromise
Local servers can be reached by remote sites via DNS rebinding (browser → `localhost`). Validate `Origin`/`Host`, bind to loopback only, and require authentication even locally.

### Scope minimization
Request only the scopes needed (least privilege); do not request a superset of `scopes_supported`.

---

## Quick checklist for a remote Streamable HTTP MCP server
- [ ] Validate `Origin` (403 on invalid); enable DNS-rebinding protection / `allowedHosts` (or use `createMcpExpressApp`).
- [ ] Bind to `127.0.0.1` locally; only `0.0.0.0` behind a TLS-terminating proxy with auth.
- [ ] `requireBearerAuth` on POST/GET/DELETE `/mcp`; verify token audience (RFC 8707) — never passthrough.
- [ ] Serve RFC 9728 protected-resource metadata; return 401 with `WWW-Authenticate`.
- [ ] Secure random session IDs bound to `<user_id>:<session_id>`; never authenticate via session alone.
