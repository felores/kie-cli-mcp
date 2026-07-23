# Agent Guidelines for kie-ai-mcp-server

## Project Goal
**Seamless integration with Kie.ai API** - Kie.ai provides access to the best AI models (Veo 3, Runway, Nano Banana, Suno, etc.) through one affordable, developer-friendly API. Our MCP server bridges these powerful AI capabilities to Claude Desktop and other MCP clients.

## Immediate Goals
- **Simplify tool interfaces** - Reduce cognitive load for users
- **Consolidate related tools** - Example: merge `generate_nano_banana`, `edit_nano_banana`, and `upscale_nano_banana` into a single unified `nano_banana` tool that auto-detects mode based on parameters (presence of `image_urls` = edit mode, presence of `scale` = upscale mode, etc.)
- **Maintain backwards compatibility** when possible
- **Improve user experience** through intuitive parameter design

## Build/Test Commands
- Build: `npm run build` (TypeScript → dist/)
- Test: `npm test` (Jest)
- Dev: `npm run dev` (tsx auto-reload)
- Type check: `npx tsc --noEmit`

## Available CLI Tools
- **Git**: Full git access for version control
- **GitHub CLI** (`gh`): Create releases, manage PRs, issues, etc.
- **NPM**: Package management and publishing

## Code Style
- **Module system**: ES modules (`.js` extensions in imports)
- **TypeScript**: Strict mode, explicit types, no `any` except for request handlers
- **Imports**: MCP SDK imports use `.js` extension, local imports use `.js` extension
- **Validation**: Use Zod schemas for all request validation (see types.ts)
- **Error handling**: Wrap errors in `McpError` with appropriate `ErrorCode`
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Database**: SQLite with TaskDatabase class, always update task status
  - Use `await db.createTask()` when creating new generation tasks
  - Use `await db.updateTask()` to sync status after API calls
  - Store api_type for intelligent endpoint routing
  - Handle database errors gracefully with try-catch blocks
  - Use local database as cache to reduce API calls
- **API client**: Use KieAiClient class methods, never construct raw fetch calls
- **Response format**: Return MCP tool responses with JSON.stringify and `null, 2`
- **Async/await**: Use async/await, avoid promises directly

## Callback URL Pattern
For tools requiring callback URLs (like Veo3, Suno):
- **Schema**: Make `callBackUrl` optional in Zod schema
- **Fallback**: Use `KIE_AI_CALLBACK_URL` environment variable if not provided
- **Validation**: Check both direct parameter and environment variable in refine
- **Handler**: Add fallback logic before API call: `if (!request.callBackUrl && process.env.KIE_AI_CALLBACK_URL)`
- **Documentation**: Show both explicit and environment variable approaches in examples

## Environment
- Required: `KIE_AI_API_KEY`
- Optional: `KIE_AI_BASE_URL`, `KIE_AI_TIMEOUT`, `KIE_AI_DB_PATH`, `KIE_AI_CALLBACK_URL`

## Architecture (monorepo, npm workspaces)

One shared `core` feeds two independently installable surfaces:

```text
packages/core   @felores/kie-ai-core  (PRIVATE, never published; bundled into both)
  src/tools/         tool registry, one ToolDef per model (single source of truth)
  src/kie-ai-client.ts  KieAiClient -> Kie.ai API
  src/database.ts       TaskDatabase (SQLite task persistence)
  src/types.ts          Zod schemas
packages/mcp    @felores/kie-ai-mcp-server  (bin: kie-ai-mcp-server)
  src/index.ts          MCP adapter: listTools + dispatch derived from TOOL_REGISTRY
packages/cli    @felores/kie-cli            (bin: kie-cli)
  src/index.ts          CLI adapter: yargs commands derived from TOOL_REGISTRY
```

