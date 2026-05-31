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
import { startHttpServer } from "./http-server.js";

import { KieAiClient } from "./kie-ai-client.js";
import { TaskDatabase } from "./database.js";
import { z } from "zod";
import {
  NanoBananaImageSchema,
  Veo3GenerateSchema,
  SunoGenerateSchema,
  ElevenLabsTTSSchema,
  ElevenLabsSoundEffectsSchema,
  ByteDanceSeedanceVideoSchema,
  ByteDanceSeedreamImageSchema,
  QwenImageSchema,
  RunwayAlephVideoSchema,
  Wan27VideoSchema,
  MidjourneyGenerateSchema,
  GptImage2Schema,
  FluxKontextImageSchema,
  RecraftRemoveBackgroundSchema,
  IdeogramReframeSchema,
  KlingVideoSchema,
  HailuoVideoSchema,
  Flux2ImageSchema,
  WanAnimateSchema,
  ZImageSchema,
  GrokImagineSchema,
  InfiniTalkSchema,
  KlingAvatarSchema,
  TopazUpscaleImageSchema,
  HappyHorseVideoSchema,
  KieAiConfig,
} from "./types.js";

class KieAiMcpServer {
  private client: KieAiClient;
  private db: TaskDatabase;
  private config: KieAiConfig;
  private enabledTools: Set<string>;

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

  private static readonly ALL_TOOLS = Array.from(
    new Set([
      ...KieAiMcpServer.TOOL_CATEGORIES.image,
      ...KieAiMcpServer.TOOL_CATEGORIES.video,
      ...KieAiMcpServer.TOOL_CATEGORIES.audio,
      ...KieAiMcpServer.TOOL_CATEGORIES.utility,
    ]),
  );

  constructor() {
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
  }

  /**
   * Build a fresh MCP Server instance wired to the shared client/db/config.
   * Called once in stdio mode, and once per session in Streamable HTTP mode
   * (each HTTP session needs its own protocol-level Server, but they all share
   * the same KieAiClient + SQLite TaskDatabase held on this instance).
   */
  buildServer(): Server {
    const server = new Server(
      { name: "kie-ai-mcp-server", version: "3.2.1" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } },
    );
    this.setupHandlers(server);
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

  private formatError(
    toolName: string,
    error: unknown,
    paramDescriptions: Record<string, string>,
  ) {
    let errorMessage = "Unknown error";
    let errorDetails = "";

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for Zod validation errors
      if (errorMessage.includes("ZodError")) {
        const lines = errorMessage.split("\n");
        const validationErrors = lines.filter(
          (line) =>
            line.includes("Expected") ||
            line.includes("Required") ||
            line.includes("Invalid"),
        );

        if (validationErrors.length > 0) {
          errorDetails = `Validation errors:\n${validationErrors.map((err) => `- ${err.trim()}`).join("\n")}`;
        }
      }
    }

