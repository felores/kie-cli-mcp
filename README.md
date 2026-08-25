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
</div>

<p align="center">🇬🇧 <b>English</b> &nbsp;·&nbsp; 🇪🇸 <a href="README.es.md">Español</a></p>

# Kie.ai CLI + MCP Server + Agent Skill

**One API for state-of-the-art AI media models (Veo 3, Nano Banana, Suno, Kling, Flux, ElevenLabs, Seedance and more), exposed as both an MCP server and a standalone CLI generated from one shared tool registry.** Generate video, images, music and speech from Claude, Codex, OpenCode, Pi-mono, or any agentic harness, or straight from your terminal.

> ## ⚡ Token-efficient by design
>
> An MCP server injects **every** tool's schema into your model's context on **every turn**: with a catalog this large, that's a lot of tokens spent on tools you may never call.
>
> This server fixes that: load **only the tools you actually use** with `KIE_AI_ENABLED_TOOLS` (or whole categories with `KIE_AI_TOOL_CATEGORIES`). Your context stays lean and you pay for exactly the surface you need, no more, no less.
>
## Two ways to use it (one shared core)

The MCP server and the CLI are generated from the same tool registry, so both expose the exact same models and install **independently**:

- **MCP server**: `@felores/kie-ai-mcp-server`, for Claude Desktop and other MCP clients. See **Quick Start** below.
- **CLI**: `@felores/kie-cli` (binary `kie-cli`), for the terminal, no MCP client needed: `npm i -g @felores/kie-cli`, then `kie-cli --help`. See [`packages/cli/README.md`](packages/cli/README.md).
- **OpenAI transport**: `@felores/kie-ai-openai-server`, a loopback HTTP server that exposes selected image/video models through OpenAI-shaped routes. Version 0.4 adds registry-driven Seedream, Qwen, Flux 2, and Flux Kontext image generation/editing. See [`docs/openai-transport.md`](docs/openai-transport.md).

The MCP server runs locally over **stdio** by default, and can also run as a **remote HTTP service** (Streamable HTTP) so one shared instance serves many clients over the network. It ships with a **Dockerfile and a Coolify compose file** for one-step self-hosting ([deploy guide](docs/DEPLOY_HTTP.md)). See the **Remote / HTTP transport** section below.

## ✨ What's new in MCP 5.0.0

Built on the **SDK v2 packages** (`@modelcontextprotocol/server`,
`@modelcontextprotocol/node`) with **Node >= 20** and **zod v4**:

- **Dual protocol era.** The server negotiates the protocol version per client:
  2025-era clients keep working unchanged, while the 2026-07-28 vocabulary
  (`server/discover`, cache hints, extensions, structured schemas, tasks) is
  served as soon as the SDK lifts its negotiation cap.
- **Structured results.** Failed tool calls arrive as `isError: true` with
  structured error content; generation, upload and planning tools expose
  `structuredContent` (`task_id`, `media_id`, `plan_id`) and advertise
  `outputSchema` in `tools/list`.
- **Modern input schemas.** Tool `inputSchema` is generated as JSON Schema
  2020-12, the dialect MCP 2026-07-28 targets.
- **MRTR plan approval.** On 2026-era hosts approval is a multi-round-trip
  `input_required` flow; 2025-era hosts keep the push-style elicitation.
- **`server/discover` + cache hints + extension negotiation.** The server
  answers discovery with its supported versions, capabilities and
  instructions, and advertises the MCP Apps extension that gates the upload
  widget resource.
- **Official MCP Tasks (opt-in).** `KIE_AI_MCP_TASKS=true` exposes the `tasks`
  capability and task-mode `tools/call` runs backed by an in-process engine
  mirrored to the local SQLite database; legacy `get_task_status` /
  `list_tasks` / `wait_for_task` remain available in all modes.

## Secure reference uploads

- `upload_file` sends validated Base64 directly to Kie. The CLI can also read a
  local path only beneath explicit `KIE_CLI_UPLOAD_ROOTS`. Arbitrary URL import
  is intentionally unavailable.