- A tool is one `ToolDef { name, description, category, schema, run(args, ctx) }`.
- `run()` returns the MCP content envelope; the MCP server returns it verbatim, and the CLI unwraps `content[0].text`.
- MCP `inputSchema` and CLI flags are derived from the tool's Zod schema via `toInputJsonSchema`. Zod is the only schema definition.
- esbuild bundles `core` into each publishable package (`sqlite3` is external). `core` is never published.
- Build: `npm run build` (all), `npm run bundle` (publish bundles), `npm test` (core Jest), `npm run typecheck`.

## Adding New Tools

Adding a model is one tool file plus one client method. The MCP server and CLI discover it automatically through the registry.

1. Check endpoint status in `docs/ENDPOINTS.md`.
2. Check [Kie Market](https://kie.ai/market) for API and model updates before implementation.
3. Research the relevant Kie.ai playground page and API documentation.
4. Save endpoint documentation in `docs/kie/{provider}_{model}.md`.
5. Run `npm run add-tool -- <tool_name> [image|video|audio|utility]`.
6. Define the Zod schema in `packages/core/src/types.ts`, add the client method, and implement the tool in `packages/core/src/tools/<tool_name>.ts`.
7. Update `EXPECTED_TOOL_NAMES` in `packages/core/src/__tests__/registry.test.ts`, then run `npm run build && npm test`.

### Key Files
| What | Where |
|------|-------|
| Endpoint tracking | `docs/ENDPOINTS.md` |
| Kie API and model updates | `https://kie.ai/market` |
| Scaffold a tool | `npm run add-tool -- <name> <category>` |
| Tool registry | `packages/core/src/tools/index.ts` |
| One tool per file | `packages/core/src/tools/<tool_name>.ts` |
| Zod schemas | `packages/core/src/types.ts` |
| API client | `packages/core/src/kie-ai-client.ts` |
| MCP adapter | `packages/mcp/src/index.ts` |
| CLI adapter | `packages/cli/src/index.ts` |
| Registry tests | `packages/core/src/__tests__/registry.test.ts` |
| Tool documentation | `docs/TOOLS.md` |

## Agent Overview

### **Artist Agent** (`ai_docs/artist.md`)
**Purpose**: Static image generation and editing workflows

**Primary Models**:
- **Nano Banana**: Google's Gemini 2.5 Flash - unified generation/editing/upscaling
- **Seedream**: ByteDance's advanced image model - text-to-image + editing
- **Qwen**: Alibaba's image model - text-to-image + editing  
- **OpenAI 4o**: GPT-4o image capabilities - generation + editing + variants
- **Midjourney**: Artistic image generation (6 modes)
- **Flux Kontext**: Context-aware image generation + editing
- **Ideogram**: Typography-focused image generation + reframing
- **Recraft**: Specialized background removal

**Key Capabilities**:
- Unified tools that auto-detect mode (generate vs edit vs upscale)
- Smart parameter validation and mode switching
- Professional image editing with mask-based modifications
- Multiple aspect ratios and quality tiers
- Batch processing and variant generation

### **Filmographer Agent** (`ai_docs/filmographer.md`)  
**Purpose**: Video generation, editing, and motion workflows

**Primary Models**:
- **Veo3**: Google's premium cinematic video (text + optional images)
- **Sora 2**: OpenAI's advanced video model (text/image/storyboard modes)
- **Kling**: Multi-tier video generation (v2.1-pro control, v2.5-turbo speed)
- **ByteDance Seedance**: Professional video (lite/pro quality tiers)
- **Hailuo**: Fast video generation (standard/pro quality)
- **Wan**: Quick video creation with prompt expansion
- **Midjourney Video**: Image-to-video with motion control
- **Runway Aleph**: Video editing and enhancement

**Key Capabilities**:
- Decision tree model selection based on user input
- Start/end frame control for precise transitions
- Multiple quality tiers and aspect ratios
- Text-to-video, image-to-video, and storyboard modes
- CFG fine-tuning and motion parameter control

### **Agent-Model Relationships**

**Unified Tool Design**: Both agents use unified tools that consolidate multiple capabilities:
- Single interface handles generation, editing, and transformation modes
- Smart parameter detection automatically routes to correct API endpoint
- Reduces cognitive load while maintaining full functionality

**Workflow Integration**:
- **Artist**: Focuses on static visual creation with editing workflows
- **Filmographer**: Handles motion, timing, and sequential visual narratives
- **Cross-over**: Models like Midjourney serve both agents (image generation vs video)

**Quality Tiers**: Both agents provide tiered quality options:
- **Standard**: Fast generation for prototyping and casual use
- **Pro/Premium**: High-fidelity output for professional work
- **Turbo/Lite**: Optimized for speed and cost efficiency

## Database & Task Management

### **Database Architecture**
- **SQLite Database**: Local persistent storage using `sqlite3` package
- **TaskDatabase Class**: Wrapper class providing Promise-based database operations
- **Auto-initialization**: Creates tables and indexes on first run
- **Thread Safety**: Uses SQLite serialization for concurrent access

### **Database Schema**
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT UNIQUE NOT NULL,
  api_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  result_url TEXT,
  error_message TEXT
);

