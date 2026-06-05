#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import {
  KieAiClient,
  TaskDatabase,
  KieAiConfig,
  ToolContext,
  ToolResult,
  TOOL_REGISTRY,
  getTool,
  toInputJsonSchema,
  toolToMarkdown,
  categoryPromptText,
  formatToolError,
} from "@felores/kie-ai-core";

class KieAiMcpServer {
  private server: Server;
  private client: KieAiClient;
  private db: TaskDatabase;
  private config: KieAiConfig;
  private enabledTools: Set<string>;
  private toolContext: ToolContext;

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
      "grok_imagine", // xAI multimodal: text-to-image/video, image-to-video, upscale
      "infinitalk_lip_sync", // MeiGen-AI lip sync video generator
      "kling_avatar", // Kuaishou talking avatar video generator
      "midjourney_generate", // Also generates videos (mj_video, mj_video_hd modes)
    ],
    audio: ["suno_generate_music", "elevenlabs_tts", "elevenlabs_ttsfx"],
    utility: ["list_tasks", "get_task_status"],
  };

  // Derived from the registry so every registered tool is always enabled-eligible.
  // TOOL_CATEGORIES (above) only drives the optional KIE_AI_TOOL_CATEGORIES filter;
  // a tool missing from it can still run, it just isn't selectable by category.
  private static readonly ALL_TOOLS = TOOL_REGISTRY.map((t) => t.name);

  constructor() {
    this.server = new Server(
      {
        name: "kie-ai-mcp-server",
        version: "3.3.1",
      },
      {
        // SDK 1.x requires declaring the capabilities whose request handlers we
        // register below (tools, resources, prompts).
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    // Initialize client with config from environment
    this.config = {
      apiKey: process.env.KIE_AI_API_KEY || "",
      baseUrl: process.env.KIE_AI_BASE_URL || "https://api.kie.ai/api/v1",
      timeout: parseInt(process.env.KIE_AI_TIMEOUT || "60000"),
      callbackUrlFallback:
        process.env.KIE_AI_CALLBACK_URL_FALLBACK ||
        "https://proxy.kie.ai/mcp-callback",
    };

    if (!this.config.apiKey) {
      throw new Error("KIE_AI_API_KEY environment variable is required");
    }

    this.client = new KieAiClient(this.config);
    this.db = new TaskDatabase(process.env.KIE_AI_DB_PATH);
    this.enabledTools = this.getEnabledTools();
    this.toolContext = {
      client: this.client,
      db: this.db,
      getCallbackUrl: (url) => this.getCallbackUrl(url),
      formatError: formatToolError,
    };

    this.setupHandlers();
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

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = TOOL_REGISTRY.filter((t) =>
        this.enabledTools.has(t.name),
      ).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: toInputJsonSchema(t.schema),
      }));
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!this.enabledTools.has(name)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Tool '${name}' is not enabled. This tool has been disabled by server configuration. ` +
              `Please check KIE_AI_ENABLED_TOOLS, KIE_AI_TOOL_CATEGORIES, or KIE_AI_DISABLED_TOOLS environment variables.`,
          );
        }

        const tool = getTool(name);
        if (!tool) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return await tool.run(args, this.toolContext);
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        const message =
          error instanceof Error ? error.message : "Unknown error";
        throw new McpError(ErrorCode.InternalError, message);
      }
    });

    // Resource Handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const toolResources = TOOL_REGISTRY.filter((t) =>
        this.enabledTools.has(t.name),
      ).map((t) => ({
        uri: `kie://tools/${t.name}`,
        name: t.name,
        description: t.description,
        mimeType: "text/markdown",
        annotations: { audience: ["assistant"], priority: 0.6 },
      }));

      const guideResources = [
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

      return { resources: [...toolResources, ...guideResources] };
    });

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        const toolMatch = uri.match(/^kie:\/\/tools\/(.+)$/);
        if (toolMatch) {
          const tool = getTool(toolMatch[1]);
          if (!tool) {
            throw new McpError(
              ErrorCode.InvalidParams,
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
            throw new McpError(
              ErrorCode.InvalidParams,
              `Resource not found: ${uri}`,
            );
        }
      },
    );

    // Prompt Handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
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

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;
      if (name !== "image" && name !== "video") {
        throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
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
- **Resolution**: 720p (cost-effective, good quality)
- **Quality**: Lite/Pro models based on user intent detection
- **Duration**: 5 seconds (optimal for most content)
- **Format**: Standard output formats

### **Quality Detection Logic**
The system automatically detects user intent:

#### **High Quality Indicators**
- Keywords: "high quality", "professional", "premium", "cinematic", "best"
- Action: Upgrade to pro models + 1080p resolution
- Cost Impact: ~2-4x higher than defaults

#### **Speed Indicators**  
- Keywords: "fast", "quick", "rapid", "social media", "draft"
- Action: Use lite/fast models + 720p resolution
- Cost Impact: Standard (cost-effective)

#### **Standard Requests**
- No quality keywords mentioned
- Action: Use default settings (lite + 720p)
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
- **ByteDance Seedance 2.0**:
  - Default: \`mode: "standard"\`, \`resolution: "720p"\`, \`generate_audio: true\`
  - Fast/Iterative: \`mode: "fast"\`, \`resolution: "480p"\`
  - Higher Quality: \`mode: "standard"\`, \`resolution: "720p"\`

- **Veo3**:
  - Default: \`model: "veo3_fast"\`
  - High Quality: \`model: "veo3"\`

- **Wan Video**:
  - Default: \`resolution: "720p"\`
  - High Quality: \`resolution: "1080p"\`

### **Image Parameters**
- **Nano Banana Pro**: Automatic mode detection, cost-effective by default
- **OpenAI 4o**: Multiple variants (default 4) for cost efficiency
- **Flux Kontext**: Professional quality with cost controls

### **Audio Parameters**
- **ElevenLabs**: Turbo model for cost-effective speech
- **Suno**: Custom mode for professional music generation

## 🎯 Use Case Optimization

### **Social Media Content**
- **Video**: Wan Video, 720p, 5 seconds
- **Images**: Nano Banana Pro, lite quality
- **Audio**: ElevenLabs Turbo for voiceovers
- **Cost Strategy**: Lowest cost, fast generation

### **Professional Commercial Work**
- **Video**: ByteDance Seedance Pro, 1080p
- **Images**: OpenAI 4o or Flux Kontext, professional quality
- **Audio**: ElevenLabs Pro or Suno V5
- **Cost Strategy**: Balanced quality and cost

### **Premium Cinematic Content**
- **Video**: Veo3, highest quality settings
- **Images**: Flux Kontext Max, premium quality
- **Audio**: Suno V5 custom mode
- **Cost Strategy**: Quality prioritized over cost

### **Internal Prototyping**
- **Video**: Wan Video or ByteDance Lite, 720p
- **Images**: Nano Banana Pro, fast generation
- **Audio**: ElevenLabs Turbo
- **Cost Strategy**: Maximum cost efficiency

## ⚠️ Cost Prevention Measures

### **Automatic Safeguards**
- **Resolution Control**: Explicit 720p default prevents accidental 1080p
- **Quality Defaults**: Lite models prevent accidental pro usage
- **Duration Limits**: 5-second default prevents excessive generation
- **Parameter Validation**: Prevents invalid expensive combinations

### **User Intent Confirmation**
- **High Quality Detection**: Requires explicit keywords
- **Specific Requests**: "high quality in 720p" prevents unnecessary 1080p
- **Professional Context**: "professional" triggers pro models but maintains 720p

### **Budget Monitoring**
- **Task Tracking**: Database tracks all generation costs
- **Status Monitoring**: Prevents duplicate expensive generations
- **Error Handling**: Graceful failure prevents wasted costs

## 🚀 Optimization Recommendations

### **For Cost-Conscious Projects**
1. Use default settings whenever possible
2. Prefer lite models for iterative work
3. Use 720p resolution unless 1080p is essential
4. Limit video duration to 5 seconds
5. Batch similar requests for efficiency

### **For Quality-Critical Projects**
1. Upgrade to pro models selectively
2. Use 1080p only for final deliverables
3. Test with lite models before pro generation
4. Use consistent parameters for batch work
5. Plan generation costs in project budget

### **For Balanced Projects**
1. Use pro models with 720p resolution
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
| **ByteDance Seedance 2.0** | 720p | standard/fast | 4-15s | Medium | Multimodal refs, native audio, adaptive aspect |
| **Wan Video 2.5** | 1080p | Single | 5-10s | Fast | Quick generation, social media |
| **Runway Aleph** | 1080p | Single | Source | Medium | Video-to-video editing, style transfer |

## Quality & Cost Trade-offs

### Default Settings (Cost-Effective)
- **Resolution**: 720p (unless user requests high quality)
- **Quality Mode**: standard/fast (unless user requests "fast" explicitly)
- **Model**: ByteDance Seedance 2.0 standard as default

### High Quality Upgrades
- **User says "high quality"**: Standard mode + 720p (already default)
- **User says "cinematic"**: Veo3 model
- **User says "fast/quick"**: Seedance fast mode + 480p

## Use Case Recommendations

- **Cinematic/Premium Content**: Veo3 (model: "veo3")
- **Professional/Commercial**: ByteDance Seedance 2.0 (mode: "standard")
- **Social Media/Fast**: ByteDance Seedance 2.0 fast or Wan Video 2.5
- **Multimodal (refs + audio)**: ByteDance Seedance 2.0 with reference URLs
- **Video Editing**: Runway Aleph (existing video transformation)

## Parameter Mapping

### Input Methods
- **Text-to-Video**: All models (prompt only)
- **Image-to-Video**: Veo3 (imageUrls), Seedance (first_frame_url), Wan (image_url)
- **Video-to-Video**: Runway Aleph (videoUrl)
- **Multimodal Refs**: Seedance 2.0 (reference_image/video/audio_urls)

### Quality Control
- **Veo3**: model selection (veo3 vs veo3_fast)
- **Seedance 2.0**: mode (standard vs fast) + resolution
- **Wan**: resolution parameter only
- **Runway**: implicit (no quality settings)

### Aspect Ratios
- **Veo3**: 16:9, 9:16, Auto
- **ByteDance**: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21
- **Wan**: 16:9, 9:16, 1:1
- **Runway**: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9
`;
  }

  private getQualityOptimizationGuide(): string {
    return `# Quality & Cost Optimization Guide

## 🎯 Default Settings (Cost-Effective)

### **CRITICAL COST CONTROL RULES**
- **Resolution**: ALWAYS use \`"720p"\` unless user explicitly requests high quality
- **Quality Level**: ALWAYS use **lite/fast** versions unless user requests "high quality"
- **Model Selection**: bytedance_seedance_video with \`mode: "standard"\` as default

### **Quality Upgrade Logic**

#### **When User Says "high quality"**
- Upgrade to: Pro versions + 1080p resolution
- ByteDance: \`quality: "pro"\` + \`"resolution": "1080p"\`
- Wan Video: \`"resolution": "1080p"\`
- Veo3: \`model: "veo3"\`

#### **When User Says "high quality in 720p"**
- Upgrade to: Pro versions + keep 720p resolution
- ByteDance: \`quality: "pro"\` + \`"resolution": "720p"\`
- Veo3: \`model: "veo3"\`

#### **When User Says "fast" or "quick"**
- Keep: Lite versions + 720p resolution (already default)
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
1. Use lite models with 720p resolution (default)
2. Avoid 1080p unless explicitly needed
3. Use batch processing when possible
4. Monitor costs through task database

### **For Quality-Focused Projects**
1. Use pro models with 1080p resolution
2. Accept 2-4x cost increase
3. Use professional models (Veo3, Flux Kontext Max)
4. Optimize selectively (not all content needs max quality)

### **For Balanced Projects**
1. Use pro models with 720p resolution
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
}

// Start the server
const server = new KieAiMcpServer();
server.run().catch(console.error);
