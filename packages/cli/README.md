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

Add `--json` to print the raw tool result (machine-readable, ideal for piping to
`jq` or other agents):

```bash
kie-cli list_tasks --json | jq '.tasks'
```

Tools that return a `success: false` payload set a non-zero exit code.

## Available tools

Run `kie-cli --help` for the current list. Tools are grouped by category
(`image`, `video`, `audio`, `utility`) and include Nano Banana, Veo3, Suno,
ElevenLabs, ByteDance Seedance/Seedream, Qwen, Runway Aleph, Midjourney, Wan,
Hailuo, Kling, GPT Image 2, Flux Kontext, Recraft, Ideogram, Topaz, HappyHorse
and more.

## License

MIT