- `upload_widget` renders a minimal MCP Apps file picker when the host supports
  `ui://` resources.
- Remote operators may enable temporary capability storage with
  `KIE_MCP_PUBLIC_BASE_URL`. Upload minting stays behind authenticated MCP;
  one-use upload URLs stay in app metadata. Only an opaque `media_id` reaches
  model content; the server resolves it to Kie immediately before submission.
  See [the HTTP deployment guide](docs/DEPLOY_HTTP.md).

## Safe media workflow

Version 4 makes cost control a server-side workflow instead of an agent instruction:

| Surface | Prepare | Human approval | Submit |
| --- | --- | --- | --- |
| MCP | `prepare_media_generation` | Host `elicitation.form` confirmation | `submit_media_generation` |
| CLI | `prepare_media_generation` | `--approve <plan-id>` | `submit_media_generation` |

Preparation validates one to six requests, resolves model settings and policy defaults, records pricing as `exact` only for verified formulas and `unknown` otherwise, and creates no provider task. A plan is persistent, expires after 15 minutes by default, is bound to its MCP server session, and can be submitted only once. See [Media planning and approval](#media-planning-and-approval) for the complete flow.

## 🚀 Quick Start

**Requires Node.js >= 20** to run the MCP server.

Add Kie.ai to your MCP client. Pick how many tools you want loaded:

### Load all tools (simplest)

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

This makes **every** tool available, so every tool's schema goes into your context.

### Load only the tools you need (save tokens, recommended)

Add `KIE_AI_ENABLED_TOOLS` with a comma-separated list; only those tools load:

```json
{
  "mcpServers": {
    "kie-ai": {
      "command": "npx",
      "args": ["-y", "@felores/kie-ai-mcp-server"],
      "env": {
        "KIE_AI_API_KEY": "your-api-key-here",
        "KIE_AI_ENABLED_TOOLS": "nano_banana_image,veo3_generate_video,suno_generate_music"
      }
    }
  }
}
```

This loads **only** those tools (plus the always-on utility tools), keeping your context lean.

**Get your free API key:** [kie.ai/api-key](https://kie.ai/api-key). No callback URL setup required, the server handles it automatically.

**For Claude Desktop:** add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). Also works with Cursor, Windsurf, VS Code, Claude Code, OpenCode, Droid, and others.

### 🎛️ More ways to filter

Same idea, different env vars (inside the `env` block, or as shell exports for the CLI, e.g. `export KIE_AI_ENABLED_TOOLS="nano_banana_image,veo3_generate_video"`):

```jsonc
// Load whole categories instead of naming each tool
"KIE_AI_TOOL_CATEGORIES": "image,video"

// Or load everything EXCEPT some tools
"KIE_AI_DISABLED_TOOLS": "midjourney_generate,runway_aleph_video"
```

- **Categories:** `image`, `video`, `audio`, `utility`.
- **Priority:** `ENABLED_TOOLS` > `TOOL_CATEGORIES` > `DISABLED_TOOLS` > all tools (default).
- Utility tools, including task tracking and upload helpers, are always enabled and cannot be disabled.
- Official MCP Tasks are experimental and opt-in: set `KIE_AI_MCP_TASKS=true` to declare the `tasks` capability, per-tool `execution.taskSupport`, and the task-mode `tools/call` surface. The published MCP SDK still negotiates at most 2025-11-25, so task-mode calls are currently refused with a clear error instead of running; the surface activates once the SDK negotiates the 2026-07-28 revision. Legacy `get_task_status` / `list_tasks` / `wait_for_task` remain available in all modes.
- MCP hides and rejects direct `image`, `video`, and `audio` tool calls by default. Use `prepare_media_generation`, host approval elicitation, and `submit_media_generation` instead. `KIE_AI_ALLOW_DIRECT_GENERATION=true` is the explicit legacy bypass when you intentionally disable these approval safeguards. Filtering still controls which generation tools can be plan targets.
- MCP hides and rejects direct `image`, `video`, and `audio` tool calls by default. Use `prepare_media_generation`, host approval elicitation, and `submit_media_generation` instead. `KIE_AI_ALLOW_DIRECT_GENERATION=true` is the explicit legacy bypass when you intentionally disable these approval safeguards. Filtering still controls which generation tools can be plan targets. Use `prepare_media_generation`, host approval elicitation, and `submit_media_generation` instead. `KIE_AI_ALLOW_DIRECT_GENERATION=true` is the explicit legacy bypass when you intentionally disable these approval safeguards. Filtering still controls which generation tools can be plan targets.

## 🤖 Agent skill (optional)

`skills/generate-media/` is the canonical agent workflow. It requires a persisted plan, displays resolved settings and verified pricing state, then waits for explicit approval before task submission. `skills/kie-ai/` is a migration pointer only. Skills load **globally**, so install the canonical skill into your personal skills dir:

```bash
cp -r skills/generate-media ~/.claude/skills/generate-media
# or symlink to keep it in sync with the repo:
ln -s "$PWD/skills/generate-media" ~/.claude/skills/generate-media
```

Then any session can prepare media in plain language ("make me an image of...", "turn this photo into a video") and request approval before a paid task starts.

## Media planning and approval

Use `list_models` to search source-backed capabilities, then prepare one to six requests in a single persisted plan. Preparing validates target schemas and applies safe defaults, but never calls a Kie generation endpoint.

```json
{
  "tool": "prepare_media_generation",
  "arguments": {
    "items": [
      { "tool": "nano_banana_image", "args": { "prompt": "A red panda coding at night" } }
    ]
  }
}
```

For MCP clients that advertise and handle the `elicitation.form` capability, preparation shows the complete resolved plan and price summary in a host confirmation form. Only an accepted form with `confirm: true` records the plan as approved. Declined, cancelled, unconfirmed, and unsupported elicitations leave the plan prepared and unapproved. Submit only the resulting approved plan ID:

```json
{
  "tool": "submit_media_generation",
  "arguments": {
    "planId": "<approved-plan-id>"
  }
}
```

The CLI has no MCP host. It requires an explicit `--approve <plan-id>` value matching `--planId`; this atomically changes a prepared plan to approved before submission.

Pricing refresh is read-only by default: `npm run pricing:refresh` reports the tracked source evidence freshness and does not fetch, scrape, or write. `npm run pricing:refresh -- --apply` is an explicit metadata-only boundary. It is an intentional no-op without eligible validated formula proposals; with `--proposals <file>`, it can record the proposed deterministic credits formula plus its source URL, fingerprint, verification date, scope, and test evidence in the rate-card evidence manifest. It never edits executable formulas or derives USD conversions automatically.

```bash
kie-cli submit_media_generation --planId <prepared-plan-id> --approve <prepared-plan-id> --json
```

Plans are persisted in the local SQLite database and move atomically from `prepared` to `approved`, `submitting`, and then `submitted` or `failed`. They expire after 15 minutes by default, cannot be modified, and cannot be submitted twice. The request hash detects accidental plan mutation only. An MCP plan is also bound to the server instance that prepared and approved it, so another HTTP session cannot submit it. A submitted batch creates no more than four provider tasks concurrently. Exact credit quotes exist only for verified request dimensions; all other requests are `unknown`. No USD conversion is assumed.

## Models

A unified, always-current catalog organized by job:

### Video generation

| Model | Best for | Tool |
| --- | --- | --- |
| **ByteDance Seedance 2.5** | Multimodal references, experimental semantic task continuation, first/last-frame control, and native audio | `bytedance_seedance_video` |
| **Kling 3.0** | Multi-shot videos and native audio | `kling_video` |
| **Google Veo 3 / 3.1** | Cinematic generation with synchronized audio and 1080p output | `veo3_generate_video` |
| **Gemini Omni** | Videos with reusable characters and voices | `gemini_omni` |
| **MiniMax H3 (Hailuo 03)** | Text, first/last-frame, and multimodal reference-to-video | `hailuo_video` |
| **Wan 2.7** and **HappyHorse** | Fast generation, references, and video editing workflows | `wan_video`, `happyhorse_video` |

### Video editing and avatars

- **Runway Aleph**: video-to-video transformation and editing
- **Midjourney** and **Grok Imagine**: image-to-video, stylized generation, and Grok Imagine Image 2.0 image editing
- **Wan Animate**: character animation and replacement
- **OmniHuman 1.5**, **Kling Avatar**, and **InfiniTalk**: talking avatars and lip sync

### Image generation and editing

- **Nano Banana 2 / Lite**, **GPT Image 2**, **ByteDance Seedream V4 / V5 Lite / V5 Pro**, **Flux Kontext / Flux 2**, **Qwen**, and **Z-Image**: generation and image editing
- **Ideogram**, **Recraft**, and **Topaz**: reframing, background removal, and upscaling

### Audio

- **Suno V5 / V5.5**: music generation with realistic vocals and duration control
- **ElevenLabs**: text-to-speech and sound effects

Each tool features **smart mode detection**: one tool handles generate / edit / upscale based on the parameters you pass.

**The complete, current list is always available:** run `kie-cli --help` (and `kie-cli <tool> --help` for a tool's flags), or see **[docs/TOOLS.md](docs/TOOLS.md)**.

## MCP resources & prompts

Beyond tools, the MCP server exposes (all generated from the registry, so they never drift):

- **Prompts** (slash commands in your client): `/image` and `/video`: guidance for picking and driving the right model.
- **Resources:**
  - `kie://tools/<name>`: a Markdown reference for each tool (parameters, types, defaults), generated from its schema.
  - `kie://guides/image-models-comparison`, `kie://guides/video-models-comparison`, `kie://guides/quality-optimization`: model comparison and cost/quality guides.
  - `kie://tasks/active`, `kie://stats/usage`: live view of the local task database.
  - `ui://kie/upload.html`: sandboxed MCP Apps upload widget.

## Examples

### MCP (prepare, approve, submit)

Prepare the paid request first. This does not start generation:

```json
{
  "tool": "prepare_media_generation",
  "arguments": {
    "items": [
      {
        "tool": "nano_banana_image",
        "args": {
          "prompt": "A futuristic city at sunset, cyberpunk style",
          "aspect_ratio": "16:9",
          "resolution": "2K",
          "output_format": "png"
        }
      }
    ]
  }
}
```

The MCP host then presents the returned plan, resolved settings, and price summary with `elicitation.form`. Approve that host form with `confirm: true`; the approved response includes a `planId`. Then submit that approved plan:

```json
{
  "tool": "submit_media_generation",
  "arguments": {
    "planId": "<approved-plan-id>"
  }
}
```

Do not call paid media tools directly from MCP. `KIE_AI_ALLOW_DIRECT_GENERATION=true` is only the explicit legacy bypass.

### CLI

```bash
# 1. Prepare one or more paid requests. This creates no provider task.
kie-cli prepare_media_generation \
  --items '[{"tool":"nano_banana_image","args":{"prompt":"a red panda coding at night, neon","resolution":"2K"}}]' \
  --json

# 2. Review the returned plan, then explicitly approve and submit it.
kie-cli submit_media_generation \
  --planId <prepared-plan-id> \
  --approve <prepared-plan-id> \
  --json

# 3. Wait for a returned task ID in one call.
kie-cli wait_for_task --task_id <id> --json

# Other supported jobs use the same prepare -> approve -> submit flow.
# The raw generation commands below remain lower-level compatibility APIs.
kie-cli suno_generate_music --prompt "Upbeat electronic, energetic" --customMode --model V5 --title "Energy Boost"
kie-cli elevenlabs_tts --text "Welcome to the future of content creation!" --voice Rachel --model turbo
```

Use `prepare_media_generation` for any paid CLI job when you need approval, quotes, defaults, batch control, or replay protection. The raw commands remain available for scripts that deliberately own their own safety boundary. Generation is asynchronous: tools return a `task_id`. Wait for it in a single call with `wait_for_task` (it polls Kie for you and returns the final URLs when ready), or check once with `get_task_status` and browse recent work with `list_tasks`. Add `--json` to the CLI for machine-readable output.

In an MCP client, `wait_for_task` keeps the tool call open and streams `notifications/progress` until the result is ready, so the model gets the URLs without looping. For long jobs (video), enable `resetTimeoutOnProgress` with a generous `maxTotalTimeout` in your client so the call is not cut off at the default timeout.

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
npm run check       # Biome: format + lint + import organization
npm run format      # apply Biome formatting
npm run build       # build all workspaces
npm run typecheck   # type-check all workspaces
npm test            # run the test suite
```

This is an npm-workspaces monorepo: `packages/core` (private shared registry, bundled into the others), `packages/mcp` (`@felores/kie-ai-mcp-server`) and `packages/cli` (`@felores/kie-cli`). To add a model, run `npm run add-tool -- <name> <category>` and both surfaces pick it up. For the dev server with auto-reload: `npm run dev -w @felores/kie-ai-mcp-server`.
</details>

<details>

<summary><strong>🌐 Remote / HTTP transport (v5.0.0+)</strong></summary>

The server defaults to **stdio** (one local process per client). It can also run
as a **remote HTTP service** over **Streamable HTTP**. Since v5.0.0 it is built
on the MCP SDK v2 packages and serves both 2025-era and 2026-07-28 clients by
protocol negotiation.

**Why use it:**
- **One shared instance for many clients** — host it once, connect your whole
  team or several agents over the network instead of spawning a local process each.
- **Deploy anywhere** — runs as a container on any host or PaaS (Dockerfile +
  Coolify compose included), behind your own TLS/proxy.
- **Centralized config & task history** — a single API key and one shared SQLite
  task DB, so generations are tracked in one place.
- **Secured by default off-loopback** — bearer-token auth and Host-allowlist
  (DNS-rebinding) protection, with an open `/health` endpoint for uptime probes.
- **Zero disruption** — stdio stays the default; HTTP is purely opt-in.

Opt in with `MCP_TRANSPORT=http` or `--http`:

```bash
KIE_AI_API_KEY=sk-... MCP_TRANSPORT=http MCP_HTTP_PORT=3000 \
  node packages/mcp/dist/index.js
curl http://127.0.0.1:3000/health
# → {"status":"ok","transport":"streamable-http","sessions":0,"version":"5.0.0"}
```

Single `/mcp` endpoint (POST + GET/SSE + DELETE), stateful sessions via
`Mcp-Session-Id`, plus an unauthenticated `GET /health`.

| Env | Default | Purpose |
|-----|---------|---------|
| `MCP_TRANSPORT` | `stdio` | set `http` to enable |
| `MCP_HTTP_HOST` | `127.0.0.1` | `0.0.0.0` only in a container / behind a proxy |
| `MCP_HTTP_PORT` | `3000` | listen port |
| `KIE_MCP_HTTP_TOKEN` | _(unset)_ | require `Authorization: Bearer <token>` |
| `MCP_ALLOWED_HOSTS` | _(unset)_ | Host allowlist (DNS-rebind protection); required off-loopback |

Docker + Coolify deployment and a client-connection walkthrough are in
[docs/DEPLOY_HTTP.md](docs/DEPLOY_HTTP.md).
</details>

## Task management

The server keeps a local SQLite database of prepared plans and tasks, persistent across restarts, used for approval safety, status tracking, and correct endpoint routing.

```json
{ "tool": "list_tasks", "arguments": { "limit": 20, "status": "completed" } }
```
```json
{ "tool": "get_task_status", "arguments": { "task_id": "281e5b0...f39b9" } }
```

Note: `list_tasks` reflects the MCP's local cache, tasks it has created or polled, not your full Kie.ai account history. When a provider status response includes `creditsConsumed`, it is returned as actual task usage, separately from a plan quote. See [docs/DATABASE.md](docs/DATABASE.md).

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
