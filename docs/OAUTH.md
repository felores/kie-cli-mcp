# MCP OAuth — deferred design (Phase 7)

**Status:** deferred by design · **Requires:** a public remote deployment and
per-owner tenant state · **Not implemented in MCP 5.0.0.**

OAuth is not needed for the current deployment model (local/self-hosted, one
bearer token per instance, Streamable HTTP with `KIE_MCP_HTTP_TOKEN`). This
document records the target architecture so the work is unambiguous if a public
remote deployment is ever planned, and states clearly what must happen before
it.

## When this activates

1. A **public remote deployment** (exposed beyond a trusted network/VPN), and
2. **Tenant ownership** exists in the data model (tasks, plans, uploads, widget
   grants scoped by owner — see Phase 1 principals). Without per-owner state,
   OAuth identities have nothing meaningful to scope.

Both are currently deferred. Nothing in this document changes today's behavior.

## Target architecture

- **MCP OAuth 2.1 resource server (RS)** in front of `/mcp` and the upload
  routes, on top of the existing Host/Origin middleware:
  - `requireBearerAuth({ verifier, requiredScopes?, resourceMetadataUrl? })`
    from `@modelcontextprotocol/server` (web-standard shape; the Node adapter
    mirrors it for `IncomingMessage`), with `verifyBearerToken` +
    `bearerAuthChallengeResponse` answering `401/403` and the RFC 9728
    `WWW-Authenticate` challenge (`getOAuthProtectedResourceMetadataUrl`).
  - Access tokens verified against a **dedicated IdP** (managed OAuth
    provider). The SDK's legacy authorization-server helpers
    (`@modelcontextprotocol/server-legacy/auth`) are deprecated and must not
    be used to build a custom AS.
- **Principal mapping:** the verified `AuthInfo.subject` becomes the
  `CallerPrincipal`, which already derives the per-session approval owner
  (`principalApprovalId`, Phase 1). With per-owner tenant state, the same
  principal scopes tasks, plans, reservations, uploads, and widget grants —
  no new identity plumbing in tools.
- **Audience and resource validation:** a token minted for another server is
  rejected. The verifier must enforce the token's `aud`/token-type claims
  against the protected resource identifier advertised in the RFC 9728
  resource metadata (`getOAuthProtectedResourceMetadataUrl`), and the RS must
  not accept tokens lacking that binding.
- **Provisioning:** after handshake, sessions bind to the authenticated
  subject; unauthenticated requests get an `authorization_required` discovery
  answer, then the normal OAuth flow.

## The BYOK boundary (important)

Kie API keys are **provider credentials**, not MCP authentication. A remote
BYOK service would keep Kie credentials server-side, **encrypted per user**
(e.g., envelope encryption keyed by tenant), and never pass the client's key
through MCP parameters. MCP OAuth only authenticates the client to *this*
server; the Kie credentials on that account belong to the tenant record.

## Explicitly out of scope now

- Building or hosting an authorization server (use a managed IdP when needed).
- Exposing upload capabilities or the widget on unauthenticated routes.
- Per-user billing or quota isolation beyond the existing per-owner bounds in
  the upload store.

## Ready seams (verified against the installed SDK)

- `requireBearerAuth`, `verifyBearerToken`, `bearerAuthChallengeResponse`,
  `getOAuthProtectedResourceMetadataUrl`, `OAuthTokenVerifier` —
  `@modelcontextprotocol/server` (and mirrored in `@modelcontextprotocol/express`).
- `AuthInfo` is available on HTTP handler context (`ctx.http.authInfo` in
  modern-era handlers), so authenticated subject flows into tool context
  without transport changes.
- The HTTP transport's `authorizeMcpRequest` is the single choke point that
  today checks the static bearer; swapping its verifier for an OAuth RS is the
  implementation seam.