-- Performance indexes
CREATE INDEX idx_task_id ON tasks(task_id);
CREATE INDEX idx_status ON tasks(status);
```

### **Task Lifecycle Management**
1. **Task Creation**: When user calls generation tool → `INSERT` with status 'pending'
2. **Status Updates**: During API polling → `UPDATE` status based on API response
3. **Completion**: When API returns success → `UPDATE` with result_url
4. **Failure**: When API returns error → `UPDATE` with error_message

### **Database Operations**
```typescript
// Core methods available in TaskDatabase class
await db.createTask({ task_id, api_type, status });           // Create new task
await db.getTask(task_id);                                   // Get specific task
await db.updateTask(task_id, { status, result_url });         // Update task
await db.getAllTasks(limit);                                 // List all tasks
await db.getTasksByStatus(status, limit);                    // Filter by status
```

### **Smart Status Checking Pattern**
The `get_task_status` tool implements intelligent status checking:

1. **Local Database Query**: Fast lookup of task metadata and api_type
2. **API Endpoint Routing**: Use api_type to call correct Kie.ai endpoint
3. **Database Synchronization**: Update local record with latest API data
4. **Combined Response**: Merge local and API data for complete picture

### **API Type Routing Strategy**
```typescript
// Client uses api_type to determine correct endpoint
if (apiType === 'veo3') {
  return this.makeRequest(`/veo/record-info?taskId=${taskId}`, 'GET');
} else if (apiType === 'suno') {
  return this.makeRequest(`/generate/record-info?taskId=${taskId}`, 'GET');
} else if (apiType.includes('elevenlabs') || apiType.includes('bytedance')) {
  return this.makeRequest(`/jobs/recordInfo?taskId=${taskId}`, 'GET');
}
```

### **Database Configuration**
- **Environment Variable**: `KIE_AI_DB_PATH` (default: `./tasks.db`)
- **Auto-creation**: Database and tables created automatically on startup
- **Persistence**: Data survives server restarts
- **Inspectability**: Can be opened with any SQLite client tool

### **Task Status Values**
- **`pending`**: Task created, waiting for API processing
- **`processing`**: API is actively processing the task
- **`completed`**: Task finished successfully, result available
- **`failed`**: Task failed, error message available

### **Best Practices for Agents**
- **Always update task status** in database after API calls
- **Use api_type from database** for intelligent endpoint routing
- **Store both local and API status** for comprehensive tracking
- **Handle database errors gracefully** with proper error messages
- **Use transactions** when multiple updates are needed (not currently implemented)
- **Consider cleanup strategies** for old completed tasks (future enhancement)

### **Performance Considerations**
- **Indexed Queries**: task_id and status fields are indexed for fast lookups
- **Local Caching**: Database reduces API calls for status checks
- **Connection Management**: Single database connection per server instance
- **Memory Usage**: SQLite is lightweight and efficient for task tracking

### **Future Database Enhancements**
- **Task Expiration**: Automatic cleanup of old completed tasks
- **User Association**: Multi-user support with user_id field
- **Task Metadata**: Additional fields for parameters, model versions, etc.
- **Statistics**: Analytics and usage tracking tables
- **Batch Operations**: Bulk status updates and cleanup operations

## Publishing to NPM

### Package Information
- **Published packages** (versioned independently):
  - `@felores/kie-ai-mcp-server` in `packages/mcp` (bin: `kie-ai-mcp-server`)
  - `@felores/kie-cli` in `packages/cli` (bin: `kie-cli`)
  - `@felores/kie-ai-core` is private and bundled into both published packages.
- **NPM account**: `felores`
- **Registry**: https://registry.npmjs.org/
- **2FA**: Enabled (requires OTP for publishing)

### Version Management (CRITICAL)
**ALWAYS check and update versions when making user-facing changes:**

### Release Workflow (Canonical)

1. Bump each affected public package independently: MCP changes require `packages/mcp/package.json` and `packages/mcp/src/index.ts`; CLI changes require `packages/cli/package.json`. Update `package-lock.json`, `CHANGELOG.md`, README model references, `docs/TOOLS.md` (`npm run docs`), and relevant `docs/kie/` contracts.
2. Verify locally: `npm run typecheck`, `npm run build`, `npm test`, and `npm pack -w @felores/kie-ai-mcp-server --dry-run` plus `npm pack -w @felores/kie-cli --dry-run` for affected packages.
3. Commit the release preparation, rebase, and push `main`. Create and push tag `vX.Y.Z`, then create the GitHub Release with notes from the changelog.
4. Publish affected packages to npm with a fresh OTP when manual publishing is required. The release workflow also publishes to npm and GitHub Packages (`https://npm.pkg.github.com/`); monitor its run to completion.
5. A release is complete only when: commits and tag are pushed, the GitHub Release is visible, intended versions resolve from npm, both intended packages have successful GitHub Packages publish steps, and the working tree is clean.

