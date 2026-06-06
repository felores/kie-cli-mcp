# TypeScript SDK — Streamable HTTP Server (`@modelcontextprotocol/sdk` v1.29.0)

> Sources (fetched 2026-06-06):
> - README: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/README.md
> - Server docs: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/docs/server.md
> - Stateful example: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/src/examples/server/simpleStreamableHttp.ts
> - Stateless example: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/src/examples/server/simpleStatelessStreamableHttp.ts
> - JSON-response example: https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.29.0/src/examples/server/jsonResponseStreamableHttp.ts
>
> **`@modelcontextprotocol/sdk` npm `latest` = 1.29.0** (verified via `npm view`). This is the v1.x line. A v2 with split packages (`@modelcontextprotocol/server`, `/client`, `/express`, `/node`, `/hono`) is on `main` but NOT yet the recommended/stable release — v1.x remains recommended for production.

## Import paths (v1.x — note `.js` extensions)

```typescript
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { hostHeaderValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
```

## API surface

### `StreamableHTTPServerTransport`
Constructor option object (`StreamableHTTPServerTransportOptions`):

| Option | Type | Meaning |
|---|---|---|
| `sessionIdGenerator` | `(() => string) \| undefined` | **Stateful** when a generator is provided (e.g. `() => randomUUID()`); **stateless** when set to `undefined`. |
| `eventStore` | `EventStore` | Enables resumability/redelivery (e.g. `InMemoryEventStore`). When set, the transport replays missed events on GET reconnect with `Last-Event-ID`. |
| `onsessioninitialized` | `(sessionId: string) => void` | Fires once the session is established; store the transport in your session map here (avoids race conditions). |
| `onsessionclosed` | `(sessionId: string) => void` | Fires when the session is closed/terminated. |
| `enableJsonResponse` | `boolean` | `true` → JSON-only responses, no SSE (limited notifications). |
| `enableDnsRebindingProtection` | `boolean` | Validate `Host`/`Origin`. **Default: disabled** at the transport level for backwards compat. |
| `allowedHosts` | `string[]` | Allowed `Host` header values when DNS-rebinding protection is on. |
| `allowedOrigins` | `string[]` | Allowed `Origin` header values. |

Key methods / properties:
- `await transport.handleRequest(req, res, req.body?)` — single entry point for **POST, GET, and DELETE** on the `/mcp` route. Pass `req.body` for POST; omit for GET/DELETE.
- `transport.sessionId` — current session ID (set after init).
- `transport.onclose = () => {...}` — cleanup hook; remove the transport from your map.
- `await transport.close()` — tear down.
- `await server.connect(transport)` — connect an `McpServer` to the transport.

### `createMcpExpressApp(options?)`  (new in v1.x helper)
Returns an Express app pre-wired with `express.json()` and **DNS-rebinding protection enabled by default** when `host` is a loopback address.
- `createMcpExpressApp()` → default host `127.0.0.1`, protection auto-enabled.
- `createMcpExpressApp({ host: 'localhost' })` → protection auto-enabled.
- `createMcpExpressApp({ host: '0.0.0.0' })` → **no** auto protection (binds all interfaces).

### `hostHeaderValidation(allowedHosts: string[])`
Standalone Express middleware for custom host validation:
```typescript
import express from 'express';
import { hostHeaderValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
const app = express();
app.use(express.json());
app.use(hostHeaderValidation(['localhost', '127.0.0.1', 'myhost.local']));
```

**Both stateful and stateless modes are fully supported in v1.29.0**, plus JSON-response mode and backwards-compatible (Streamable HTTP + legacy SSE) servers.

---

## Minimal STATELESS server (one transport per request)

Best for simple API-style servers; no session tracking. GET/DELETE return 405.

```typescript
import { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod';

const getServer = () => {
  const server = new McpServer(
    { name: 'stateless-streamable-http-server', version: '1.0.0' },
    { capabilities: { logging: {} } }
  );
  server.registerTool(
    'echo',
    { description: 'Echo text', inputSchema: { text: z.string() } },
    async ({ text }) => ({ content: [{ type: 'text', text }] })
  );
  return server;
};

const app = createMcpExpressApp(); // DNS-rebinding protection on (host 127.0.0.1)

app.post('/mcp', async (req: Request, res: Response) => {
  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// Stateless: no SSE / no session, so GET + DELETE are not allowed
const notAllowed = (_req: Request, res: Response) =>
  res.writeHead(405).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }));
app.get('/mcp', notAllowed);
app.delete('/mcp', notAllowed);

app.listen(3000, () => console.log('MCP Stateless Streamable HTTP Server on :3000'));
```

---

## Minimal STATEFUL server (session map + resumability)

Sessions keyed by the `Mcp-Session-Id` header; reconnection/resumability via `eventStore` + `Last-Event-ID`. This is the shape to use for the kie-ai MCP server if it needs sessions.

```typescript
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
// ^ InMemoryEventStore lives under examples in the SDK; for production supply your own EventStore.

const app = createMcpExpressApp();

// Session ID -> transport
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

function getServer() {
  const server = new McpServer({ name: 'my-server', version: '1.0.0' }, { capabilities: { logging: {} } });
  // ...registerTool / registerResource / registerPrompt...
  return server;
}

// POST: initialize a new session OR route to an existing one
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId]; // reuse
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const eventStore = new InMemoryEventStore(); // enable resumability
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sid) => {
          // store AFTER init to avoid races with early requests
          transports[sid] = transport;
        }
        // enableDnsRebindingProtection: true,
        // allowedHosts: ['127.0.0.1'],
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) delete transports[sid];
      };
      const server = getServer();
      await server.connect(transport); // connect BEFORE handling so responses flow back
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: No valid session ID provided' }, id: null });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// GET: open the server-to-client SSE stream; supports resumption via Last-Event-ID
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  // const lastEventId = req.headers['last-event-id'] as string | undefined; // resumability
  await transports[sessionId].handleRequest(req, res);
});

// DELETE: explicit session termination
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.listen(3000, () => console.log('MCP Streamable HTTP Server on :3000'));

// Graceful shutdown: close all transports
process.on('SIGINT', async () => {
  for (const sid in transports) {
    try { await transports[sid].close(); delete transports[sid]; } catch {}
  }
  process.exit(0);
});
```

### JSON-response mode (no SSE)
Set `enableJsonResponse: true` on the transport for a JSON-only server (limited notifications). See `jsonResponseStreamableHttp.ts`.

### Reconnection / resumability
- Provide an `eventStore` to the transport (the examples use `InMemoryEventStore`; provide a durable store in production).
- The client reconnects by issuing a GET with the `Last-Event-ID` header; the transport replays missed events on that stream only.

## Notes vs older README
- v1.29.0 **moved the long express boilerplate out of `README.md`** into `docs/server.md` + runnable `src/examples/server/*.ts`. The README is now a table of pointers.
- New helper `createMcpExpressApp()` and `hostHeaderValidation()` middleware were added to make DNS-rebinding protection the default for localhost without manually setting `enableDnsRebindingProtection`/`allowedHosts` on every transport.
