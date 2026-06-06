import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export interface HttpTransportOptions {
  // Factory that builds a fresh MCP Server per session (SDK Servers bind to one
  // transport), wired to the shared client/db context.
  createServer: () => Server;
  version: string;
}

// Streamable HTTP transport (MCP spec 2025-11-25): a single /mcp endpoint that
// serves POST (client→server messages), GET (server→client SSE stream), and
// DELETE (session termination). Stateful: each session gets its own transport +
// Server, keyed by the Mcp-Session-Id header.
export function startHttpServer(opts: HttpTransportOptions): void {
  const port = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);
  const host = process.env.MCP_HTTP_HOST || "127.0.0.1";
  const token = process.env.KIE_MCP_HTTP_TOKEN || "";
  const allowedHosts = (process.env.MCP_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Active sessions, keyed by Mcp-Session-Id.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Health endpoint: unauthenticated and exempt from Origin/DNS-rebind checks so
  // container HEALTHCHECK and uptime probes work without the bearer token.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "streamable-http",
      sessions: transports.size,
      version: opts.version,
    });
  });

  // Bearer-token auth for the MCP endpoint (only enforced when a token is set).
  const requireAuth = (req: Request, res: Response): boolean => {
    if (!token) return true;
    const header = req.headers.authorization || "";
    if (header === `Bearer ${token}`) return true;
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
    return false;
  };

  // Security options shared by every per-session transport. DNS-rebinding
  // protection is opt-in at the SDK level; enable it whenever allowedHosts is
  // configured (required when binding beyond loopback, e.g. 0.0.0.0 in Docker).
  const securityOpts =
    allowedHosts.length > 0
      ? { enableDnsRebindingProtection: true, allowedHosts }
      : {};

  app.post("/mcp", async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport | undefined = sessionId
      ? transports.get(sessionId)
      : undefined;

    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: no valid session ID for a non-init request",
          },
          id: null,
        });
        return;
      }

      // New session: create transport + a fresh Server, then connect.
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
        },
        ...securityOpts,
      });
      transport.onclose = () => {
        if (transport!.sessionId) transports.delete(transport!.sessionId);
      };
      await opts.createServer().connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET (SSE stream) and DELETE (terminate) require an existing session.
  const handleSessionRequest = async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  app.listen(port, host, () => {
    console.error(
      `[Kie.ai MCP] Streamable HTTP transport listening on http://${host}:${port}/mcp ` +
        `(health: /health, auth: ${token ? "bearer token" : "none"}, ` +
        `dns-rebind protection: ${allowedHosts.length > 0 ? "on" : "off"})`,
    );
  });
}