1. **When to bump version**:
   - **Patch (x.x.X)**: Bug fixes, documentation, internal improvements
   - **Minor (x.X.0)**: New features, new tools, new parameters (backwards compatible)
   - **Major (X.0.0)**: Breaking changes, API endpoint changes, removed features

2. **Files to update** when bumping the MCP server:
   - `packages/mcp/package.json` → `"version": "X.Y.Z"`
   - `packages/mcp/src/index.ts` → `version: "X.Y.Z"` (in Server constructor)
   - `CHANGELOG.md` → Add new version section with changes
   - `README.md` → Update changelog section
   - CLI bumps require `packages/cli/package.json`.

3. **Pre-publish checklist**:
   ```bash
   npm run build                    # Must succeed
   npx tsc --noEmit                 # Must have no errors
   npm publish --dry-run            # Preview what will be published
   ```

4. **Publishing workflow**:
   ```bash
   # Check login status
   npm whoami                       # Should return: felores
   
   # Publish (requires 2FA code)
   npm publish --otp=XXXXXX         # Replace XXXXXX with 6-digit code
   
   # Verify publication
   npm view @felores/kie-ai-mcp-server version
   ```

5. **Git workflow** (after successful publish):
   ```bash
   git add .
   git commit -m "Release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

6. **Creating GitHub releases** (optional but recommended):
    ```bash
    # Agent has access to gh CLI for creating releases
    gh release create vX.Y.Z \
      --title "Release vX.Y.Z" \
      --notes "See CHANGELOG.md for details"
    ```

7. **Automated Publishing via GitHub Actions**:
    - **Release workflow**: `.github/workflows/release.yml` - Full automated publishing
    - **Publish workflow**: `.github/workflows/publish.yml` - GitHub Packages only
    - **Trigger**: Pushing a git tag (vX.Y.Z) automatically triggers release workflow
    - **Permissions**: Requires `contents: write` and `packages: write` in GitHub Actions

8. **GitHub Packages Integration**:
    - **Registry**: https://npm.pkg.github.com/
    - **Package**: @felores/kie-ai-mcp-server
    - **Installation**: `npm install @felores/kie-ai-mcp-server --registry https://npm.pkg.github.com/`
    - **Authentication**: Requires GitHub token with `read:packages` scope

