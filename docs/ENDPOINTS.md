# Kie.ai Endpoints & MCP Tools Mapping

> **Last Updated**: 2026-06-05
> **Purpose**: Track Kie.ai API endpoints and their MCP/CLI tool implementation status.

## Overview

This document maps Kie.ai platform endpoints to the tools exposed by the server. It is maintainer-facing (the end-user tool reference is the generated [TOOLS.md](./TOOLS.md)). Use this to:

- See which Kie.ai endpoints are implemented vs pending
- Track new endpoints worth adding
- Understand the routing and the grouping strategy (multiple models, one unified tool)

The tools below are shared by both surfaces (`@felores/kie-ai-mcp-server` and the `kie-cli` CLI), generated from one registry.

---

## Endpoint routing

Almost every tool talks to the same two Kie.ai "market" endpoints, so the routing is simple:

| Purpose | Endpoint |
|---------|----------|
| Create a task (most tools) | `POST /api/v1/jobs/createTask` |
| Poll a task (most tools) | `GET /api/v1/jobs/recordInfo?taskId=...` |

Exceptions (handled in `packages/core/src/kie-ai-client.ts`):

| Tool | Create | Poll |
|------|--------|------|
| `veo3_generate_video` / `veo3_get_1080p_video` | `POST /api/v1/veo/generate` | `GET /api/v1/veo/record-info`, `GET /api/v1/veo/get-1080p-video` |
| `suno_generate_music` | `POST /api/v1/generate` | `GET /api/v1/generate?taskId=...` |

The server only treats `code === 200` in the response body as success (HTTP 200 with `code !== 200` is an application-level failure).

---

## Implementation Status Legend

| Status | Meaning |
|--------|---------|
| ✅ | Implemented |
| 🔄 | Needs update (pricing, parameters, or features changed) |
| ❌ | Not implemented, needs a new tool |
| 📋 | Planned |

---

## Current tools

### Utility
| Tool | Description |
|------|-------------|
| `list_tasks` | List recent tasks (local cache) with status filter |
| `get_task_status` | Check status of a generation task (single poll) |
| `wait_for_task` | Block until a task finishes (polls Kie directly, streams `notifications/progress`); optional callback rendezvous |

### Image
| Tool | Kie.ai Models | Status |
|------|---------------|--------|
| `nano_banana_image` | Nano Banana 2 / Nano Banana 2 Lite (generate/edit) | ✅ |
| `bytedance_seedream_image` | Seedream V4 / V5 Lite / V5 Pro (text-to-image/edit) | ✅ |
| `qwen_image` | Qwen (text-to-image/edit) | ✅ |
| `gpt_image_2` | GPT Image 2 (text/image-to-image) | ✅ |
| `flux_kontext_image` | Flux Kontext Pro/Max | ✅ |
| `flux2_image` | Flux 2 Pro/Flex (text/image-to-image) | ✅ |
| `z_image` | Tongyi-MAI Z-Image (photorealistic) | ✅ |
| `topaz_upscale_image` | Topaz Image Upscale (1x-8x) | ✅ |
| `ideogram_reframe` | Ideogram V3 Reframe | ✅ |
| `recraft_remove_background` | Recraft Remove Background | ✅ |
| `midjourney_generate` | Midjourney (image and video modes) | ✅ |

### Video
| Tool | Kie.ai Models | Status |
|------|---------------|--------|
| `veo3_generate_video` | Veo 3 / 3.1 (text/image-to-video) | ✅ |
| `veo3_get_1080p_video` | Veo 3 1080p retrieval | ✅ |
| `bytedance_seedance_video` | Seedance 2.0 (standard/fast/mini, multimodal refs, native audio) | ✅ |
| `runway_aleph_video` | Runway Aleph (video-to-video) | ✅ |
| `wan_video` | Wan 2.7 (T2V/I2V/R2V/video-edit) | ✅ |
| `wan_animate` | Wan Animate (animation/character replace) | ✅ |
| `happyhorse_video` | HappyHorse 1.0 (T2V/I2V/R2V/video-edit) | ✅ |
| `hailuo_video` | Hailuo 02 / 2.3 (standard/pro) | ✅ |
| `kling_video` | Kling 3.0 (text/image-to-video, multi-shot, native audio) | ✅ |
| `grok_imagine` | xAI Grok Imagine (text/image to image/video, upscale) | ✅ |
| `infinitalk_lip_sync` | MeiGen-AI InfiniTalk (lip-sync talking video) | ✅ |
| `kling_avatar` | Kuaishou Kling AI Avatar (talking avatar) | ✅ |

