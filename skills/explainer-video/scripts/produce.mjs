#!/usr/bin/env node
/**
 * Explainer-video pipeline runner for kie-cli.
 *
 * storyboard.json → character refs → scene stills → narration → clips → final.mp4
 *
 * Resumable: every completed step is recorded in <out>/state.json; re-running the
 * same command skips finished work and retries failures only.
 *
 * Requires: kie-cli (with KIE_AI_API_KEY set), ffmpeg + ffprobe, Node >= 18.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

// ---------- CLI args ----------

const args = process.argv.slice(2);
function flag(name, fallback = undefined) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

const STORYBOARD = flag("storyboard");
const OUT = flag("out", "build/explainer");
const STAGE = flag("stage", "all");
const DRY = !!flag("dry-run", false);
const MODE = flag("mode", "std");
const VOICE_OVERRIDE = flag("voice");
const CONCURRENCY = parseInt(flag("concurrency", "3"), 10);

if (!STORYBOARD) {
  console.error(
    "Usage: produce.mjs --storyboard <file.json> [--out dir] [--stage all|characters|stills|voiceover|clips|assemble] [--dry-run] [--mode std|pro] [--voice Name] [--concurrency N]",
  );
  process.exit(1);
}

// ---------- Load storyboard & state ----------

const sb = JSON.parse(readFileSync(STORYBOARD, "utf8"));
const AR = sb.aspect_ratio || "16:9";
const [ARW, ARH] = AR === "9:16" ? [1080, 1920] : AR === "1:1" ? [1080, 1080] : [1920, 1080];
const VOICE = VOICE_OVERRIDE || sb.voice?.name || "Brian";

for (const d of ["", "characters", "stills", "clips", "vo", "segments"]) {
  mkdirSync(path.join(OUT, d), { recursive: true });
}
const STATE_FILE = path.join(OUT, "state.json");
const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
  : { characters: {}, stills: {}, vo: {}, clips: {} };
function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------- kie-cli helpers ----------

function runKie(toolArgs) {
  const res = spawnSync("kie-cli", [...toolArgs, "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const raw = (res.stdout || "").trim();
  try {
    // stdout may carry log lines before the JSON object; parse from first '{'
    const start = raw.indexOf("{");
    return JSON.parse(raw.slice(start));
  } catch {
    return { success: false, error: raw || res.stderr || `kie-cli exited ${res.status}` };
  }
}

function deepFind(obj, pred, out = []) {
  if (obj == null) return out;
  if (typeof obj === "string") {
    if (pred(obj)) out.push(obj);
  } else if (typeof obj === "object") {
    for (const v of Object.values(obj)) deepFind(v, pred, out);
  }
  return out;
}

function extractTaskId(resp) {
  if (resp.task_id) return resp.task_id;
  const ids = deepFind(resp, (s) => /^[a-zA-Z0-9_-]{8,64}$/.test(s));
  return resp.data?.taskId || resp.taskId || ids[0];
}

function extractResultUrl(resp) {
  if (resp.result_url) return resp.result_url;
  const urls = deepFind(resp, (s) => /^https?:\/\/\S+\.(png|jpe?g|webp|mp4|mov|mp3|wav|m4a)(\?|$)/i.test(s));
  return urls[0];
}

async function pollTask(taskId, { intervalMs, timeoutMs, label }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const resp = runKie(["get_task_status", "--task_id", taskId]);
    const status = (resp.status || resp.local_status || "").toLowerCase();
    if (status === "completed") {
      const url = extractResultUrl(resp);
      if (url) return url;
      throw new Error(`${label}: completed but no result URL found for task ${taskId}`);
    }
    if (status === "failed") {
      throw new Error(`${label}: task ${taskId} failed: ${resp.error_message || resp.error || "unknown"}`);
    }
    if (Date.now() > deadline) throw new Error(`${label}: task ${taskId} timed out`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function download(url, dest) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed ${resp.status}: ${url}`);
  await pipeline(Readable.fromWeb(resp.body), createWriteStream(dest));
  return dest;
}

/** Run jobs with bounded concurrency; failures are collected, not fatal. */
async function runPool(items, worker, concurrency = CONCURRENCY) {
  const queue = [...items];
  const failures = [];
  async function lane() {
    while (queue.length) {
      const item = queue.shift();
      try {
        await worker(item);
      } catch (err) {
        failures.push({ item, error: String(err.message || err) });
        console.error(`  ✗ ${err.message || err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return failures;
}

// ---------- ffmpeg helpers ----------

function ff(cmdArgs, label) {
  const res = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...cmdArgs], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`ffmpeg failed (${label}): ${res.stderr?.slice(0, 800)}`);
}

function mediaDuration(file) {
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  const d = parseFloat((res.stdout || "").trim());
  if (!isFinite(d)) throw new Error(`ffprobe could not read duration of ${file}`);
  return d;
}

// ---------- Stages ----------

const stylize = (p) => `${p}, ${sb.style}`;

async function stageCharacters() {
  console.log(`\n== Characters (${sb.characters.length}) ==`);
  const pending = sb.characters.filter((c) => !state.characters[c.id]?.file);
  if (DRY) {
    pending.forEach((c) => console.log(`  [dry] nano_banana_image: character ${c.id}`));
    return;
  }
  const failures = await runPool(pending, async (c) => {
    console.log(`  → character ${c.id}`);
    const resp = runKie([
      "nano_banana_image",
      "--prompt", stylize(c.prompt),
      "--aspect_ratio", AR,
      "--output_format", "png",
    ]);
    if (resp.success === false) throw new Error(`character ${c.id}: ${resp.error}`);
    const taskId = extractTaskId(resp);
    const url = await pollTask(taskId, { intervalMs: 5000, timeoutMs: 10 * 60_000, label: `character ${c.id}` });
    const file = path.join(OUT, "characters", `${c.id}.png`);
    await download(url, file);
    state.characters[c.id] = { taskId, url, file };
    saveState();
    console.log(`  ✓ character ${c.id}`);
  });
  if (failures.length) throw new Error(`${failures.length} character(s) failed — re-run to retry`);
}

async function stageStills() {
  console.log(`\n== Stills (${sb.scenes.length} scenes) ==`);
  const pending = sb.scenes.filter((s) => !state.stills[s.id]?.file);
  if (DRY) {
    pending.forEach((s) => console.log(`  [dry] nano_banana_image: scene ${s.id} (refs: ${(s.characters || []).join(",") || "none"})`));
    return;
  }
  const failures = await runPool(pending, async (s) => {
    console.log(`  → still ${s.id}`);
    const refs = (s.characters || [])
      .map((id) => state.characters[id]?.url)
      .filter(Boolean);
    const cliArgs = [
      "nano_banana_image",
      "--prompt", stylize(s.prompt),
      "--aspect_ratio", AR,
      "--output_format", "png",
    ];
    if (refs.length) cliArgs.push("--image_input", ...refs);
    const resp = runKie(cliArgs);
    if (resp.success === false) throw new Error(`still ${s.id}: ${resp.error}`);
    const taskId = extractTaskId(resp);
    const url = await pollTask(taskId, { intervalMs: 5000, timeoutMs: 10 * 60_000, label: `still ${s.id}` });
    const file = path.join(OUT, "stills", `scene-${String(s.id).padStart(2, "0")}.png`);
    await download(url, file);
    state.stills[s.id] = { taskId, url, file };
    saveState();
    console.log(`  ✓ still ${s.id}`);
  });
  if (failures.length) throw new Error(`${failures.length} still(s) failed — re-run to retry`);
}

async function stageVoiceover() {
  console.log(`\n== Voiceover (${sb.scenes.length} lines, voice: ${VOICE}) ==`);
  const pending = sb.scenes.filter((s) => !state.vo[s.id]?.file);
  if (DRY) {
    pending.forEach((s) => console.log(`  [dry] elevenlabs_tts: scene ${s.id} (${s.vo.split(/\s+/).length} words)`));
    return;
  }
  const failures = await runPool(pending, async (s) => {
    console.log(`  → vo ${s.id}`);
    const cliArgs = ["elevenlabs_tts", "--text", s.vo, "--voice", VOICE];
    if (sb.voice?.speed) cliArgs.push("--speed", String(sb.voice.speed));
    if (sb.voice?.stability) cliArgs.push("--stability", String(sb.voice.stability));
    const resp = runKie(cliArgs);
    if (resp.success === false) throw new Error(`vo ${s.id}: ${resp.error}`);
    const taskId = extractTaskId(resp);
    const url = await pollTask(taskId, { intervalMs: 4000, timeoutMs: 5 * 60_000, label: `vo ${s.id}` });
    const file = path.join(OUT, "vo", `scene-${String(s.id).padStart(2, "0")}.mp3`);
    await download(url, file);
    state.vo[s.id] = { taskId, url, file, seconds: mediaDuration(file) };
    saveState();
    console.log(`  ✓ vo ${s.id} (${state.vo[s.id].seconds.toFixed(1)}s)`);
  });
  if (failures.length) throw new Error(`${failures.length} voiceover line(s) failed — re-run to retry`);
}

function sceneTargetSeconds(s) {
  const voSec = state.vo[s.id]?.seconds ?? 8;
  return Math.max(s.min_seconds || 4, voSec + 0.4);
}

async function stageClips() {
  console.log(`\n== Clips (${sb.scenes.length} scenes, mode: ${MODE}) ==`);
  const pending = sb.scenes.filter((s) => !state.clips[s.id]?.file);
  if (DRY) {
    let total = 0;
    for (const s of sb.scenes) total += Math.min(15, Math.ceil(sceneTargetSeconds(s)));
    pending.forEach((s) => console.log(`  [dry] kling_video: scene ${s.id} (~${Math.min(15, Math.ceil(sceneTargetSeconds(s)))}s)`));
    console.log(`  [dry] total clip seconds ≈ ${total}`);
    return;
  }
  const failures = await runPool(pending, async (s) => {
    const still = state.stills[s.id];
    if (!still?.url) throw new Error(`clip ${s.id}: no still available (run stills stage first)`);
    // Kling caps at 15s; assembler freezes the last frame for longer narration.
    const dur = Math.max(3, Math.min(15, Math.ceil(sceneTargetSeconds(s))));
    console.log(`  → clip ${s.id} (${dur}s)`);
    const prompt = `${s.motion || "subtle ambient animation"}. ${s.prompt}. Flat 2D cartoon animation, smooth minimal motion, no camera shake beyond direction given.`;
    const resp = runKie([
      "kling_video",
      "--prompt", prompt,
      "--image_urls", still.url,
      "--duration", String(dur),
      "--mode", MODE,
    ]);
    if (resp.success === false) throw new Error(`clip ${s.id}: ${resp.error}`);
    const taskId = extractTaskId(resp);
    const url = await pollTask(taskId, { intervalMs: 15_000, timeoutMs: 30 * 60_000, label: `clip ${s.id}` });
    const file = path.join(OUT, "clips", `scene-${String(s.id).padStart(2, "0")}.mp4`);
    await download(url, file);
    state.clips[s.id] = { taskId, url, file, seconds: dur };
    saveState();
    console.log(`  ✓ clip ${s.id}`);
  });
  if (failures.length) throw new Error(`${failures.length} clip(s) failed — re-run to retry`);
}

function stageAssemble() {
  console.log(`\n== Assemble ==`);
  if (DRY) {
    console.log(`  [dry] ${sb.scenes.length} segments → final.mp4`);
    return;
  }
  const segFiles = [];
  for (const s of sb.scenes) {
    const clip = state.clips[s.id]?.file;
    const vo = state.vo[s.id]?.file;
    if (!clip || !vo) throw new Error(`assemble: scene ${s.id} missing ${!clip ? "clip" : "vo"}`);
    const target = sceneTargetSeconds(s).toFixed(2);
    const seg = path.join(OUT, "segments", `scene-${String(s.id).padStart(2, "0")}.mp4`);
    // Freeze last frame if the clip is shorter than narration; trim if longer.
    ff(
      [
        "-i", clip, "-i", vo,
        "-filter_complex",
        `[0:v]tpad=stop_mode=clone:stop_duration=20,trim=0:${target},setpts=PTS-STARTPTS,` +
          `scale=${ARW}:${ARH}:force_original_aspect_ratio=decrease,pad=${ARW}:${ARH}:(ow-iw)/2:(oh-ih)/2,fps=30[v];` +
          `[1:a]apad=whole_dur=${target},atrim=0:${target},asetpts=PTS-STARTPTS[a]`,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        seg,
      ],
      `segment ${s.id}`,
    );
    segFiles.push(seg);
    console.log(`  ✓ segment ${s.id} (${target}s)`);
  }

  const listFile = path.join(OUT, "segments", "concat.txt");
  writeFileSync(listFile, segFiles.map((f) => `file '${path.resolve(f)}'`).join("\n"));
  const narrated = path.join(OUT, "narrated.mp4");
  ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", narrated], "concat");

  const finalFile = path.join(OUT, "final.mp4");
  if (sb.music?.file && existsSync(sb.music.file)) {
    const vol = sb.music.volume ?? 0.12;
    ff(
      [
        "-i", narrated, "-stream_loop", "-1", "-i", sb.music.file,
        "-filter_complex",
        `[1:a]volume=${vol}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=3[a]`,
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest",
        finalFile,
      ],
      "music mix",
    );
  } else {
    ff(["-i", narrated, "-c", "copy", finalFile], "finalize");
  }
  console.log(`\n✅ Done: ${finalFile} (${mediaDuration(finalFile).toFixed(1)}s)`);
}

// ---------- Main ----------

const STAGES = {
  characters: stageCharacters,
  stills: stageStills,
  voiceover: stageVoiceover,
  clips: stageClips,
  assemble: stageAssemble,
};
const order = STAGE === "all" ? Object.keys(STAGES) : [STAGE];
if (order.some((s) => !STAGES[s])) {
  console.error(`Unknown stage "${STAGE}". Valid: ${Object.keys(STAGES).join(", ")}, all`);
  process.exit(1);
}

console.log(
  `Storyboard: ${sb.title} — ${sb.scenes.length} scenes, ${sb.characters.length} characters, ${AR}, voice ${VOICE}${DRY ? " [DRY RUN]" : ""}`,
);
try {
  for (const name of order) await STAGES[name]();
} catch (err) {
  console.error(`\n⛔ ${err.message || err}\nState saved — re-run the same command to resume.`);
  process.exit(1);
}
