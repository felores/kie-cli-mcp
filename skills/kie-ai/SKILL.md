---
name: kie-ai
description: >-
  Generate media (images, video, music, speech, sound effects, lip-sync, upscaling)
  with AI through the Kie.ai `kie-cli` command. Use this whenever the user wants to
  create or edit an image, generate a video, compose music, synthesize a voice/TTS,
  make a talking-avatar or lip-sync clip, upscale an image, or remove a background,
  and whenever they mention Kie.ai, Nano Banana, Veo3, Suno, ElevenLabs, Seedance,
  Seedream, Midjourney, Flux, Kling, Wan, Hailuo, GPT Image, Recraft, Ideogram, or
  Topaz. Trigger even if the user doesn't name a model, e.g. "make me an image of...",
  "turn this photo into a video", "generate a 30s song", "read this text aloud". If
  the `kie-cli` command isn't installed, this skill explains how to install it.
---

# Kie.ai media generation (kie-cli)

Kie.ai gives one API access to many top media models. The `kie-cli` command exposes
each model as a subcommand. It is **self-documenting**: you discover commands and
flags at runtime, so you never need a hardcoded model list (which would go stale as
models change).

## Step 0, Check the CLI is available

```bash
command -v kie-cli >/dev/null && kie-cli --help >/dev/null 2>&1 && echo "kie-cli ready" || echo "kie-cli missing"
```

- If ready, go to **Workflow**.
- If missing, go to **Install**.

Also confirm the API key is set (the CLI needs it to do anything):

```bash
[ -n "$KIE_AI_API_KEY" ] && echo "key set" || echo "KIE_AI_API_KEY not set"
```

## Install (only if the CLI is missing)

**Option A, from npm (preferred):**

```bash
npm i -g @felores/kie-cli && kie-cli --help | head -1   # install + verify
```

**Option B, from the monorepo (use if Option A fails with a 404 / "not found",
i.e. the package isn't published yet).** This builds the self-contained CLI bundle
and links it as a global `kie-cli`:

```bash
REPO="$HOME/Documents/GitHub/mcp/kie-ai-mcp-server"
[ -d "$REPO" ] || git clone https://github.com/felores/kie-cli-mcp "$REPO"
cd "$REPO"
npm install
npm run build -w @felores/kie-ai-core && npm run bundle -w @felores/kie-cli
chmod +x packages/cli/dist/index.js
ln -sf "$PWD/packages/cli/dist/index.js" "$(npm config get prefix)/bin/kie-cli"
kie-cli --help | head -1       # verify
```

(The bundle inlines everything except `sqlite3`, so the linked `kie-cli` runs
standalone. To remove it later: `rm "$(npm config get prefix)/bin/kie-cli"`.)

Then set the API key (get one at https://kie.ai). For this shell session:

```bash
export KIE_AI_API_KEY="your-key"
```

To persist it, add that line to `~/.zshrc` (or `~/.bashrc`). Optional env vars:
`KIE_AI_BASE_URL`, `KIE_AI_TIMEOUT`, `KIE_AI_DB_PATH`, `KIE_AI_CALLBACK_URL`.

If `npm i -g` fails with permissions, prefer fixing the npm prefix or using a node
version manager rather than `sudo`. If you genuinely cannot install the CLI, the same
models are also available through the MCP server `@felores/kie-ai-mcp-server` (add it
to your MCP client config with the same `KIE_AI_API_KEY`): but the rest of this skill
assumes the CLI.

## Workflow

The flow is always: **discover → generate → poll → read result.** Generation is
asynchronous: a generate command returns a `task_id`, and you poll until it finishes.

### 1. Discover the right command and its flags

```bash
kie-cli --help                 # all commands, grouped [image]/[video]/[audio]/[utility]
kie-cli <tool> --help          # that tool's flags, with types, choices, and defaults
```

Read `<tool> --help` before composing a command, the flags, allowed enum values, and
defaults come straight from the tool's schema, so this is the source of truth. Don't
guess flag names.

### 2. Run the generation with `--json`

Always pass `--json` so the output is machine-readable and you can extract the task id
reliably (e.g. with `jq`). Without `--json` the output is pretty-printed for humans.

### 3. Poll the task until it completes

```bash
kie-cli get_task_status --task_id <id> --json
```

Re-run until the status indicates completion (or failure). When complete, the JSON
holds the output URL(s): inspect the response fields. `get_task_status` also returns
polling guidance (suggested interval) based on the media type; images finish in
seconds, videos can take minutes. Don't poll in a tight loop, wait a few seconds
between checks.

### 4. List recent work

```bash
kie-cli list_tasks --json      # recent task ids + statuses (shared local task DB)
```

## Worked examples

**Image (Nano Banana):**
```bash
# discover flags, then generate
kie-cli nano_banana_image --help
kie-cli nano_banana_image --prompt "a red panda coding at night, neon" --resolution 2K --json
# -> {"success": true, ... "task_id": "abc123" ...}
kie-cli get_task_status --task_id abc123 --json
```

**Video (Veo3), extracting the id with jq:**
```bash
ID=$(kie-cli veo3_generate_video --prompt "drone shot over a canyon at sunrise" --json | jq -r '.task_id // .response.data.taskId')
kie-cli get_task_status --task_id "$ID" --json
```

**Speech (ElevenLabs TTS):**
```bash
kie-cli elevenlabs_tts --help
kie-cli elevenlabs_tts --text "Welcome to the demo." --json
```

## Notes for reliable use

- **`--json` for anything programmatic.** Parse it; don't scrape the pretty output.
- **Errors are data, not crashes.** A bad/missing parameter returns
  `{"success": false, "error": ..., "parameter_guidance": ...}` and a non-zero exit
  code. Read `parameter_guidance` and fix the flags, then retry.
- **Invalid enum values are rejected by the CLI** with the list of valid choices,
  if you hit that, re-check `<tool> --help`.
- **One image/edit tool may take reference images** (e.g. `--image_input <url> ...`);
  array flags accept multiple values: `--image_input url1 url2`.
- **Don't hardcode the model list.** New models appear over time; `kie-cli --help` is
  always current.