    // Build parameter guidance
    const paramGuidance = Object.entries(paramDescriptions)
      .map(([param, desc]) => `- ${param}: ${desc}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              tool: toolName,
              error: errorMessage,
              details: errorDetails,
              parameter_guidance: paramGuidance,
              message: `Failed to execute ${toolName}. Check parameters and try again.`,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  private setupHandlers(server: Server): void {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [
        {
          name: "nano_banana_image",
          description:
            "Generate and edit images using Google's Gemini 3.1 Flash Image (Nano Banana 2) - unified tool with 4K support, up to 14 reference images, Google Search grounding, and improved text rendering. Pricing: 8 credits/1K, 12/2K, 18/4K",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt for image generation or editing (max 20000 chars). Nano Banana models support up to 20K characters.",
                minLength: 1,
                maxLength: 20000,
              },
              image_input: {
                type: "array",
                description:
                  "Array of reference image URLs for editing mode (up to 14 images for multi-reference)",
                items: { type: "string", format: "uri" },
                minItems: 1,
                maxItems: 14,
              },
              output_format: {
                type: "string",
                enum: ["png", "jpg"],
                description: "Output format for generate/edit modes",
                default: "png",
              },
              aspect_ratio: {
                type: "string",
                enum: [
                  "1:1",
                  "1:4",
                  "1:8",
                  "2:3",
                  "3:2",
                  "3:4",
                  "4:1",
                  "4:3",
                  "4:5",
                  "5:4",
                  "8:1",
                  "9:16",
                  "16:9",
                  "21:9",
                  "auto",
                ],
                description: "Aspect ratio for generate/edit modes",
                default: "1:1",
              },
              resolution: {
                type: "string",
                enum: ["1K", "2K", "4K"],
                description:
                  "Output resolution: 1K (8 credits), 2K (12 credits), 4K (18 credits)",
                default: "1K",
              },
              google_search: {
                type: "boolean",
                description:
                  "Enable Google Search grounding for factual image generation",
                default: false,
              },
            },
            required: [],
          },
        },
        {
          name: "veo3_generate_video",
          description:
            "Generate professional-quality videos using Google's Veo3 API",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Text prompt describing desired video content",
                minLength: 1,
                maxLength: 2000,
              },
              imageUrls: {
                type: "array",
                description:
                  "Image URLs for image-to-video generation: 1 image (video unfolds around it) or 2 images (first=start frame, second=end frame)",
                items: { type: "string", format: "uri" },
                maxItems: 2,
                minItems: 1,
              },
              model: {
                type: "string",
                enum: ["veo3", "veo3_fast"],
                description:
                  "Model type: veo3 (quality) or veo3_fast (cost-efficient)",
                default: "veo3",
              },
              watermark: {
                type: "string",
                description: "Watermark text to add to video",
                maxLength: 100,
              },
              aspectRatio: {
                type: "string",
                enum: ["16:9", "9:16", "Auto"],
                description: "Video aspect ratio (16:9 supports 1080P)",
                default: "16:9",
              },
              seeds: {
                type: "integer",
                description: "Random seed for consistent results",
                minimum: 10000,
                maximum: 99999,
              },
              callBackUrl: {
                type: "string",
                format: "uri",
                description: "Callback URL for task completion notifications",
              },
              enableFallback: {
                type: "boolean",
                description:
                  "Enable fallback mechanism for content policy failures (Note: fallback videos cannot use 1080P endpoint)",
                default: false,
              },
              enableTranslation: {
                type: "boolean",
                description:
                  "Auto-translate prompts to English for better results",
                default: true,
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "get_task_status",
          description:
            "Get the status of a generation task with intelligent polling guidance. Returns task status, results, and recommended polling strategy (interval, timing, next steps) based on task type (image/video/audio).",
          inputSchema: {
            type: "object",
            properties: {
              task_id: {
                type: "string",
                description: "Task ID to check status for",
              },
            },
            required: ["task_id"],
          },
        },
        {
          name: "list_tasks",
          description: "List recent tasks with their status",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "integer",
                description: "Maximum number of tasks to return",
                default: 20,
                maximum: 100,
              },
              status: {
                type: "string",
                description: "Filter by status",
                enum: ["pending", "processing", "completed", "failed"],
              },
            },
          },
        },
        {
          name: "veo3_get_1080p_video",
          description:
            "Get 1080P high-definition version of a Veo3 video (not available for fallback mode videos)",
          inputSchema: {
            type: "object",
            properties: {
              task_id: {
                type: "string",
                description: "Veo3 task ID to get 1080p video for",
              },
              index: {
                type: "integer",
                description:
                  "Video index (optional, for multiple video results)",
                minimum: 0,
              },
            },
            required: ["task_id"],
          },
        },
        {
          name: "suno_generate_music",
          description:
            "Generate music with AI using Suno models (V3_5, V4, V4_5, V4_5PLUS, V5)",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Description of the desired audio content. In custom mode: used as exact lyrics (max 5000 chars for V4_5+, V5; 3000 for V3_5, V4). In non-custom mode: core idea for auto-generated lyrics (max 500 chars)",
                minLength: 1,
                maxLength: 5000,
              },
              customMode: {
                type: "boolean",
                description:
                  "Enable advanced parameter customization. If true: requires style and title. If false: simplified mode with only prompt required",
              },
              instrumental: {
                type: "boolean",
                description:
                  "Generate instrumental music (no lyrics). In custom mode: if true, only style and title required; if false, prompt used as exact lyrics",
              },
              model: {
                type: "string",
                description: "AI model version for generation",
                enum: ["V3_5", "V4", "V4_5", "V4_5PLUS", "V5"],
              },
              callBackUrl: {
                type: "string",
                description:
                  "URL to receive task completion updates (optional, will use KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
              style: {
                type: "string",
                description:
                  "Music style/genre (required in custom mode, max 1000 chars for V4_5+, V5; 200 for V3_5, V4)",
                maxLength: 1000,
              },
              title: {
                type: "string",
                description:
                  "Track title (required in custom mode, max 80 chars)",
                maxLength: 80,
              },
              negativeTags: {
                type: "string",
                description:
                  "Music styles to exclude (optional, max 200 chars)",
                maxLength: 200,
              },
              vocalGender: {
                type: "string",
                description:
                  "Vocal gender preference (optional, only effective in custom mode)",
                enum: ["m", "f"],
              },
              styleWeight: {
                type: "number",
                description:
                  "Strength of style adherence (optional, range 0-1, up to 2 decimal places)",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
              },
              weirdnessConstraint: {
                type: "number",
                description:
                  "Controls experimental/creative deviation (optional, range 0-1, up to 2 decimal places)",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
              },
              audioWeight: {
                type: "number",
                description:
                  "Balance weight for audio features (optional, range 0-1, up to 2 decimal places)",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
              },
            },
            required: ["prompt", "customMode", "instrumental"],
          },
        },
        {
          name: "elevenlabs_tts",
          description:
            "Generate speech from text using ElevenLabs TTS models (Turbo 2.5 by default, with optional Multilingual v2 support)",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description:
                  "The text to convert to speech (max 5000 characters)",
                minLength: 1,
                maxLength: 5000,
              },
              model: {
                type: "string",
                description:
                  "TTS model to use - turbo (faster, default) or multilingual (supports context)",
                enum: ["turbo", "multilingual"],
                default: "turbo",
              },
              voice: {
                type: "string",
                description: "Voice to use for speech generation",
                enum: [
                  "Rachel",
                  "Aria",
                  "Roger",
                  "Sarah",
                  "Laura",
                  "Charlie",
                  "George",
                  "Callum",
                  "River",
                  "Liam",
                  "Charlotte",
                  "Alice",
                  "Matilda",
                  "Will",
                  "Jessica",
                  "Eric",
                  "Chris",
                  "Brian",
                  "Daniel",
                  "Lily",
                  "Bill",
                ],
                default: "Rachel",
              },
              stability: {
                type: "number",
                description: "Voice stability (0-1, step 0.01)",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
                default: 0.5,
              },
              similarity_boost: {
                type: "number",
                description: "Similarity boost (0-1, step 0.01)",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
                default: 0.75,
              },
              style: {
                type: "number",
                description: "Style exaggeration (0-1, step 0.01)",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
                default: 0,
              },
              speed: {
                type: "number",
                description: "Speech speed (0.7-1.2, step 0.01)",
                minimum: 0.7,
                maximum: 1.2,
                multipleOf: 0.01,
                default: 1,
              },
              timestamps: {
                type: "boolean",
                description: "Whether to return timestamps for each word",
                default: false,
              },
              previous_text: {
                type: "string",
                description:
                  "Text that came before current request (multilingual model only, max 5000 characters)",
                maxLength: 5000,
                default: "",
              },
              next_text: {
                type: "string",
                description:
                  "Text that comes after current request (multilingual model only, max 5000 characters)",
                maxLength: 5000,
                default: "",
              },
              language_code: {
                type: "string",
                description:
                  "Language code (ISO 639-1) for language enforcement (turbo model only)",
                maxLength: 500,
                default: "",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["text"],
          },
        },
        {
          name: "elevenlabs_ttsfx",
          description:
            "Generate sound effects from text descriptions using ElevenLabs Sound Effects v2 model",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description:
                  "The text describing the sound effect to generate (max 5000 characters)",
                minLength: 1,
                maxLength: 5000,
              },
              loop: {
                type: "boolean",
                description:
                  "Whether to create a sound effect that loops smoothly",
                default: false,
              },
              duration_seconds: {
                type: "number",
                description:
                  "Duration in seconds (0.5-22). If not specified, optimal duration will be determined from prompt",
                minimum: 0.5,
                maximum: 22,
                multipleOf: 0.1,
              },
              prompt_influence: {
                type: "number",
                description:
                  "How closely to follow the prompt (0-1). Higher values mean less variation",
                minimum: 0,
                maximum: 1,
                multipleOf: 0.01,
                default: 0.3,
              },
              output_format: {
                type: "string",
                description: "Output format of the generated audio",
                enum: [
                  "mp3_22050_32",
                  "mp3_44100_32",
                  "mp3_44100_64",
                  "mp3_44100_96",
                  "mp3_44100_128",
                  "mp3_44100_192",
                  "pcm_8000",
                  "pcm_16000",
                  "pcm_22050",
                  "pcm_24000",
                  "pcm_44100",
                  "pcm_48000",
                  "ulaw_8000",
                  "alaw_8000",
                  "opus_48000_32",
                  "opus_48000_64",
                  "opus_48000_96",
                  "opus_48000_128",
                  "opus_48000_192",
                ],
                default: "mp3_44100_128",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["text"],
          },
        },
        {
          name: "bytedance_seedance_video",
          description:
            "Generate videos with ByteDance Seedance 2.0 — multimodal inputs (image/video/audio references), native audio generation, standard and fast modes",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt for video generation (3-20000 characters)",
                minLength: 3,
                maxLength: 20000,
              },
              mode: {
                type: "string",
                description:
                  "Generation mode — standard (seedance-2, higher quality) or fast (seedance-2-fast, iterative workflows)",
                enum: ["standard", "fast"],
                default: "standard",
              },
              first_frame_url: {
                type: "string",
                description:
                  "URL of image to use as the first frame (optional)",
                format: "uri",
              },
              last_frame_url: {
                type: "string",
                description: "URL of image to use as the last frame (optional)",
                format: "uri",
              },
              reference_image_urls: {
                type: "array",
                description:
                  "Reference images for style/subject guidance (up to 9)",
                items: { type: "string", format: "uri" },
                maxItems: 9,
              },
              reference_video_urls: {
                type: "array",
                description:
                  "Reference videos for motion/style guidance (up to 3)",
                items: { type: "string", format: "uri" },
                maxItems: 3,
              },
              reference_audio_urls: {
                type: "array",
                description:
                  "Reference audio for sound-guided generation (up to 3)",
                items: { type: "string", format: "uri" },
                maxItems: 3,
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio of the generated video",
                enum: [
                  "1:1",
                  "9:16",
                  "16:9",
                  "4:3",
                  "3:4",
                  "21:9",
                  "9:21",
                  "adaptive",
                ],
                default: "16:9",
              },
              resolution: {
                type: "string",
                description:
                  "Video resolution — 480p for faster, 720p for balance",
                enum: ["480p", "720p"],
                default: "720p",
              },
              duration: {
                type: "integer",
                description: "Duration of video in seconds (4-15)",
                minimum: 4,
                maximum: 15,
                default: 5,
              },
              generate_audio: {
                type: "boolean",
                description: "Generate native audio for the video",
                default: true,
              },
              web_search: {
                type: "boolean",
                description:
                  "Enable web search to enhance prompt understanding",
                default: false,
              },
              nsfw_checker: {
                type: "boolean",
                description: "Enable NSFW content filtering",
                default: false,
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "bytedance_seedream_image",
          description:
            "Generate and edit images using ByteDance Seedream models (supports V4 and V5 Lite with 3K output). V5 Lite offers enhanced detail fidelity, multi-image fusion up to 14 refs, and clear small-text rendering",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt for image generation or editing. V4: max 5000 chars, V5 Lite: max 3000 chars (API returns 500 error if exceeded)",
                minLength: 1,
                maxLength: 5000,
              },
              image_urls: {
                type: "array",
                description:
                  "Array of image URLs for editing mode (optional - if not provided, uses text-to-image). V4: max 10, V4.5: max 14",
                items: {
                  type: "string",
                  format: "uri",
                },
                minItems: 1,
                maxItems: 14,
              },
              version: {
                type: "string",
                description:
                  "Seedream version: '4' for V4, '5-lite' for V5 Lite (default) with enhanced features",
                enum: ["4", "5-lite"],
                default: "5-lite",
              },
              image_size: {
                type: "string",
                description: "Image aspect ratio (V4 only)",
                enum: [
                  "square",
                  "square_hd",
                  "portrait_4_3",
                  "portrait_3_2",
                  "portrait_16_9",
                  "landscape_4_3",
                  "landscape_3_2",
                  "landscape_16_9",
                  "landscape_21_9",
                ],
                default: "square_hd",
              },
              image_resolution: {
                type: "string",
                description: "Image resolution (V4 only)",
                enum: ["1K", "2K", "4K"],
                default: "1K",
              },
              max_images: {
                type: "integer",
                description: "Number of images to generate (V4 only)",
                minimum: 1,
                maximum: 6,
                default: 1,
              },
              seed: {
                type: "integer",
                description:
                  "Random seed for reproducible results (V4 only, use -1 for random)",
                default: -1,
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio for V5 Lite output (V5 Lite only)",
                enum: [
                  "1:1",
                  "4:3",
                  "3:4",
                  "16:9",
                  "9:16",
                  "2:3",
                  "3:2",
                  "21:9",
                ],
                default: "1:1",
              },
              quality: {
                type: "string",
                description:
                  "Output quality for V5 Lite (V5 Lite only): 'basic' = 2K, 'high' = 3K resolution",
                enum: ["basic", "high"],
                default: "basic",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "qwen_image",
          description:
            "Generate and edit images using Qwen models (unified tool for both text-to-image and image editing)",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Text prompt for image generation or editing",
                minLength: 1,
              },
              image_url: {
                type: "string",
                description:
                  "URL of image to edit (optional - if not provided, uses text-to-image)",
                format: "uri",
              },
              image_size: {
                type: "string",
                description: "Image size",
                enum: [
                  "square",
                  "square_hd",
                  "portrait_4_3",
                  "portrait_16_9",
                  "landscape_4_3",
                  "landscape_16_9",
                ],
                default: "square_hd",
              },
              num_inference_steps: {
                type: "integer",
                description:
                  "Number of inference steps (2-250 for text-to-image, 2-49 for edit)",
                minimum: 2,
                maximum: 250,
                default: 30,
              },
              guidance_scale: {
                type: "number",
                description:
                  "CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit)",
                minimum: 0,
                maximum: 20,
                default: 2.5,
              },
              enable_safety_checker: {
                type: "boolean",
                description: "Enable safety checker",
                default: true,
              },
              output_format: {
                type: "string",
                description: "Output format",
                enum: ["png", "jpeg"],
                default: "png",
              },
              negative_prompt: {
                type: "string",
                description: "Negative prompt (max 500 characters)",
                maxLength: 500,
                default: " ",
              },
              acceleration: {
                type: "string",
                description: "Acceleration level",
                enum: ["none", "regular", "high"],
                default: "none",
              },
              num_images: {
                type: "string",
                description: "Number of images (1-4, edit mode only)",
                enum: ["1", "2", "3", "4"],
              },
              sync_mode: {
                type: "boolean",
                description: "Sync mode (edit mode only)",
                default: false,
              },
              seed: {
                type: "number",
                description: "Random seed for reproducible results",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "z_image",
          description:
            "Generate photorealistic images using Tongyi-MAI Z-Image model. Ultra-fast Turbo performance, accurate bilingual text rendering (Chinese/English), strong semantic understanding. Pricing: ~$0.004/image",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired image (max 5000 characters). Supports bilingual prompts.",
                minLength: 1,
                maxLength: 5000,
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio for the generated image",
                enum: ["1:1", "4:3", "3:4", "16:9", "9:16"],
                default: "1:1",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "grok_imagine",
          description:
            "Generate images and videos using xAI's Grok Imagine (4 modes: text-to-image, text-to-video, image-to-video, upscale). Supports synchronized audio with video. Pricing: ~$0.10 per 6-second video",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired content (required for text modes, optional for image-to-video)",
                maxLength: 5000,
              },
              image_urls: {
                type: "array",
                description:
                  "Single image URL for image-to-video mode (alternative to task_id)",
                items: { type: "string", format: "uri" },
                maxItems: 1,
              },
              task_id: {
                type: "string",
                description:
                  "Task ID from a previous Grok generation (for upscale or image-to-video from generated image)",
              },
              index: {
                type: "integer",
                description:
                  "Image index from task_id (0-5, Grok generates 6 images per task)",
                minimum: 0,
                maximum: 5,
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio for generated content",
                enum: ["2:3", "3:2", "1:1"],
                default: "1:1",
              },
              mode: {
                type: "string",
                description:
                  "Generation style: 'normal' (default), 'fun' (playful), 'spicy' (expressive, not available with external images)",
                enum: ["fun", "normal", "spicy"],
                default: "normal",
              },
              generation_mode: {
                type: "string",
                description:
                  "Explicit mode selection (auto-detected if not provided): text-to-image, text-to-video, image-to-video, or upscale",
                enum: [
                  "text-to-image",
                  "text-to-video",
                  "image-to-video",
                  "upscale",
                ],
              },
              callBackUrl: {
                type: "string",
                description: "Optional: URL for task completion notifications",
                format: "uri",
              },
            },
          },
        },
        {
          name: "infinitalk_lip_sync",
          description:
            "Generate AI lip-sync talking videos using MeiGen-AI InfiniTalk. Transforms portrait image + audio into natural talking avatar with synchronized lips, facial expressions, and head movements. Pricing: ~$0.015/s (480p), ~$0.06/s (720p), max 15s",
          inputSchema: {
            type: "object",
            properties: {
              image_url: {
                type: "string",
                description:
                  "URL of the portrait image to animate (JPEG, PNG, WEBP, max 10MB)",
                format: "uri",
              },
              audio_url: {
                type: "string",
                description:
                  "URL of the audio file for lip sync (MPEG, WAV, AAC, MP4, OGG, max 10MB)",
                format: "uri",
              },
              prompt: {
                type: "string",
                description:
                  "Text prompt to guide video generation (e.g., 'A young woman talking on a podcast')",
                minLength: 1,
                maxLength: 1500,
              },
              resolution: {
                type: "string",
                description:
                  "Video resolution: 480p (faster, cheaper) or 720p (higher quality)",
                enum: ["480p", "720p"],
                default: "480p",
              },
              seed: {
                type: "integer",
                description: "Random seed for reproducibility (10000-1000000)",
                minimum: 10000,
                maximum: 1000000,
              },
              callBackUrl: {
                type: "string",
                description: "Optional: URL for task completion notifications",
                format: "uri",
              },
            },
            required: ["image_url", "audio_url", "prompt"],
          },
        },
        {
          name: "kling_avatar",
          description:
            "Generate lifelike talking avatar videos using Kuaishou Kling AI. Transforms portrait photo + audio into realistic avatar with accurate lip-sync, emotions, and identity preservation. Pricing: ~$0.04/s (720P standard), ~$0.08/s (1080P pro), max 15s",
          inputSchema: {
            type: "object",
            properties: {
              image_url: {
                type: "string",
                description:
                  "URL of the portrait image for avatar (JPEG, PNG, WEBP, max 10MB)",
                format: "uri",
              },
              audio_url: {
                type: "string",
                description:
                  "URL of the audio file for the avatar to speak (MPEG, WAV, AAC, MP4, OGG, max 10MB)",
                format: "uri",
              },
              prompt: {
                type: "string",
                description:
                  "Text prompt to guide video generation (emotions, expressions, scene settings)",
                minLength: 1,
                maxLength: 1500,
              },
              quality: {
                type: "string",
                description:
                  "Video quality: standard (720P, faster) or pro (1080P, higher quality)",
                enum: ["standard", "pro"],
                default: "standard",
              },
              callBackUrl: {
                type: "string",
                description: "Optional: URL for task completion notifications",
                format: "uri",
              },
            },
            required: ["image_url", "audio_url", "prompt"],
          },
        },
        {
          name: "midjourney_generate",
          description:
            "Generate images and videos using Midjourney AI models (unified tool for text-to-image, image-to-image, style reference, omni reference, and video generation)",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired image or video (max 2000 characters)",
                minLength: 1,
                maxLength: 2000,
              },
              taskType: {
                type: "string",
                description:
                  "Task type for generation mode (auto-detected if not provided)",
                enum: [
                  "mj_txt2img",
                  "mj_img2img",
                  "mj_style_reference",
                  "mj_omni_reference",
                  "mj_video",
                  "mj_video_hd",
                ],
              },
              fileUrl: {
                type: "string",
                description:
                  "Single image URL for image-to-image or video generation (legacy - use fileUrls instead)",
                format: "uri",
              },
              fileUrls: {
                type: "array",
                description:
                  "Array of image URLs for image-to-image or video generation (recommended)",
                items: {
                  type: "string",
                  format: "uri",
                },
                maxItems: 10,
              },
              speed: {
                type: "string",
                description:
                  "Generation speed (not required for video/omni tasks)",
                enum: ["relaxed", "fast", "turbo"],
              },
              aspectRatio: {
                type: "string",
                description: "Output aspect ratio",
                enum: [
                  "1:2",
                  "9:16",
                  "2:3",
                  "3:4",
                  "5:6",
                  "6:5",
                  "4:3",
                  "3:2",
                  "1:1",
                  "16:9",
                  "2:1",
                ],
                default: "16:9",
              },
              version: {
                type: "string",
                description: "Midjourney model version",
                enum: ["7", "6.1", "6", "5.2", "5.1", "niji6"],
                default: "7",
              },
              variety: {
                type: "integer",
                description:
                  "Controls diversity of generated results (0-100, increment by 5)",
                minimum: 0,
                maximum: 100,
              },
              stylization: {
                type: "integer",
                description:
                  "Artistic style intensity (0-1000, suggested multiple of 50)",
                minimum: 0,
                maximum: 1000,
              },
              weirdness: {
                type: "integer",
                description:
                  "Creativity and uniqueness level (0-3000, suggested multiple of 100)",
                minimum: 0,
                maximum: 3000,
              },
              ow: {
                type: "integer",
                description:
                  "Omni intensity parameter for omni reference tasks (1-1000)",
                minimum: 1,
                maximum: 1000,
              },
              waterMark: {
                type: "string",
                description: "Watermark identifier",
                maxLength: 100,
              },
              enableTranslation: {
                type: "boolean",
                description: "Auto-translate non-English prompts to English",
                default: false,
              },
              videoBatchSize: {
                type: "string",
                description: "Number of videos to generate (video mode only)",
                enum: ["1", "2", "4"],
                default: "1",
              },
              motion: {
                type: "string",
                description:
                  "Motion level for video generation (required for video mode)",
                enum: ["high", "low"],
                default: "high",
              },
              high_definition_video: {
                type: "boolean",
                description:
                  "Use high definition video generation instead of standard definition",
                default: false,
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "runway_aleph_video",
          description:
            "Transform videos using Runway Aleph video-to-video generation with AI-powered editing",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired video transformation (max 1000 characters)",
                minLength: 1,
                maxLength: 1000,
              },
              videoUrl: {
                type: "string",
                description: "URL of the input video to transform",
                format: "uri",
              },
              waterMark: {
                type: "string",
                description: "Watermark text to add to the video",
                maxLength: 100,
                default: "",
              },
              uploadCn: {
                type: "boolean",
                description: "Whether to upload to China servers",
                default: false,
              },
              aspectRatio: {
                type: "string",
                description: "Aspect ratio of the output video",
                enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"],
                default: "16:9",
              },
              seed: {
                type: "integer",
                description: "Random seed for reproducible results (1-999999)",
                minimum: 1,
                maximum: 999999,
              },
              referenceImage: {
                type: "string",
                description: "URL of reference image for style guidance",
                format: "uri",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt", "videoUrl"],
          },
        },
        {
          name: "gpt_image_2",
          description:
            "Generate images using GPT Image 2 (text-to-image and image-to-image with up to 16 reference images)",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired image (max 20000 characters)",
                maxLength: 20000,
              },
              input_urls: {
                type: "array",
                description:
                  "Array of up to 16 image URLs for image-to-image mode. Omit for text-to-image.",
                items: { type: "string", format: "uri" },
                maxItems: 16,
              },
              aspect_ratio: {
                type: "string",
                description: "Image aspect ratio",
                enum: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
                default: "auto",
              },
              resolution: {
                type: "string",
                description: "Output resolution",
                enum: ["1K", "2K", "4K"],
                default: "1K",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "flux_kontext_image",
          description:
            "Generate or edit images using Flux Kontext AI models (unified tool for text-to-image generation and image editing)",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired image or edit (max 5000 characters, English recommended)",
                minLength: 1,
                maxLength: 5000,
              },
              inputImage: {
                type: "string",
                description:
                  "Input image URL for editing mode (required for image editing, omit for text-to-image generation)",
                format: "uri",
              },
              aspectRatio: {
                type: "string",
                description: "Output image aspect ratio (default: 16:9)",
                enum: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
                default: "16:9",
              },
              outputFormat: {
                type: "string",
                description: "Output image format",
                enum: ["jpeg", "png"],
                default: "jpeg",
              },
              model: {
                type: "string",
                description: "Model version to use for generation",
                enum: ["flux-kontext-pro", "flux-kontext-max"],
                default: "flux-kontext-pro",
              },
              enableTranslation: {
                type: "boolean",
                description:
                  "Automatically translate non-English prompts to English",
                default: true,
              },
              promptUpsampling: {
                type: "boolean",
                description:
                  "Enable prompt enhancement for better results (may increase processing time)",
                default: false,
              },
              safetyTolerance: {
                type: "integer",
                description:
                  "Content moderation level (0-6 for generation, 0-2 for editing)",
                minimum: 0,
                maximum: 6,
                default: 2,
              },
              uploadCn: {
                type: "boolean",
                description:
                  "Route uploads via China servers for better performance in Asia",
                default: false,
              },
              watermark: {
                type: "string",
                description:
                  "Watermark identifier to add to the generated image",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "wan_video",
          description:
            "Generate videos using Alibaba Wan 2.7 (text-to-video, image-to-video, reference-to-video, video-edit with native audio support)",
          inputSchema: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                description:
                  "Generation mode: text-to-video (default), image-to-video, reference-to-video, or video-edit. Auto-detected from parameters if omitted.",
                enum: [
                  "text-to-video",
                  "image-to-video",
                  "reference-to-video",
                  "video-edit",
                ],
              },
              prompt: {
                type: "string",
                description:
                  "Text prompt for video generation (max 5000 characters)",
                minLength: 1,
                maxLength: 5000,
              },
              negative_prompt: {
                type: "string",
                description:
                  "Negative prompt to describe content to avoid (max 500 characters)",
                maxLength: 500,
              },
              audio_url: {
                type: "string",
                description:
                  "Audio URL for text-to-video with audio (T2V mode only)",
                format: "uri",
              },
              first_frame_url: {
                type: "string",
                description: "URL of first frame image for image-to-video mode",
                format: "uri",
              },
              last_frame_url: {
                type: "string",
                description: "URL of last frame image for image-to-video mode",
                format: "uri",
              },
              first_clip_url: {
                type: "string",
                description: "URL of first video clip for image-to-video mode",
                format: "uri",
              },
              driving_audio_url: {
                type: "string",
                description: "Audio URL to drive facial expressions (I2V mode)",
                format: "uri",
              },
              reference_image: {
                type: "array",
                description:
                  "Reference images for reference-to-video mode (up to 5)",
                items: { type: "string", format: "uri" },
                maxItems: 5,
              },
              reference_video: {
                type: "array",
                description:
                  "Reference videos for reference-to-video mode (up to 5)",
                items: { type: "string", format: "uri" },
                maxItems: 5,
              },
              reference_voice: {
                type: "string",
                description: "Voice reference URL for R2V mode",
                format: "uri",
              },
              first_frame: {
                type: "string",
                description: "First frame image URL for R2V mode",
                format: "uri",
              },
              video_url_edit: {
                type: "string",
                description: "Video URL to edit (video-edit mode)",
                format: "uri",
              },
              reference_image_edit: {
                type: "string",
                description: "Reference image URL for video-edit mode",
                format: "uri",
              },
              audio_setting: {
                type: "string",
                description: "Audio handling for video-edit: auto or origin",
                enum: ["auto", "origin"],
              },
              resolution: {
                type: "string",
                description: "Video resolution",
                enum: ["720p", "1080p"],
                default: "1080p",
              },
              ratio: {
                type: "string",
                description: "Aspect ratio of the generated video",
                enum: ["16:9", "9:16", "1:1", "4:3", "3:4"],
                default: "16:9",
              },
              duration: {
                type: "integer",
                description: "Duration in seconds (2-15)",
                minimum: 2,
                maximum: 15,
                default: 5,
              },
              prompt_extend: {
                type: "boolean",
                description:
                  "Enable prompt rewriting using LLM for better results",
                default: true,
              },
              watermark: {
                type: "boolean",
                description: "Add watermark to generated video",
                default: false,
              },
              seed: {
                type: "integer",
                description:
                  "Random seed for reproducible results (0-2147483647)",
                minimum: 0,
              },
              nsfw_checker: {
                type: "boolean",
                description: "Enable NSFW content filter",
                default: false,
              },
              callBackUrl: {
                type: "string",
                description: "Optional: URL for task completion notifications",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "topaz_upscale_image",
          description:
            "Upscale and enhance images using Topaz Labs AI upscaler. Increases resolution with high-fidelity detail restoration, natural texture reconstruction, and improved clarity. Supports 1x-8x upscaling (max output 20,000px per side). Pricing: 10 credits (≤2K), 20 credits (4K), 40 credits (8K).",
          inputSchema: {
            type: "object",
            properties: {
              image_url: {
                type: "string",
                description:
                  "URL of image to upscale (JPEG, PNG, WEBP, max 10MB)",
                format: "uri",
              },
              upscale_factor: {
                type: "string",
                description:
                  "Upscale factor: 1x (enhance only), 2x (default), 4x, or 8x. Max output dimension is 20,000px.",
                enum: ["1", "2", "4", "8"],
                default: "2",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["image_url"],
          },
        },
        {
          name: "recraft_remove_background",
          description:
            "Remove backgrounds from images using Recraft AI background removal model",
          inputSchema: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description:
                  "URL of image to remove background from (PNG, JPG, WEBP, max 5MB, 16MP, 4096px max, 256px min)",
                format: "uri",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["image"],
          },
        },
        {
          name: "ideogram_reframe",
          description:
            "Reframe images to different aspect ratios and sizes using Ideogram V3 Reframe model",
          inputSchema: {
            type: "object",
            properties: {
              image_url: {
                type: "string",
                description:
                  "URL of image to reframe (JPEG, PNG, WEBP, max 10MB)",
                format: "uri",
              },
              image_size: {
                type: "string",
                description: "Output size for the reframed image",
                enum: [
                  "square",
                  "square_hd",
                  "portrait_4_3",
                  "portrait_16_9",
                  "landscape_4_3",
                  "landscape_16_9",
                ],
                default: "square_hd",
              },
              rendering_speed: {
                type: "string",
                description: "Rendering speed for generation",
                enum: ["TURBO", "BALANCED", "QUALITY"],
                default: "BALANCED",
              },
              style: {
                type: "string",
                description: "Style type for generation",
                enum: ["AUTO", "GENERAL", "REALISTIC", "DESIGN"],
                default: "AUTO",
              },
              num_images: {
                type: "string",
                description: "Number of images to generate",
                enum: ["1", "2", "3", "4"],
                default: "1",
              },
              seed: {
                type: "number",
                description: "Seed for reproducible results",
                default: 0,
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["image_url"],
          },
        },
        {
          name: "kling_video",
          description:
            "Generate videos using Kling 3.0 AI - supports 3-15s flexible duration, native multilingual audio, multi-shot storytelling, character elements, and std/pro quality modes",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired video content (max 5000 characters). For audio: use [Character name, voice style] format for dialogue",
                minLength: 1,
                maxLength: 5000,
              },
              image_urls: {
                type: "array",
                description:
                  "Up to 2 image URLs: first = start frame, second = end frame (optional - if not provided, uses text-to-video)",
                items: { type: "string", format: "uri" },
                maxItems: 2,
              },
              duration: {
                type: "string",
                description: "Duration of video in seconds (3-15)",
                default: "5",
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio of video (text-to-video mode only)",
                enum: ["16:9", "9:16", "1:1"],
                default: "16:9",
              },
              mode: {
                type: "string",
                description:
                  "Quality mode: 'std' for standard (faster, cheaper), 'pro' for professional quality",
                enum: ["std", "pro"],
                default: "std",
              },
              sound: {
                type: "boolean",
                description:
                  "Enable native audio generation including multilingual speech, sound effects, and ambient sound. Pricing: with audio is 2x credits",
                default: false,
              },
              multi_shots: {
                type: "boolean",
                description:
                  "Enable multi-shot mode for cinematic storytelling with multiple scenes (requires multi_prompt)",
                default: false,
              },
              multi_prompt: {
                type: "array",
                description:
                  "Array of shot definitions for multi-shot mode. Each shot has a prompt and duration (1-12s)",
                items: {
                  type: "object",
                  properties: {
                    prompt: {
                      type: "string",
                      description: "Scene description for this shot",
                    },
                    duration: {
                      type: "integer",
                      description: "Duration of this shot in seconds (1-12)",
                      minimum: 1,
                      maximum: 12,
                    },
                  },
                  required: ["prompt", "duration"],
                },
              },
              kling_elements: {
                type: "array",
                description:
                  "Character/object elements for consistent identity across shots. Provide name, description, and reference images/videos",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Element name (e.g., character name)",
                    },
                    description: {
                      type: "string",
                      description: "Element description",
                    },
                    element_input_urls: {
                      type: "array",
                      description: "Reference image URLs for this element",
                      items: { type: "string", format: "uri" },
                    },
                    element_input_video_urls: {
                      type: "array",
                      description: "Reference video URLs for this element",
                      items: { type: "string", format: "uri" },
                    },
                  },
                  required: ["name", "description"],
                },
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "hailuo_video",
          description:
            "Generate videos using Hailuo AI models (unified tool for text-to-video and image-to-video with standard/pro quality). Supports v02 (original) and v2.3 (enhanced motion/expressions, 1080P)",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired video content (max 1500 characters)",
                minLength: 1,
                maxLength: 1500,
              },
              imageUrl: {
                type: "string",
                description:
                  "URL of input image for image-to-video mode (optional - if not provided, uses text-to-video)",
                format: "uri",
              },
              endImageUrl: {
                type: "string",
                description:
                  "URL of end frame image for image-to-video (optional - requires imageUrl)",
                format: "uri",
              },
              version: {
                type: "string",
                description:
                  "Hailuo model version: '02' (original) or '2.3' (better motion, expressions, 1080P support)",
                enum: ["02", "2.3"],
                default: "02",
              },
              quality: {
                type: "string",
                description:
                  "Quality level of video generation (standard for faster, pro for higher quality)",
                enum: ["standard", "pro"],
                default: "standard",
              },
              duration: {
                type: "string",
                description:
                  "Duration of video in seconds (standard quality only). Note: 10s not supported with 1080P in v2.3",
                enum: ["6", "10"],
                default: "6",
              },
              resolution: {
                type: "string",
                description:
                  "Resolution of video (standard quality only). v02: 512P/768P, v2.3: 768P/1080P",
                enum: ["512P", "768P", "1080P"],
                default: "768P",
              },
              promptOptimizer: {
                type: "boolean",
                description:
                  "Whether to use the model's prompt optimizer for better results",
                default: true,
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "flux2_image",
          description:
            "Generate and edit images using Black Forest Labs' Flux 2 models (Pro/Flex) with multi-reference consistency, photoreal detail, and accurate text rendering",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description:
                  "Text prompt describing the desired image (3-5000 characters)",
                minLength: 3,
                maxLength: 5000,
              },
              input_urls: {
                type: "array",
                description:
                  "Reference images for image-to-image mode (1-8 URLs). Omit for text-to-image mode.",
                items: { type: "string", format: "uri" },
                minItems: 1,
                maxItems: 8,
              },
              aspect_ratio: {
                type: "string",
                description:
                  "Aspect ratio for the generated image. 'auto' only valid with input_urls.",
                enum: [
                  "1:1",
                  "4:3",
                  "3:4",
                  "16:9",
                  "9:16",
                  "3:2",
                  "2:3",
                  "auto",
                ],
                default: "1:1",
              },
              resolution: {
                type: "string",
                description:
                  "Output resolution. Pro: 1K (~$0.025), 2K (~$0.035). Flex: 1K (~$0.07), 2K (~$0.12).",
                enum: ["1K", "2K"],
                default: "1K",
              },
              model_type: {
                type: "string",
                description:
                  "Model variant: 'pro' for fast reliable results, 'flex' for more control and fine-tuning.",
                enum: ["pro", "flex"],
                default: "pro",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "wan_animate",
          description:
            "Animate static images or replace characters in videos using Alibaba's Wan 2.2 Animate models with motion transfer and seamless environmental integration",
          inputSchema: {
            type: "object",
            properties: {
              video_url: {
                type: "string",
                description:
                  "URL of the reference video (MP4, QUICKTIME, X-MATROSKA, max 10MB, max 30 seconds)",
                format: "uri",
              },
              image_url: {
                type: "string",
                description:
                  "URL of the character image (JPEG, PNG, WEBP, max 10MB). Will be resized and center-cropped to match video aspect ratio.",
                format: "uri",
              },
              mode: {
                type: "string",
                description:
                  "Animation mode: 'animate' transfers motion/expressions from video to image, 'replace' swaps the character in video with the image",
                enum: ["animate", "replace"],
                default: "animate",
              },
              resolution: {
                type: "string",
                description:
                  "Output resolution: 480p (~$0.03/sec), 580p (~$0.0475/sec), 720p (~$0.0625/sec)",
                enum: ["480p", "580p", "720p"],
                default: "480p",
              },
              callBackUrl: {
                type: "string",
                description:
                  "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
                format: "uri",
              },
            },
            required: ["video_url", "image_url"],
          },
        },
        {
          name: "happyhorse_video",
          description:
            "Generate videos using Alibaba HappyHorse 1.0 (text-to-video, image-to-video, reference-to-video with up to 9 images, video-edit with native audio)",
          inputSchema: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                description:
                  "Generation mode: text-to-video (default), image-to-video, reference-to-video, or video-edit. Auto-detected from parameters if omitted.",
                enum: [
                  "text-to-video",
                  "image-to-video",
                  "reference-to-video",
                  "video-edit",
                ],
              },
              prompt: {
                type: "string",
                description:
                  "Text prompt for video generation (max 5000 characters)",
                minLength: 1,
                maxLength: 5000,
              },
              image_urls: {
                type: "array",
                description: "Input image URL for image-to-video mode (max 1)",
                items: { type: "string", format: "uri" },
                maxItems: 1,
              },
              reference_image: {
                type: "array",
                description:
                  "Reference images for reference-to-video mode (up to 9)",
                items: { type: "string", format: "uri" },
                maxItems: 9,
              },
              video_url: {
                type: "string",
                description: "Video URL to edit (video-edit mode)",
                format: "uri",
              },
              reference_image_edit: {
                type: "array",
                description: "Reference images for video-edit mode (up to 5)",
                items: { type: "string", format: "uri" },
                maxItems: 5,
              },
              audio_setting: {
                type: "string",
                description: "Audio handling for video-edit: auto or origin",
                enum: ["auto", "origin"],
              },
              resolution: {
                type: "string",
                description: "Video resolution",
                enum: ["720p", "1080p"],
                default: "1080p",
              },
              aspect_ratio: {
                type: "string",
                description: "Aspect ratio of the generated video",
                enum: ["16:9", "9:16", "1:1", "4:3", "3:4"],
                default: "16:9",
              },
              duration: {
                type: "integer",
                description: "Duration in seconds (3-15)",
                minimum: 3,
                maximum: 15,
                default: 5,
              },
              seed: {
                type: "integer",
                description:
                  "Random seed for reproducible results (0-2147483647)",
                minimum: 0,
              },
              callBackUrl: {
                type: "string",
                description: "Optional: URL for task completion notifications",
                format: "uri",
              },
            },
            required: ["prompt"],
          },
        },
      ];

      const filteredTools = allTools.filter((tool) =>
        this.enabledTools.has(tool.name),
      );

      return { tools: filteredTools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!this.enabledTools.has(name)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Tool '${name}' is not enabled. This tool has been disabled by server configuration. ` +
              `Please check KIE_AI_ENABLED_TOOLS, KIE_AI_TOOL_CATEGORIES, or KIE_AI_DISABLED_TOOLS environment variables.`,
          );
        }

        switch (name) {
          case "nano_banana_image":
            return await this.handleNanoBananaImage(args);

          case "veo3_generate_video":
            return await this.handleVeo3GenerateVideo(args);

          case "get_task_status":
            return await this.handleGetTaskStatus(args);

          case "list_tasks":
            return await this.handleListTasks(args);

          case "veo3_get_1080p_video":
            return await this.handleVeo3Get1080pVideo(args);

          case "suno_generate_music":
            return await this.handleSunoGenerateMusic(args);

          case "elevenlabs_tts":
            return await this.handleElevenLabsTTS(args);

          case "elevenlabs_ttsfx":
            return await this.handleElevenLabsSoundEffects(args);

          case "bytedance_seedance_video":
            return await this.handleByteDanceSeedanceVideo(args);

          case "bytedance_seedream_image":
            return await this.handleByteDanceSeedreamImage(args);

          case "qwen_image":
            return await this.handleQwenImage(args);

          case "z_image":
            return await this.handleZImage(args);

          case "grok_imagine":
            return await this.handleGrokImagine(args);

          case "infinitalk_lip_sync":
            return await this.handleInfiniTalkLipSync(args);

          case "kling_avatar":
            return await this.handleKlingAvatar(args);

          case "midjourney_generate":
            return await this.handleMidjourneyGenerate(args);

          case "gpt_image_2":
            return await this.handleGptImage2(args);

          case "flux_kontext_image":
            return await this.handleFluxKontextImage(args);

          case "runway_aleph_video":
            return await this.handleRunwayAlephVideo(args);

          case "wan_video":
            return await this.handleWanVideo(args);

          case "happyhorse_video":
            return await this.handleHappyHorseVideo(args);

          case "topaz_upscale_image":
            return await this.handleTopazUpscaleImage(args);

          case "recraft_remove_background":
            return await this.handleRecraftRemoveBackground(args);

          case "ideogram_reframe":
            return await this.handleIdeogramReframe(args);

          case "kling_video":
            return await this.handleKlingVideo(args);

          case "hailuo_video":
            return await this.handleHailuoVideo(args);

          case "flux2_image":
            return await this.handleFlux2Image(args);

          case "wan_animate":
            return await this.handleWanAnimate(args);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`,
            );
        }
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
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          // Model Documentation - Images
          {
            uri: "kie://models/bytedance-seedream",
            name: "ByteDance Seedream V4",
            description:
              "4K image generation and editing with batch processing (1-10 images)",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.7,
            },
          },
          {
            uri: "kie://models/qwen-image",
            name: "Qwen Image",
            description:
              "Multi-image editing, single-image consistency, fast processing",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.7,
            },
          },
          {
            uri: "kie://models/flux-kontext",
            name: "Flux Kontext",
            description:
              "Advanced controls, customizable parameters, technical precision",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/gpt-image-2",
            name: "GPT Image 2",
            description:
              "Text-to-image and image-to-image with up to 16 reference images",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/nano-banana",
            name: "Nano Banana Pro (Gemini 3.0)",
            description:
              "Text-to-image, bulk editing (up to 10 images), and UPSCALING (1x-4x with face enhancement)",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },

          // Model Documentation - Videos
          {
            uri: "kie://models/veo3",
            name: "Google Veo3",
            description:
              "Premium cinematic video generation with 1080p support",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.8,
            },
          },
          {
            uri: "kie://models/bytedance-seedance",
            name: "ByteDance Seedance 2.0",
            description:
              "Multimodal video generation with native audio, image/video/audio references, standard and fast modes",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.7,
            },
          },
          {
            uri: "kie://models/wan-video",
            name: "Wan 2.7 Video",
            description:
              "Multi-mode video generation: T2V, I2V, R2V, video-edit with audio",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/happyhorse-video",
            name: "HappyHorse 1.0 Video",
            description:
              "Multi-mode video: T2V, I2V, R2V (up to 9 refs), video-edit with audio",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/runway-aleph",
            name: "Runway Aleph",
            description: "Video-to-video editing and transformation",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/kling-v2-1",
            name: "Kling v2.1 Pro",
            description:
              "Controlled motion video with CFG control and 2-image transitions",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/kling-v2-5",
            name: "Kling v2.5 Turbo",
            description: "Fast video generation with turbo speed (5-10s)",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/hailuo",
            name: "Hailuo 02",
            description: "Fast video generation with built-in prompt optimizer",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },
          {
            uri: "kie://models/midjourney",
            name: "Midjourney",
            description:
              "6 generation modes: text/image-to-image, style/omni reference, video (SD/HD)",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },

          // Specialized Tools
          {
            uri: "kie://models/topaz-upscale",
            name: "Topaz Image Upscale",
            description:
              "AI-powered image upscaling with detail restoration (1x-8x)",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.5,
            },
          },
          {
            uri: "kie://models/recraft-bg-removal",
            name: "Recraft Background Removal",
            description: "AI-powered background removal for subject isolation",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.5,
            },
          },
          {
            uri: "kie://models/ideogram-reframe",
            name: "Ideogram V3 Reframe",
            description:
              "Intelligent aspect ratio changes and composition adjustment",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.5,
            },
          },

          // Comparison Guides
          {
            uri: "kie://guides/image-models-comparison",
            name: "Image Models Comparison",
            description: "Feature matrix comparing all image generation models",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.5,
            },
          },
          {
            uri: "kie://guides/video-models-comparison",
            name: "Video Models Comparison",
            description: "Feature matrix comparing all video generation models",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.5,
            },
          },

          // Best Practices
          {
            uri: "kie://guides/quality-optimization",
            name: "Quality & Cost Optimization",
            description:
              "Resolution settings, quality levels, and cost control strategies",
            mimeType: "text/markdown",
            annotations: {
              audience: ["assistant"],
              priority: 0.6,
            },
          },

          // Operational Resources
          {
            uri: "kie://tasks/active",
            name: "Active Generation Tasks",
            description:
              "Real-time status of all currently active AI generation tasks",
            mimeType: "application/json",
            annotations: {
              audience: ["user", "assistant"],
              priority: 0.4,
            },
          },
          {
            uri: "kie://stats/usage",
            name: "Usage Statistics",
            description: "Current usage statistics and cost tracking",
            mimeType: "application/json",
            annotations: {
              audience: ["user"],
              priority: 0.3,
            },
          },
        ],
      };
    });

    server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        // Model Documentation
        const modelMatch = uri.match(/^kie:\/\/models\/(.+)$/);
        if (modelMatch) {
          const modelKey = modelMatch[1];
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: await this.getModelDocumentation(modelKey),
              },
            ],
          };
        }

        // Comparison Guides
        if (uri === "kie://guides/image-models-comparison") {
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: this.getImageModelsComparison(),
              },
            ],
          };
        }

        if (uri === "kie://guides/video-models-comparison") {
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: this.getVideoModelsComparison(),
              },
            ],
          };
        }

        if (uri === "kie://guides/quality-optimization") {
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: this.getQualityOptimizationGuide(),
              },
            ],
          };
        }

        // Operational Resources
        switch (uri) {
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
              ErrorCode.InternalError,
              `Resource not found: ${uri}`,
            );
        }
      },
    );

    // Prompt Handlers
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
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

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "image": {
          const agentInstructions = await this.getAgentInstructions("image");

          return {
            description: "Generate, edit, or enhance images using AI models",
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "resource" as const,
                  resource: {
                    uri: "kie://agents/image",
                    name: "image",
                    mimeType: "text/markdown",
                    text: agentInstructions,
                  },
                },
              },
            ],
          };
        }

        case "video": {
          const agentInstructions = await this.getAgentInstructions("video");

          return {
            description: "Generate videos from text or images",
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "resource" as const,
                  resource: {
                    uri: "kie://agents/video",
                    name: "video",
                    mimeType: "text/markdown",
                    text: agentInstructions,
                  },
                },
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.InternalError,
            `Prompt not found: ${name}`,
          );
      }
    });
  }

  private async handleNanoBananaImage(args: any) {
    try {
      const request = NanoBananaImageSchema.parse(args);

      const response = await this.client.generateNanoBananaImage(request);

      // Determine mode and api_type based on parameters
      const isEdit = !!request.image_input && request.image_input.length > 0;
      const apiType = isEdit ? "nano-banana-edit" : "nano-banana-image";
      const modeDescription = isEdit ? "edit" : "generate";

      if (response.data?.taskId) {
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: apiType as any,
          status: "pending",
          result_url: response.data.imageUrl,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                response: response,
                mode: modeDescription,
                message: `Nano Banana 2 image ${modeDescription} initiated`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.formatError("nano_banana_image", error, {
        prompt:
          "Required for generate/edit modes: text description (max 5000 chars)",
        image_input:
          "Optional for edit mode: array of up to 14 reference image URLs",
        output_format: 'Optional: "png" or "jpg"',
        aspect_ratio: 'Optional: aspect ratio like "16:9", "1:1", etc.',
        resolution: 'Optional: "1K", "2K", or "4K"',
        google_search:
          "Optional: enable Google Search grounding (default: false)",
      });
    }
  }

  private async handleVeo3GenerateVideo(args: any) {
    try {
      const request = Veo3GenerateSchema.parse(args);

      // Use intelligent callback URL resolution
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateVeo3Video(request);

      if (response.data?.taskId) {
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "veo3",
          status: "pending",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                message: "Veo3 video generation task created successfully",
                note: "Use get_task_status to check progress",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.formatError("veo3_generate_video", error, {
        prompt: "Required: video description (max 2000 chars)",
        imageUrls:
          "Optional: 1-2 image URLs for image-to-video (1 image = unfold around it, 2 images = start to end frame transition)",
        model: 'Optional: "veo3" (quality) or "veo3_fast" (cost-efficient)',
        watermark: "Optional: watermark text (max 100 chars)",
        aspectRatio: 'Optional: "16:9", "9:16", or "Auto"',
        seeds: "Optional: random seed (10000-99999)",
        callBackUrl: "Optional: callback URL for notifications",
        enableFallback: "Optional: enable fallback for content policy failures",
        enableTranslation: "Optional: auto-translate prompts to English",
      });
    }
  }

  private async handleGetTaskStatus(args: any) {
    try {
      const { task_id } = args;

      if (!task_id || typeof task_id !== "string") {
        throw new McpError(
          ErrorCode.InvalidParams,
          "task_id is required and must be a string",
        );
      }

      const localTask = await this.db.getTask(task_id);

      // Always try to get updated status from API, passing api_type if available
      let apiResponse = null;
      let parsedResult = null;

      try {
        apiResponse = await this.client.getTaskStatus(
          task_id,
          localTask?.api_type,
        );

        // Update local database with API response
        if (apiResponse?.data) {
          const apiData = apiResponse.data;

          // Handle different response formats for different API types
          let status: "pending" | "processing" | "completed" | "failed" =
            "pending";
          let resultUrl = undefined;
          let errorMessage = undefined;

          if (localTask?.api_type === "suno") {
            // Suno-specific status mapping
            const sunoStatus = apiData.status;
            if (sunoStatus === "SUCCESS") status = "completed";
            else if (
              sunoStatus === "CREATE_TASK_FAILED" ||
              sunoStatus === "GENERATE_AUDIO_FAILED" ||
              sunoStatus === "CALLBACK_EXCEPTION" ||
              sunoStatus === "SENSITIVE_WORD_ERROR"
            )
              status = "failed";
            else if (
              sunoStatus === "PENDING" ||
              sunoStatus === "TEXT_SUCCESS" ||
              sunoStatus === "FIRST_SUCCESS"
            )
              status = "processing";

            // Extract audio URLs from Suno response
            if (
              apiData.response?.sunoData &&
              apiData.response.sunoData.length > 0
            ) {
              // Use the first audio URL as the primary result
              resultUrl = apiData.response.sunoData[0].audioUrl;
            }

            // Extract error message for Suno
            if (apiData.errorMessage) {
              errorMessage = apiData.errorMessage;
            }
          } else if (
            localTask?.api_type === "elevenlabs-tts" ||
            localTask?.api_type === "elevenlabs-sound-effects"
          ) {
            // ElevenLabs TTS/Sound Effects-specific status mapping
            const elevenlabsState = apiData.state;
            if (elevenlabsState === "success") status = "completed";
            else if (elevenlabsState === "fail") status = "failed";
            else if (elevenlabsState === "waiting") status = "processing";

            // Parse resultJson for ElevenLabs TTS/Sound Effects
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                // ElevenLabs TTS/Sound Effects returns resultUrls array with audio file URLs
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0]; // Use first audio URL
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for ElevenLabs TTS/Sound Effects
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else if (localTask?.api_type === "flux-kontext-image") {
            // Flux Kontext Image-specific status mapping
            const successFlag = apiData.successFlag;
            if (successFlag === 1) status = "completed";
            else if (successFlag === 2 || successFlag === 3) status = "failed";
            else if (successFlag === 0) status = "processing";

            // Extract result URL from Flux Kontext response
            if (apiData.response?.resultImageUrl) {
              resultUrl = apiData.response.resultImageUrl;
            }

            // Extract error message for Flux Kontext
            if (apiData.errorMessage) {
              errorMessage = apiData.errorMessage;
            }
          } else if (localTask?.api_type === "topaz-upscale") {
            // Topaz Image Upscale-specific status mapping
            const state = apiData.state;
            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson for Topaz Image Upscale
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0];
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for Topaz Image Upscale
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else if (localTask?.api_type === "recraft-remove-background") {
            // Recraft Remove Background-specific status mapping
            const state = apiData.state;
            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson for Recraft Remove Background
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                // Recraft Remove Background returns resultUrls array with image URLs
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0]; // Use first image URL
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for Recraft Remove Background
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else if (localTask?.api_type === "ideogram-reframe") {
            // Ideogram V3 Reframe-specific status mapping
            const state = apiData.state;
            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson for Ideogram V3 Reframe
            if (apiData.resultJson) {
              try {
                parsedResult = JSON.parse(apiData.resultJson);
                // Ideogram V3 Reframe returns resultUrls array with image URLs
                if (
                  parsedResult.resultUrls &&
                  parsedResult.resultUrls.length > 0
                ) {
                  resultUrl = parsedResult.resultUrls[0]; // Use first image URL
                }
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            // Extract error message for Ideogram V3 Reframe
            if (apiData.failMsg) {
              errorMessage = apiData.failMsg;
            }
          } else {
            // Original logic for other APIs (Nano Banana Pro, Veo3)
            const { state, resultJson, failCode, failMsg } = apiData;

            if (state === "success") status = "completed";
            else if (state === "fail") status = "failed";
            else if (state === "waiting") status = "processing";

            // Parse resultJson if available
            if (resultJson) {
              try {
                parsedResult = JSON.parse(resultJson);
              } catch (e) {
                // Invalid JSON in resultJson
              }
            }

            resultUrl = parsedResult?.resultUrls?.[0] || undefined;
            errorMessage = failMsg || undefined;
          }

          // Update database
          await this.db.updateTask(task_id, {
            status,
            result_url: resultUrl,
            error_message: errorMessage,
          });
        }
      } catch (error) {
        // API call failed, use local data if available
      }

      // Fetch updated local task
      const updatedTask = await this.db.getTask(task_id);

      // Determine polling strategy based on task type
      const getPollingStrategy = (apiType?: string) => {
        // Image generation models
        const imageModels = [
          "nano-banana",
          "nano-banana-edit",
          "nano-banana-image",
          "bytedance-seedream-image",
          "qwen-image",
          "gpt-image-2",
          "flux-kontext-image",
          "topaz-upscale",
          "recraft-remove-background",
          "ideogram-reframe",
          "midjourney",
        ];

        // Video generation models
        const videoModels = [
          "veo3",
          "veo3-fast",
          "veo3-1080p",
          "kling-3.0-video",
          "bytedance-seedance-video",
          "wan-video",
          "happyhorse-video",
          "hailuo",
          "runway-aleph-video",
        ];

        // Audio generation models
        const audioModels = [
          "suno",
          "elevenlabs-tts",
          "elevenlabs-sound-effects",
        ];

        let taskType: "image" | "video" | "audio" = "image";
        let recommendedInterval = 15; // Default for images
        let maxWaitTime = 300; // 5 minutes default

        if (apiType) {
          if (imageModels.some((model) => apiType.includes(model))) {
            taskType = "image";
            recommendedInterval = 15;
            maxWaitTime = 180; // 3 minutes for images
          } else if (videoModels.some((model) => apiType.includes(model))) {
            taskType = "video";
            recommendedInterval = 45;
            maxWaitTime = 600; // 10 minutes for videos
          } else if (audioModels.some((model) => apiType.includes(model))) {
            taskType = "audio";
            recommendedInterval = 20;
            maxWaitTime = 240; // 4 minutes for audio
          }
        }

        const status = updatedTask?.status;
        let nextAction: "continue_polling" | "task_complete" | "task_failed" =
          "continue_polling";

        if (status === "completed") {
          nextAction = "task_complete";
        } else if (status === "failed") {
          nextAction = "task_failed";
        }

        return {
          task_type: taskType,
          recommended_interval_seconds: recommendedInterval,
          max_wait_time_seconds: maxWaitTime,
          backoff_strategy: "fixed" as const,
          next_action: nextAction,
          current_status: status,
          polling_instructions: {
            continue_polling: `Continue polling every ${recommendedInterval} seconds until status changes to 'completed' or 'failed'`,
            task_complete:
              "Task completed successfully - no further polling needed",
            task_failed:
              "Task failed - check error message and consider retrying",
          },
        };
      };

      // Prepare response based on API type
      let responseData: any = {
        success: true,
        task_id: task_id,
        status: updatedTask?.status,
        result_urls: updatedTask?.result_url ? [updatedTask.result_url] : [],
        error: updatedTask?.error_message,
        api_response: apiResponse,
        message: updatedTask
          ? "Task found"
          : "Task not found in local database",
        // Add self-documenting polling strategy
        polling_strategy: getPollingStrategy(localTask?.api_type),
      };

      // Add Suno-specific information if applicable
      if (localTask?.api_type === "suno" && apiResponse?.data) {
        const sunoData = apiResponse.data;
        responseData.status = sunoData.status; // Use Suno's status directly

        // Add detailed Suno information
        if (sunoData.response?.sunoData) {
          responseData.audio_files = sunoData.response.sunoData.map(
            (audio: any) => ({
              id: audio.id,
              audio_url: audio.audioUrl,
              stream_url: audio.streamAudioUrl,
              image_url: audio.imageUrl,
              title: audio.title,
              duration: audio.duration,
              model_name: audio.modelName,
              tags: audio.tags,
              create_time: audio.createTime,
            }),
          );

          // Update result_urls with all audio URLs
          responseData.result_urls = sunoData.response.sunoData.map(
            (audio: any) => audio.audioUrl,
          );
        }

        // Add Suno-specific metadata
        responseData.suno_metadata = {
          task_type: sunoData.type,
          operation_type: sunoData.operationType,
          parent_music_id: sunoData.parentMusicId,
          parameters: sunoData.param ? JSON.parse(sunoData.param) : null,
          error_code: sunoData.errorCode,
          error_message: sunoData.errorMessage,
        };
      } else if (
        (localTask?.api_type === "elevenlabs-tts" ||
          localTask?.api_type === "elevenlabs-sound-effects") &&
        apiResponse?.data
      ) {
        const elevenlabsData = apiResponse.data;
        responseData.status = elevenlabsData.state; // Use ElevenLabs state directly

        // Add detailed ElevenLabs TTS/Sound Effects information
        if (elevenlabsData.resultJson) {
          try {
            const resultData = JSON.parse(elevenlabsData.resultJson);
            if (resultData.resultUrls) {
              responseData.result_urls = resultData.resultUrls;
              responseData.audio_url = resultData.resultUrls[0]; // Primary audio URL
            }
          } catch (e) {
            // Invalid JSON in resultJson
          }
        }

        // Add ElevenLabs-specific metadata
        responseData.elevenlabs_metadata = {
          model: elevenlabsData.model,
          state: elevenlabsData.state,
          cost_time: elevenlabsData.costTime,
          complete_time: elevenlabsData.completeTime,
          create_time: elevenlabsData.createTime,
          parameters: elevenlabsData.param
            ? JSON.parse(elevenlabsData.param)
            : null,
          fail_code: elevenlabsData.failCode,
          fail_message: elevenlabsData.failMsg,
        };
      } else {
        // Use original logic for other APIs
        responseData.status = apiResponse?.data?.state || updatedTask?.status;
        responseData.result_urls =
          parsedResult?.resultUrls ||
          (updatedTask?.result_url ? [updatedTask.result_url] : []);
        responseData.error =
          apiResponse?.data?.failMsg || updatedTask?.error_message;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.formatError("get_task_status", error, {
        task_id: "Required: task ID to check status for",
      });
    }
  }

  private async handleListTasks(args: any) {
    try {
      const { limit = 20, status } = args;

      let tasks;
      if (status) {
        tasks = await this.db.getTasksByStatus(status, limit);
      } else {
        tasks = await this.db.getAllTasks(limit);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                tasks: tasks,
                count: tasks.length,
                message: `Retrieved ${tasks.length} tasks`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.formatError("list_tasks", error, {
        limit: "Optional: max tasks to return (1-100, default: 20)",
        status:
          "Optional: filter by status (pending, processing, completed, failed)",
      });
    }
  }

  private async handleVeo3Get1080pVideo(args: any) {
    try {
      const { task_id, index } = args;

      if (!task_id || typeof task_id !== "string") {
        throw new McpError(
          ErrorCode.InvalidParams,
          "task_id is required and must be a string",
        );
      }

      const response = await this.client.getVeo1080pVideo(task_id, index);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: task_id,
                response: response,
                message: "Retrieved 1080p video URL",
                note: "Not available for videos generated with fallback mode",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.formatError("veo3_get_1080p_video", error, {
        task_id: "Required: Veo3 task ID to get 1080p video for",
        index: "Optional: video index (for multiple video results)",
      });
    }
  }

  private async handleSunoGenerateMusic(args: any) {
    try {
      const request = SunoGenerateSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateSunoMusic(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "suno",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: "Music generation task created successfully",
                  parameters: {
                    model: request.model || "V5",
                    customMode: request.customMode,
                    instrumental: request.instrumental,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Generation typically takes 1-3 minutes depending on model and length",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create music generation task",
        );
      }
    } catch (error) {
      return this.formatError("suno_generate_music", error, {
        prompt: "Required: Description of desired audio content",
        customMode: "Required: Enable advanced customization (true/false)",
        instrumental: "Required: Generate instrumental music (true/false)",
        model: "Required: AI model version (V3_5, V4, V4_5, V4_5PLUS, V5)",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        style: "Optional: Music style/genre (required in custom mode)",
        title: "Optional: Track title (required in custom mode, max 80 chars)",
        negativeTags: "Optional: Styles to exclude (max 200 chars)",
        vocalGender:
          "Optional: Vocal gender preference (m/f, custom mode only)",
        styleWeight:
          "Optional: Style adherence strength (0-1, 2 decimal places)",
        weirdnessConstraint:
          "Optional: Creative deviation control (0-1, 2 decimal places)",
        audioWeight: "Optional: Audio feature balance (0-1, 2 decimal places)",
      });
    }
  }

  private async handleElevenLabsTTS(args: any) {
    try {
      const request = ElevenLabsTTSSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateElevenLabsTTS(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "elevenlabs-tts",
          status: "pending",
        });

        const model =
          request.model === "multilingual" ? "Multilingual v2" : "Turbo 2.5";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `ElevenLabs TTS (${model}) generation task created successfully`,
                  parameters: {
                    model: model,
                    text:
                      request.text.substring(0, 100) +
                      (request.text.length > 100 ? "..." : ""),
                    voice: request.voice || "Rachel",
                    speed: request.speed || 1,
                    stability: request.stability || 0.5,
                    similarity_boost: request.similarity_boost || 0.75,
                    ...(request.model === "multilingual" && {
                      previous_text: request.previous_text || "None",
                      next_text: request.next_text || "None",
                    }),
                    ...(request.model === "turbo" && {
                      language_code: request.language_code || "None",
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    request.model === "turbo"
                      ? "Turbo 2.5 generation is faster and supports language enforcement (15-60 seconds)"
                      : "Multilingual v2 generation supports context and continuity (30-120 seconds)",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create TTS generation task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("elevenlabs_tts", error, {
          text: "Required: The text to convert to speech (max 5000 characters)",
          model:
            "Optional: TTS model - turbo (faster, default) or multilingual (supports context)",
          voice:
            "Optional: Voice to use (default: Rachel). Available: Rachel, Aria, Roger, Sarah, Laura, Charlie, George, Callum, River, Liam, Charlotte, Alice, Matilda, Will, Jessica, Eric, Chris, Brian, Daniel, Lily, Bill",
          stability: "Optional: Voice stability (0-1, default: 0.5)",
          similarity_boost: "Optional: Similarity boost (0-1, default: 0.75)",
          style: "Optional: Style exaggeration (0-1, default: 0)",
          speed: "Optional: Speech speed (0.7-1.2, default: 1.0)",
          timestamps: "Optional: Return word timestamps (default: false)",
          previous_text:
            "Optional: Previous text for continuity (multilingual model only, max 5000 chars)",
          next_text:
            "Optional: Next text for continuity (multilingual model only, max 5000 chars)",
          language_code:
            "Optional: ISO 639-1 language code for enforcement (turbo model only)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("elevenlabs_tts", error, {
        text: "Required: The text to convert to speech (max 5000 characters)",
        model: "Optional: TTS model - turbo (default) or multilingual",
        voice: "Optional: Voice to use (default: Rachel)",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleElevenLabsSoundEffects(args: any) {
    try {
      const request = ElevenLabsSoundEffectsSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response =
        await this.client.generateElevenLabsSoundEffects(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "elevenlabs-sound-effects",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message:
                    "ElevenLabs Sound Effects generation task created successfully",
                  parameters: {
                    text:
                      request.text.substring(0, 100) +
                      (request.text.length > 100 ? "..." : ""),
                    duration_seconds:
                      request.duration_seconds || "Auto-determined",
                    prompt_influence: request.prompt_influence || 0.3,
                    output_format: request.output_format || "mp3_44100_192",
                    loop: request.loop || false,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Sound effects generation typically takes 30-90 seconds depending on complexity",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create Sound Effects generation task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("elevenlabs_ttsfx", error, {
          text: "Required: The text describing the sound effect to generate (max 5000 characters)",
          loop: "Optional: Whether to create a looping sound effect (default: false)",
          duration_seconds: "Optional: Duration in seconds (0.5-22, step 0.1)",
          prompt_influence:
            "Optional: How closely to follow the prompt (0-1, step 0.01, default: 0.3)",
          output_format:
            "Optional: Audio output format (default: mp3_44100_128)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("elevenlabs_ttsfx", error, {
        text: "Required: The text describing the sound effect to generate (max 5000 characters)",
        duration_seconds: "Optional: Duration in seconds (0.5-22)",
        output_format: "Optional: Audio output format",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleByteDanceSeedanceVideo(args: any) {
    try {
      const request = ByteDanceSeedanceVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response =
        await this.client.generateByteDanceSeedanceVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode = request.mode || "standard";
        const hasFrameInput = !!request.first_frame_url;

        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "bytedance-seedance-video",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `ByteDance Seedance 2.0 ${mode} generation task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspect_ratio || "16:9",
                    resolution: request.resolution || "720p",
                    duration: request.duration || 5,
                    generate_audio: request.generate_audio !== false,
                    ...(hasFrameInput && {
                      first_frame_url: request.first_frame_url,
                    }),
                    ...(request.last_frame_url && {
                      last_frame_url: request.last_frame_url,
                    }),
                    ...(request.reference_image_urls?.length && {
                      reference_images: request.reference_image_urls.length,
                    }),
                    ...(request.reference_video_urls?.length && {
                      reference_videos: request.reference_video_urls.length,
                    }),
                    ...(request.reference_audio_urls?.length && {
                      reference_audios: request.reference_audio_urls.length,
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    `${mode} mode generation typically takes 2-5 minutes depending on duration and complexity`,
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg ||
            "Failed to create ByteDance Seedance video generation task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("bytedance_seedance_video", error, {
          prompt:
            "Required: Text prompt for video generation (3-20000 characters)",
          mode: 'Optional: Generation mode — "standard" or "fast" (default: standard)',
          first_frame_url: "Optional: URL of image to use as first frame",
          last_frame_url: "Optional: URL of image to use as last frame",
          reference_image_urls:
            "Optional: Reference images for style guidance (up to 9)",
          reference_video_urls:
            "Optional: Reference videos for motion guidance (up to 3)",
          reference_audio_urls:
            "Optional: Reference audio for sound-guided generation (up to 3)",
          aspect_ratio: "Optional: Video aspect ratio (default: 16:9)",
          resolution:
            'Optional: Video resolution — "480p" or "720p" (default: 720p)',
          duration: "Optional: Video duration in seconds 4-15 (default: 5)",
          generate_audio: "Optional: Generate native audio (default: true)",
          web_search:
            "Optional: Enable web search for prompt enhancement (default: false)",
          nsfw_checker:
            "Optional: Enable NSFW content filtering (default: false)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return this.formatError("bytedance_seedance_video", error, {
        prompt: "Required: Text prompt for video generation",
        mode: 'Optional: "standard" or "fast"',
        aspect_ratio: "Optional: Video aspect ratio",
        resolution: 'Optional: "480p" or "720p"',
        duration: "Optional: Duration in seconds 4-15",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleByteDanceSeedreamImage(args: any) {
    try {
      const request = ByteDanceSeedreamImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response =
        await this.client.generateByteDanceSeedreamImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine mode for user feedback
        const isEdit = !!request.image_urls && request.image_urls.length > 0;
        const mode = isEdit ? "Image Editing" : "Text-to-Image";

        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "bytedance-seedream-image",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `ByteDance Seedream ${request.version === "4" ? "V4" : "V5 Lite"} ${mode} task created successfully`,
                  parameters: {
                    mode: mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    image_size: request.image_size || "1:1",
                    image_resolution: request.image_resolution || "1K",
                    max_images: request.max_images || 1,
                    seed: request.seed !== undefined ? request.seed : -1,
                    ...(isEdit && {
                      image_urls_count: request.image_urls?.length || 0,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                  ],
                  usage_examples: [
                    `get_task_status: {"task_id": "${response.data.taskId}"}`,
                    `list_tasks: {"limit": 10}`,
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create ByteDance Seedream image task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("bytedance_seedream_image", error, {
          prompt:
            "Required: Text prompt for image generation or editing (max 10000 characters)",
          image_urls:
            "Optional: Array of image URLs for editing mode (1-10 images)",
          image_size: "Optional: Image aspect ratio (default: 1:1)",
          image_resolution:
            "Optional: Image resolution - 1K/2K/4K (default: 1K)",
          max_images:
            "Optional: Number of images to generate (1-6, default: 1)",
          seed: "Optional: Random seed for reproducible results (default: -1 for random)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("bytedance_seedream_image", error, {
        prompt:
          "Required: Text prompt for image generation or editing (max 10000 characters)",
        image_urls:
          "Optional: Array of image URLs for editing mode (1-10 images)",
        image_size: "Optional: Image aspect ratio (default: 1:1)",
        image_resolution: "Optional: Image resolution - 1K/2K/4K (default: 1K)",
        max_images: "Optional: Number of images to generate (1-6, default: 1)",
        seed: "Optional: Random seed for reproducible results (default: -1 for random)",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  }

  private async handleQwenImage(args: any) {
    try {
      const request = QwenImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateQwenImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine mode for user feedback
        const isEdit = !!request.image_url;
        const mode = isEdit ? "Image Editing" : "Text-to-Image";

        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "qwen-image",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `Qwen ${mode} task created successfully`,
                  parameters: {
                    mode: mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    image_size: request.image_size || "square_hd",
                    num_inference_steps:
                      request.num_inference_steps || (isEdit ? 25 : 30),
                    guidance_scale:
                      request.guidance_scale || (isEdit ? 4 : 2.5),
                    enable_safety_checker:
                      request.enable_safety_checker !== false,
                    output_format: request.output_format || "png",
                    negative_prompt:
                      request.negative_prompt ||
                      (isEdit ? "blurry, ugly" : " "),
                    acceleration: request.acceleration || "none",
                    seed: request.seed,
                    ...(isEdit && {
                      image_url: request.image_url,
                      num_images: request.num_images,
                      sync_mode: request.sync_mode,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                  ],
                  usage_examples: [
                    `get_task_status: {"task_id": "${response.data.taskId}"}`,
                    `list_tasks: {"limit": 10}`,
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Qwen image task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("qwen_image", error, {
          prompt: "Required: Text prompt for image generation or editing",
          image_url: "Optional: URL of image to edit (required for edit mode)",
          image_size:
            "Optional: Image size (square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9)",
          num_inference_steps:
            "Optional: Number of inference steps (2-250 for text-to-image, 2-49 for edit)",
          guidance_scale:
            "Optional: CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit)",
          enable_safety_checker:
            "Optional: Enable safety checker (default: true)",
          output_format: "Optional: Output format (png/jpeg, default: png)",
          negative_prompt: "Optional: Negative prompt (max 500 chars)",
          acceleration:
            "Optional: Acceleration level (none/regular/high, default: none)",
          num_images: "Optional: Number of images (1-4, edit mode only)",
          sync_mode: "Optional: Sync mode (edit mode only)",
          seed: "Optional: Random seed for reproducible results",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("qwen_image", error, {
        prompt: "Required: Text prompt for image generation or editing",
        image_url: "Optional: URL of image to edit (required for edit mode)",
        image_size:
          "Optional: Image size (square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9)",
        num_inference_steps:
          "Optional: Number of inference steps (2-250 for text-to-image, 2-49 for edit)",
        guidance_scale:
          "Optional: CFG scale (0-20, default: 2.5 for text-to-image, 4 for edit)",
        enable_safety_checker:
          "Optional: Enable safety checker (default: true)",
        output_format: "Optional: Output format (png/jpeg, default: png)",
        negative_prompt: "Optional: Negative prompt (max 500 chars)",
        acceleration:
          "Optional: Acceleration level (none/regular/high, default: none)",
        num_images: "Optional: Number of images (1-4, edit mode only)",
        sync_mode: "Optional: Sync mode (edit mode only)",
        seed: "Optional: Random seed for reproducible results",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  }

  private async handleZImage(args: any) {
    try {
      const request = ZImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateZImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "z-image",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: "Z-Image generation task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspect_ratio || "1:1",
                  },
                  pricing: "~$0.004 per image (0.8 credits)",
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated image will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Z-Image task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("z_image", error, {
          prompt:
            "Required: Text prompt describing the desired image (max 5000 chars)",
          aspect_ratio:
            "Optional: Aspect ratio (1:1, 4:3, 3:4, 16:9, 9:16, default: 1:1)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return this.formatError("z_image", error, {
        prompt:
          "Required: Text prompt describing the desired image (max 5000 chars)",
        aspect_ratio:
          "Optional: Aspect ratio (1:1, 4:3, 3:4, 16:9, 9:16, default: 1:1)",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleGrokImagine(args: any) {
    try {
      const request = GrokImagineSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateGrokImagine(request);

      if (response.code === 200 && response.data?.taskId) {
        // Detect which mode was used for logging
        const hasImageUrls =
          request.image_urls && request.image_urls.length > 0;
        const hasTaskId = !!request.task_id;
        const hasPrompt = !!request.prompt;
        const detectedMode =
          request.generation_mode ||
          (hasTaskId && !hasPrompt && !hasImageUrls
            ? "upscale"
            : hasImageUrls || hasTaskId
              ? "image-to-video"
              : request.generation_mode === "text-to-image"
                ? "text-to-image"
                : "text-to-video");

        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "grok-imagine",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `Grok Imagine ${detectedMode} task created successfully`,
                  parameters: {
                    mode: detectedMode,
                    prompt: request.prompt
                      ? request.prompt.substring(0, 100) +
                        (request.prompt.length > 100 ? "..." : "")
                      : undefined,
                    aspect_ratio: request.aspect_ratio || "1:1",
                    style_mode: request.mode || "normal",
                  },
                  pricing:
                    detectedMode === "text-to-image"
                      ? "~$0.02 per image"
                      : "~$0.10 per 6-second video",
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated content will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Grok Imagine task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("grok_imagine", error, {
          prompt:
            "Text prompt (required for text modes, optional for image-to-video)",
          image_urls: "Single image URL for image-to-video mode",
          task_id: "Task ID for upscale or image-to-video from generated image",
          index: "Image index (0-5) when using task_id",
          aspect_ratio: "Aspect ratio: 2:3, 3:2, or 1:1 (default: 1:1)",
          mode: "Style mode: fun, normal (default), or spicy",
          generation_mode:
            "Explicit mode: text-to-image, text-to-video, image-to-video, upscale",
        });
      }

      return this.formatError("grok_imagine", error, {
        prompt:
          "Text prompt (required for text modes, optional for image-to-video)",
        generation_mode:
          "Explicit mode: text-to-image, text-to-video, image-to-video, upscale",
      });
    }
  }

  private async handleInfiniTalkLipSync(args: any) {
    try {
      const request = InfiniTalkSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateInfiniTalk(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "infinitalk",
          status: "pending",
        });

        const resolution = request.resolution || "480p";
        const pricing = resolution === "720p" ? "~$0.06/s" : "~$0.015/s";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message:
                    "InfiniTalk lip-sync video task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    resolution,
                    seed: request.seed,
                  },
                  pricing: `${pricing} (max 15 seconds)`,
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Lip-synced video will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create InfiniTalk lip-sync task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("infinitalk_lip_sync", error, {
          image_url: "Required: URL of portrait image to animate",
          audio_url: "Required: URL of audio file for lip sync",
          prompt: "Required: Text prompt to guide video generation",
          resolution:
            "Optional: 480p (default, cheaper) or 720p (higher quality)",
          seed: "Optional: Random seed for reproducibility (10000-1000000)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return this.formatError("infinitalk_lip_sync", error, {
        image_url: "Required: URL of portrait image to animate",
        audio_url: "Required: URL of audio file for lip sync",
        prompt: "Required: Text prompt to guide video generation",
      });
    }
  }

  private async handleKlingAvatar(args: any) {
    try {
      const request = KlingAvatarSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateKlingAvatar(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "kling-avatar",
          status: "pending",
        });

        const quality = request.quality || "standard";
        const resolution = quality === "pro" ? "1080P" : "720P";
        const pricing = quality === "pro" ? "~$0.08/s" : "~$0.04/s";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: "Kling Avatar video task created successfully",
                  parameters: {
                    quality,
                    resolution,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                  },
                  pricing: `${pricing} (max 15 seconds)`,
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Avatar video will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Kling Avatar task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("kling_avatar", error, {
          image_url: "Required: URL of portrait image for avatar",
          audio_url: "Required: URL of audio file for avatar to speak",
          prompt: "Required: Text prompt to guide video generation",
          quality: "Optional: standard (720P, default) or pro (1080P)",
          callBackUrl: "Optional: URL for task completion notifications",
        });
      }

      return this.formatError("kling_avatar", error, {
        image_url: "Required: URL of portrait image for avatar",
        audio_url: "Required: URL of audio file for avatar to speak",
        prompt: "Required: Text prompt to guide video generation",
      });
    }
  }

  private async handleMidjourneyGenerate(args: any) {
    try {
      const request = MidjourneyGenerateSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateMidjourney(request);

      if (response.code === 200 && response.data?.taskId) {
        // Determine task type for user feedback
        const hasImage =
          request.fileUrl || (request.fileUrls && request.fileUrls.length > 0);
        const isVideoMode =
          request.motion ||
          request.videoBatchSize ||
          request.high_definition_video;
        const isOmniMode =
          request.ow || request.taskType === "mj_omni_reference";
        const isStyleMode = request.taskType === "mj_style_reference";

        let taskTypeDisplay = "Text-to-Image";
        if (isOmniMode) {
          taskTypeDisplay = "Omni Reference";
        } else if (isStyleMode) {
          taskTypeDisplay = "Style Reference";
        } else if (isVideoMode) {
          taskTypeDisplay = request.high_definition_video
            ? "Image-to-HD-Video"
            : "Image-to-Video";
        } else if (hasImage) {
          taskTypeDisplay = "Image-to-Image";
        }

        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "midjourney",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `Midjourney ${taskTypeDisplay} task created successfully`,
                  parameters: {
                    task_type: taskTypeDisplay,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspectRatio || "16:9",
                    version: request.version || "7",
                    speed: request.speed,
                    variety: request.variety,
                    stylization: request.stylization,
                    weirdness: request.weirdness,
                    enable_translation: request.enableTranslation || false,
                    waterMark: request.waterMark,
                    ...(hasImage && {
                      file_urls: request.fileUrls || [request.fileUrl],
                    }),
                    ...(isVideoMode && {
                      motion: request.motion || "high",
                      video_batch_size: request.videoBatchSize || "1",
                      high_definition_video:
                        request.high_definition_video || false,
                    }),
                    ...(isOmniMode && {
                      ow: request.ow,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated content will be available when status is "completed"',
                  ],
                  usage_examples: [
                    `get_task_status: {"task_id": "${response.data.taskId}"}`,
                    `list_tasks: {"limit": 10}`,
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Midjourney task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("midjourney_generate", error, {
          prompt:
            "Required: Text prompt describing the desired image (max 2000 chars)",
          taskType:
            "Optional: Task type (mj_txt2img, mj_img2img, mj_style_reference, mj_omni_reference, mj_video, mj_video_hd) - auto-detected if not provided",
          fileUrl:
            "Optional: Single image URL for image-to-image or video generation (legacy)",
          fileUrls:
            "Optional: Array of image URLs for image-to-image or video generation (recommended)",
          speed:
            "Optional: Generation speed (relaxed/fast/turbo) - not required for video/omni tasks",
          aspectRatio:
            "Optional: Output aspect ratio (1:2, 9:16, 2:3, 3:4, 5:6, 6:5, 4:3, 3:2, 1:1, 16:9, 2:1, default: 16:9)",
          version:
            "Optional: Midjourney model version (7, 6.1, 6, 5.2, 5.1, niji6, default: 7)",
          variety: "Optional: Diversity control (0-100, increment by 5)",
          stylization:
            "Optional: Artistic style intensity (0-1000, suggested multiple of 50)",
          weirdness:
            "Optional: Creativity level (0-3000, suggested multiple of 100)",
          ow: "Optional: Omni intensity for omni reference tasks (1-1000)",
          waterMark: "Optional: Watermark identifier (max 100 chars)",
          enableTranslation:
            "Optional: Auto-translate non-English prompts (default: false)",
          videoBatchSize:
            "Optional: Number of videos to generate (1/2/4, default: 1, video mode only)",
          motion:
            "Optional: Video motion level (high/low, default: high, required for video)",
          high_definition_video:
            "Optional: Use HD video generation (default: false, uses standard definition)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("midjourney_generate", error, {
        prompt:
          "Required: Text prompt describing the desired image (max 2000 chars)",
        taskType:
          "Optional: Task type (mj_txt2img, mj_img2img, mj_style_reference, mj_omni_reference, mj_video, mj_video_hd) - auto-detected if not provided",
        fileUrl:
          "Optional: Single image URL for image-to-image or video generation (legacy)",
        fileUrls:
          "Optional: Array of image URLs for image-to-image or video generation (recommended)",
        speed:
          "Optional: Generation speed (relaxed/fast/turbo) - not required for video/omni tasks",
        aspectRatio:
          "Optional: Output aspect ratio (1:2, 9:16, 2:3, 3:4, 5:6, 6:5, 4:3, 3:2, 1:1, 16:9, 2:1, default: 16:9)",
        version:
          "Optional: Midjourney model version (7, 6.1, 6, 5.2, 5.1, niji6, default: 7)",
        variety: "Optional: Diversity control (0-100, increment by 5)",
        stylization:
          "Optional: Artistic style intensity (0-1000, suggested multiple of 50)",
        weirdness:
          "Optional: Creativity level (0-3000, suggested multiple of 100)",
        ow: "Optional: Omni intensity for omni reference tasks (1-1000)",
        waterMark: "Optional: Watermark identifier (max 100 chars)",
        enableTranslation:
          "Optional: Auto-translate non-English prompts (default: false)",
        videoBatchSize:
          "Optional: Number of videos to generate (1/2/4, default: 1, video mode only)",
        motion:
          "Optional: Video motion level (high/low, default: high, required for video)",
        high_definition_video:
          "Optional: Use HD video generation (default: false, uses standard definition)",
        callBackUrl:
          "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
      });
    }
  }

  private async handleGptImage2(args: any) {
    try {
      const request = GptImage2Schema.parse(args);
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateGptImage2(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode = request.input_urls?.length
          ? "Image-to-Image"
          : "Text-to-Image";

        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "gpt-image-2",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `GPT Image 2 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspect_ratio || "auto",
                    resolution: request.resolution || "1K",
                    ...(request.input_urls && {
                      input_urls: request.input_urls,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create GPT Image 2 task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("gpt_image_2", error, {
          prompt:
            "Required: Text prompt describing the desired image (max 20000 chars)",
          input_urls:
            "Optional: Array of up to 16 image URLs for image-to-image mode",
          aspect_ratio:
            "Optional: auto, 1:1, 9:16, 16:9, 4:3, 3:4 (default: auto)",
          resolution: "Optional: 1K, 2K, 4K (default: 1K)",
        });
      }
      return this.formatError("gpt_image_2", error, {
        prompt:
          "Required: Text prompt describing the desired image (max 20000 chars)",
        input_urls:
          "Optional: Array of up to 16 image URLs for image-to-image mode",
        aspect_ratio:
          "Optional: auto, 1:1, 9:16, 16:9, 4:3, 3:4 (default: auto)",
        resolution: "Optional: 1K, 2K, 4K (default: 1K)",
      });
    }
  }

  private async handleHappyHorseVideo(args: any) {
    try {
      const request = HappyHorseVideoSchema.parse(args);
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateHappyHorseVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode =
          request.mode ||
          (request.video_url
            ? "video-edit"
            : request.reference_image?.length
              ? "reference-to-video"
              : request.image_urls?.length
                ? "image-to-video"
                : "text-to-video");

        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "happyhorse-video",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `HappyHorse 1.0 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    resolution: request.resolution || "1080p",
                    aspect_ratio: request.aspect_ratio || "16:9",
                    duration: request.duration || 5,
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Video will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create HappyHorse task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("happyhorse_video", error, {
          prompt: "Required: Text prompt for video generation (max 5000 chars)",
          mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
          image_urls: "I2V: Single image URL",
          reference_image: "R2V: Up to 9 reference image URLs",
          video_url: "Video Edit: Video URL to edit",
        });
      }
      return this.formatError("happyhorse_video", error, {
        prompt: "Required: Text prompt for video generation (max 5000 chars)",
        mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
      });
    }
  }

  private async handleFluxKontextImage(args: any) {
    try {
      const request = FluxKontextImageSchema.parse(args);

      // Determine mode based on presence of inputImage
      const hasInputImage = !!request.inputImage;
      const modeDisplay = hasInputImage
        ? "Image Editing"
        : "Text-to-Image Generation";

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateFluxKontextImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "flux-kontext-image",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `Flux Kontext ${modeDisplay} task created successfully`,
                  parameters: {
                    mode: modeDisplay,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    aspect_ratio: request.aspectRatio || "16:9",
                    output_format: request.outputFormat || "jpeg",
                    model: request.model || "flux-kontext-pro",
                    enable_translation: request.enableTranslation !== false,
                    prompt_upsampling: request.promptUpsampling || false,
                    safety_tolerance: request.safetyTolerance || 2,
                    upload_cn: request.uploadCn || false,
                    ...(hasInputImage && {
                      input_image: request.inputImage,
                    }),
                    ...(request.watermark && {
                      watermark: request.watermark,
                    }),
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Generated images will be available when status is "completed"',
                    hasInputImage
                      ? "Image editing typically takes 1-3 minutes depending on complexity"
                      : "Image generation typically takes 30-60 seconds depending on complexity",
                  ],
                  usage_examples: [
                    `get_task_status: {"task_id": "${response.data.taskId}"}`,
                    `list_tasks: {"limit": 10}`,
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create Flux Kontext image task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("flux_kontext_image", error, {
          prompt:
            "Required: Text prompt describing the desired image or edit (max 5000 chars, English recommended)",
          inputImage:
            "Optional: Input image URL for editing mode (required for image editing)",
          aspectRatio:
            "Optional: Output aspect ratio (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, default: 16:9)",
          outputFormat: "Optional: Output format (jpeg, png, default: jpeg)",
          model:
            "Optional: Model version (flux-kontext-pro, flux-kontext-max, default: flux-kontext-pro)",
          enableTranslation:
            "Optional: Auto-translate non-English prompts (default: true)",
          promptUpsampling:
            "Optional: Enable prompt enhancement (default: false)",
          safetyTolerance:
            "Optional: Content moderation level (0-6 for generation, 0-2 for editing, default: 2)",
          uploadCn:
            "Optional: Route uploads via China servers (default: false)",
          watermark: "Optional: Watermark identifier to add to generated image",
          callBackUrl: "Optional: Webhook URL for completion notifications",
        });
      }

      return this.formatError("flux_kontext_image", error, {
        prompt:
          "Required: Text prompt describing the desired image or edit (max 5000 chars, English recommended)",
        inputImage:
          "Optional: Input image URL for editing mode (required for image editing)",
        aspectRatio:
          "Optional: Output aspect ratio (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, default: 16:9)",
        outputFormat: "Optional: Output format (jpeg, png, default: jpeg)",
        model:
          "Optional: Model version (flux-kontext-pro, flux-kontext-max, default: flux-kontext-pro)",
        enableTranslation:
          "Optional: Auto-translate non-English prompts (default: true)",
        promptUpsampling:
          "Optional: Enable prompt enhancement (default: false)",
        safetyTolerance:
          "Optional: Content moderation level (0-6 for generation, 0-2 for editing, default: 2)",
        uploadCn: "Optional: Route uploads via China servers (default: false)",
        watermark: "Optional: Watermark identifier to add to generated image",
        callBackUrl: "Optional: Webhook URL for completion notifications",
      });
    }
  }

  private async handleRunwayAlephVideo(args: any) {
    try {
      const request = RunwayAlephVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateRunwayAlephVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "runway-aleph-video",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message:
                    "Runway Aleph video-to-video transformation task created successfully",
                  parameters: {
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    video_url: request.videoUrl,
                    aspect_ratio: request.aspectRatio || "16:9",
                    water_mark: request.waterMark || "",
                    upload_cn: request.uploadCn || false,
                    ...(request.seed !== undefined && { seed: request.seed }),
                    ...(request.referenceImage && {
                      reference_image: request.referenceImage,
                    }),
                  },
                  next_steps: [
                    "Use get_task_status to check transformation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Video-to-video transformation typically takes 3-8 minutes depending on complexity and length",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg ||
            "Failed to create Runway Aleph video transformation task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("runway_aleph_video", error, {
          prompt:
            "Required: Text prompt describing desired video transformation (max 1000 characters)",
          videoUrl: "Required: URL of the input video to transform",
          waterMark:
            "Optional: Watermark text to add to the video (max 100 characters)",
          uploadCn:
            "Optional: Whether to upload to China servers (default: false)",
          aspectRatio: "Optional: Output video aspect ratio (default: 16:9)",
          seed: "Optional: Random seed for reproducible results (1-999999)",
          referenceImage: "Optional: URL of reference image for style guidance",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("runway_aleph_video", error, {
        prompt: "Required: Text prompt for video transformation",
        videoUrl: "Required: URL of input video",
        aspectRatio: "Optional: Output video aspect ratio",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleWanVideo(args: any) {
    try {
      const request = Wan27VideoSchema.parse(args);
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateWanVideo(request);

      if (response.code === 200 && response.data?.taskId) {
        const mode =
          request.mode ||
          (request.video_url_edit
            ? "video-edit"
            : request.reference_image?.length || request.reference_video?.length
              ? "reference-to-video"
              : request.first_frame_url ||
                  request.last_frame_url ||
                  request.first_clip_url
                ? "image-to-video"
                : "text-to-video");

        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "wan-video",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: `Wan 2.7 ${mode} task created successfully`,
                  parameters: {
                    mode,
                    prompt:
                      request.prompt.substring(0, 100) +
                      (request.prompt.length > 100 ? "..." : ""),
                    resolution: request.resolution || "1080p",
                    ratio: request.ratio || "16:9",
                    duration: request.duration || 5,
                  },
                  next_steps: [
                    `Use get_task_status with task_id: ${response.data.taskId} to check progress`,
                    'Video will be available when status is "completed"',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(response.msg || "Failed to create Wan 2.7 video task");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("wan_video", error, {
          prompt: "Required: Text prompt for video generation (max 5000 chars)",
          mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
          first_frame_url: "I2V: First frame image URL",
          last_frame_url: "I2V: Last frame image URL",
          reference_image: "R2V: Up to 5 reference image URLs",
          video_url_edit: "Video Edit: Video URL to edit",
        });
      }
      return this.formatError("wan_video", error, {
        prompt: "Required: Text prompt for video generation",
        mode: "Optional: text-to-video, image-to-video, reference-to-video, video-edit",
      });
    }
  }

  private async handleTopazUpscaleImage(args: any) {
    try {
      const request = TopazUpscaleImageSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateTopazUpscaleImage(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "topaz-upscale",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: "Topaz Image Upscale task created successfully",
                  parameters: {
                    image_url: request.image_url,
                    upscale_factor: request.upscale_factor,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Upscaling typically takes 30-90 seconds depending on image size and upscale factor",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create Topaz Image Upscale task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("topaz_upscale_image", error, {
          image_url:
            "Required: URL of image to upscale (JPEG, PNG, WEBP, max 10MB)",
          upscale_factor:
            'Optional: Upscale factor "1", "2" (default), "4", or "8". Max output dimension is 20,000px.',
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("topaz_upscale_image", error, {
        image_url: "Required: URL of image to upscale",
        upscale_factor: 'Optional: Upscale factor "1", "2", "4", or "8"',
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleRecraftRemoveBackground(args: any) {
    try {
      const request = RecraftRemoveBackgroundSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response =
        await this.client.generateRecraftRemoveBackground(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "recraft-remove-background",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message:
                    "Recraft Remove Background task created successfully",
                  parameters: {
                    image: request.image,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Background removal typically takes 30-60 seconds depending on image complexity",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create Recraft Remove Background task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("recraft_remove_background", error, {
          image:
            "Required: URL of image to remove background from (PNG, JPG, WEBP, max 5MB, 16MP, 4096px max, 256px min)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("recraft_remove_background", error, {
        image: "Required: URL of image to remove background from",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleIdeogramReframe(args: any) {
    try {
      const request = IdeogramReframeSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateIdeogramReframe(request);

      if (response.code === 200 && response.data?.taskId) {
        // Store task in database
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "ideogram-reframe",
          status: "pending",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  task_id: response.data.taskId,
                  message: "Ideogram V3 Reframe task created successfully",
                  parameters: {
                    image_url: request.image_url,
                    image_size: request.image_size,
                    rendering_speed: request.rendering_speed,
                    style: request.style,
                    num_images: request.num_images,
                    seed: request.seed,
                    callBackUrl: request.callBackUrl,
                  },
                  next_steps: [
                    "Use get_task_status to check generation progress",
                    "Task completion will be sent to the provided callback URL",
                    "Image reframing typically takes 30-120 seconds depending on complexity and settings",
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      } else {
        throw new Error(
          response.msg || "Failed to create Ideogram V3 Reframe task",
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("ideogram_reframe", error, {
          image_url:
            "Required: URL of image to reframe (JPEG, PNG, WEBP, max 10MB)",
          image_size:
            "Required: Output size (square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9)",
          rendering_speed:
            "Optional: Rendering speed (TURBO, BALANCED, QUALITY) - default: BALANCED",
          style:
            "Optional: Style type (AUTO, GENERAL, REALISTIC, DESIGN) - default: AUTO",
          num_images: "Optional: Number of images (1, 2, 3, 4) - default: 1",
          seed: "Optional: Seed for reproducible results (default: 0)",
          callBackUrl:
            "Optional: URL for task completion notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("ideogram_reframe", error, {
        image_url: "Required: URL of image to reframe",
        image_size: "Required: Output size for the reframed image",
        rendering_speed: "Optional: Rendering speed preference",
        style: "Optional: Style type for generation",
        num_images: "Optional: Number of images to generate",
        seed: "Optional: Seed for reproducible results",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleKlingVideo(args: any) {
    try {
      const request = KlingVideoSchema.parse(args);

      // Use intelligent callback URL fallback
      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateKlingVideo(request);

      // Determine mode description
      const hasImages = !!request.image_urls && request.image_urls.length > 0;
      const modeDescription = request.multi_shots
        ? "Kling 3.0 multi-shot"
        : hasImages
          ? "Kling 3.0 image-to-video"
          : "Kling 3.0 text-to-video";

      if (response.data?.taskId) {
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "kling-3.0-video",
          status: "pending",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                mode: modeDescription,
                message: `Kling 3.0 video generation task created successfully (${modeDescription})`,
                parameters: {
                  prompt: request.prompt,
                  duration: request.duration || "5",
                  aspect_ratio: request.aspect_ratio || "16:9",
                  mode: request.mode || "std",
                  sound: request.sound ?? false,
                  multi_shots: request.multi_shots ?? false,
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Video generation typically takes 1-5 minutes depending on duration and complexity",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("kling_video", error, {
          prompt: "Required: video description (max 5000 chars)",
          image_urls: "Optional: up to 2 image URLs (start frame, end frame)",
          duration: 'Optional: video duration "3"-"15" (default: "5")',
          aspect_ratio:
            'Optional: aspect ratio "16:9", "9:16", or "1:1" (default: "16:9")',
          mode: 'Optional: "std" or "pro" (default: "std")',
          sound: "Optional: enable native audio (default: false)",
          multi_shots:
            "Optional: enable multi-shot mode (requires multi_prompt)",
          multi_prompt:
            "Optional: array of {prompt, duration} for multi-shot scenes",
          kling_elements:
            "Optional: character/object elements for identity consistency",
          callBackUrl:
            "Optional: callback URL (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("kling_video", error, {
        prompt: "Required: text description for video generation",
        image_urls: "Optional: up to 2 image URLs for image-to-video",
        duration: "Optional: video duration 3-15 seconds",
        aspect_ratio: "Optional: aspect ratio (16:9, 9:16, 1:1)",
        mode: "Optional: quality mode (std or pro)",
        sound: "Optional: enable native audio generation",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleHailuoVideo(args: any) {
    try {
      const request = HailuoVideoSchema.parse(args);

      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateHailuoVideo(request);

      const version = request.version || "02";
      let modeDescription: string;
      if (request.imageUrl) {
        modeDescription = `v${version} image-to-video (${request.quality || "standard"} quality)`;
      } else {
        modeDescription = `v${version} text-to-video (${request.quality || "standard"} quality)`;
      }

      if (response.data?.taskId) {
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "hailuo",
          status: "pending",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                mode: modeDescription,
                message: `Hailuo ${modeDescription} task created successfully`,
                parameters: {
                  version,
                  prompt: request.prompt,
                  imageUrl: request.imageUrl,
                  endImageUrl: request.endImageUrl,
                  quality: request.quality || "standard",
                  duration: request.duration || "6",
                  resolution: request.resolution || "768P",
                  promptOptimizer: request.promptOptimizer !== false,
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Video generation typically takes 1-3 minutes for standard, 3-5 minutes for pro quality",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("hailuo_video", error, {
          prompt: "Required: video description (max 1500 chars)",
          imageUrl: "Optional: image URL for image-to-video mode",
          endImageUrl:
            "Optional: end frame image URL for image-to-video (requires imageUrl)",
          version:
            'Optional: model version "02" (default) or "2.3" (enhanced motion)',
          quality: 'Optional: quality level "standard" (default) or "pro"',
          duration:
            'Optional: video duration "6" (default) or "10" (10s not supported with 1080P in v2.3)',
          resolution:
            'Optional: resolution "512P"/"768P" for v02, "768P"/"1080P" for v2.3',
          promptOptimizer:
            "Optional: enable prompt optimization (default: true)",
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("hailuo_video", error, {
        prompt: "Required: text description for video generation",
        imageUrl: "Optional: image URL for image-to-video mode",
        endImageUrl: "Optional: end frame image for image-to-video",
        quality: "Optional: quality level (standard or pro)",
        duration:
          "Optional: video duration in seconds (6 or 10 for standard only)",
        resolution:
          "Optional: video resolution (512P or 768P for standard only)",
        promptOptimizer: "Optional: enable prompt optimization",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleFlux2Image(args: any) {
    try {
      const request = Flux2ImageSchema.parse(args);

      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateFlux2Image(request);

      const hasInputUrls =
        !!request.input_urls && request.input_urls.length > 0;
      const modelType = request.model_type || "pro";
      const modeDescription = hasInputUrls
        ? `image-to-image (${modelType})`
        : `text-to-image (${modelType})`;

      if (response.data?.taskId) {
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "flux2-image",
          status: "pending",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                mode: modeDescription,
                message: `Flux 2 image generation task created successfully (${modeDescription})`,
                parameters: {
                  prompt: request.prompt,
                  input_urls: request.input_urls,
                  aspect_ratio: request.aspect_ratio || "1:1",
                  resolution: request.resolution || "1K",
                  model_type: modelType,
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Image generation typically takes 10-30 seconds",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("flux2_image", error, {
          prompt:
            "Required: text description of desired image (3-5000 characters)",
          input_urls:
            "Optional: array of reference image URLs for image-to-image mode (1-8 URLs)",
          aspect_ratio:
            'Optional: aspect ratio (1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, auto). Default: 1:1. "auto" only valid with input_urls.',
          resolution:
            "Optional: output resolution (1K or 2K). Default: 1K. Pro: 1K~$0.025, 2K~$0.035. Flex: 1K~$0.07, 2K~$0.12.",
          model_type:
            'Optional: model variant ("pro" for fast results, "flex" for more control). Default: pro.',
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("flux2_image", error, {
        prompt: "Required: text description of desired image",
        input_urls:
          "Optional: reference images for image-to-image mode (1-8 URLs)",
        aspect_ratio: "Optional: aspect ratio (default: 1:1)",
        resolution: "Optional: output resolution (1K or 2K)",
        model_type: "Optional: pro or flex (default: pro)",
        callBackUrl: "Optional: URL for task completion notifications",
      });
    }
  }

  private async handleWanAnimate(args: any) {
    try {
      const request = WanAnimateSchema.parse(args);

      request.callBackUrl = this.getCallbackUrl(request.callBackUrl);

      const response = await this.client.generateWanAnimate(request);

      const modeDescription =
        request.mode === "replace" ? "character replacement" : "animation";

      if (response.data?.taskId) {
        await this.db.createTask({
          task_id: response.data.taskId,
          api_type: "wan-animate",
          status: "pending",
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                task_id: response.data?.taskId,
                mode: modeDescription,
                message: `Wan 2.2 Animate task created successfully (${modeDescription} mode)`,
                parameters: {
                  video_url: request.video_url,
                  image_url: request.image_url,
                  mode: request.mode || "animate",
                  resolution: request.resolution || "480p",
                  callBackUrl: request.callBackUrl,
                },
                next_steps: [
                  "Use get_task_status to check generation progress",
                  "Task completion will be sent to the provided callback URL",
                  "Video generation time depends on input video length",
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.formatError("wan_animate", error, {
          video_url:
            "Required: URL of reference video (MP4, max 10MB, max 30 seconds)",
          image_url:
            "Required: URL of character image (JPEG/PNG/WEBP, max 10MB)",
          mode: 'Optional: "animate" (default) or "replace"',
          resolution:
            'Optional: "480p" (default, ~$0.03/sec), "580p" (~$0.0475/sec), or "720p" (~$0.0625/sec)',
          callBackUrl:
            "Optional: callback URL for notifications (uses KIE_AI_CALLBACK_URL env var if not provided)",
        });
      }

      return this.formatError("wan_animate", error, {
        video_url: "Required: URL of reference video",
        image_url: "Required: URL of character image",
        mode: "Optional: animate or replace",
        resolution: "Optional: 480p, 580p, or 720p",
        callBackUrl: "Optional: URL for task completion notifications",
      });
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

  private async getAgentInstructions(agentName: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const agentPath = path.join(__dirname, "..", "ai_docs", `${agentName}.md`);

    try {
      return await fs.readFile(agentPath, "utf-8");
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to load agent instructions for ${agentName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getModelDocumentation(modelKey: string): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Map URI keys to file names
    const modelFiles: Record<string, string> = {
      // Image models
      "bytedance-seedream": "bytedance_seedream-v4-text-to-image.md",
      "qwen-image": "qwen_text-to-image.md",
      "flux-kontext": "flux_kontext_image.md",
      "gpt-image-2": "gpt_image-2.md",
      "nano-banana": "google_nano-banana.md",
      "topaz-upscale": "topaz_image-upscale.md",
      "recraft-bg-removal": "recraft_remove_background.md",
      "ideogram-reframe": "ideogram_reframe_image.md",

      // Video models
      veo3: "google_veo3-text-to-image.md",
      "bytedance-seedance": "bytedance_seedance-2.md",
      "wan-video": "wan_2-7-text-to-video.md",
      "happyhorse-video": "happyhorse_text-to-video.md",
      "runway-aleph": "runway_aleph_video.md",
      "kling-v2-1": "kling_v2-1-pro.md",
      "kling-v2-5": "kling_v2-5-turbo-text-to-video-pro.md",
      midjourney: "midjourney_generate.md",
      hailuo: "hailuo_02-text-to-video-pro.md",
    };

    const fileName = modelFiles[modelKey];
    if (!fileName) {
      throw new McpError(ErrorCode.InternalError, `Unknown model: ${modelKey}`);
    }

    const modelPath = path.join(__dirname, "..", "ai_docs", "kie", fileName);

    try {
      return await fs.readFile(modelPath, "utf-8");
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to load model documentation for ${modelKey}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async run(): Promise<void> {
    const mode = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();

    if (mode === "http" || mode === "streamable-http") {
      // Remote mode: Streamable HTTP — for self-hosting (e.g. Coolify).
      // A fresh protocol Server is built per session; KieAiClient + SQLite DB
      // are shared across all sessions via this instance.
      startHttpServer(() => this.buildServer(), {
        port: parseInt(process.env.PORT || "3000"),
        host: process.env.HOST || "0.0.0.0",
        authToken: process.env.MCP_AUTH_TOKEN,
        path: process.env.MCP_HTTP_PATH || "/mcp",
      });
    } else {
      // Local mode: stdio (Claude Desktop, Cursor, npx). Unchanged default.
      const server = this.buildServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("[Kie.ai MCP] Started in stdio mode");
    }
  }
}

// Start the server
const server = new KieAiMcpServer();
server.run().catch(console.error);
