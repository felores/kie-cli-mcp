# @felores/kie-ai-mcp-server

MCP server for the [Kie.ai](https://kie.ai) APIs: image, video, music and speech
generation across Nano Banana, Veo3, Suno, ElevenLabs, ByteDance, Qwen, Runway,
Midjourney, Wan, Hailuo, Kling, GPT Image 2, Flux Kontext, Recraft, Ideogram,
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
- Tool filtering: `KIE_AI_ENABLED_TOOLS`, `KIE_AI_TOOL_CATEGORIES`,
  `KIE_AI_DISABLED_TOOLS`

## Tools

Generation tools create async tasks; poll them with `get_task_status` and browse
recent work with `list_tasks`. See the
[repository](https://github.com/felores/kie-ai-mcp-server) for full tool docs.

## License

MIT