### Repository Metadata Management
- **About section**: Updated with concise description and npm package link
- **Topics**: Added relevant tags for discoverability (mcp, kie-ai, ai, etc.)
- **Homepage**: Links to npm package page
- **Release notes**: Include installation instructions and key features

### Important Notes
- **Never publish without updating CHANGELOG.md** - users need to know what changed
- **Never skip version bump** - even for small fixes
- **Test build before publishing** - `npm run build` must succeed
- **Check package size** - should be ~10-15KB (shown in dry-run)
- **2FA timeout** - OTP codes expire quickly, have it ready before running publish
- **Package.json files field** - Only dist/, README.md, LICENSE are published (configured)
- **GitHub Actions secrets**: Ensure `NPM_TOKEN` and `GITHUB_TOKEN` are properly configured
- **Release automation**: Tag pushes trigger automated publishing to both NPM and GitHub Packages
- **Repository consistency**: Keep README, CHANGELOG, and package.json in sync

## Release Best Practices

### Pre-Release Checklist
1. **Version consistency**: All version files updated (package.json, index.ts, CHANGELOG.md)
2. **Documentation**: README.md reflects current tool names and features
3. **Build verification**: Agent runs `npm run build` - must succeed without errors
4. **Type checking**: Agent runs `npx tsc --noEmit` - must have no errors
5. **Tests**: Agent runs `npm test` - must pass (if tests exist)
6. **Local testing with MCP Inspector** *(manual user step - after agent hands off dist/)*: 
   - Agent builds the project and hands dist/ to user
   - User runs: `npx @modelcontextprotocol/inspector node --env-file=.env dist/index.js`
   - User verifies in Inspector UI:
     - ListTools response shows all tools including new ones
     - Test new/critical tools in Tools tab with sample parameters
     - Resources tab displays documentation correctly
     - Notifications pane shows no server errors
     - Test all modes for unified tools (e.g., image-to-video with and without image_url)
   - User confirms readiness before proceeding to publishing
7. **Changelog**: Detailed CHANGELOG.md entry with user-facing changes
8. **Git status**: Clean working directory with all changes committed

### Release Process Options

#### Option 1: Manual Release (Recommended for testing)
```bash
# 1. Update versions and documentation
# 2. Commit changes
git add .
git commit -m "Release vX.Y.Z"

# 3. Create and push tag
git tag vX.Y.Z
git push origin main --tags

# 4. Create GitHub release
gh release create vX.Y.Z --title "Release vX.Y.Z" --notes "Detailed release notes"

# 5. Publish to NPM manually
npm publish --otp=XXXXXX
```

#### Option 2: Automated Release (Production)
```bash
# 1. Update versions and documentation
# 2. Commit changes
git add .
git commit -m "Release vX.Y.Z"

# 3. Create and push tag (triggers automated workflow)
git tag vX.Y.Z
git push origin main --tags

# 4. Monitor GitHub Actions for successful publishing
```

### Release Troubleshooting

#### Common Issues
- **GitHub Actions failures**: Check secrets configuration and permissions
- **NPM publish failures**: Verify 2FA, package name, and registry access
- **Version conflicts**: Ensure all version files are synchronized
- **Build failures**: Check TypeScript compilation and dependencies

#### Recovery Steps
1. **Failed automated release**: Delete the tag and retry after fixing issues
2. **NPM rollback**: Use `npm deprecate` for problematic versions
3. **GitHub release cleanup**: Delete and recreate release with correct notes

### Post-Release Tasks
1. **Verify installation**: Test `npm install @felores/kie-ai-mcp-server`
2. **Check GitHub release**: Ensure notes and assets are correct
3. **Update documentation**: Update any external references if needed
4. **Monitor issues**: Watch for user feedback and bug reports

## MCP Tool Architecture & Schema Design

