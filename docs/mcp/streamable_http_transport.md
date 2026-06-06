# MCP Streamable HTTP Transport (Spec Concept)

> Source: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
> Fetched: 2026-06-06
> Current protocol revision: **2025-11-25** (latest dated/stable). Streamable HTTP first appeared in `2025-03-26` and replaced the deprecated HTTP+SSE transport from `2024-11-05`.

MCP encodes messages with JSON-RPC (UTF-8). Two standard transports are defined: **stdio** and **Streamable HTTP**.

## Streamable HTTP — Overview

- Replaces the HTTP+SSE transport from protocol version 2024-11-05.
- Server is an independent process that handles multiple client connections, using HTTP **POST** and **GET**.
- The server **MUST** provide a **single HTTP endpoint path** (the "MCP endpoint") that supports both POST and GET, e.g. `https://example.com/mcp`.
- Server **MAY** use Server-Sent Events (SSE) to stream multiple server messages back to the client.

### Security Warning (mandatory)

1. Servers **MUST** validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks.
   - If `Origin` is present and invalid, respond with HTTP **403 Forbidden** (body MAY be a JSON-RPC error response with no `id`).
2. When running locally, servers **SHOULD** bind only to localhost (`127.0.0.1`), not all interfaces (`0.0.0.0`).
3. Servers **SHOULD** implement proper authentication for all connections.

## Sending Messages to the Server (POST)

- Every JSON-RPC message from the client **MUST** be a new HTTP POST to the MCP endpoint.
- Client **MUST** send an `Accept` header listing **both** `application/json` and `text/event-stream`.
- The POST body **MUST** be a single JSON-RPC request, notification, or response.
- If input is a JSON-RPC **response or notification**:
  - Accepted → server **MUST** return **HTTP 202 Accepted** with no body.
  - Rejected → HTTP error (e.g. 400); body MAY be a JSON-RPC error with no `id`.
- If input is a JSON-RPC **request**, server **MUST** return either:
  - `Content-Type: text/event-stream` (open an SSE stream), or
  - `Content-Type: application/json` (one JSON object).
  - The client **MUST** support both.
- If the server opens an SSE stream:
  - SHOULD immediately send an SSE event with an event ID and empty `data` to prime reconnection.
  - MAY close the connection (without terminating the stream) anytime to avoid long-lived connections; client SHOULD poll/reconnect.
  - SHOULD send a standard SSE `retry` field before closing; client MUST respect it.
  - The stream SHOULD eventually include the JSON-RPC response for the originating request.
  - After the response is sent, the server SHOULD terminate the SSE stream.
  - Disconnection is NOT cancellation. To cancel, client sends an MCP `CancelledNotification`. To avoid message loss, server MAY make the stream resumable.

## Listening for Messages from the Server (GET)

- Client **MAY** issue an HTTP **GET** to the MCP endpoint to open an SSE stream for server-initiated messages without first POSTing.
- Client **MUST** include `Accept: text/event-stream`.
- Server **MUST** respond with `Content-Type: text/event-stream`, or HTTP **405 Method Not Allowed** if it offers no SSE stream at this endpoint.
- On a GET SSE stream the server MAY send requests/notifications, but **MUST NOT** send a JSON-RPC response unless resuming a previously-interrupted stream.

## Multiple Connections

- Client MAY hold multiple SSE streams simultaneously.
- Server **MUST** send each JSON-RPC message on only one stream (no broadcasting the same message across streams).

## Resumability and Redelivery

- Servers MAY attach an `id` field to SSE events (per SSE standard).
  - If present, the ID **MUST** be globally unique across all streams within that session (or per-client if no session).
  - Event IDs SHOULD encode enough info to identify the originating stream.
- To resume after disconnect, client **SHOULD** issue an HTTP GET with the `Last-Event-ID` header.
  - Server MAY replay messages sent after that event ID **on the same stream**, and MUST NOT replay messages from a different stream.
  - Resumption is always via HTTP GET with `Last-Event-ID`, regardless of how the original stream started.
- Event IDs act as a per-stream cursor.

## Session Management

- A server MAY assign a session ID at initialization by including an **`Mcp-Session-Id`** header on the HTTP response containing the `InitializeResult`.
  - SHOULD be globally unique and cryptographically secure (UUID, JWT, or hash).
  - MUST contain only visible ASCII (0x21–0x7E).
- If a session ID was returned, the client **MUST** include `Mcp-Session-Id` on all subsequent HTTP requests.
  - Servers requiring a session ID SHOULD respond **400 Bad Request** to non-initialization requests lacking the header.
- The server MAY terminate a session anytime; afterward it **MUST** respond **404 Not Found** to requests with that session ID.
- On receiving 404, the client **MUST** start a new session via a fresh `InitializeRequest` with no session ID.
- Clients done with a session **SHOULD** send an HTTP **DELETE** to the MCP endpoint with the `Mcp-Session-Id` header to terminate it.
  - Server MAY respond **405 Method Not Allowed** if it does not allow client-initiated termination.

## Protocol Version Header

- Over HTTP, after initialization the client **MUST** send `MCP-Protocol-Version: <version>` on all subsequent requests, e.g. `MCP-Protocol-Version: 2025-11-25`.
- The version SHOULD be the one negotiated at initialization.
- If the server receives no `MCP-Protocol-Version` header and cannot otherwise determine the version, it SHOULD assume **`2025-03-26`**.
- Invalid/unsupported version → **400 Bad Request**.

## Backwards Compatibility (with deprecated HTTP+SSE, 2024-11-05)

**Servers** supporting old clients should continue hosting both the old SSE + POST endpoints alongside the new single MCP endpoint.

**Clients** supporting old servers should:
1. Accept a server URL (old or new transport).
2. POST an `InitializeRequest` with the dual `Accept` header.
   - Success → new Streamable HTTP server.
   - Fails with 400 / 404 / 405 → issue a GET expecting an SSE `endpoint` event; if it arrives, treat as legacy HTTP+SSE.

## Custom Transports

The protocol is transport-agnostic. Custom transports MUST preserve the JSON-RPC message format and lifecycle requirements, and SHOULD document their connection/message patterns.
