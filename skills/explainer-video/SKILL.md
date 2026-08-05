---
name: explainer-video
description: >-
  Produce a complete narrated animated explainer video (TED-Ed style) end-to-end
  with the Kie.ai `kie-cli` command: character references, per-scene stills,
  image-to-video animation, voiceover narration, and final ffmpeg assembly, all
  driven by one storyboard JSON file. Use this whenever the user wants a full
  explainer video, educational video, narrated animation, "video about X",
  "explain X in a video", faceless channel video, or wants to turn a script or
  storyboard into a finished video. For single one-off generations (one image,
  one clip, one voice line) use the `kie-ai` skill instead.
---

# Explainer video production (kie-cli)

This skill turns a **storyboard JSON** into a **finished narrated video** using the
`kie-cli` pipeline runner bundled here. The pipeline is:

```
storyboard.json
  → character reference images   (nano_banana_image)
  → per-scene stills             (nano_banana_image + character refs for consistency)
  → per-scene animated clips     (kling_video, image-to-video from each still)
  → per-scene narration          (elevenlabs_tts)
  → assembly                     (ffmpeg: sync each clip to its narration, concat, music bed)
  → final.mp4
```

## Step 0 — Prerequisites

```bash
command -v kie-cli >/dev/null && echo "kie-cli ready" || echo "kie-cli missing (see kie-ai skill Install)"
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null && echo "ffmpeg ready" || echo "ffmpeg missing (brew install ffmpeg)"
[ -n "$KIE_AI_API_KEY" ] && echo "key set" || echo "KIE_AI_API_KEY not set"
```

All three must be ready. `kie-cli` install instructions live in the `kie-ai` skill.

## Step 1 — Author the storyboard

Write a storyboard JSON conforming to `references/storyboard.schema.json`. A complete
worked example is at `examples/reading-daily.storyboard.json`.

**If the user has only a topic (no script yet):** write the script first using the
narrative formula in `references/style-guide.md` — hook → bridge → mechanism →
application → obstacle & fixes → bookend + CTA. One scene = one narration sentence =
one visual metaphor = 8–12 seconds.

Storyboard rules that make the pipeline work well:

- `style` is appended to **every** image prompt: keep it as a single reusable style
  string (see the style guide for the TED-Ed default).
- Every scene's `vo` (narration line) should read aloud in **under ~14 seconds**
  (≈ 35 words). The assembler paces each scene to its narration; Kling clips max out
  at 15s, so longer narration gets a frozen final frame. Split long beats into two scenes.
- List the character ids that appear in each scene in `characters`; their reference
  images are passed to the still generator so faces/outfits stay consistent.
- `motion` describes camera/animation for the clip prompt ("slow lateral tracking",
  "static with subtle flicker", "speed ramp") — keep it modest; this is 2D animation.

## Step 2 — Dry run (cost & sanity preview)

```bash
node skills/explainer-video/scripts/produce.mjs \
  --storyboard my-video.storyboard.json --out build/my-video --dry-run
```

This prints every generation that would run (counts per stage) without spending
credits. Review scene count and total clip seconds with the user before proceeding.

## Step 3 — Produce

```bash
node skills/explainer-video/scripts/produce.mjs \
  --storyboard my-video.storyboard.json --out build/my-video
```

The runner is **resumable**: progress persists in `<out>/state.json`, so a crash,
Ctrl-C, or failed generation only re-runs the missing pieces. Re-run the same
command to continue. Useful flags:

- `--stage characters|stills|voiceover|clips|assemble` — run a single stage
- `--voice Brian` — override the storyboard's narrator voice
- `--mode pro` — Kling pro quality (higher cost; default `std`)
- `--concurrency 4` — parallel task submissions (default 3)

Stage order when run individually: characters → stills → voiceover → clips →
assemble. (Voiceover before clips: each clip's duration is derived from its
narration length.)

## Step 4 — Review checkpoints (recommended with a user present)

Rather than one long unattended run, pause for approval at the cheap-to-fix points:

1. After **characters**: show the reference images; regenerate if the look is wrong
   (delete that character's entry in `state.json` and re-run).
2. After **stills**: skim the scene images; fix prompts for any broken scene, clear
   just those scenes from `state.json`, re-run stills.
3. Then run voiceover + clips + assemble unattended.

## Output

```
<out>/characters/<id>.png     character reference images
<out>/stills/scene-NN.png     per-scene stills
<out>/clips/scene-NN.mp4      raw animated clips
<out>/vo/scene-NN.mp3         per-scene narration
<out>/segments/scene-NN.mp4   narration-synced segments
<out>/final.mp4               the finished video
```

## Notes

- **Cost scales linearly with scene count.** ~30 scenes ≈ 2–4 character images +
  30 stills + 30 clips + 30 TTS lines. Always dry-run first and confirm with the user.
- **Failed generations are data.** The runner records failures in `state.json` and
  continues; re-run to retry only the failures.
- Result URLs from Kie.ai expire after ~14 days; the runner downloads every asset
  locally as soon as it completes.
- The assembler paces the video to the narration (scene = VO length + a beat of
  silence), which is what makes the result feel authored rather than stitched.
