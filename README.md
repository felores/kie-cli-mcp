# 🎨 Kie.ai MCP Server — Self-Hosted Edition

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.x-blue)](https://modelcontextprotocol.io)
[![Transport](https://img.shields.io/badge/transport-stdio%20%7C%20streamable--http-green)](#-quick-start)
[![Deploy](https://img.shields.io/badge/deploy-Coolify%20%7C%20Docker-8b5cf6)](#-self-host-on-coolify-recommended)
[![AI Tools](https://img.shields.io/badge/AI_tools-28-orange)](#-what-you-get)

**One MCP server for state-of-the-art AI generation — video, images, music, audio — running on _your own_ server.**

This is a self-hostable build of the Kie.ai MCP server: the same 28 AI tools, plus a **remote Streamable HTTP transport** so you can deploy it on your own infrastructure (Coolify-first), reach it from anywhere, and keep your data and your API key on your own box.

---

## ⚡ What This Is

The original [kie-ai-mcp-server by felores](https://github.com/felores/kie-ai-mcp-server) is a fantastic stdio MCP server — it runs locally as a subprocess of your AI client. This fork adds what you need to **run it as a service**:

- 🌐 **Remote Streamable HTTP transport** — reachable over the network, not just locally
- 🔐 **Bearer-token auth** — so only you can spend your credits
- 🐳 **Docker + Coolify deploy** — one compose file, automatic HTTPS
- ♻️ **Dual transport** — `stdio` stays the default, so nothing breaks for local users

Perfect as the first MCP behind a self-hosted gateway like [MetaMCP](https://github.com/metatool-ai/metamcp) or [MCPJungle](https://github.com/mcpjungle/MCPJungle).

## 🎯 Architecture

```
   Claude Desktop / Cursor / claude.ai
                │  Bearer token
                ▼
        MCP Gateway (MetaMCP)            ← one endpoint for all your MCPs
                │
                ▼
   ┌─────────────────────────────┐
   │  kie-ai-mcp  (this server)  │      ← your Coolify service
   │  Streamable HTTP  →  /mcp    │         • /health for Coolify
   │  SQLite task DB   →  /data   │         • your KIE_AI_API_KEY
   └─────────────────────────────┘
                │
                ▼
            Kie.ai API  (Veo3, Nano Banana, Suno, …)
```

## 🚀 Quick Start

Two ways to run it — pick one.

| Mode | When | How |
|------|------|-----|
| 🐳 **Self-hosted (HTTP)** | Reachable from anywhere, behind a gateway, on your own server | [Coolify deploy ↓](#-self-host-on-coolify-recommended) |
| 💻 **Local (stdio)** | Quick local use in one client | [npx config ↓](#-local-use-stdio) |

---

## 🐳 Self-Host on Coolify (recommended)

Deploy straight from this repo. Coolify builds the image and provisions HTTPS for you.

**1. New resource** → Coolify → your project → **+ New Resource → Docker Compose**

**2. Point it at this repo**

| Setting | Value |
|---------|-------|
| Repository | `https://github.com/oliverhees/kie-ai-mcp-server.git` |
| Branch | `main` |
| Compose file | `docker-compose.coolify.yml` |

**3. Set environment variables**

```bash
SERVICE_FQDN_KIEAIMCP_3000=kie-mcp.your-domain.tld   # your subdomain — Coolify adds TLS
KIE_AI_API_KEY=your-kie-ai-api-key                   # from https://kie.ai/api-key
MCP_AUTH_TOKEN=$(openssl rand -hex 32)               # secret bearer token — see note below
```

> ⚠️ **Always set `MCP_AUTH_TOKEN`.** Without it the `/mcp` endpoint is **open**, and anyone with the URL can spend your Kie.ai credits. Generate one with `openssl rand -hex 32`.

**4. Deploy.** The build compiles the native `sqlite3` addon (~1–2 min), then fetches a TLS cert.

**5. Verify**

```bash
curl https://kie-mcp.your-domain.tld/health
# → {"status":"ok","transport":"streamable-http","sessions":0}
```

The SQLite task history lives on the `/data` volume, so it survives redeploys.

### 🔌 Connect a client

| Client | URL | Auth |
|--------|-----|------|
| **claude.ai** (Custom Connector) | `https://kie-mcp.your-domain.tld/mcp` | Bearer `MCP_AUTH_TOKEN` |
| **Claude Desktop / Cursor** | same URL (via Streamable HTTP / `mcp-remote`) | `Authorization: Bearer …` |
| **MetaMCP / MCPJungle** | register as a Streamable HTTP server, same URL + token | Bearer `MCP_AUTH_TOKEN` |

---

## 💻 Local Use (stdio)

For quick local use the original stdio mode is unchanged — just add it to your MCP client:

```json
{
  "mcpServers": {
    "kie-ai": {
      "command": "npx",
      "args": ["-y", "@felores/kie-ai-mcp-server"],
      "env": { "KIE_AI_API_KEY": "your-api-key-here" }
    }
  }
}
```

Works with Claude Desktop, Cursor, Windsurf, VS Code, Claude Code, and more.

---

## ⚙️ Configuration

### Transport (remote vs. local)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_TRANSPORT` | `stdio` | `stdio` (local) or `http` (remote Streamable HTTP) |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | HTTP bind (http mode) |
| `MCP_AUTH_TOKEN` | — | Bearer token; **set this when public** |
| `MCP_HTTP_PATH` | `/mcp` | MCP endpoint path |
| `MCP_CORS_ORIGIN` | `*` | CORS origin for browser clients (claude.ai) |

### Kie.ai

| Variable | Default | Purpose |
|----------|---------|---------|
| `KIE_AI_API_KEY` | — | **Required.** From [kie.ai/api-key](https://kie.ai/api-key) |
| `KIE_AI_DB_PATH` | `~/.kie-ai/tasks.db` | SQLite path. In Docker: `/data/tasks.db` (volume) |
| `KIE_AI_CALLBACK_URL` | — | Optional public callback URL for async tasks |

### Tool filtering

Reduce noise by enabling only the tools you use:

```bash
KIE_AI_ENABLED_TOOLS="nano_banana_image,veo3_generate_video,suno_generate_music"  # whitelist
KIE_AI_TOOL_CATEGORIES="image,video"                                              # by category
KIE_AI_DISABLED_TOOLS="midjourney_generate,runway_aleph_video"                    # blacklist
```

Priority: `ENABLED_TOOLS` > `TOOL_CATEGORIES` > `DISABLED_TOOLS` > all. Utility tools (`list_tasks`, `get_task_status`) are always on.

---

## 🎨 What You Get

**28 unified AI tools** across image, video, and audio — Veo 3, Nano Banana 2, Suno V5, ElevenLabs, ByteDance Seedance/Seedream, Qwen, GPT Image 2, Flux Kontext, Wan 2.7, Hailuo, Kling, Midjourney, Runway Aleph, Topaz, Recraft, Ideogram, and more. Each tool features smart mode detection (generate / edit / upscale in one).

**→ [Full tool reference](docs/TOOLS.md)** · [Database & tasks](docs/DATABASE.md) · [Admin config](docs/ADMIN.md)

## 🔑 Key Features

- 🌐 **Remote-ready** — Streamable HTTP transport with stateful sessions
- 🔐 **Auth built in** — bearer-token gate, open `/health` for healthchecks
- 🐳 **Coolify/Docker deploy** — multi-stage image, persistent DB volume
- 🎯 **One API key** for all models · 🔄 **SQLite task tracking** that survives restarts
- 🧠 **Smart cost control** — defaults to the cheapest tier unless you ask for quality

## 🆘 Troubleshooting

**`401` on `/mcp`** — your client isn't sending `Authorization: Bearer <MCP_AUTH_TOKEN>`, or the token doesn't match.

**Coolify build fails** — make sure the compose file path is `docker-compose.coolify.yml` and the branch is correct. The `sqlite3` addon needs the build stage's toolchain (already in the Dockerfile).

**`/health` not responding right after deploy** — the server takes ~1–4 s to boot (large tool registry). The healthcheck's `start_period` covers this; just wait a moment.

---

## 🙏 Credits

- **[felores/kie-ai-mcp-server](https://github.com/felores/kie-ai-mcp-server)** — the original MCP server and all 28 AI tools. This edition only adds the remote/self-hosting layer.
- **[Kie.ai](https://kie.ai)** — the unified AI generation API.
- **[Model Context Protocol](https://modelcontextprotocol.io)** — the open standard this builds on.

## 👋 About — Aiianer

Self-hosting layer built and maintained by **Oliver Hees** (aka **Aiianer**) — building tools, courses, and content for the German-speaking AI builder community.

If this helped you self-host your own AI tooling, the best way to say thanks is to come hang out:

[![Skool Community](https://img.shields.io/badge/Skool-Aiianer_Community-purple?style=for-the-badge&logo=skool)](https://skool.com/aiianer)
[![YouTube](https://img.shields.io/badge/YouTube-%40aiianer-red?style=for-the-badge&logo=youtube)](https://youtube.com/@aiianer)
[![Website](https://img.shields.io/badge/Website-aiianer.de-blue?style=for-the-badge&logo=safari)](https://aiianer.de)

- 🎓 **[Skool Community](https://skool.com/aiianer)** — courses, deep-dives, and a community of builders
- 📺 **[YouTube](https://youtube.com/@aiianer)** — tutorials and walkthroughs
- 🌐 **[Website](https://aiianer.de)** — everything else

## 📄 License

[MIT](LICENSE) — do whatever you want, just don't blame me if it breaks.

If you fork it or build something on top, a backlink to this repo or a shoutout to [@aiianer](https://aiianer.de) is appreciated but not required. Original tools © [felores](https://github.com/felores/kie-ai-mcp-server).

---

**Made with 💛 in Germany · [aiianer.de](https://aiianer.de)**