### **Unified Tool Pattern**

Our primary design goal is **unified tools** that consolidate multiple related capabilities into single interfaces. This reduces cognitive load and simplifies user experience.

#### **Examples of Unified Tools:**
- `bytedance_seedance_video`: Text-to-video + Image-to-video
- `bytedance_seedream_image`: Text-to-image + Image editing
- `qwen_image`: Text-to-image + Image editing
- `midjourney_generate`: 6 generation modes in one tool
- `openai_4o_image`: Text-to-image + Image editing + Image variants

### **Schema Design Principles**

#### **1. Union Schema Pattern**
For unified tools, create a single schema that encompasses ALL possible parameters across all modes:

```typescript
// All parameters are optional at the schema level
UnifiedToolSchema = z.object({
  // Parameters for mode A
  prompt: z.string().optional(),
  
  // Parameters for mode B  
  imageUrl: z.string().url().optional(),
  
  // Parameters for mode C
  maskUrl: z.string().url().optional(),
  
  // Common parameters
  quality: z.enum(['standard', 'hd']).default('standard'),
  callBackUrl: z.string().url().optional()
}).refine((data) => {
  // Business logic validation for mode requirements
  return validateModeRequirements(data);
});
```

#### **2. Smart Mode Detection**
Implement logic to detect the intended mode based on parameter combinations:

```typescript
// Mode detection logic in refine() or handler
const hasPrompt = !!data.prompt;
const hasImage = !!data.imageUrl;
const hasMask = !!data.maskUrl;

if (hasImage && hasMask) {
  // Image editing mode
  return hasPrompt; // prompt required for editing
} else if (hasImage) {
  // Image variants mode
  return true; // prompt optional
} else {
  // Text-to-image mode
  return hasPrompt; // prompt required
}
```

#### **3. Single vs Multiple Endpoints**

**Single Endpoint Tools** (API handles mode detection internally):
- `openai_4o_image`: One endpoint `/gpt4o-image/generate`
- API determines behavior based on parameter presence
- Server just passes parameters through

**Multiple Endpoint Tools** (Server routes to different endpoints):
- `bytedance_seedance_video`: Routes to different endpoints based on quality/mode
- `midjourney_generate`: Routes to different MJ endpoints based on task type
- Server handles intelligent endpoint selection

### **Client Instructions vs Schema Delivery**

#### **What MCP Server Provides Automatically:**
1. **Tool Discovery**: `ListToolsResponse` with all available tools
2. **Schema Delivery**: Complete JSON Schema for each tool
3. **Parameter Validation**: Type checking, constraints, enums
4. **Error Messages**: Validation failures with specific guidance

#### **What Should Go in Client Instructions:**

