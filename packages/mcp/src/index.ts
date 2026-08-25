#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  categoryPromptText,
  formatToolError,
  getTool,
  KieAiClient,
  type KieAiConfig,
  TOOL_REGISTRY,
  type ToolContext,
  ToolResult,
  toInputJsonSchema,
  toolToMarkdown,
  UPLOAD_WIDGET_URI,
  uploadPathForMimeType,
} from "@felores/kie-ai-core";
import { TaskDatabase } from "@felores/kie-ai-core/database";
import {
  CancelTaskRequestSchema,
  GetTaskPayloadRequestSchema,
  ListTasksRequestSchema,
} from "@modelcontextprotocol/core";
import {
  type CallToolResult,
  type ListResourcesResult,
  type ListToolsResult,
  ProtocolError,
  ProtocolErrorCode,
  type ReadResourceResult,
  Server,
} from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  appsExtensions,
  buildDiscoverPayload,
  toolOutputSchema,
} from "./discovery.js";
import { startHttpServer } from "./http-transport.js";
import {
  approvalInputRequired,
  requestMcpPlanApproval,
} from "./plan-approval.js";
import {
  type CallerPrincipal,
  principalApprovalId,
  STDIO_PRINCIPAL,
} from "./principal.js";
import { normalizeToolResult } from "./result-normalization.js";
import { type MCPTask, TaskEngine, taskToWire } from "./tasks.js";
import { isMcpToolCallable } from "./tool-access.js";
import { TemporaryUploadStore } from "./upload-storage.js";
import { UPLOAD_WIDGET_HTML, UPLOAD_WIDGET_MIME } from "./upload-widget.js";
import { WidgetGrantService } from "./widget-grants.js";

export class KieAiMcpServer {
  private server: Server;
  private client: KieAiClient;
  private db: TaskDatabase;
  private config: KieAiConfig;
  private enabledTools: Set<string>;
  private toolContext: Omit<ToolContext, "approvalContext">;
  private readonly widgetGrants = new WidgetGrantService();
  private taskEngine!: TaskEngine;
  private readonly tasksEnabled = process.env.KIE_AI_MCP_TASKS === "true";
  // Utility tools are derived from the registry's `category` field, not a
  // hardcoded list, so they are always-on by definition: any tool marked
  // `category: "utility"` (get_task_status, list_tasks, wait_for_task) cannot be
  // disabled or filtered out, and adding a new one never needs mirroring here.
  private static readonly UTILITY_TOOLS = TOOL_REGISTRY.filter(
    (t) => t.category === "utility",
  ).map((t) => t.name);

  private static readonly TOOL_CATEGORIES: Record<string, string[]> = {
    image: [
      "nano_banana_image",
      "bytedance_seedream_image",
      "qwen_image",
      "gpt_image_2",
      "flux_kontext_image",
      "flux2_image",
      "z_image",
      "topaz_upscale_image",
      "recraft_remove_background",
      "ideogram_reframe",
      "midjourney_generate", // Also generates images (6 modes: txt2img, img2img, style ref, omni ref, video SD/HD)
    ],
    video: [
      "veo3_generate_video",
      "veo3_get_1080p_video",
      "bytedance_seedance_video",
      "wan_video",
      "wan_animate",
      "happyhorse_video",
      "hailuo_video",
      "kling_video",
      "runway_aleph_video",
      "grok_imagine", // xAI multimodal: text/image-to-image, text/image-to-video, upscale
      "infinitalk_lip_sync", // MeiGen-AI lip sync video generator
      "kling_avatar", // Kuaishou talking avatar video generator
      "midjourney_generate", // Also generates videos (mj_video, mj_video_hd modes)
    ],
    audio: ["suno_generate_music", "elevenlabs_tts", "elevenlabs_ttsfx"],
    utility: KieAiMcpServer.UTILITY_TOOLS,
  };

  // Derived from the registry so every registered tool is always enabled-eligible.
  // TOOL_CATEGORIES (above) only drives the optional KIE_AI_TOOL_CATEGORIES filter;
  // a tool missing from it can still run, it just isn't selectable by category.
  private static readonly ALL_TOOLS = TOOL_REGISTRY.map((t) => t.name);

  static readonly VERSION = "6.0.0";

  constructor() {
    // Initialize client with config from environment
    this.config = {
      apiKey: process.env.KIE_AI_API_KEY || "",
      baseUrl: process.env.KIE_AI_BASE_URL || "https://api.kie.ai/api/v1",
      timeout: parseInt(process.env.KIE_AI_TIMEOUT || "60000"),
      callbackUrlFallback:
        process.env.KIE_AI_CALLBACK_URL_FALLBACK ||
        "https://proxy.kie.ai/mcp-callback",
      fileUploadBaseUrl: process.env.KIE_AI_FILE_UPLOAD_BASE_URL,
    };

    if (!this.config.apiKey) {
      throw new Error("KIE_AI_API_KEY environment variable is required");
    }

    this.client = new KieAiClient(this.config);
    this.db = new TaskDatabase(process.env.KIE_AI_DB_PATH);
    this.taskEngine = new TaskEngine(this.db);
    this.enabledTools = this.getEnabledTools();
    this.toolContext = {
      client: this.client,
      db: this.db,
      getCallbackUrl: (url) => this.getCallbackUrl(url),
      formatError: formatToolError,
      // Plan utilities must resolve through the server's enabled-tool boundary,
      // not the unrestricted registry used to construct the server.
      getTool: (name) =>
        this.enabledTools.has(name) ? getTool(name) : undefined,
    };

    this.server = this.createServer();
  }

