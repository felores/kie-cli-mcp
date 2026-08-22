# @felores/kie-ai-mcp-server

MCP server for the [Kie.ai](https://kie.ai) APIs: image, video, music and speech
generation across Nano Banana, Veo3, Suno, ElevenLabs, ByteDance Seedance 2.5, Qwen, Runway,
Midjourney, Wan, MiniMax H3 (Hailuo 03), Kling, GPT Image 2, Flux Kontext, Recraft, Ideogram,
Topaz, HappyHorse and more. Exposes every model as an MCP tool to Claude Desktop
and other MCP clients.

Prefer a terminal? The same models are available as a standalone CLI:
[`@felores/kie-cli`](https://www.npmjs.com/package/@felores/kie-cli) (binary `kie-cli`). Both surfaces
are generated from one shared tool registry and install independently.

## Install / configure

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kie-ai": {
      "command": "npx",
      "args": ["-y", "@felores/kie-ai-mcp-server"],
      "env": { "KIE_AI_API_KEY": "your-key" }
    }
  }
}
```

### Environment

- Required: `KIE_AI_API_KEY`
- Optional: `KIE_AI_BASE_URL`, `KIE_AI_TIMEOUT`, `KIE_AI_DB_PATH`,
  `KIE_AI_CALLBACK_URL`
- Optional remote upload storage: `KIE_MCP_PUBLIC_BASE_URL`,
  `KIE_MCP_HTTP_TOKEN`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, and
  `MCP_UPLOAD_ALLOWED_ORIGINS` must be configured together.
- Tool filtering: `KIE_AI_ENABLED_TOOLS`, `KIE_AI_TOOL_CATEGORIES`,
  `KIE_AI_DISABLED_TOOLS`
- Direct paid generation compatibility bypass: `KIE_AI_ALLOW_DIRECT_GENERATION=true`
  bypasses the default prepare, host approval, and submit safeguards. Leave it unset
  for approval-bound MCP generation.

## Tools

By default, MCP exposes utility tools and requires `prepare_media_generation`, host
approval, then `submit_media_generation` for paid image, video, and audio work.
Generation tasks can be polled with `get_task_status` and browsed with `list_tasks`. See the
[repository](https://github.com/felores/kie-cli-mcp) for full tool docs.

`upload_file` supports validated Base64 and intentionally rejects arbitrary URL imports.
MCP Apps hosts can render `upload_widget`; it uses one-use upload capabilities
outside model-visible content, then resolves an opaque `media_id` server-side.

## License

MIT