**❌ DON'T Include:**
- Raw schema definitions (they're delivered automatically)
- Parameter type information (handled by MCP)
- Validation rules (enforced by server)

**✅ DO Include:**
1. **Tool Capabilities**: High-level descriptions of what each tool does
2. **Usage Patterns**: Common workflows and parameter combinations
3. **Mode Logic**: Explain how unified tools detect modes
4. **Best Practices**: Tips for getting good results
5. **Parameter Selection**: Guidance on choosing between options
6. **Error Handling**: What to do when things go wrong

**Example Client Instruction:**
> "Use `openai_4o_image` for all image generation needs. It automatically detects whether you want to generate from text (provide prompt), edit an existing image (provide prompt + imageUrl + maskUrl), or create variants (provide imageUrl). Generate 4 variants by default for best results. Use HD quality for professional work."

### **Implementation Patterns**

#### **Pattern 1: Single Endpoint, Smart API**
```typescript
// API handles mode detection internally
async generateOpenAI4oImage(request: OpenAI4oImageRequest) {
  const payload = {
    prompt: request.prompt,
    filesUrl: request.filesUrl,
    maskUrl: request.maskUrl,
    // ... other parameters
  };
  
  // Always same endpoint - API figures out what to do
  return this.makeRequest('/gpt4o-image/generate', 'POST', payload);
}
```

#### **Pattern 2: Multiple Endpoints, Smart Routing**
```typescript
// Server routes to different endpoints based on mode
async generateByteDanceSeedanceVideo(request: ByteDanceSeedanceVideoRequest) {
  const isImageToVideo = !!request.image_url;
  const isProQuality = request.quality === 'pro';
  
  let endpoint = '/bytedance/seedance/';
  endpoint += isProQuality ? 'v1-pro-' : 'v1-lite-';
  endpoint += isImageToVideo ? 'image-to-video' : 'text-to-video';
  
  return this.makeRequest(endpoint, 'POST', request);
}
```

#### **Pattern 3: Complex Mode Detection**
```typescript
// Midjourney - complex parameter combinations determine mode
async generateMidjourney(request: MidjourneyGenerateRequest) {
  let taskType = 'mj_txt2img'; // default
  
  // Smart detection based on parameters
  if (request.high_definition_video || request.motion) {
    taskType = request.high_definition_video ? 'mj_video_hd' : 'mj_video';
  } else if (request.ow) {
    taskType = 'mj_omni_reference';
  } else if (request.taskType === 'mj_style_reference') {
    taskType = 'mj_style_reference';
  } else if (request.fileUrls || request.fileUrl) {
    taskType = 'mj_img2img';
  }
  
  const payload = { ...request, taskType };
  return this.makeRequest('/mj/generate', 'POST', payload);
}
```

### **Schema Validation Best Practices**

#### **1. Layered Validation**
- **Schema Layer**: Basic type checking (string, number, URL format)
- **Business Logic Layer**: Mode-specific requirement validation
- **API Layer**: Final validation by the target API

#### **2. Clear Error Messages**
```typescript
.refine((data) => {
  // Complex validation with clear error messages
  if (data.maskUrl && !data.filesUrl) {
    return false;
  }
  return true;
}, {
  message: "maskUrl requires filesUrl to be provided",
  path: ["maskUrl"]
});
```

#### **3. Environment Variable Fallbacks**
```typescript
.refine((data) => {
  // Check both direct parameter and environment variable
  const hasCallBackUrl = data.callBackUrl || process.env.KIE_AI_CALLBACK_URL;
  return !!hasCallBackUrl;
}, {
  message: "callBackUrl is required (either directly or via KIE_AI_CALLBACK_URL environment variable)",
  path: ["callBackUrl"]
});
```

### **Future Development Guidelines**

#### **When Adding New Tools:**

1. **Analyze API Structure**: 
   - Single endpoint with smart mode detection? → Pattern 1
   - Multiple distinct endpoints? → Pattern 2
   - Complex parameter combinations? → Pattern 3

2. **Design Unified Schema**:
   - Include ALL possible parameters
   - Make parameters optional at schema level
   - Add business logic validation in refine()

3. **Implement Smart Detection**:
   - Clear, predictable mode detection logic
   - Document the detection rules in client instructions
   - Provide helpful error messages for invalid combinations

4. **Update Documentation**:
   - Add tool to README.md with examples
   - Update CHANGELOG.md
   - Document mode detection logic in AGENTS.md

#### **When Modifying Existing Tools:**

1. **Backward Compatibility**: Add new parameters as optional
2. **Schema Evolution**: Extend existing schemas without breaking changes
3. **Documentation**: Update examples and usage patterns
4. **Testing**: Verify all modes still work correctly

### **Key Takeaways**

1. **Unified Tools > Multiple Tools**: Reduce cognitive load
2. **Schema Delivery is Automatic**: Don't manually paste schemas in client instructions
3. **Smart Mode Detection**: Either API handles it (Pattern 1) or server routes it (Pattern 2/3)
4. **Client Instructions Focus on Usage**: How to use, not what the parameters are
5. **Clear Error Messages**: Help users understand what went wrong and how to fix it

This architecture ensures a clean, maintainable codebase while providing an excellent user experience through intelligent, unified tool interfaces.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
