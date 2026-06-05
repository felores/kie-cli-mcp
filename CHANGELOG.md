# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.2] - 2026-06-05

### Changed
- Removed em dashes from all docs and from a few tool description strings
  (`bytedance_seedance_video` and its `mode`/`resolution` hints), so the text
  shown in `kie-cli --help` and MCP `listTools` is clean. No functional changes.
- Rewrote the README: fact-checked against the current code, trimmed marketing
  fluff, and led with the token-efficiency story (load only the tools you need
  via `KIE_AI_ENABLED_TOOLS`; the CLI costs zero context tokens until called).
- Added a Spanish README (`README.es.md`) with a language switcher.

## [3.3.1] - 2026-06-05

### Fixed
- **Task creation now requires `code === 200`.** Six generation tools
  (`kling_video`, `veo3_generate_video`, `nano_banana_image`, `wan_animate`,
  `hailuo_video`, `flux2_image`) persisted a task and returned `success: true`
  whenever the response contained a `taskId`, even when Kie reported an
  application-level failure (HTTP 200 with `code !== 200`). They now only create
  the task and return success when `response.code === 200 && taskId`, otherwise
  they surface the API error message, matching the other 19 tools.
  (Addresses the CodeRabbit review on PR #2; `@felores/kie-cli` → 0.1.1.)

## [3.3.0] - 2026-06-04

### Added
- **Standalone CLI** (`@felores/kie-cli`, binary `kie-cli`): every Kie.ai model is
  now usable from the terminal with no MCP client. Commands and flags are
  generated from the same tool registry as the MCP server. Supports `--json` for
  machine-readable output. Installs completely independently of the MCP server.
- **`npm run add-tool <name>`**: scaffolds a new tool file and registers it, so
  adding a model is one file plus a client method. Both the MCP server and the
  CLI pick it up automatically.

### Fixed
- **Resources and prompts now work.** The model-documentation resources (17) and
  the `image`/`video` prompts loaded Markdown from an `ai_docs/` directory that
  did not ship in the package, so `resources/read` and `prompts/get` failed with
  ENOENT for every one of them (pre-existing bug). They are now **generated from
  the tool registry**: each tool exposes a `kie://tools/<name>` resource rendered
  from its schema, and the prompts list the tools for their category. Nothing is
  read from disk, so they can never drift or 404. `resources/read` now succeeds
  for all 33 resources (was 5/22); both prompts return content.

### Changed
- **Monorepo architecture**: the project is now an npm-workspaces monorepo with a
  shared, unpublished `core` package (tool registry, Zod schemas, API client,
  task database) that is bundled into both the MCP server and the CLI at build
  time. One source of truth, two independently installable packages.
- **Tools come from a single registry**: `listTools` and tool dispatch are
  derived from the registry instead of 28 hand-written JSON Schemas and a 6,000+
  line switch. MCP tool names, descriptions and behaviour are unchanged.
- **`inputSchema` is now derived from each tool's Zod schema.** This corrects
  pre-existing drift between the hand-written JSON Schema and the validator. Most
  visible on `midjourney_generate`, whose advertised parameters/enums now match
  what is actually validated (e.g. `speed` accepts `relax`, not `relaxed`).
  Runtime validation behaviour is unchanged.
- **Upgraded `@modelcontextprotocol/sdk` from `^0.4.0` to `^1.29.0`.** Server
  capabilities (`tools`, `resources`, `prompts`) are now declared explicitly, as
  required by the 1.x SDK. Protocol behaviour is unchanged: `tools/list` (28),
  `resources/list` (22) and `prompts/list` (2) all respond as before.

### Notes
- The MCP package keeps its name `@felores/kie-ai-mcp-server` and bin
  `kie-ai-mcp-server`; existing client configurations require no changes.
- Minimum `zod` is now `^3.24.0` (the bundled `zod-to-json-schema` uses the
  `zod/v3` subpath, which older zod releases do not export).

## [3.2.1] - 2026-05-02

### Removed
- **Sora 2** (`sora_video`): Removed following OpenAI deprecation. All Sora 2 endpoints (text-to-video, image-to-video, storyboard, characters, watermark remover) are no longer available.

## [3.2.0] - 2026-05-01

### Breaking Changes
- **GPT Image 2**: Replaced `openai_4o_image` tool with `gpt_image_2`
  - Removed: `filesUrl`, `size`, `nVariants`, `maskUrl`, `isEnhance`, `uploadCn`, `enableFallback`, `fallbackModel`
  - Added: `input_urls` (up to 16 reference images), `resolution` (1K/2K/4K), `aspect_ratio` (auto/1:1/9:16/16:9/4:3/3:4)
  - Model IDs: `gpt-image-2-text-to-image` / `gpt-image-2-image-to-image`
  - Now uses Market API (`/jobs/createTask`) instead of legacy `/gpt4o-image/generate`

### Changed
- **Wan 2.5 -> 2.7**: Upgraded `wan_video` tool with 4 modes
  - Added: `mode` parameter (text-to-video, image-to-video, reference-to-video, video-edit)
  - Added: `first_frame_url`, `last_frame_url`, `first_clip_url`, `driving_audio_url` (I2V)
  - Added: `reference_image`, `reference_video`, `reference_voice`, `first_frame` (R2V)
  - Added: `video_url_edit`, `reference_image_edit`, `audio_setting` (video-edit)
  - Added: `ratio` (5 options), `prompt_extend`, `watermark`, `nsfw_checker`
  - Model IDs: `wan/2-7-text-to-video`, `wan/2-7-image-to-video`, `wan/2-7-r2v`, `wan/2-7-videoedit`

### Added
- **HappyHorse 1.0** (`happyhorse_video`): New video tool with 4 modes
  - text-to-video, image-to-video (1 image), reference-to-video (up to 9 images), video-edit
  - Supports 720p/1080p, 5 aspect ratios, 3-15s duration, native audio
  - Model IDs: `happyhorse/text-to-video`, `happyhorse/image-to-video`, `happyhorse/reference-to-video`, `happyhorse/video-edit`

## [3.1.0] - 2026-04-16

### Breaking Changes
- **Seedance 2.0**: Upgraded from Seedance v1 (lite/pro) to Seedance 2.0
  - Removed: `quality`, `image_url`, `end_image_url`, `camera_fixed`, `seed`, `enable_safety_checker` parameters
  - Renamed: `image_url` → `first_frame_url`, `end_image_url` → `last_frame_url`
  - Changed: `duration` from string (2-12s) to integer (4-15s)
  - Changed: `resolution` now supports 480p/720p only (removed 1080p)
  - Model IDs changed: `bytedance/v1-{lite,pro}-{text,image}-to-video` → `bytedance/seedance-2` / `bytedance/seedance-2-fast`

### Added
- `mode` parameter: `"standard"` (seedance-2) or `"fast"` (seedance-2-fast)
- `reference_image_urls`: Up to 9 reference images for style/subject guidance
- `reference_video_urls`: Up to 3 reference videos for motion/style guidance
- `reference_audio_urls`: Up to 3 reference audio clips for sound-guided generation
- `generate_audio`: Native audio generation (default: true)
- `web_search`: Web search for prompt enhancement (default: false)
- `nsfw_checker`: Content filtering (default: false)
- `adaptive` aspect ratio: Automatically matches input frame dimensions
- Prompt length expanded: 3-20000 characters (was 1-10000)

## [3.0.1] - 2026-03-04

### Added
- **Topaz Image Upscale**: New `topaz_upscale_image` tool for AI-powered image enhancement and upscaling
  - Supports 1x, 2x, 4x, and 8x upscale factors
  - High-fidelity detail restoration and natural texture reconstruction
  - Max output dimension: 20,000 pixels per side
  - Pricing: 10 credits (≤2K), 20 credits (4K), 40 credits (8K)
  - Model ID: `topaz/image-upscale`

## [3.0.0] - 2026-02-28

### Breaking Changes
- **Nano Banana 2**: Upgraded from Gemini 3.0 Pro Image (Nano Banana Pro) to Gemini 3.1 Flash Image (Nano Banana 2)
  - Removed: `image` (upscale), `scale`, `face_enhance` parameters - upscale mode removed
  - Renamed: `image_urls` → `image_input` (now supports up to 14 images, was 8)
  - Added: `google_search` parameter for Google Search grounding
  - Added aspect ratios: `1:4`, `1:8`, `4:1`, `8:1`
  - Model ID changed: `nano-banana-pro` → `nano-banana-2`
  - Pricing: 8 credits/1K, 12/2K, 18/4K

- **Seedream 5.0 Lite**: Upgraded from Seedream V4.5 to V5 Lite as default version
  - Version enum changed: `["4", "4.5"]` → `["4", "5-lite"]`, default `"5-lite"`
  - V5 Lite quality: basic = 2K, high = 3K (was 4K for V4.5)
  - Model IDs: `seedream/5-lite-text-to-image`, `seedream/5-lite-image-to-image`

- **Kling 3.0**: Complete upgrade from v2.5/v2.6/v2.1-pro to Kling 3.0
  - Removed: `image_url`, `tail_image_url`, `negative_prompt`, `cfg_scale`, `version` parameters
  - Added: `image_urls` (array, up to 2 for start/end frames)
  - Added: `mode` (`std`/`pro`) for quality selection
  - Added: `multi_shots` + `multi_prompt` for cinematic multi-shot storytelling
  - Added: `kling_elements` for character/object identity consistency
  - Duration changed: fixed `["5", "10"]` → flexible `3-15` seconds
  - Single model endpoint: `kling-3.0/video`
  - Native multilingual audio via `sound` parameter

- **TaskRecord api_type**: Removed `nano-banana-upscale`, `kling-v2-1-pro`, `kling-v2-5-turbo-text-to-video`, `kling-v2-5-turbo-image-to-video`. Added `kling-3.0-video`

## [2.0.10] - 2025-01-05

### Fixed
- **Nano Banana Pro model name**: Fixed incorrect model identifier from `google/nano-banana-pro` to `nano-banana-pro` - this was causing 422 "model not supported" errors

## [2.0.9] - 2025-12-27

### Added
- **Z-Image Tool**: New `z_image` tool for Tongyi-MAI fast text-to-image
  - Ultra-fast Turbo performance
  - Accurate bilingual text rendering (Chinese/English)
  - Strong semantic understanding
  - Aspect ratios: 1:1, 4:3, 3:4, 16:9, 9:16
  - Pricing: ~$0.004/image (0.8 credits)

- **Grok Imagine Tool**: New `grok_imagine` tool for xAI multimodal generation
  - 4 modes: text-to-image, text-to-video, image-to-video, upscale
  - Smart mode auto-detection based on parameters
  - Style modes: fun, normal, spicy
  - Aspect ratios: 2:3, 3:2, 1:1
  - Pricing: ~$0.02/image, ~$0.10/6s video

- **InfiniTalk Lip-Sync Tool**: New `infinitalk_lip_sync` tool for MeiGen-AI
  - Transforms portrait image + audio into talking avatar
  - Synchronized lips, facial expressions, head movements
  - Resolutions: 480p, 720p
  - Max duration: 15 seconds
  - Pricing: ~$0.015/s (480p), ~$0.06/s (720p)

- **Kling Avatar Tool**: New `kling_avatar` tool for Kuaishou talking avatars
  - Lifelike talking avatars from photo + audio
  - Accurate lip-sync, emotions, identity preservation
  - Quality levels: standard (720P), pro (1080P)
  - Max duration: 15 seconds
  - Pricing: ~$0.04/s (standard), ~$0.08/s (pro)

### Enhanced
- **Hailuo 2.3 Support**: Updated `hailuo_video` tool with version selection
  - Added `version` parameter: "02" (original) or "2.3" (enhanced)
  - Hailuo 2.3: Better motion, facial expressions, 1080P support
  - Updated resolution options: 768P/1080P for v2.3, 512P/768P for v02
  - 10s duration not supported with 1080P in v2.3
  - Maintains full backward compatibility

## [2.0.8] - 2025-12-08

### Enhanced
- **Kling 2.6 Native Audio Support**: Updated `kling_video` tool with Kling 2.6 models
  - Added `version` parameter: "2.5" (default) or "2.6" for native audio
  - Added `sound` parameter: Enable synchronized speech, sound effects, and ambient audio
  - Text-to-video and image-to-video modes with audio
  - Pricing: ~$0.28 (5s no-audio), ~$0.55 (5s with audio), 2x credits for audio
  - Maintains full backward compatibility with v2.1-pro and v2.5-turbo

- **Seedream 4.5 with 4K Output**: Updated `bytedance_seedream_image` tool
  - Added `version` parameter: "4" (default) or "4.5" for 4K support
  - Added `quality` parameter: "basic" (2K) or "high" (4K resolution)
  - Added `aspect_ratio` parameter for V4.5: 1:1, 4:3, 3:4, 16:9, 9:16, 2:3, 3:2, 21:9
  - Enhanced detail fidelity and aesthetic cohesion
  - Multi-image fusion with up to 14 reference images (V4.5)
  - Clear small-text and facial rendering
  - Pricing: ~$0.032 per image
  - Maintains full backward compatibility with V4

## [2.0.7] - 2025-12-06

### Added
- **Wan 2.2 Animate**: New `wan_animate` tool from Alibaba Tongyi Lab
  - Animation mode: Transfer motion/expressions from video to static image
  - Character replacement mode: Swap characters in video while preserving lighting/tone
  - Preserves original video audio
  - Resolutions: 480p (~$0.03/sec), 580p (~$0.0475/sec), 720p (~$0.0625/sec)
  - Max video length: 30 seconds

## [2.0.6] - 2025-12-06

### Added
- **Flux-2 Image Generation**: New `flux2_image` tool from Black Forest Labs
  - Text-to-image and image-to-image modes with smart detection
  - Pro (fast) and Flex (more control) model variants
  - Multi-reference consistency with up to 8 input images
  - Photoreal detail, accurate text rendering
  - Aspect ratios: 1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, auto
  - Resolutions: 1K (~$0.025-$0.07), 2K (~$0.035-$0.12)

## [2.0.5] - 2025-12-06

### Changed
- **Nano Banana Pro Upgrade**: Updated `nano_banana_image` to use Gemini 3.0 Pro Image model
  - Added `resolution` parameter (1K, 2K, 4K)
  - Renamed `image_size` to `aspect_ratio`
  - Changed max reference images from 10 to 8
  - Changed `output_format` from "jpeg" to "jpg"

## [2.0.4] - 2025-10-22

### Added
- **Intelligent Polling Strategy**: Enhanced `get_task_status` tool with self-documenting polling guidance
- **Task Type Detection**: Automatic classification of tasks into image/video/audio with optimal polling intervals
- **Dynamic Polling Intervals**: 
  - Image tasks: 15 seconds (3-minute max wait)
  - Video tasks: 45 seconds (10-minute max wait)
  - Audio tasks: 20 seconds (4-minute max wait)
- **Status-Aware Instructions**: Contextual guidance based on current task status (continue_polling/task_complete/task_failed)
- **Self-Documenting Responses**: Every `get_task_status` response includes `polling_strategy` object with timing and next steps

### Enhanced
- **Client Experience**: Eliminates need for hardcoded polling intervals in MCP clients
- **API Efficiency**: Reduces unnecessary API calls through intelligent timing recommendations
- **Comprehensive Model Coverage**: Supports all 21 AI models with appropriate polling strategies

## [2.0.3] - 2025-10-22

### Fixed
- **Automatic Generation Loop**: Resolved issue where MCP server resources and prompts were causing automatic tool execution in clients
- **Removed Auto-Triggering Content**: Eliminated imperative commands and decision trees from agent instruction files that could be interpreted as execution instructions
- **Safe Documentation Format**: Converted from instructional format to reference documentation format

### Changed
- **Renamed Agent Files**: 
  - `artist.md` → `image.md` 
  - `filmographer.md` → `video.md`
- **Updated Prompt Names**: 
  - "artist" prompt → "image" prompt
  - "filmographer" prompt → "video" prompt
- **Removed Agent Resources**: Agent instructions are no longer exposed as automatically-loaded resources, only available as explicit prompts
- **Cleaned Frontmatter**: Removed `mode` property from documentation files to prevent client interpretation

### Improved
- **Safer MCP Integration**: Documentation now informs users without triggering automatic execution
- **Better User Experience**: Clear separation between reference documentation and executable tools
- **Maintained Functionality**: All essential information preserved in safe, descriptive format

## [2.0.1] - 2025-10-22
## [2.0.2] - 2025-10-22

### Added
- **Tool Filtering Feature**: Optional environment variable-based tool filtering to reduce cognitive load
  - **Whitelist Mode**: `KIE_AI_ENABLED_TOOLS` - Enable only specific tools (highest priority)
  - **Category Filter**: `KIE_AI_TOOL_CATEGORIES` - Enable tools by category (image, video, audio)
  - **Blacklist Mode**: `KIE_AI_DISABLED_TOOLS` - Disable specific tools (lowest priority)
  - **Priority Logic**: ENABLED_TOOLS > TOOL_CATEGORIES > DISABLED_TOOLS > All tools (default)
  - **Tool Categories**: 
    - `image` (8 tools): nano_banana, seedream, qwen, openai_4o, flux, recraft, ideogram, midjourney*
    - `video` (9 tools): veo3, veo3_1080p, sora, seedance, wan, hailuo, kling, runway, midjourney*
    - `audio` (3 tools): suno, elevenlabs_tts, elevenlabs_ttsfx
    - `utility` (2 tools): list_tasks, get_task_status ⭐ **Always enabled**
  - **Multi-category tools**: midjourney appears in both image and video (supports both modalities)

  - **Smart Defaults**: Utility tools (list_tasks, get_task_status) are always enabled for server monitoring
  - **Protection**: Utility tools cannot be disabled - warning shown if attempted in blacklist mode
  - **Auto-inclusion**: Utility tools automatically added in whitelist and category modes
  - **Error Handling**: Clear error messages when disabled tools are accessed
  - **Validation**: Server startup validation for invalid tool names and categories

### Documentation
- Added tool filtering section to README.md with examples and use cases
- Updated .env.example with tool filtering environment variables
- Added server logs showing enabled tool count on startup
- Documented utility tools always-on behavior and rationale

### Technical
- Added static `TOOL_CATEGORIES` and `ALL_TOOLS` constants to KieAiMcpServer class
- Added `enabledTools: Set<string>` property initialized in constructor
- Added validation methods: `validateToolNames()`, `validateCategories()`, `getEnabledTools()`
- Modified ListToolsRequestSchema handler to filter tools based on enabled set
- Modified CallToolRequestSchema handler to validate tool access before execution
- Implemented utility tools protection logic in all filtering modes
- 100% backwards compatible - no env vars = all 21 tools enabled (default behavior)

### Documentation
- **Major README Restructuring**: Reduced README from 2238 to 505 lines (77% reduction)
  - Created `docs/` directory for organized documentation
  - **docs/TOOLS.md** (~1334 lines): Complete reference for all 21 AI tools with examples and API endpoints
  - **docs/DATABASE.md** (220 lines): SQLite database schema, task lifecycle, and management best practices
  - **docs/ADMIN.md** (260 lines): Administrator configuration guide with Docker, Kubernetes, and Systemd examples
  - **docs/INTELLIGENCE.md** (310 lines): Intelligent intention detection system with real-world examples
  - Added collapsible `<details>` sections for optional content in README
  - Added documentation links at top of README for quick navigation
  - Preserved all critical information while improving organization and readability

### Fixed
- **Model Documentation Mappings**: Fixed resource URI mappings in `src/index.ts`
  - Corrected Veo3 documentation URI (was pointing to wrong file)
  - Added 7 new video model documentation resources (Sora 2, Hailuo, Kling variants)
  - Fixed typo: renamed `bytedamce_seedream-v4-edit.md` → `bytedance_seedream-v4-edit.md`
- **Agent Documentation Updates**:
  - **artist.md**: Fixed Nano Banana upscaling information (was incorrectly marked as unavailable, now correctly shows 1x-4x support)
  - **artist.md**: Added missing decision tree entries for new image models
  - **filmographer.md**: Added Sora 2, Hailuo 02, and Kling v2.5-turbo to capabilities matrix
  - Updated all agent capability matrices to reflect current model support

### Notes
- MCP resources and prompts continue to work unchanged, loading from `ai_docs/` directory
- All prompts (`/artist`, `/filmographer`) now load the corrected agent instructions
- Build and type checking pass without errors

## [2.0.0] - 2025-10-20

### Added
- **Sora 2 Video Tool**: New unified `sora_video` tool for OpenAI's Sora 2 video generation
  - **5-in-1 Unified Interface**: Single tool handles all Sora 2 endpoints with smart mode detection
  - **Text-to-Video Mode**: Generate videos from text prompts with standard/high quality tiers
  - **Image-to-Video Mode**: Create videos from text + images with intelligent motion synthesis
  - **Storyboard Mode**: Generate videos from images only (no prompt required) - unique Sora capability
  - **Quality Tiers**: `standard` (480p) and `high` (1080p) with automatic endpoint routing
  - **Flexible Duration**: `n_frames` parameter supports 10s, 15s, and 25s video lengths at 5fps
  - **Aspect Ratio Control**: Portrait and landscape orientations for different use cases
  - **Watermark Control**: Optional watermark removal for clean output
  - **Smart Parameter Detection**: Automatically routes to correct Sora 2 endpoint based on input combination

### Models Added
- `openai/sora-2-text-to-video` - Standard quality text-to-video
- `openai/sora-2-pro-text-to-video` - High quality text-to-video  
- `openai/sora-2-image-to-video` - Standard quality image-to-video
- `openai/sora-2-pro-image-to-video` - High quality image-to-video
- `openai/sora-2-storyboard` - Images-only video generation

### Integration
- **Filmographer Agent Updated**: Added Sora 2 to decision tree and capabilities matrix
- **Database Support**: Added `sora-video` api_type for task tracking and status polling
- **Parameter Validation**: Comprehensive Zod schema with mode-specific validation rules
- **Error Handling**: Detailed error messages for invalid parameter combinations
- **Documentation**: Complete parameter reference and usage examples in filmographer.md

### Changed
- **Tool Count**: Increased from 20 to 21 unified tools
- **Video Tools**: Expanded from 7 to 8 with Sora 2 addition
- **Package Description**: Updated to reflect 21 AI tools including Sora 2
- **Version**: Major version bump to 2.0.0 for significant new AI model capability

### Technical
- **Smart Mode Detection Logic**: 
  - `prompt` only → Text-to-video mode
  - `prompt` + `image_urls` → Image-to-video mode  
  - `image_urls` only → Storyboard mode
- **Endpoint Routing**: Automatic selection between standard/pro endpoints based on `size` parameter
- **Callback Support**: Full integration with existing callback URL infrastructure
- **Task Management**: Complete integration with database task tracking system

## [1.9.9] - 2025-10-17

### Added
- **Hailuo Video Tool**: New unified `hailuo_video` tool for professional video generation
  - Text-to-video and image-to-video modes with automatic smart mode detection
  - Quality levels: `standard` (default, faster) and `pro` (higher quality)
  - Standard quality supports configurable duration (6/10s) and resolution (512P/768P)
  - Pro quality optimized for maximum visual fidelity without resolution/duration constraints
  - Optional end frame reference for smooth video transitions in image-to-video mode
  - Integrated with task database for status tracking and persistence
  - Full prompt optimization support for better results

### Changed
- Updated tool count from 19 to 20 unified tools
- Video tools increased from 6 to 7 with Hailuo addition

## [1.9.8] - 2025-10-17

### Added
- **Zero-Configuration Callback URLs**: Callback URLs are now optional for all tools
  - Users only need `KIE_AI_API_KEY` to get started - no callback URL setup required
  - Added `KIE_AI_CALLBACK_URL_FALLBACK` environment variable for administrators
  - Hardcoded fallback to `https://proxy.kie.ai/mcp-callback` as ultimate default
  - Maintains backward compatibility with existing `KIE_AI_CALLBACK_URL` setups

### Improved
- **User Experience**: Simplified onboarding with single API key requirement
- **Administrative Control**: Deployments can configure custom fallback callbacks
- **Fallback Chain**: User parameter → KIE_AI_CALLBACK_URL → KIE_AI_CALLBACK_URL_FALLBACK → hardcoded default

### Technical
- Updated all schemas to make `callBackUrl` truly optional at validation level
- Added `getCallbackUrl()` helper method with intelligent fallback resolution
- Extended `KieAiConfig` interface with `callbackUrlFallback` property
- Simplified handler logic across 10+ tools with unified callback resolution

### Changed
- Removed callback URL validation requirements from schemas in `types.ts`
- Updated all tool handlers to use centralized `getCallbackUrl()` method
- Modified configuration initialization to include fallback URL setup

## [1.9.7] - 2025-10-17

### Fixed
- **Database Directory Permissions**: Added intelligent fallback strategy for directory creation
  - When running with `npx -y`, temporary directories may not be writable
  - Now automatically falls back to `~/.kie-ai/tasks.db` if current directory is not writable
  - Eliminates `SQLITE_CANTOPEN` error in restricted environments
  - Logs fallback location for user awareness

### Technical
- Added `resolveDbPath()` method with smart path resolution logic
- Added error handling for `mkdirSync()` failures with graceful fallback
- Added `homedir()` import from OS module for cross-platform home directory detection
- Maintains support for custom `KIE_AI_DB_PATH` environment variable
- Fully backwards compatible - existing installations unaffected

### User Experience
- Works seamlessly with `npx -y` installations in Claude Desktop
- No manual directory creation required in any scenario
- Transparent fallback with informative logging

## [1.9.6] - 2025-10-17

### Fixed
- **Database Directory Creation**: TaskDatabase now automatically creates parent directories if they don't exist
  - Uses `fs.mkdirSync()` with `{ recursive: true }` in constructor
  - Eliminates `SQLITE_CANTOPEN` error when using custom `KIE_AI_DB_PATH`
  - Users no longer need to manually create directories before running the MCP server
  - Fully backwards compatible - existing installations unaffected

### Technical
- Added `path` module import for `dirname()` function
- Added `fs` module import for `mkdirSync()` function
- Updated TaskDatabase constructor to create directory structure before opening database file

### User Experience
- Seamless MCP initialization with zero configuration required for database persistence
- Works out-of-the-box with npx installations in Claude Desktop
- Eliminates early connection failures due to missing directories

## [1.9.5] - 2025-01-16

### Fixed
- **Veo3 API Image Parameters**: Veo3 API actually supports 2 images for image-to-video mode
  - **1 image mode**: Video unfolds around the provided image
  - **2 images mode**: First image serves as start frame, second as end frame (creates transition effect)
  - Updated schema from `max(1)` to `min(1).max(2)` to reflect API capability
  - Enhanced tool documentation to clarify both image modes with examples
  - Updated error messages with mode-specific guidance

- **Missing ai_docs in npm Package**: Agent instruction files were not included in published package
  - Added `ai_docs/` directory to `package.json` files field
  - MCP clients can now load `filmographer.md` and `artist.md` instructions without ENOENT errors
  - All AI documentation files now properly distributed with package

### Technical
- Updated `Veo3GenerateSchema` in types.ts to accept 1-2 images with `.min(1).max(2)`
- Enhanced MCP tool schema with `minItems: 1` and `maxItems: 2` for imageUrls
- Updated tool description to explain both single and dual image modes
- Updated error message guidance for better UX

## [1.9.4] - 2025-01-16

### Added
- **New Kling Video Tool**: Unified MCP tool for high-quality video generation
  - **Three Intelligent Modes**:
    - `kling/v2-1-pro`: Advanced video generation with start and end frame references for precise control
    - `kling/v2-5-turbo-image-to-video-pro`: Fast image-to-video animation
    - `kling/v2-5-turbo-text-to-video-pro`: High-quality text-to-video generation
  - **Smart Mode Detection**: Automatically selects the best model based on parameters
  - **Unified Schema**: Single `kling_video` tool for all three endpoints with automatic routing
  - **Frame Reference Control**: V2.1-pro supports both start and end frame images for controlled transitions
  - **Database Integration**: Tracks all three Kling models with api_type routing for intelligent status polling

### Changed
- **Tool Count Update**: Increased from 18 to 19 unified AI tools
- **Video Tools Expansion**: Added Kling to the video generation family alongside Veo3, ByteDance, Runway, and Wan
- **API Routing**: Updated `getTaskStatus()` to support three new Kling api_types for intelligent endpoint routing
- **Database Schema**: Extended `TaskRecord.api_type` union to include 'kling-v2-1-pro', 'kling-v2-5-turbo-text-to-video', 'kling-v2-5-turbo-image-to-video'
- **Release Guidelines**: Added MCP Inspector local testing step with clear agent/user role clarification

### Technical
- Added `KlingVideoSchema` with unified parameter validation supporting all three modes
- Implemented `generateKlingVideo()` in KieAiClient with smart endpoint selection
- Added `handleKlingVideo()` handler in index.ts with proper mode detection and task tracking
- All Kling endpoints use `/jobs/recordInfo` for status polling with consistent response format
- Updated AGENTS.md Pre-Release Checklist to include MCP Inspector verification step

## [1.9.3] - 2025-01-15

### Changed
- **MCP Prompts & Resources Redesign**: Complete overhaul of prompts and resources following MCP protocol specifications
  - **Agent-Based Prompts**: Replaced generic workflow prompts with slash command triggers
    - `/artist` - Image generation agent with full artist.md instructions
    - `/filmographer` - Video generation agent with full filmographer.md instructions
  - **Simplified Invocation**: Prompts load full agent instructions without requiring structured arguments
  - **Natural Language**: Users provide complete context in their message (including image URLs)
  - **Embedded Resources**: Agent instructions delivered as embedded resources in prompt responses
  
  - **Knowledge Resources**: Comprehensive model documentation and comparison guides
    - **Agent Instructions**: Full system prompts for artist and filmographer agents
    - **Model Documentation**: Individual docs for all 12+ models (ByteDance, Qwen, Flux, Veo3, etc.)
    - **Comparison Guides**: Feature matrices for image and video models
    - **Optimization Guide**: Quality & cost control strategies with default settings
  
  - **Resource Annotations**: Priority and audience hints for intelligent context inclusion
    - Agent instructions: priority 0.9, audience "assistant"
    - Model docs: priority 0.6-0.8, audience "assistant"
    - Comparison guides: priority 0.5, audience "assistant"
    - Operational resources: priority 0.3-0.4, audience "user" or "user, assistant"
  
  - **Removed**: Old generic prompts (create_social_media_content, product_photography, explainer_video)
  - **Removed**: Placeholder resources (models/status, config/limits) in favor of real documentation

### Technical
- Added `getAgentInstructions()` helper to load agent markdown files dynamically
- Added `getModelDocumentation()` helper to load model docs with file name mapping
- Added `getImageModelsComparison()` with feature matrix for all image models
- Added `getVideoModelsComparison()` with feature matrix and cost trade-offs
- Added `getQualityOptimizationGuide()` with resolution/quality control strategies
- Updated `ReadResourceRequestSchema` handler with model matching and guide routing
- Updated `GetPromptRequestSchema` handler to embed agent instructions as resources
- Maintained backward compatibility with existing operational resources (tasks/active, stats/usage)

## [1.9.2] - 2025-01-15

### Changed
- **Documentation Updates**: Comprehensive README.md updates with competitive research validation
  - **Competitive Analysis**: Updated comparison table with accurate research findings
  - **Pricing Claims**: Validated and updated to "30-50% lower cost" with research backing
  - **Support Claims**: Clarified human vs AI-powered support differences
  - **Uptime Information**: Updated competitors to "Not disclosed" based on research
  - **API Key Claims**: Corrected Fal.ai to single key system
  - **Model Count**: Updated to reflect 18 AI tools with unified interfaces
- **Package Metadata**: Enhanced package.json description and keywords for better discoverability
- **Repository Information**: Updated with comprehensive feature list and competitive advantages

### Technical
- **Build Verification**: Confirmed all TypeScript compilation and build processes
- **Type Safety**: Verified no TypeScript errors with `npx tsc --noEmit`
- **Documentation Accuracy**: All tool descriptions and parameters validated against current implementation
- **Competitive Research**: Completed validation of pricing, uptime, and support claims for Fal.ai and Replicate.com

## [1.9.1] - 2025-01-15

### Changed
- **Nano Banana Tools Consolidation**: Merged three separate Nano Banana tools into one unified tool
  - **Removed**: `nano_banana_generate`, `nano_banana_edit`, `nano_banana_upscale`
  - **Added**: `nano_banana_image` - Unified tool for all Nano Banana operations
  - **Smart Mode Detection**: Automatically detects operation mode based on parameters:
    - Generate mode: `prompt` only
    - Edit mode: `prompt` + `image_urls`
    - Upscale mode: `image` (+ optional `scale`)
  - **Backward Compatibility**: All existing functionality preserved
  - **Improved UX**: Single tool reduces cognitive load for users

### Technical
- Replaced `NanoBananaGenerateSchema`, `NanoBananaEditSchema`, `NanoBananaUpscaleSchema` with unified `NanoBananaImageSchema`
- Updated `KieAiClient.generateNanoBananaImage()` with intelligent endpoint routing
- Consolidated three handlers into single `handleNanoBananaImage()` function
- Added smart validation logic in schema refine for mode detection
- Updated `TaskRecord` api_type union to include 'nano-banana-image'
- Enhanced parameter guidance and error messages

## [1.9.0] - 2025-01-15

### Added
- **Recraft Remove Background**: New `recraft_remove_background` tool for AI-powered background removal
- **Ideogram V3 Reframe**: New `ideogram_reframe` tool for intelligent image reframing and aspect ratio conversion
- **Professional Background Removal**: High-quality background removal using Recraft's advanced AI model
- **Intelligent Image Reframing**: Smart image resizing and aspect ratio conversion using Ideogram V3
- **Format Support**: Supports PNG, JPG, and WEBP image formats for both tools
- **Size Constraints**: Recraft handles up to 5MB/16MP, Ideogram handles up to 10MB images
- **Task Integration**: Full database tracking and status monitoring for all generation tasks
- **Callback Support**: Optional callback URL with environment variable fallback for completion notifications

### Ideogram V3 Reframe Features
- **Multiple Output Sizes**: square, square_hd, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9
- **Rendering Speed Options**: TURBO (fast), BALANCED (default), QUALITY (best)
- **Style Controls**: AUTO, GENERAL, REALISTIC, DESIGN style types
- **Batch Generation**: Generate 1-4 image variants in a single request
- **Reproducible Results**: Seed control for consistent output
- **Smart Content Adaptation**: Intelligent content-aware reframing

### Technical
- Added `RecraftRemoveBackgroundSchema` and `RecraftRemoveBackgroundRequest` types with comprehensive validation
- Added `IdeogramReframeSchema` and `IdeogramReframeRequest` types with full parameter validation
- Extended `TaskRecord` api_type with 'recraft-remove-background' and 'ideogram-reframe' for proper task tracking
- Updated API client with `generateRecraftRemoveBackground()` and `generateIdeogramReframe()` methods
- Enhanced task status routing for `/jobs/recordInfo` endpoint with tool-specific response parsing
- Smart status mapping: waiting→processing, success→completed, fail→failed
- Result URL extraction from `resultJson.resultUrls` array for processed images
- Comprehensive parameter validation with image format, size, and constraint checking

### User Experience
- **Simple Interfaces**: Minimal required parameters with comprehensive optional controls
- **Fast Processing**: Background removal (30-60s) and image reframing (30-120s)
- **High Quality**: Professional-grade results with clean edge detection and smart content adaptation
- **Flexible Output**: Multiple aspect ratios, styles, and rendering options for diverse use cases
- **Reliable Tracking**: Full task status monitoring and result URL management
- **Flexible Integration**: Support for both direct callback URLs and environment variable configuration

## [1.8.0] - 2025-01-15

### Added
- **Flux Kontext Image**: New unified `flux_kontext_image` tool for advanced AI image generation and editing
- **Dual Mode Support**: Single tool supporting both text-to-image generation and image editing
  - Text-to-Image Mode: Generate images from text prompts
  - Image Editing Mode: Edit existing images with inputImage parameter
- **Smart Translation**: Automatic translation of non-English prompts to English for better results
- **Multiple Aspect Ratios**: Support for 6 aspect ratios including ultra-wide (21:9) and mobile portrait (9:16)
- **Model Selection**: Choose between flux-kontext-pro (standard) and flux-kontext-max (enhanced) models
- **Safety Controls**: Configurable content moderation levels (0-6 for generation, 0-2 for editing)
- **Output Formats**: Support for both JPEG and PNG output formats
- **Prompt Enhancement**: Optional prompt upsampling for improved generation quality
- **Watermark Support**: Add custom watermarks to generated images
- **Regional Upload**: Choose between China and non-China servers for optimal upload speeds

### Enhanced
- **Default Aspect Ratio**: 16:9 as requested for optimal desktop and HD display compatibility
- **Error Handling**: Improved validation for safety tolerance ranges based on generation mode
- **Status Tracking**: Added specific status parsing for Flux Kontext response format

## [1.7.5] - 2025-01-15

### Added
- **OpenAI 4o Image**: New unified `openai_4o_image` tool for comprehensive image generation, editing, and variants
- **3 Generation Modes**: Support for text-to-image, image editing, and image variants in a single interface
- **Smart Mode Detection**: Automatically detects generation mode based on parameter presence
  - Text-to-Image: `prompt` provided, no `filesUrl`
  - Image Editing: `filesUrl` + `maskUrl` provided
  - Image Variants: `filesUrl` provided, no `maskUrl`
- **Multiple Variants**: Generate up to 4 image variations in a single request (default: 4)
- **Flexible Sizing**: Support for 5 different image sizes including portrait and landscape formats
- **Quality Options**: Standard or HD quality for different use cases
- **Style Control**: Choose between vivid (creative) or natural (realistic) styles
- **Model Options**: Support for both `gpt-4o-image` and `gpt-4o-image-mini` models
- **Fallback Support**: Automatic fallback to FLUX_MAX model when GPT-4o fails (enabled by default)
- **Task Integration**: Full database tracking and status monitoring for image generation

### Technical
- Added `OpenAI4oImageSchema` and `OpenAI4oImageRequest` types with comprehensive validation
- Extended `TaskRecord` api_type with 'openai-4o-image' for proper task tracking
- Updated API client with `generateOpenAI4oImage()` method and intelligent parameter mapping
- Enhanced task status routing for `/gpt4o-image/record-info` endpoint
- Smart mode detection logic based on parameter combinations
- Fallback mechanism implementation with FLUX_MAX model support
- Comprehensive parameter validation with mode-specific requirements
- Support for both URL and base64 JSON response formats

### User Experience
- **Unified Interface**: Single tool replaces multiple specialized image tools
- **Intelligent Defaults**: Generate 4 variants by default, fallback enabled for reliability
- **Clear Mode Detection**: Users can rely on auto-detection or understand the logic
- **Professional Quality**: HD quality option for high-end applications
- **Consistent Results**: Multiple variants provide choice while maintaining style coherence
- **Reliable Generation**: Fallback mechanism ensures successful generation even if GPT-4o fails

## [1.7.4] - 2025-01-14

### Added
- **Midjourney Generate**: New unified `midjourney_generate` tool for comprehensive Midjourney AI generation
- **6 Generation Modes**: Support for text-to-image, image-to-image, style reference, omni reference, and video generation (SD/HD)
- **Smart Task Detection**: Automatically detects generation mode based on parameters and context
- **Video Default Strategy**: Standard definition video by default, high definition only when explicitly requested
- **Advanced Style Controls**: Fine-tune with stylization (0-1000), variety (0-100), and weirdness (0-3000) parameters
- **Multiple Aspect Ratios**: Support for 11 different aspect ratios including ultra-wide (2:1) and ultra-tall (1:2)
- **Model Version Access**: Support for Midjourney versions 7, 6.1, 6, 5.2, 5.1, and niji6 for anime/illustration
- **Speed Options**: Relaxed, fast, and turbo generation speeds (where applicable)
- **Reference Modes**: Advanced omni reference for character transfer and style reference for artistic style application
- **Batch Video Generation**: Generate 1, 2, or 4 videos in a single request
- **Motion Control**: High and low motion levels for video generation
- **Callback Support**: Optional callback URL with environment variable fallback

### Technical
- Added `MidjourneyGenerateSchema` and `MidjourneyGenerateRequest` types with comprehensive validation
- Extended `TaskRecord` api_type with 'midjourney' for proper task tracking
- Updated API client with `generateMidjourney()` method and intelligent parameter mapping
- Enhanced task status routing for `/mj/record-info` endpoint with fallback strategy
- Smart task type detection logic based on parameter presence and combinations
- Video quality control: standard definition (`mj_video`) vs high definition (`mj_video_hd`)
- Omni intensity parameter validation (1-1000) for omni reference tasks
- Comprehensive parameter validation with mode-specific requirements
- Support for both legacy `fileUrl` and recommended `fileUrls` array parameters

### User Experience
- **Unified Interface**: Single tool replaces multiple specialized Midjourney tools
- **Intelligent Defaults**: Sensible defaults for all parameters reduce configuration complexity
- **Clear Mode Detection**: Users can rely on auto-detection or specify taskType explicitly
- **Video Quality Choice**: Standard definition by default for cost efficiency, HD available on demand
- **Comprehensive Documentation**: Detailed examples for all generation modes and parameter combinations

## [1.7.3] - 2025-01-14

### Added
- **Qwen Image**: New unified `qwen_image` tool for image generation and editing
- **Text-to-Image Support**: Generate high-quality images from text prompts using Qwen's advanced model
- **Image Editing Support**: Edit and transform existing images with natural language descriptions
- **Smart Mode Detection**: Automatically detects text-to-image vs image editing based on presence of `image_url` parameter
- **Acceleration Options**: Three acceleration levels (none, regular, high) for speed vs quality trade-offs
- **Flexible Image Sizes**: Support for 6 different aspect ratios and resolutions
- **Batch Generation**: Generate up to 4 images in a single request (edit mode)
- **Advanced Controls**: Fine-tune with guidance_scale, num_inference_steps, and negative prompts
- **Task Integration**: Full database tracking and status monitoring for image generation

### Technical
- Added `QwenImageSchema` and `QwenImageRequest` types
- Extended `TaskRecord` api_type with 'qwen-image'
- Updated API client with `generateQwenImage()` method
- Enhanced task status routing for `/jobs/recordInfo` endpoint
- Intelligent model selection: `qwen/text-to-image` vs `qwen/image-edit`
- Mode-specific parameter validation and defaults
- Comprehensive parameter validation with callback URL fallback support

### User Experience
- **Unified Interface**: Single tool for both image generation and editing reduces complexity
- **Intelligent Detection**: No need to specify mode - tool automatically detects based on parameters
- **Speed Options**: Acceleration levels for faster generation when quality trade-offs are acceptable
- **Professional Quality**: Advanced controls for fine-tuning image generation
- **Consistent Results**: Seed control enables reproducible image generation

## [1.7.2] - 2025-01-14

### Added
- **ByteDance Seedream V4 Image**: New unified `bytedance_seedream_image` tool for image generation and editing
- **Text-to-Image Support**: Generate high-quality images from text prompts using ByteDance's advanced Seedream V4 model
- **Image Editing Support**: Edit and transform existing images with natural language descriptions
- **Smart Mode Detection**: Automatically detects text-to-image vs image editing based on presence of `image_urls` parameter
- **High Resolution Support**: Generate images in 1K, 2K, and 4K resolutions
- **Multiple Aspect Ratios**: Support for 9 different aspect ratios including vertical, horizontal, and square formats
- **Batch Generation**: Generate up to 6 images in a single request
- **Batch Editing**: Edit up to 10 images simultaneously with consistent style application
- **Seed Control**: Reproducible image generation with random seed support
- **Task Integration**: Full database tracking and status monitoring for image generation

### Technical
- Added `ByteDanceSeedreamImageSchema` and `ByteDanceSeedreamImageRequest` types
- Extended `TaskRecord` api_type with 'bytedance-seedream-image'
- Updated API client with `generateByteDanceSeedreamImage()` method
- Enhanced task status routing for `/jobs/recordInfo` endpoint
- Intelligent model selection: `bytedance/seedream-v4-text-to-image` vs `bytedance/seedream-v4-edit`
- Comprehensive parameter validation with callback URL fallback support
- Smart endpoint selection based on mode (generation vs editing)

### User Experience
- **Unified Interface**: Single tool for both image generation and editing reduces complexity
- **Intelligent Detection**: No need to specify mode - tool automatically detects based on parameters
- **Professional Quality**: Support for up to 4K resolution for high-end applications
- **Consistent Results**: Seed control enables reproducible image generation
- **Efficient Workflow**: Batch processing capabilities for multiple images

## [1.7.1] - 2025-01-14

### Changed
- **Unified ElevenLabs TTS Tool**: Merged `elevenlabs_tts` and `elevenlabs_tts_turbo` into single tool
- **Smart Model Selection**: Added `model` parameter (turbo/multilingual) with turbo as default
- **Simplified Interface**: Reduced cognitive load with single entry point for TTS generation
- **Parameter Routing**: Smart parameter handling based on selected model
  - Turbo model: uses `language_code` for language enforcement
  - Multilingual model: uses `previous_text`/`next_text` for context
- **Backwards Compatibility**: Maintained all existing functionality and parameters

### Technical
- Updated `ElevenLabsTTSSchema` with unified model selection
- Removed `ElevenLabsTTSTurboSchema` and related types
- Updated database schema to remove 'elevenlabs-tts-turbo' from TaskRecord api_type
- Merged `generateElevenLabsTTS()` methods with intelligent model routing
- Enhanced `handleElevenLabsTTS()` with model-specific parameter handling
- Updated task status checking for unified elevenlabs-tts api_type
- Improved response messages with model-specific information

### User Experience
- **Faster Default**: Turbo 2.5 model is now the default for faster generation
- **Clear Documentation**: Updated tool description to explain both models
- **Intelligent Parameters**: Only relevant parameters are used based on model selection
- **Consistent Interface**: Single tool name reduces confusion and simplifies usage

## [1.7.0] - 2025-01-14

### Added
- **Alibaba Wan 2.5 Video**: New `wan_video` tool for video generation (unified text-to-video and image-to-video)
- **Text-to-Video Support**: Generate videos from text prompts using Alibaba's advanced Wan 2.5 model
- **Image-to-Video Support**: Animate static images with natural language descriptions
- **Smart Mode Detection**: Automatically detects text-to-video vs image-to-video based on parameters
- **Prompt Expansion**: LLM-powered prompt rewriting for improved results with short prompts
- **Flexible Resolutions**: 720p for faster generation, 1080p for higher quality
- **Aspect Ratio Control**: Support for 16:9, 9:16, and 1:1 formats (text-to-video)
- **Duration Control**: 5 or 10 second options for image-to-video generation
- **Negative Prompts**: Fine-tune results by specifying content to avoid
- **Seed Control**: Reproducible video generation with random seed support
- **Task Integration**: Full database tracking and status monitoring for video generation

### Technical
- Added `WanVideoSchema` and `WanVideoRequest` types
- Extended `TaskRecord` api_type with 'wan-video'
- Updated API client with `generateWanVideo()` method
- Enhanced task status routing for `/jobs/recordInfo` endpoint
- Comprehensive parameter validation with callback URL fallback support
- Smart endpoint selection based on mode (text-to-video vs image-to-video)
- Model selection logic: `wan/2-5-text-to-video` vs `wan/2-5-image-to-video`

## [1.6.0] - 2025-01-14

### Added
- **Runway Aleph Video**: New `runway_aleph_video` tool for video-to-video transformation
- **AI-Powered Video Editing**: Transform existing videos using text prompts and AI
- **Style Transfer**: Apply artistic styles to videos with natural language descriptions
- **Reference Image Guidance**: Use reference images to guide video transformation style
- **Aspect Ratio Conversion**: Convert between horizontal, vertical, and square video formats
- **Watermark Support**: Add custom watermarks to transformed videos
- **Reproducible Transformations**: Seed control for consistent video editing results
- **China Server Support**: Option to upload to China servers for global accessibility
- **Task Integration**: Full database tracking and status monitoring for video transformations

### Technical
- Added `RunwayAlephVideoSchema` and `RunwayAlephVideoRequest` types
- Extended `TaskRecord` api_type with 'runway-aleph-video'
- Updated API client with `generateRunwayAlephVideo()` method
- Enhanced task status routing for `/api/v1/aleph/record-info` endpoint
- Comprehensive parameter validation with callback URL fallback support
- Smart endpoint selection for Runway Aleph API integration

## [1.5.0] - 2025-01-14

### Added
- **ByteDance Seedance Video**: New unified `bytedance_seedance_video` tool for video generation
- **Text-to-Video Support**: Generate videos from text prompts using ByteDance models
- **Image-to-Video Support**: Animate static images with natural language descriptions
- **Smart Mode Detection**: Automatically detects text-to-video vs image-to-video based on parameters
- **Quality Tiers**: Lite quality for faster generation, Pro quality for higher results
- **Model Consolidation**: Single tool replaces 4 separate ByteDance video endpoints
  - `bytedance/v1-lite-text-to-video`
  - `bytedance/v1-lite-image-to-video` 
  - `bytedance/v1-pro-text-to-video`
  - `bytedance/v1-pro-image-to-video`
- **Flexible Aspect Ratios**: Support for 1:1, 9:16, 16:9, 4:3, 3:4, 21:9, 9:21 formats
- **Resolution Options**: 480p, 720p, 1080p video quality settings
- **Camera Control**: Fixed camera position option for stable video generation
- **Seed Control**: Reproducible video generation with random seed support
- **End Frame Support**: Specify ending image for image-to-video transitions
- **Safety Features**: Built-in content safety checking with disable option
- **Task Integration**: Full database tracking and status monitoring

### Technical
- Updated database schema to support `bytedance-seedance-video` api_type
- Enhanced client routing for unified ByteDance video endpoint handling
- Comprehensive parameter validation with Zod schemas
- Smart endpoint selection based on quality and mode parameters

## [1.4.0] - 2025-01-14

### Added
- **ElevenLabs Sound Effects**: New `elevenlabs_ttsfx` tool for sound effect generation
- **Sound Effects v2 Model**: Integration with ElevenLabs Sound Effects v2 API
- **Flexible Duration Control**: Customizable sound effect duration from 0.5 to 22 seconds
- **Loop Support**: Create seamless looping sound effects
- **Multiple Audio Formats**: Support for MP3, PCM, Opus, and telephony formats
- **Prompt Influence Control**: Adjust how closely to follow text descriptions (0-1 range)
- **High-Quality Audio**: Professional-grade sound effect generation
- **Task Status Integration**: Full task tracking for sound effects generation

### Technical
- Added `ElevenLabsSoundEffectsSchema` and `ElevenLabsSoundEffectsRequest` types
- Extended `TaskRecord` api_type with 'elevenlabs-sound-effects'
- Updated API client with `generateElevenLabsSoundEffects()` method
- Enhanced task status handling for sound effects responses
- Comprehensive documentation with examples and use cases

## [1.3.0] - 2025-01-14

### Added
- **ElevenLabs TTS Integration**: New `elevenlabs_tts` tool for text-to-speech generation
- **ElevenLabs TTS Turbo**: New `elevenlabs_tts_turbo` tool for faster text-to-speech with language enforcement
- **Multilingual Support**: Support for ElevenLabs multilingual TTS v2 model
- **Turbo 2.5 Model**: Faster generation with ISO 639-1 language code enforcement
- **21 Voice Options**: Full support for all ElevenLabs voices (Rachel, Aria, Roger, Sarah, etc.)
- **Advanced Voice Controls**: Stability, similarity boost, style, and speed parameters
- **Word Timestamps**: Optional timestamp generation for each word
- **Text Continuity**: Previous/next text support for improved speech continuity
- **Language Enforcement**: ISO 639-1 language code support for Turbo 2.5 model
- **Task Status Integration**: Full task tracking and status polling for TTS generation
- **Callback Support**: Optional callback URL for TTS completion notifications

### Performance Improvements
- **Faster TTS Generation**: Turbo 2.5 model processes text in 15-60 seconds (vs 30-120 seconds for multilingual)
- **Language Consistency**: Turbo model provides better language enforcement for multilingual content

### Voice Options
- **Female Voices**: Rachel, Aria, Sarah, Laura, Charlotte, Alice, Matilda, Jessica, Lily
- **Male Voices**: Roger, Charlie, George, Callum, River, Liam, Will, Eric, Chris, Brian, Daniel, Bill

### Advanced Parameters
- **Stability** (0-1): Control voice stability and consistency
- **Similarity Boost** (0-1): Enhance voice similarity to original
- **Style** (0-1): Control style exaggeration and expressiveness
- **Speed** (0.7-1.2): Adjust speech rate
- **Timestamps**: Get word-level timing information
- **Continuity**: Previous/next text for seamless concatenation

### Technical Details
- Uses `/jobs/createTask` endpoint for TTS generation
- Supports `/jobs/recordInfo` for task status checking
- Response parsing for `resultUrls` array with audio file URLs
- Integration with existing task management system
- Environment variable support for callback URLs

## [1.2.2] - 2025-01-14

### Fixed
- **Critical Suno Task Status Bug**: Corrected endpoint from `/generate` to `/generate/record-info`
- **Suno Response Parsing**: Fixed handling of Suno's complex response structure
- **Status Mapping**: Implemented proper Suno status mapping (PENDING → SUCCESS, etc.)
- **Audio URL Extraction**: Fixed extraction of audio URLs from `sunoData` array
- **Task Tracking**: Suno music generation tasks can now be properly tracked

### Technical Details
- Updated API endpoint to match official Suno documentation
- Added type-specific response parsing for different APIs
- Enhanced task status responses with Suno metadata
- Fixed database result_url handling for multiple audio files

## [1.2.1] - 2025-01-14

### Fixed
- **Suno Task Status Endpoint**: Corrected endpoint from `/generate` to `/generate/record-info`
- **Suno Response Parsing**: Added proper handling for Suno's complex response structure
- **Status Mapping**: Implemented Suno-specific status mapping (PENDING, TEXT_SUCCESS, FIRST_SUCCESS, SUCCESS, etc.)
- **Audio URL Extraction**: Properly extract audio URLs from Suno's `sunoData` array
- **Callback URL**: Made callBackUrl optional and added environment variable support
- **Environment Variable**: Suno tool now uses KIE_AI_CALLBACK_URL as fallback like Veo3 tool
- **Validation**: Updated schema validation to check both direct and environment variable callback URL

### Changed
- **Enhanced Task Status Response**: Added Suno-specific metadata and audio file details
- **Multiple Audio Support**: Handle multiple audio files from Suno response
- **Documentation**: Added examples showing both explicit and environment variable approaches
- **Error Handling**: Improved error messages and status reporting for Suno tasks

### Technical Details
- Updated `getTaskStatus` to handle different response formats per API type
- Added comprehensive Suno metadata in task status responses
- Improved database result_url handling for multiple audio URLs
- Enhanced API response parsing with type-specific logic

## [1.2.0] - 2025-01-14

### Added
- **Suno Music Generation**: New `suno_generate_music` tool for AI-powered music creation
  - Support for all Suno models: V3_5, V4, V4_5, V4_5PLUS, V5
  - Custom mode with advanced parameters (style, title, vocal gender, etc.)
  - Instrumental and vocal music generation
  - Comprehensive parameter validation and error handling
  - Task tracking and status monitoring integration

### Changed
- Updated database schema to support 'suno' api_type
- Enhanced task status routing to handle Suno music generation endpoints
- Updated API endpoints documentation with Suno integration

### Documentation
- Added comprehensive Suno tool documentation with examples
- Updated feature list and API endpoints sections
- Enhanced parameter descriptions and usage guidelines

## [1.1.3] - 2025-01-14

### Breaking Changes
- Renamed all tools for better consistency and naming convention:
  - `generate_nano_banana` → `nano_banana_generate`
  - `edit_nano_banana` → `nano_banana_edit`
  - `upscale_nano_banana` → `nano_banana_upscale`
  - `generate_veo3_video` → `veo3_generate_video`
  - `get_veo3_1080p_video` → `veo3_get_1080p_video`

### Changed
- Updated all handler method names to match new tool names
- Updated error handling to use new tool names
- Updated README.md with new tool names and examples

## [1.1.2] - 2025-01-14

### Added
- Comprehensive error handling with `formatError` method for all tools
- Parameter-specific guidance for each tool with usage examples
- Zod validation error parsing for detailed parameter feedback

### Changed
- All tool handlers now use consistent error formatting
- Enhanced error messages with actionable guidance for users
- Improved error response structure with tool context and parameter descriptions

### Fixed
- Proper error handling in `upscale_nano_banana`, `generate_veo3_video`, `get_task_status`, `list_tasks`, and `get_veo3_1080p_video` tools
- Consistent try/catch structure across all API endpoints

## [1.1.1] - 2025-01-14

### Added
- `KIE_AI_CALLBACK_URL` environment variable for default callback URL configuration
- `enableTranslation` parameter to Veo3 tool (auto-translate prompts to English, default: true)
- `Auto` option to Veo3 `aspectRatio` parameter
- `callBackUrl` parameter now exposed in Veo3 MCP tool schema

### Changed
- Veo3 tool now uses `KIE_AI_CALLBACK_URL` environment variable as fallback when `callBackUrl` is not provided in request
- Updated Veo3 documentation to match official Kie.ai API specification

### Fixed
- Veo3 tool now fully aligned with official Kie.ai API documentation
- All Veo3 parameters properly documented and exposed

## [1.1.0] - 2025-01-14

### Breaking Changes
- Migrated from `/playground/*` to official `/jobs/*` API endpoints for all Nano Banana operations
- Updated status check endpoint from `/playground/recordInfo` to `/jobs/recordInfo`

### Added
- New `upscale_nano_banana` tool for image upscaling
  - Scale images 1-4x
  - Optional GFPGAN face enhancement
  - Supports jpeg/png/webp up to 10MB
- `output_format` parameter (png/jpeg) to `generate_nano_banana` and `edit_nano_banana` tools
- `image_size` parameter with 11 aspect ratio options (1:1, 9:16, 16:9, 3:4, 4:3, 3:2, 2:3, 5:4, 4:5, 21:9, auto) to image generation tools

### Changed
- Increased prompt max length from 1,000 to 5,000 characters for all Nano Banana tools
- Increased max input images from 5 to 10 for `edit_nano_banana`
- Enhanced `get_task_status` to properly parse `resultJson` string and extract result URLs
- Improved task status mapping: `waiting` → `processing`, `success` → `completed`, `fail` → `failed`
- Task status queries now automatically update local database with API responses
- Better error message extraction and handling from API responses

### Fixed
- `get_task_status` now correctly parses JSON strings returned by the API
- Database updates properly reflect current task state from API
- Result URLs are now properly extracted from `resultUrls` array

### Documentation
- Updated README with all new parameters and comprehensive examples
- Corrected API endpoints to match official Kie.ai documentation
- Added complete parameter documentation for all tools
- Updated feature list with new capabilities

## [1.0.3] - 2024-12-XX

### Changed
- Minor updates and fixes

## [1.0.0] - 2024-12-XX

### Added
- Initial release
- Nano Banana image generation tool
- Nano Banana image editing tool
- Veo3 video generation tool
- Veo3 1080p video upgrade tool
- Task status checking
- Task listing with filters
- SQLite-based task persistence
- Smart endpoint routing based on task type
- Comprehensive error handling for all HTTP status codes
- Environment-based configuration
- MCP protocol integration

[1.7.5]: https://github.com/felores/kie-cli-mcp/compare/v1.7.4...v1.7.5
[1.7.4]: https://github.com/felores/kie-cli-mcp/compare/v1.7.3...v1.7.4
[1.7.3]: https://github.com/felores/kie-cli-mcp/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/felores/kie-cli-mcp/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/felores/kie-cli-mcp/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/felores/kie-cli-mcp/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/felores/kie-cli-mcp/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/felores/kie-cli-mcp/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/felores/kie-cli-mcp/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/felores/kie-cli-mcp/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/felores/kie-cli-mcp/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/felores/kie-cli-mcp/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/felores/kie-cli-mcp/compare/v1.1.3...v1.2.0
[1.1.3]: https://github.com/felores/kie-cli-mcp/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/felores/kie-cli-mcp/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/felores/kie-cli-mcp/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/felores/kie-cli-mcp/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/felores/kie-cli-mcp/compare/v1.0.0...v1.0.3
[1.0.0]: https://github.com/felores/kie-cli-mcp/releases/tag/v1.0.0