### Audio
| Tool | Kie.ai Models | Status |
|------|---------------|--------|
| `suno_generate_music` | Suno V3.5 / V4 / V4.5 / V4.5+ / V5 | ✅ |
| `elevenlabs_tts` | ElevenLabs Text-to-Speech | ✅ |
| `elevenlabs_ttsfx` | ElevenLabs Sound Effects | ✅ |

---

## Endpoints needing implementation

> See [MISSING_ENDPOINTS.md](./MISSING_ENDPOINTS.md) for implementation specs.

| Endpoint | Provider | Type | Kie.ai URL |
|----------|----------|------|------------|
| ElevenLabs STT | ElevenLabs | Speech-to-Text | https://kie.ai/elevenlabs-speech-to-text |
| Suno Vocal Separation | Suno | Audio | https://docs.kie.ai/suno-api/separate-vocals |
| Suno Audio Cover | Suno | Audio | https://docs.kie.ai/suno-api/upload-and-cover-audio |
| Ideogram V3 (full generation) | Ideogram | Image | https://kie.ai/ideogram/v3 |
| Seedance 1.0 Pro Fast | ByteDance | Video | https://kie.ai/seedance-1-0-pro-fast |

---

## Tool grouping strategy

The server groups related Kie.ai models into unified tools for better UX, using smart parameter detection instead of one tool per model variant:

```text
prompt only                  -> text-to-image / text-to-video
prompt + image_urls          -> edit / image-to-video
image only                   -> upscale / transform
video_url + image_url        -> animation / character replace
```

Examples: `nano_banana_image` (generate/edit), `wan_video` (T2V/I2V/R2V/video-edit), `kling_video` (text/image-to-video, multi-shot).

To add a model: `npm run add-tool -- <name> <category>`, then fill the schema + client method. Both surfaces and [TOOLS.md](./TOOLS.md) (`npm run docs`) pick it up.

---

## API documentation links

| Resource | URL |
|----------|-----|
| Kie.ai Docs Home | https://docs.kie.ai |
| Market API (jobs/createTask) | https://docs.kie.ai/market-api/quickstart |
| Veo 3 API | https://docs.kie.ai/veo3-api/quickstart |
| Suno API | https://docs.kie.ai/suno-api/quickstart |
| Flux Kontext API | https://docs.kie.ai/flux-kontext-api/quickstart |
| Runway API | https://docs.kie.ai/runway-api/quickstart |
| File Upload API | https://docs.kie.ai/file-upload-api/quickstart |

---

## Pricing reference

Kie.ai credits, where 1 credit is about $0.005. Pricing changes often; verify current rates at https://kie.ai/market.

---

## Changelog

### 2026-06-05 (later)
- `wait_for_task` now polls the Kie API directly by default and streams MCP
  `notifications/progress`, so it blocks in one call until the result is ready
  (the callback rendezvous is now an optional fallback). Added it to the Utility
  table, which had been undercounting it.

### 2026-06-05
- Refreshed to the current 28 tools; moved `grok_imagine`, `z_image`,
  `infinitalk_lip_sync` and `kling_avatar` from "needing implementation" to
  implemented; removed the retired `sora_video` and the old `openai_4o_image`
  (now `gpt_image_2`).
- Added the "Endpoint routing" section (most tools use `/jobs/createTask` +
  `/jobs/recordInfo`; veo3 and suno are the exceptions).

### 2025-12-06
- Initial document creation and endpoint mapping.
