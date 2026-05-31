/**
 * Streamable HTTP transport for the Kie.ai MCP server.
 *
 * Turns the stdio MCP server into a remotely reachable HTTP service so it can be
 * self-hosted (e.g. on Coolify) and connected from Claude Desktop, Cursor,
 * claude.ai custom connectors, or any MCP client that speaks Streamable HTTP.
 *
 * Design:
 * - Stateful sessions: each MCP `initialize` creates a session (Mcp-Session-Id
 *   header) backed by its own protocol-level `Server` instance. Shared resources
 *   (Kie.ai client + SQLite task DB) live on the outer KieAiMcpServer instance,
 *   so sessions are cheap and the task history is global.
 * - Bearer-token auth: when MCP_AUTH_TOKEN is set, every /mcp request must send
 *   `Authorization: Bearer <token>`. /health stays open for Coolify checks.
 * - CORS: exposes Mcp-Session-Id so browser-based clients (claude.ai) work.
 */

import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export interface HttpServerOptions {
  port: number;
  host: string;
  /** When set, /mcp requires `Authorization: Bearer <authToken>`. */
  authToken?: string;
  /** Endpoint path for the MCP transport (default "/mcp"). */
  path: string;
}

/**
 * Start the Streamable HTTP server.
 *
 * @param buildServer Factory that returns a fresh, fully-wired MCP `Server`.
 *                    Called once per initialized session.
 * @param opts        Network + auth configuration.
 */
export function startHttpServer(
  buildServer: () => Server,
  opts: HttpServerOptions,
): void {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  // --- CORS (allow browser-based MCP clients like claude.ai) -----------------
  const corsOrigin = process.env.MCP_CORS_ORIGIN || "*";
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", corsOrigin);
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id, mcp-protocol-version, authorization",
    );
    res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // --- Health check (open, no auth — used by Coolify/Docker) ------------------
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      transport: "streamable-http",
      sessions: Object.keys(transports).length,
    });
  });

  // --- Auth gate (only guards the MCP endpoint) ------------------------------
  const authToken = opts.authToken;
  if (!authToken) {
    console.error(
      "[Kie.ai MCP] WARNING: MCP_AUTH_TOKEN is not set — the /mcp endpoint is " +
        "OPEN. Anyone who can reach this URL can spend your Kie.ai credits. " +
        "Set MCP_AUTH_TOKEN before exposing this server publicly.",
    );
  }
  const requireAuth = (req: Request, res: Response): boolean => {
    if (!authToken) return true; // explicitly opted out
    const header = req.headers["authorization"];
    if (header === `Bearer ${authToken}`) return true;
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: invalid or missing bearer token" },
      id: null,
    });
    return false;
  };

  // --- Session registry ------------------------------------------------------
  // One transport per active MCP session, keyed by Mcp-Session-Id.
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // --- POST /mcp: client -> server messages (incl. initialize) ---------------
  app.post(opts.path, async (req, res) => {
    if (!requireAuth(req, res)) return;

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Existing session.
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session: spin up a transport + its own protocol Server.
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          console.error(`[Kie.ai MCP] Session initialized: ${sid}`);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
          console.error(`[Kie.ai MCP] Session closed: ${transport.sessionId}`);
        }
      };

      const server = buildServer();
      await server.connect(transport);
    } else {
      // No session id and not an initialize request -> invalid.
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: no valid session ID provided",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // --- GET /mcp: server -> client stream (SSE); DELETE /mcp: end session -----
  const handleSessionRequest = async (req: Request, res: Response) => {
    if (!requireAuth(req, res)) return;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };

  app.get(opts.path, handleSessionRequest);
  app.delete(opts.path, handleSessionRequest);

  // --- Listen ----------------------------------------------------------------
  app.listen(opts.port, opts.host, () => {
    console.error(
      `[Kie.ai MCP] Streamable HTTP listening on http://${opts.host}:${opts.port}${opts.path} ` +
        `(auth: ${authToken ? "on" : "OFF"})`,
    );
  });
}