  // Build a fresh MCP Server with all handlers wired to the shared client/db
  // context. State ownership is derived from the caller principal, never from
  // the Server instance: same principal across instances => same approval
  // owner, the same widget grant space, and the same plan/upload state. This
  // keeps subsequent stateless (SDK v2) requests resolveable.
  createServer(principal: CallerPrincipal = STDIO_PRINCIPAL): Server {
    const approvalContext = principalApprovalId(principal);
    const server = new Server(
      {
        name: "kie-ai-mcp-server",
        version: KieAiMcpServer.VERSION,
      },
      {
        // SDK v2: declare the capabilities whose request handlers are
        // registered below, the MCP Apps extension used by the upload widget,
        // and the modern cache hints for stable list/discovery results.
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          extensions: appsExtensions,
          ...(this.tasksEnabled ? { tasks: {} } : {}),
        },
        cacheHints: {
          "tools/list": { cacheScope: "private", ttlMs: 60_000 },
          "server/discover": { cacheScope: "private", ttlMs: 60_000 },
        },
      },
    );
    this.setupHandlers(
      server,
      {
        ...this.toolContext,
        approvalContext,
      },
      principal,
    );
    return server;
  }

  private validateToolNames(tools: string[]): void {
    const invalidTools = tools.filter(
      (tool) => !KieAiMcpServer.ALL_TOOLS.includes(tool),
    );
    if (invalidTools.length > 0) {
      throw new Error(
        `Invalid tool names: ${invalidTools.join(", ")}. ` +
          `Valid tools are: ${KieAiMcpServer.ALL_TOOLS.join(", ")}`,
      );
    }
  }

  private validateCategories(categories: string[]): void {
    const validCategories = Object.keys(KieAiMcpServer.TOOL_CATEGORIES);
    const invalidCategories = categories.filter(
      (cat) => !validCategories.includes(cat),
    );
    if (invalidCategories.length > 0) {
      throw new Error(
        `Invalid categories: ${invalidCategories.join(", ")}. ` +
          `Valid categories are: ${validCategories.join(", ")}`,
      );
    }
  }

  private getEnabledTools(): Set<string> {
    const enabledToolsEnv = process.env.KIE_AI_ENABLED_TOOLS;
    const categoriesEnv = process.env.KIE_AI_TOOL_CATEGORIES;
    const disabledToolsEnv = process.env.KIE_AI_DISABLED_TOOLS;

    if (enabledToolsEnv) {
      const tools = enabledToolsEnv
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      this.validateToolNames(tools);

      // Always include utility tools
      const allTools = [
        ...new Set([...tools, ...KieAiMcpServer.TOOL_CATEGORIES.utility]),
      ];

      console.error(
        `[Kie.ai MCP] Tool filtering enabled: whitelist mode (${tools.length} specified + ${KieAiMcpServer.TOOL_CATEGORIES.utility.length} utility = ${allTools.length} tools)`,
      );
      return new Set(allTools);
    }

    if (categoriesEnv) {
      const categories = categoriesEnv
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      this.validateCategories(categories);

      const tools: string[] = [];
      for (const category of categories) {
        const categoryTools = KieAiMcpServer.TOOL_CATEGORIES[category];
        tools.push(...categoryTools);
      }

      // Always include utility tools
      tools.push(...KieAiMcpServer.TOOL_CATEGORIES.utility);
      const uniqueTools = [...new Set(tools)];

      console.error(
        `[Kie.ai MCP] Tool filtering enabled: category mode (${categories.join(", ")}) - ${uniqueTools.length} tools (includes utility)`,
      );
      return new Set(uniqueTools);
    }

    if (disabledToolsEnv) {
      const disabledTools = disabledToolsEnv
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      this.validateToolNames(disabledTools);

      // Check if user is trying to disable utility tools
      const disabledUtilityTools = disabledTools.filter((t) =>
        KieAiMcpServer.TOOL_CATEGORIES.utility.includes(t),
      );

      if (disabledUtilityTools.length > 0) {
        console.error(
          `[Kie.ai MCP] Warning: Cannot disable utility tools (${disabledUtilityTools.join(", ")}). These tools are always enabled for server monitoring.`,
        );
      }

      // Filter out utility tools from disabled list
      const nonUtilityDisabled = disabledTools.filter(
        (t) => !KieAiMcpServer.TOOL_CATEGORIES.utility.includes(t),
      );

      const tools = KieAiMcpServer.ALL_TOOLS.filter(
        (t) => !nonUtilityDisabled.includes(t),
      );
      console.error(
        `[Kie.ai MCP] Tool filtering enabled: blacklist mode (${nonUtilityDisabled.length} tools disabled, ${tools.length} enabled, utility always on)`,
      );
      return new Set(tools);
    }

    console.error(
      `[Kie.ai MCP] Tool filtering: all tools enabled (${KieAiMcpServer.ALL_TOOLS.length} tools)`,
    );
    return new Set(KieAiMcpServer.ALL_TOOLS);
  }

  private getCallbackUrl(userUrl?: string): string {
    return (
      userUrl ||
      process.env.KIE_AI_CALLBACK_URL ||
      this.config.callbackUrlFallback
    );
  }

  private setupHandlers(
    server: Server,
    toolContext: ToolContext,
    principal: CallerPrincipal,
  ): void {
    const owner = principalApprovalId(principal);
    const scopedContext: ToolContext = {
      ...toolContext,
      createWidgetGrant: () => this.widgetGrants.createGrant(owner),
      validateWidgetGrant: (grant) =>
        this.widgetGrants.validateGrant(owner, grant),
    };

    server.setRequestHandler("tools/list", async () => {
      const tools = TOOL_REGISTRY.filter((t) =>
        isMcpToolCallable(t, this.enabledTools),
      ).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: toInputJsonSchema(
          t.schema,
        ) as ListToolsResult["tools"][number]["inputSchema"],
        ...(this.tasksEnabled
          ? { execution: { taskSupport: "optional" as const } }
          : {}),
        ...(toolOutputSchema(t)
          ? {
              outputSchema: toolOutputSchema(
                t,
              ) as ListToolsResult["tools"][number]["outputSchema"],
            }
          : {}),
        ...(t.ui
          ? {
              _meta: {
                ui: {
                  ...(t.ui.resourceUri
                    ? { resourceUri: t.ui.resourceUri }
                    : {}),
                  ...(t.ui.visibility ? { visibility: t.ui.visibility } : {}),
                },
                ...(t.ui.resourceUri
                  ? { "ui/resourceUri": t.ui.resourceUri }
                  : {}),
              },
            }
          : {}),
      }));
      return { tools } as ListToolsResult;
    });

    server.setRequestHandler("tools/call", async (request, serverCtx) => {
      try {
        const { name, arguments: args } = request.params;

        const tool = getTool(name);
        if (!tool) {
          throw new ProtocolError(
            ProtocolErrorCode.MethodNotFound,
            `Unknown tool: ${name}`,
          );
        }

        if (!this.enabledTools.has(name)) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidRequest,
            `Tool '${name}' is not enabled. This tool has been disabled by server configuration. ` +
              `Please check KIE_AI_ENABLED_TOOLS, KIE_AI_TOOL_CATEGORIES, or KIE_AI_DISABLED_TOOLS environment variables.`,
          );
        }

        if (!isMcpToolCallable(tool, this.enabledTools)) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidRequest,
            `Tool '${name}' requires prepare_media_generation, host approval, and submit_media_generation. ` +
              "Set KIE_AI_ALLOW_DIRECT_GENERATION=true only to explicitly bypass approval safeguards.",
          );
        }

        // When the client opts into progress (a progressToken in the request
        // _meta), give the tool an onProgress sink that streams
        // notifications/progress on this still-open request. Each notification
        // resets the client's request timeout, so a blocking tool like
        // wait_for_task can hold the call open until generation finishes.
        const progressToken = (
          request.params as { _meta?: { progressToken?: string | number } }
        )._meta?.progressToken;
        const requestContext: ToolContext = {
          ...scopedContext,
          requestPlanApproval: (plan) =>
            requestMcpPlanApproval(server, plan, serverCtx),
        };
        const ctx: ToolContext =
          progressToken === undefined
            ? requestContext
            : {
                ...requestContext,
                onProgress: async (update) => {
                  try {
                    await serverCtx.mcpReq.notify({
                      method: "notifications/progress",
                      params: { progressToken, ...update },
                    });
                  } catch {
                    // Client may have disconnected mid-generation; the poll
                    // loop still returns its final result, so ignore.
                  }
                },
              };

        const taskParam = (
          request.params as { task?: { ttl?: number; pollInterval?: number } }
        ).task;
        if (taskParam) {
          if (!this.tasksEnabled) {
            throw new ProtocolError(
              ProtocolErrorCode.InvalidRequest,
              "Task mode is disabled. Set KIE_AI_MCP_TASKS=true to enable official MCP Tasks.",
            );
          }
          const negotiated = server.getNegotiatedProtocolVersion();
          if (negotiated === undefined || negotiated < "2026-07-28") {
            // The published SDK validates task results against the 2025-era
            // schema; starting a task here would orphan it (the response is
            // rejected after the engine starts), so refuse before running.
            throw new ProtocolError(
              ProtocolErrorCode.InvalidRequest,
              "Task mode requires the 2026-07-28 protocol revision, which the installed MCP SDK cannot negotiate yet.",
            );
          }
          // Official MCP Tasks: run the tool asynchronously and return the
          // task descriptor; clients poll tasks/result for the original
          // result. The progress sink and plan-approval seam stay out of the
          // async run (task mode has no retry round).
          const task = this.taskEngine.start(
            name,
            async () =>
              normalizeToolResult(await tool.run(args, requestContext)),
            taskParam,
          );
          return { task: taskToWire(task) } as unknown as CallToolResult;
        }
        const toolResult = normalizeToolResult(await tool.run(args, ctx));
        if (toolResult.structuredContent?.input_required === true) {
          const plan = toolResult._meta?.["kie/approval-plan"] as
            | Parameters<typeof approvalInputRequired>[0]
            | undefined;
          if (plan) return approvalInputRequired(plan);
        }
        return toolResult;
      } catch (error) {
        if (error instanceof ProtocolError) {
          throw error;
        }

        const message =
          error instanceof Error ? error.message : "Unknown error";
        throw new ProtocolError(ProtocolErrorCode.InternalError, message);
      }
    });

    // Resource Handlers
    server.setRequestHandler("resources/list", async () => {
      const toolResources = TOOL_REGISTRY.filter(
        (t) =>
          isMcpToolCallable(t, this.enabledTools) &&
          (!t.ui?.visibility || t.ui.visibility.includes("model")),
      ).map((t) => ({
        uri: `kie://tools/${t.name}`,
        name: t.name,
        description: t.description,
        mimeType: "text/markdown",
        annotations: { audience: ["assistant"], priority: 0.6 },
      }));

      // MCP Apps negotiation: the app resource is exposed only to hosts that
      // declare the Apps extension; other clients keep the widget tool's
      // plain-text fallback.
      const appsSupported = Boolean(
        server.getClientCapabilities()?.extensions?.[
          "io.modelcontextprotocol/ui"
        ],
      );
      const guideResources = [
        ...(appsSupported &&
        isMcpToolCallable(getTool("upload_widget")!, this.enabledTools)
          ? [
              {
                uri: UPLOAD_WIDGET_URI,
                name: "Secure Media Upload",
                description:
                  "Minimal MCP Apps file picker for temporary media uploads",
                mimeType: UPLOAD_WIDGET_MIME,
                annotations: { audience: ["user"], priority: 0.8 },
              },
            ]
          : []),
        {
          uri: "kie://guides/image-models-comparison",
          name: "Image Models Comparison",
          description: "Feature matrix comparing all image generation models",
          mimeType: "text/markdown",
          annotations: { audience: ["assistant"], priority: 0.5 },
        },
        {
          uri: "kie://guides/video-models-comparison",
          name: "Video Models Comparison",
          description: "Feature matrix comparing all video generation models",
          mimeType: "text/markdown",
          annotations: { audience: ["assistant"], priority: 0.5 },
        },
        {
          uri: "kie://guides/quality-optimization",
          name: "Quality & Cost Optimization",
          description:
            "Resolution settings, quality levels, and cost control strategies",
          mimeType: "text/markdown",
          annotations: { audience: ["assistant"], priority: 0.6 },
        },
        {
          uri: "kie://tasks/active",
          name: "Active Generation Tasks",
          description:
            "Real-time status of all currently active AI generation tasks",
          mimeType: "application/json",
          annotations: { audience: ["user", "assistant"], priority: 0.4 },
        },
        {
          uri: "kie://stats/usage",
          name: "Usage Statistics",
          description: "Current usage statistics and cost tracking",
          mimeType: "application/json",
          annotations: { audience: ["user"], priority: 0.3 },
        },
      ];
      return {
        resources: [...toolResources, ...guideResources],
      } as ListResourcesResult;
    });

    server.setRequestHandler("resources/read", async (request) => {
      const { uri } = request.params;

      if (uri === UPLOAD_WIDGET_URI) {
        const widgetTool = getTool("upload_widget");
        if (!widgetTool || !isMcpToolCallable(widgetTool, this.enabledTools)) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            `Resource not found: ${uri}`,
          );
        }
        const publicOrigin = scopedContext.getUploadPublicOrigin?.();
        return {
          contents: [
            {
              uri,
              mimeType: UPLOAD_WIDGET_MIME,
              text: UPLOAD_WIDGET_HTML,
              _meta: {
                ui: {
                  csp: {
                    connectDomains: publicOrigin ? [publicOrigin] : [],
                    resourceDomains: [],
                    frameDomains: [],
                    baseUriDomains: [],
                  },
                  prefersBorder: true,
                },
              },
            },
          ],
        };
      }

      const toolMatch = uri.match(/^kie:\/\/tools\/(.+)$/);
      if (toolMatch) {
        const tool = getTool(toolMatch[1]);
        if (!tool) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            `Resource not found: ${uri}`,
          );
        }
        if (!isMcpToolCallable(tool, this.enabledTools)) {
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            `Resource not found: ${uri}`,
          );
        }
        return {
          contents: [
            { uri, mimeType: "text/markdown", text: toolToMarkdown(tool) },
          ],
        };
      }

      switch (uri) {
        case "kie://guides/image-models-comparison":
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: this.getImageModelsComparison(),
              },
            ],
          };
        case "kie://guides/video-models-comparison":
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: this.getVideoModelsComparison(),
              },
            ],
          };
        case "kie://guides/quality-optimization":
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: this.getQualityOptimizationGuide(),
              },
            ],
          };
        case "kie://tasks/active":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: await this.getActiveTasks(),
              },
            ],
          };
        case "kie://stats/usage":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: await this.getUsageStats(),
              },
            ],
          };
        default:
          throw new ProtocolError(
            ProtocolErrorCode.InvalidParams,
            `Resource not found: ${uri}`,
          );
      }
    });

    // Prompt Handlers
    server.setRequestHandler("prompts/list", async () => {
      return {
        prompts: [
          {
            name: "image",
            title: "🎨 Create Images",
            description:
              "Generate, edit, or enhance images using AI models. Just describe what you want and include any image URLs in your message.",
          },
          {
            name: "video",
            title: "🎬 Create Videos",
            description:
              "Generate videos from text or images. Describe what you want and include any image URLs to animate.",
          },
        ],
      };
    });

    server.setRequestHandler("prompts/get", async (request) => {
      const { name } = request.params;
      if (name !== "image" && name !== "video") {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidParams,
          `Unknown prompt: ${name}`,
        );
      }
      const text = categoryPromptText(
        name,
        TOOL_REGISTRY.filter((t) => this.enabledTools.has(t.name)),
      );
      return {
        description:
          name === "image"
            ? "Generate, edit, or enhance images using AI models"
            : "Generate videos from text or images",
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text },
          },
        ],
      };
    });

    server.setRequestHandler("server/discover", async () => {
      return buildDiscoverPayload(
        "Kie.ai media generation. Prepare media plans explicitly and approve them before submission; poll with get_task_status.",
      );
    });

    if (this.tasksEnabled) {
      // Official MCP Tasks: the result of a task-mode tools/call, the active
      // task list, and cancellation. Only registered when the capability is
      // enabled (KIE_AI_MCP_TASKS=true).
      const notFoundTask = (): Record<string, unknown> => ({
        taskId: "not-found",
        status: "failed",
        ttl: 0,
        pollInterval: 0,
        createdAt: new Date(0).toISOString(),
        lastUpdatedAt: new Date(0).toISOString(),
        statusMessage: "Task not found or expired.",
      });
      server.setRequestHandler(
        "tasks/result",
        { params: GetTaskPayloadRequestSchema, result: undefined },
        async (request) => {
          const task = this.taskEngine.get(request.params.taskId);
          if (!task) return notFoundTask();
          if (task.status === "completed" && task.result) return task.result;
          return taskToWire(task);
        },
      );
      server.setRequestHandler(
        "tasks/list",
        { params: ListTasksRequestSchema, result: undefined },
        async () => ({
          tasks: this.taskEngine.list().map(taskToWire),
        }),
      );
      server.setRequestHandler(
        "tasks/cancel",
        { params: CancelTaskRequestSchema, result: undefined },
        async (request) => {
          const task = this.taskEngine.cancel(request.params.taskId);
          if (!task) return { task: notFoundTask() };
          return { task: taskToWire(task) };
        },
      );
    }
  }

  // Dynamic Resource Methods
  private async getActiveTasks(): Promise<string> {
    try {
      const activeTasks = await this.db.getTasksByStatus("pending", 50);
      const processingTasks = await this.db.getTasksByStatus("processing", 50);

      return JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          active_tasks: {
            pending: activeTasks.length,
            processing: processingTasks.length,
            total: activeTasks.length + processingTasks.length,
          },
          tasks: {
            pending: activeTasks.map((task) => ({
              task_id: task.task_id,
              api_type: task.api_type,
              created_at: task.created_at,
            })),
            processing: processingTasks.map((task) => ({
              task_id: task.task_id,
              api_type: task.api_type,
              created_at: task.created_at,
            })),
          },
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: "Failed to retrieve active tasks",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    }
  }

  private async getUsageStats(): Promise<string> {
    try {
      const allTasks = await this.db.getAllTasks(1000);
      const completedTasks = await this.db.getTasksByStatus("completed", 1000);
      const failedTasks = await this.db.getTasksByStatus("failed", 1000);

      // Calculate usage by API type
      const usageByType: Record<string, number> = {};
      allTasks.forEach((task) => {
        usageByType[task.api_type] = (usageByType[task.api_type] || 0) + 1;
      });

      // Calculate recent activity (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTasks = allTasks.filter(
        (task) => new Date(task.created_at) > oneDayAgo,
      );

      return JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          total_tasks: allTasks.length,
          completed_tasks: completedTasks.length,
          failed_tasks: failedTasks.length,
          success_rate:
            allTasks.length > 0
              ? ((completedTasks.length / allTasks.length) * 100).toFixed(2) +
                "%"
              : "0%",
          recent_activity: {
            last_24_hours: recentTasks.length,
            by_type: recentTasks.reduce(
              (acc, task) => {
                acc[task.api_type] = (acc[task.api_type] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
          },
          usage_by_type: usageByType,
          most_used_model: Object.keys(usageByType).reduce(
            (a, b) => (usageByType[a] > usageByType[b] ? a : b),
            "",
          ),
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: "Failed to retrieve usage statistics",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    }
  }

  private async getModelsStatus(): Promise<string> {
    // This would typically ping the Kie.ai API to get real-time model status
    // For now, we'll return simulated status based on typical availability
    const models = [
      {
        name: "veo3",
        status: "available",
        category: "video",
        quality: "premium",
      },
      {
        name: "veo3_fast",
        status: "available",
        category: "video",
        quality: "standard",
      },
      {
        name: "bytedance_seedance",
        status: "available",
        category: "video",
        quality: "professional",
      },
      {
        name: "wan_video",
        status: "available",
        category: "video",
        quality: "standard",
      },
      {
        name: "happyhorse_video",
        status: "available",
        category: "video",
        quality: "standard",
      },
      {
        name: "runway_aleph",
        status: "available",
        category: "video",
        quality: "professional",
      },
      {
        name: "nano_banana",
        status: "available",
        category: "image",
        quality: "standard",
      },
      {
        name: "qwen_image",
        status: "available",
        category: "image",
        quality: "professional",
      },
      {
        name: "gpt_image_2",
        status: "available",
        category: "image",
        quality: "professional",
      },
      {
        name: "flux_kontext",
        status: "available",
        category: "image",
        quality: "premium",
      },
      {
        name: "bytedance_seedream",
        status: "available",
        category: "image",
        quality: "professional",
      },
      {
        name: "midjourney",
        status: "available",
        category: "image",
        quality: "premium",
      },
      {
        name: "topaz_upscale_image",
        status: "available",
        category: "image",
        quality: "professional",
      },
      {
        name: "recraft_remove_background",
        status: "available",
        category: "image",
        quality: "professional",
      },
      {
        name: "ideogram_reframe",
        status: "available",
        category: "image",
        quality: "professional",
      },
      {
        name: "suno_v5",
        status: "available",
        category: "audio",
        quality: "professional",
      },
      {
        name: "elevenlabs_tts",
        status: "available",
        category: "audio",
        quality: "professional",
      },
      {
        name: "elevenlabs_sound_effects",
        status: "available",
        category: "audio",
        quality: "professional",
      },
    ];

    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total_models: models.length,
        available_models: models.filter((m) => m.status === "available").length,
        models_by_category: {
          video: models.filter((m) => m.category === "video"),
          image: models.filter((m) => m.category === "image"),
          audio: models.filter((m) => m.category === "audio"),
        },
        models_by_quality: {
          premium: models.filter((m) => m.quality === "premium"),
          professional: models.filter((m) => m.quality === "professional"),
          standard: models.filter((m) => m.quality === "standard"),
        },
        models: models,
      },
      null,
      2,
    );
  }

  private async getConfigLimits(): Promise<string> {
    // Return current configuration, rate limits, and quotas
    const config = {
      api_config: {
        base_url: process.env.KIE_AI_BASE_URL || "https://api.kie.ai",
        timeout: parseInt(process.env.KIE_AI_TIMEOUT || "120000"),
        callback_url: process.env.KIE_AI_CALLBACK_URL || null,
      },
      rate_limits: {
        requests_per_minute: 60,
        requests_per_hour: 1000,
        concurrent_tasks: 5,
        max_file_size: "50MB",
        max_video_duration: 60,
        max_image_resolution: "4K",
      },
      model_limits: {
        video: {
          max_duration_seconds: 60,
          max_resolution: "1080p",
          supported_formats: ["mp4", "mov", "avi"],
          max_file_size: "100MB",
        },
        image: {
          max_resolution: "4K",
          supported_formats: ["png", "jpeg", "webp"],
          max_file_size: "10MB",
          max_batch_size: 4,
        },
        audio: {
          max_duration_seconds: 300,
          supported_formats: ["mp3", "wav", "m4a"],
          max_file_size: "20MB",
        },
      },
      quotas: {
        daily_generation_limit: 100,
        monthly_generation_limit: 2000,
        storage_retention_days: 30,
        max_concurrent_generations: 5,
      },
      cost_controls: {
        default_quality: "standard",
        auto_upscale_enabled: false,
        cost_alert_threshold: 50,
        monthly_budget_limit: 500,
      },
      features: {
        callback_support: true,
        batch_processing: true,
        status_tracking: true,
        error_recovery: true,
        quality_optimization: true,
      },
      database: {
        path: process.env.KIE_AI_DB_PATH || "./tasks.db",
        max_tasks_stored: 10000,
        cleanup_enabled: true,
        cleanup_after_days: 30,
      },
    };

    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        server_version: "1.2.0",
        configuration: config,
        warnings: [
          "Rate limits are enforced per API key",
          "Large files may take longer to process",
          "HD quality content costs significantly more",
          "Callback URLs must be publicly accessible",
        ],
        recommendations: [
          "Use standard quality for testing",
          "Monitor task status to avoid duplicate requests",
          "Clean up completed tasks regularly",
          "Set up cost alerts for production use",
        ],
      },
      null,
      2,
    );
  }

  private async loadQualityGuidelines(): Promise<string> {
    return `# Quality Control Guidelines

## 🎯 Cost-Effective Defaults

### **Standard Default Settings**
- **Resolution**: Use each model's 720 tier with its exact enum spelling (\`720P\` for Wan, \`720p\` where documented elsewhere)
- **Quality**: Lite/Pro models based on user intent detection
- **Duration**: 5 seconds (optimal for most content)
- **Format**: Standard output formats

### **Quality Detection Logic**
The system automatically detects user intent:

#### **High Quality Indicators**
- Keywords: "high quality", "professional", "premium", "cinematic", "best"
- Action: Upgrade to pro models and each model's documented 1080 tier
- Cost Impact: ~2-4x higher than defaults

#### **Speed Indicators**  
- Keywords: "fast", "quick", "rapid", "social media", "draft"
- Action: Use lite/fast models and each model's documented 720 tier
- Cost Impact: Standard (cost-effective)

#### **Standard Requests**
- No quality keywords mentioned
- Action: Use default settings with model-specific resolution values
- Cost Impact: Lowest possible

## 💰 Cost Management Strategy

### **Video Generation Costs**
| Quality | Resolution | Model | Cost Multiplier |
|---------|------------|-------|-----------------|
| Lite | 720p | Fast models | 1x (baseline) |
| Lite | 1080p | Fast models | ~2x |
| Pro | 720p | Pro models | ~2x |
| Pro | 1080p | Pro models | ~4x |

### **Image Generation Costs**
| Quality | Model | Features | Cost Multiplier |
|---------|-------|----------|-----------------|
| Standard | Nano Banana Pro | Fast generation | 1x (baseline) |
| Artistic | Qwen Image | High quality | ~1.5x |
| Professional | OpenAI 4o | Advanced features | ~2x |
| Premium | Flux Kontext | Professional grade | ~2.5x |

### **Audio Generation Costs**
| Type | Model | Quality | Cost Multiplier |
|------|-------|---------|-----------------|
| Speech | ElevenLabs Turbo | Fast | 1x (baseline) |
| Speech | ElevenLabs Pro | High quality | ~1.5x |
| Music | Suno V5 | Professional | ~2x |
| Sound Effects | ElevenLabs SFX | Standard | ~1x |

## 🔧 Intelligent Parameter Selection

### **Video Parameters**
- **ByteDance Seedance 2.5**:
  - Use one prompt with optional first/last frames or multimodal image/video/audio references.
  - Frame inputs and multimodal references cannot be combined.
  - The official example uses \`resolution: "720p"\` and \`duration: 15\`; no defaults are imposed by this server.

- **Veo3**:
  - Default: \`model: "veo3_fast"\`
  - High Quality: \`model: "veo3"\`

- **Wan Video**:
  - Default: \`resolution: "1080P"\`, \`aspect_ratio: "adaptive"\`
  - Lower Resolution: \`resolution: "720P"\` or \`"480P"\`
  - Duration: 2-30 seconds, or \`-1\` for smart duration

### **Image Parameters**
- **Nano Banana Pro**: Automatic mode detection, cost-effective by default
- **OpenAI 4o**: Multiple variants (default 4) for cost efficiency
- **Flux Kontext**: Professional quality with cost controls

### **Audio Parameters**
- **ElevenLabs**: Turbo model for cost-effective speech
- **Suno**: Custom mode for professional music generation

## 🎯 Use Case Optimization

### **Social Media Content**
- **Video**: Wan Video, 720P, 5 seconds
- **Images**: Nano Banana Pro, lite quality
- **Audio**: ElevenLabs Turbo for voiceovers
- **Cost Strategy**: Lowest cost, fast generation

### **Professional Commercial Work**
- **Video**: ByteDance Seedance 2.5 with the documented input scenario
- **Images**: OpenAI 4o or Flux Kontext, professional quality
- **Audio**: ElevenLabs Pro or Suno V5
- **Cost Strategy**: Balanced quality and cost

### **Premium Cinematic Content**
- **Video**: Veo3, highest quality settings
- **Images**: Flux Kontext Max, premium quality
- **Audio**: Suno V5 custom mode
- **Cost Strategy**: Quality prioritized over cost

### **Internal Prototyping**
- **Video**: Wan Video at 720P or ByteDance Seedance at 720p
- **Images**: Nano Banana Pro, fast generation
- **Audio**: ElevenLabs Turbo
- **Cost Strategy**: Maximum cost efficiency

## ⚠️ Cost Prevention Measures

### **Automatic Safeguards**
- **Resolution Control**: Explicit 720 tier prevents accidental 1080 output; use 720P for Wan and 720p for Seedance
- **Quality Defaults**: Lite models prevent accidental pro usage
- **Duration Limits**: 5-second default prevents excessive generation
- **Parameter Validation**: Prevents invalid expensive combinations

### **User Intent Confirmation**
- **High Quality Detection**: Requires explicit keywords
- **Specific Requests**: A requested 720 tier prevents unnecessary 1080-tier output
- **Professional Context**: "professional" triggers pro models but maintains the model-specific 720 tier

### **Budget Monitoring**
- **Task Tracking**: Database tracks all generation costs
- **Status Monitoring**: Prevents duplicate expensive generations
- **Error Handling**: Graceful failure prevents wasted costs

## 🚀 Optimization Recommendations

### **For Cost-Conscious Projects**
1. Use default settings whenever possible
2. Prefer lite models for iterative work
3. Use each model's documented 720 tier unless its 1080 tier is essential
4. Limit video duration to 5 seconds
5. Batch similar requests for efficiency

### **For Quality-Critical Projects**
1. Upgrade to pro models selectively
2. Use each model's documented 1080 tier only for final deliverables
3. Test with lite models before pro generation
4. Use consistent parameters for batch work
5. Plan generation costs in project budget

### **For Balanced Projects**
1. Use pro models with their documented 720 tier
2. Upgrade specific elements rather than entire project
3. Mix lite and pro models strategically
4. Monitor costs through task database
5. Optimize workflows based on results

## 📊 Cost Tracking

### **Database Monitoring**
- **Task Records**: All tasks stored with parameters and costs
- **Status Tracking**: Monitor expensive operations
- **Result Analysis**: Compare quality vs cost effectiveness

### **Performance Metrics**
- **Success Rates**: Track failed vs successful generations
- **Cost per Quality**: Analyze quality improvement vs cost increase
- **Time Analysis**: Compare generation speed vs quality

These guidelines ensure optimal balance between quality requirements and cost management while maintaining excellent user experience.`;
  }

  private getImageModelsComparison(): string {
    return `# Image Models Comparison

| Model | Resolution | Batch Size | Speed | Editing | Key Strengths |
|-------|-----------|------------|-------|---------|---------------|
| **ByteDance Seedream V4** | Up to 4K | 1-6 images | Medium | ✅ Yes (1-10 images) | Professional quality, batch processing, high resolution |
| **Qwen Image** | HD | 1-4 images | Fast | ✅ Yes (multi-image) | Fast processing, multi-image editing, pose transfer |
| **Flux Kontext** | HD | Single | Medium | ✅ Yes | Advanced controls, technical precision, safety tolerance |
| **OpenAI GPT-4o** | Limited AR | 1-4 variants | Medium | ✅ Yes (with mask) | Creative variants, mask editing, fallback support |
| **Nano Banana Pro** | Custom | 1-10 images | Fastest | ✅ Yes (simple) | Bulk edits, 4x upscaling, face enhancement |
| **Recraft BG Removal** | Original | Single | Fast | N/A | Background removal only |
| **Ideogram Reframe** | HD | 1-4 images | Medium | N/A | Aspect ratio changes, intelligent composition |

## Use Case Recommendations

- **Professional/Commercial Work**: ByteDance Seedream V4 (4K, batch processing)
- **Multi-Image Editing**: Qwen Image (pose transfer, style consistency)  
- **Technical Precision**: Flux Kontext (advanced controls, safety settings)
- **Creative Exploration**: OpenAI GPT-4o (4 variants, creative prompts)
- **Bulk Simple Edits**: Nano Banana Pro (fastest, bulk processing)
- **Product Photography**: Recraft BG Removal → Nano Banana Pro upscale
- **Aspect Ratio Changes**: Ideogram Reframe (intelligent composition)

## Parameter Compatibility

### Image Input
- **filesUrl/image_urls**: ByteDance, Qwen, OpenAI, Nano Banana Pro
- **inputImage**: Flux Kontext
- **image_url**: Qwen, Ideogram, Recraft
- **image**: Nano Banana Pro (upscale mode)

### Quality Control
- **Resolution**: ByteDance (1K/2K/4K), Qwen (6 presets), Ideogram (6 presets)
- **Guidance Scale**: Qwen (0-20), Flux (implicit)
- **Safety**: Flux (tolerance 0-6), Qwen (checker on/off)

### Output Quantity
- **max_images**: ByteDance (1-6)
- **num_images**: Qwen (1-4 string), Ideogram (1-4)
- **nVariants**: OpenAI (1/2/4 string)
`;
  }

  private getVideoModelsComparison(): string {
    return `# Video Models Comparison

| Model | Max Resolution | Quality Modes | Duration | Speed | Key Strengths |
|-------|---------------|---------------|----------|-------|---------------|
| **Google Veo3** | 1080p | veo3/veo3_fast | Default | Medium | Premium cinematic quality, 1080p support |
| **ByteDance Seedance 2.5** | Example: 720p | Single model | Example: 15s | Medium | Text, first/last frames, or multimodal refs |
| **Wan Video 3.0** | 480P-1080P | Multimodal | 2-30s | Flexible | References, keyframes, documents, webpages |
| **Runway Aleph** | 1080p | Single | Source | Medium | Video-to-video editing, style transfer |

## Quality & Cost Trade-offs

### Default Settings (Cost-Effective)
- **Resolution**: Use the selected model's documented 720 tier unless the user requests high quality
- **Quality Mode**: standard/fast (unless user requests "fast" explicitly)
- **Model**: ByteDance Seedance 2.5

### High Quality Upgrades
- **User says "high quality"**: Use the requested documented Seedance 2.5 inputs
- **User says "cinematic"**: Veo3 model
- **User says "fast/quick"**: Choose a speed-oriented model with documented fast behavior

## Use Case Recommendations

- **Cinematic/Premium Content**: Veo3 (model: "veo3")
- **Professional/Commercial**: ByteDance Seedance 2.5
- **Multimodal/Long-form**: Wan Video 3.0
- **Multimodal (refs + audio)**: ByteDance Seedance 2.5 with reference URLs
- **Video Editing**: Runway Aleph (existing video transformation)

## Parameter Mapping

### Input Methods
- **Text-to-Video**: All models (prompt only)
- **Image-to-Video**: Veo3 (imageUrls), Seedance (first_frame_url), Wan (first_frame_url and optional last_frame_url)
- **Video-to-Video**: Runway Aleph (videoUrl)
- **Multimodal Refs**: Seedance 2.5 and Wan 3.0 (reference_image_urls, reference_video_urls, reference_audio_urls)

### Quality Control
- **Veo3**: model selection (veo3 vs veo3_fast)
- **Seedance 2.5**: one fixed model with optional resolution
- **Wan**: resolution parameter only
- **Runway**: implicit (no quality settings)

### Aspect Ratios
- **Veo3**: 16:9, 9:16, Auto
- **ByteDance**: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21
- **Wan**: adaptive, 16:9, 4:3, 1:1, 3:4, 9:16
- **Runway**: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9
`;
  }

  private getQualityOptimizationGuide(): string {
    return `# Quality & Cost Optimization Guide

## 🎯 Default Settings (Cost-Effective)

### **CRITICAL COST CONTROL RULES**
- **Resolution**: Use the model's 720 tier unless the user requests high quality: \`"720p"\` for Seedance and \`"720P"\` for Wan
- **Quality Level**: ALWAYS use **lite/fast** versions unless user requests "high quality"
- **Model Selection**: bytedance_seedance_video uses the fixed Seedance 2.5 model

### **Quality Upgrade Logic**

#### **When User Says "high quality"**
- Upgrade to: Pro versions plus each model's documented 1080 tier
- ByteDance: \`"resolution": "1080p"\`
- Wan Video: \`"resolution": "1080P"\`
- Veo3: \`model: "veo3"\`

#### **When User Says "high quality in 720p"**
- Upgrade to: Pro versions while keeping each model's documented 720 tier
- ByteDance: \`"resolution": "720p"\`
- Wan Video: \`"resolution": "720P"\`
- Veo3: \`model: "veo3"\`

#### **When User Says "fast" or "quick"**
- Keep: Lite versions with each model's documented 720 tier
- ByteDance: \`quality: "lite"\` + \`"resolution": "720p"\`
- Veo3: \`model: "veo3_fast"\` + \`"resolution": "720p"\`

## 💰 Cost Impact Matrix

### **Video Generation**
| Quality | Resolution | Model | Relative Cost |
|---------|-----------|-------|---------------|
| Lite | 720p | Default | 1x (baseline) |
| Lite | 1080p | Upgraded | ~2x |
| Pro | 720p | Upgraded | ~2x |
| Pro | 1080p | Maximum | ~4x |

### **Image Generation**
| Model | Resolution | Relative Cost |
|-------|-----------|---------------|
| Nano Banana Pro | Standard | 1x |
| Qwen | HD | 1.5x |
| ByteDance Seedream | 2K | 2x |
| ByteDance Seedream | 4K | 3x |
| Flux Kontext | Pro | 2.5x |

## 🎯 Parameter Selection Strategy

### **For Cost-Sensitive Projects**
1. Use lite models with their documented 720 tier
2. Avoid each model's 1080 tier unless explicitly needed
3. Use batch processing when possible
4. Monitor costs through task database

### **For Quality-Focused Projects**
1. Use pro models with their documented 1080 tier
2. Accept 2-4x cost increase
3. Use professional models (Veo3, Flux Kontext Max)
4. Optimize selectively (not all content needs max quality)

### **For Balanced Projects**
1. Use pro models with their documented 720 tier
2. Upgrade specific elements rather than entire project
3. Mix lite and pro models strategically
4. Monitor costs through task database

## 📊 Cost Tracking

### **Database Monitoring**
- **Task Records**: All tasks stored with parameters and costs
- **Status Tracking**: Monitor expensive operations
- **Result Analysis**: Compare quality vs cost effectiveness

### **Performance Metrics**
- **Success Rates**: Track failed vs successful generations
- **Cost per Quality**: Analyze quality improvement vs cost increase
- **Time Analysis**: Compare generation speed vs quality
`;
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  // Streamable HTTP transport (remote access). Each session gets its own Server
  // via createServer(); the shared client/db context is reused across sessions.
  runHttp(): void {
    const publicBaseUrl = process.env.KIE_MCP_PUBLIC_BASE_URL;
    const uploadStore = publicBaseUrl
      ? new TemporaryUploadStore({
          publicBaseUrl,
          storageRoot: process.env.KIE_MCP_UPLOAD_DIR,
          maxFileBytes: parseInt(
            process.env.KIE_MCP_MAX_UPLOAD_BYTES || String(25 * 1024 * 1024),
            10,
          ),
        })
      : undefined;
    if (uploadStore) {
      // Uploads are scoped by the calling session's owner (its derived
      // approvalContext), never shared across principals, so one session
      // cannot finalize another session's staged media.
      this.toolContext = {
        ...this.toolContext,
        createUploadCapability: (request) =>
          uploadStore.createCapability(request),
        finalizeUpload: async (request) => {
          const staged = await uploadStore.createProviderDownload({
            mediaId: request.mediaId,
            owner: request.owner,
          });
          const response = await this.client.uploadFromUrl({
            fileUrl: staged.url,
            uploadPath: uploadPathForMimeType(staged.contentType),
            fileName: staged.filename,
          });
          const downloadUrl =
            response.data?.downloadUrl ?? response.data?.fileUrl;
          if ((response.code !== 200 && response.code !== 0) || !downloadUrl) {
            throw new Error(
              response.msg || "Kie.ai did not return a finalized downloadUrl.",
            );
          }
          await uploadStore.removeMedia(request.mediaId, request.owner);
          return {
            downloadUrl,
            filename: staged.filename,
            contentType: staged.contentType,
            size: staged.size,
          };
        },
        getUploadPublicOrigin: () => uploadStore.publicOrigin,
      };
    }
    startHttpServer({
      createServer: (principal) => this.createServer(principal),
      version: KieAiMcpServer.VERSION,
      uploadStore,
    });
  }
}

export async function startMcpServer(): Promise<void> {
  // Default transport is stdio; opt into Streamable HTTP with MCP_TRANSPORT=http
  // or the --http flag.
  const useHttp =
    process.env.MCP_TRANSPORT === "http" || process.argv.includes("--http");
  const server = new KieAiMcpServer();
  if (useHttp) {
    server.runHttp();
  } else {
    await server.run();
  }
}

export function isMcpEntrypoint(
  entrypoint: string | undefined,
  modulePath: string,
): boolean {
  if (!entrypoint) return false;

  try {
    return realpathSync(entrypoint) === realpathSync(modulePath);
  } catch {
    return false;
  }
}

if (isMcpEntrypoint(process.argv[1], fileURLToPath(import.meta.url))) {
  startMcpServer().catch(console.error);
}
