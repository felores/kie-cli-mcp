<div align="center">
<pre>
██╗  ██╗██╗███████╗
██║ ██╔╝██║██╔════╝
█████╔╝ ██║█████╗  
██╔═██╗ ██║██╔══╝  
██║  ██╗██║███████╗
╚═╝  ╚═╝╚═╝╚══════╝
 C L I  /  M C P
</pre>

🇬🇧 <b>English</b> &nbsp;·&nbsp; 🇪🇸 <a href="README.es.md">Español</a>

</div>

# Kie.ai CLI + MCP Server

**One API for state-of-the-art AI media models (Veo 3, Nano Banana, Suno, Kling, Flux, ElevenLabs, Seedance and more), exposed as both an MCP server and a standalone CLI generated from one shared tool registry.** Generate video, images, music and speech from Claude, Codex, OpenCode, Pi-mono, or any agentic harness, or straight from your terminal.

> ## ⚡ Token-efficient by design
>
> An MCP server injects **every** tool's schema into your model's context on **every turn**: with a catalog this large, that's a lot of tokens spent on tools you may never call.
>
> This server fixes that: load **only the tools you actually use** with `KIE_AI_ENABLED_TOOLS` (or whole categories with `KIE_AI_TOOL_CATEGORIES`). Your context stays lean and you pay for exactly the surface you need, no more, no less.
>
> And the bundled **CLI (`kie-cli`) costs zero context tokens** until you call it: the agent discovers commands on demand with `kie-cli --help` instead of carrying schemas around. One registry, two surfaces, minimal footprint.

## Two ways to use it (one shared core)

The MCP server and the CLI are generated from the same tool registry, so both expose the exact same models and install **independently**:

- **MCP server**: `@felores/kie-ai-mcp-server`, for Claude Desktop and other MCP clients. See **Quick Start** below.
- **CLI**: `@felores/kie-cli` (binary `kie-cli`), for the terminal, no MCP client needed: `npm i -g @felores/kie-cli`, then `kie-cli --help`. See [`packages/cli/README.md`](packages/cli/README.md).

## 🚀 Quick Start

```json
{
  "mcpServers": {
    "kie-ai": {
      "command": "npx",
      "args": ["-y", "@felores/kie-ai-mcp-server"],
      "env": {
        "KIE_AI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Get your free API key:** [kie.ai/api-key](https://kie.ai/api-key). No callback URL setup required, the server handles it automatically.

**For Claude Desktop:** add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). Also works with Cursor, Windsurf, VS Code, Claude Code, OpenCode, Droid, and others.

### 🎛️ Load only the tools you need (save tokens)

Add any of these to the `env` block above (or export them for the CLI). This is the core of the token-efficiency story:

```jsonc
// Whitelist, load ONLY these tools (highest priority)
"KIE_AI_ENABLED_TOOLS": "nano_banana_image,veo3_generate_video,suno_generate_music"

// Category filter, load whole categories
"KIE_AI_TOOL_CATEGORIES": "image,video"

// Blacklist, load everything except these
"KIE_AI_DISABLED_TOOLS": "midjourney_generate,runway_aleph_video"
```

- **Categories:** `image`, `video`, `audio`, `utility`.
- **Priority:** `ENABLED_TOOLS` > `TOOL_CATEGORIES` > `DISABLED_TOOLS` > all tools (default).
- The utility tools (`list_tasks`, `get_task_status`) are always enabled and can't be disabled, they're how you track and poll your generations.

## 🤖 Agent skill (optional)

`skills/kie-ai/` is a Claude Code skill that teaches agents to drive the `kie-cli` command (discover → generate → poll → result), including how to install the CLI if it's missing. Skills load **globally**, so install it into your personal skills dir (a project-local skill only triggers inside this repo):

```bash
cp -r skills/kie-ai ~/.claude/skills/kie-ai
# or symlink to keep it in sync with the repo:
ln -s "$PWD/skills/kie-ai" ~/.claude/skills/kie-ai
```

Then any session can generate media in plain language ("make me an image of…", "turn this photo into a video").

## Models

A unified, always-current catalog including:

- **Google Veo 3**: cinematic video with synchronized audio and 1080p output
- **Nano Banana 2** (Gemini 3 Flash Image): fast image generation/editing with Google Search grounding
- **Suno V5**: music generation with realistic vocals
- **Kling 3.0**, **Wan 2.7**, **Hailuo 02**, **ByteDance Seedance**, **HappyHorse**, **Runway Aleph**, **Midjourney**: video generation and editing
- **GPT Image 2**, **Flux Kontext / Flux 2**, **Qwen**, **ByteDance Seedream**, **Ideogram**, **Recraft**, **Topaz**: image generation, editing, reframing, background removal, upscaling
- **ElevenLabs**: text-to-speech and sound effects

Each tool features **smart mode detection**: one tool handles generate / edit / upscale based on the parameters you pass.

**The complete, current list is always available:** run `kie-cli --help` (and `kie-cli <tool> --help` for a tool's flags), or see **[docs/TOOLS.md](docs/TOOLS.md)**.

## MCP resources & prompts

Beyond tools, the MCP server exposes (all generated from the registry, so they never drift):

- **Prompts** (slash commands in your client): `/image` and `/video`: guidance for picking and driving the right model.
- **Resources:**
  - `kie://tools/<name>`: a Markdown reference for each tool (parameters, types, defaults), generated from its schema.
  - `kie://guides/image`, `kie://guides/video`, `kie://guides/quality`: model comparison and cost/quality guides.
  - `kie://tasks/active`, `kie://stats/usage`: live view of the local task database.

