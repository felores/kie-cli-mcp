# @felores/kie-cli

Standalone command-line interface for the [Kie.ai](https://kie.ai) APIs: generate
images, video, music and speech from your terminal. Same models as the
[`@felores/kie-ai-mcp-server`](https://www.npmjs.com/package/@felores/kie-ai-mcp-server)
MCP server, no MCP client required.

The CLI and the MCP server are generated from one shared tool registry, so both
always expose the exact same tools. They install and run completely
independently.

## Install

```bash
npm install -g @felores/kie-cli
```

## Setup

```bash
export KIE_AI_API_KEY="your-key"
```

Optional: `KIE_AI_BASE_URL`, `KIE_AI_TIMEOUT`, `KIE_AI_DB_PATH`, `KIE_AI_CALLBACK_URL`.
`upload_file` accepts validated Base64 or a local path beneath explicitly
configured `KIE_CLI_UPLOAD_ROOTS`. Temporary HTTP upload
capabilities and `upload_widget` require the MCP HTTP adapter and return clear
unsupported-adapter guidance in the CLI.

## Usage

```bash
# List every tool (commands map 1:1 to the MCP tools)
kie-cli --help

# See the flags for a tool (derived from its schema)
kie-cli nano_banana_image --help

# Generate an image
kie-cli nano_banana_image --prompt "a red panda coding at night" --resolution 2K

# Generate a video, then poll the task
kie-cli veo3_generate_video --prompt "drone shot over a canyon at sunrise"
kie-cli get_task_status --task_id <id>

# List recent tasks
kie-cli list_tasks --limit 10
```

### JSON output

Current model selectors include Suno `V6`/`V6_MINI`/`V6_WILD`, GPT Image 2.5
`flare`/`sunburst`, Seedream `5-pro`/`5-flash`, Qwen `qwen3`/`qwen3-pro`,
Wan video `wan/3-0-video`/`wan/3-0-video-prime`, and Wan image
`wan/2-7-image`/`wan/2-7-image-pro`. HappyHorse now routes only to 1.1.
Retired provider versions and parameters are rejected.

Nested Wan editing boxes use JSON; `input_urls` stays a normal array flag:

```bash
kie-cli wan_image --prompt "Replace the marked object" \
  --input_urls https://example.com/product.png \
  --bbox_list '[[[10,20,100,120]]]' --n 1
```

Add `--json` to print the raw tool result (machine-readable, ideal for piping to
`jq` or other agents):

```bash
kie-cli list_tasks --json | jq '.tasks'
```

Tools that return a `success: false` payload set a non-zero exit code.

## Available tools

Run `kie-cli --help` for the current list. Tools are grouped by category
(`image`, `video`, `audio`, `utility`) and include Nano Banana, Veo3, Suno,
ElevenLabs, ByteDance Seedance 2.5/Seedream, Qwen, Runway Aleph, Midjourney, Wan,
MiniMax H3 (Hailuo 03), Kling, GPT Image 2, Flux Kontext, Recraft, Ideogram, Topaz, HappyHorse
and more.

## License

MIT