## Examples

### MCP (tool call)

```json
{
  "tool": "nano_banana_image",
  "arguments": {
    "prompt": "A futuristic city at sunset, cyberpunk style",
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "output_format": "png"
  }
}
```

### CLI

```bash
# Generate an image, then poll until it's done
kie-cli nano_banana_image --prompt "a red panda coding at night, neon" --resolution 2K --json
kie-cli get_task_status --task_id <id> --json

# Music, with custom lyrics off
kie-cli suno_generate_music --prompt "Upbeat electronic, energetic" --customMode --model V5 --title "Energy Boost"

# Speech
kie-cli elevenlabs_tts --text "Welcome to the future of content creation!" --voice Rachel --model turbo
```

Generation is asynchronous: tools return a `task_id`; poll it with `get_task_status` and browse recent work with `list_tasks`. Add `--json` to the CLI for machine-readable output.

## Configuration

<details>
<summary><strong>⚙️ Environment variables</strong></summary>

### Required
```bash
export KIE_AI_API_KEY="your-api-key-here"   # Get from https://kie.ai/api-key
```

### Optional
```bash
export KIE_AI_BASE_URL="https://api.kie.ai/api/v1"            # API base URL
export KIE_AI_TIMEOUT="60000"                                # Request timeout (ms)
export KIE_AI_DB_PATH="./tasks.db"                           # Task database location
export KIE_AI_CALLBACK_URL="https://your-domain.com/webhook" # Custom callback
export KIE_AI_CALLBACK_URL_FALLBACK="https://your-proxy.com/callback"  # Deployment-wide default
```

### Callback URL priority

| Priority | Source | Variable |
|----------|--------|----------|
| 1 | Per-request | `callBackUrl` argument |
| 2 | Environment | `KIE_AI_CALLBACK_URL` |
| 3 | Admin fallback | `KIE_AI_CALLBACK_URL_FALLBACK` |
| 4 | Hardcoded default | `https://proxy.kie.ai/mcp-callback` |

See [docs/ADMIN.md](docs/ADMIN.md) for Docker, Kubernetes and Systemd examples.
</details>

<details>
<summary><strong>📦 Install from source (for development)</strong></summary>

```bash
git clone https://github.com/felores/kie-cli-mcp.git
cd kie-cli-mcp
npm install
npm run build       # build all workspaces
npm run typecheck   # type-check all workspaces
npm test            # run the test suite
```

This is an npm-workspaces monorepo: `packages/core` (private shared registry, bundled into the others), `packages/mcp` (`@felores/kie-ai-mcp-server`) and `packages/cli` (`@felores/kie-cli`). To add a model, run `npm run add-tool -- <name> <category>` and both surfaces pick it up. For the dev server with auto-reload: `npm run dev -w @felores/kie-ai-mcp-server`.
</details>

## Task management

The server keeps a local SQLite database of the tasks it creates and polls, persistent across restarts, used for status tracking and correct endpoint routing.

```json
{ "tool": "list_tasks", "arguments": { "limit": 20, "status": "completed" } }
```
```json
{ "tool": "get_task_status", "arguments": { "task_id": "281e5b0...f39b9" } }
```

Note: `list_tasks` reflects the MCP's local cache, tasks it has created or polled, not your full Kie.ai account history. See [docs/DATABASE.md](docs/DATABASE.md).

## Error handling

The server surfaces Kie.ai's response codes (it only treats `code === 200` as success):

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Content policy violation / English prompts only |
| 401 | Unauthorized (invalid API key) |
| 402 | Insufficient credits |
| 404 | Resource not found |
| 422 | Validation error / record is null |
| 429 | Rate limited |
| 455 | Service maintenance |
| 500 | Server error / timeout |
| 501 | Generation failed |

## Troubleshooting

- **"Unauthorized"**: verify `KIE_AI_API_KEY` is set and valid at [kie.ai/api-key](https://kie.ai/api-key).
- **"Task not found"**: tasks may expire after ~14 days; check the task id.
- **Generation failures**: check content-policy compliance, English prompts, and sufficient credits.

## Documentation

- [docs/TOOLS.md](docs/TOOLS.md): complete tool reference
- [docs/DATABASE.md](docs/DATABASE.md): database and task lifecycle
- [docs/ADMIN.md](docs/ADMIN.md): deployment and environment setup
- [docs/INTELLIGENCE.md](docs/INTELLIGENCE.md): smart mode detection and cost optimization

## Support

- **This server (MCP or CLI):** open a pull request at https://github.com/felores/kie-cli-mcp
- **Kie.ai API:** support@kie.ai or https://docs.kie.ai/
- **API keys:** https://kie.ai/api-key

## Contributing

Fork → feature branch → make your change (add tests if applicable) → open a PR.

## License

MIT, see [LICENSE](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
