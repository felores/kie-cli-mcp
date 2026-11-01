---
status: draft
date: 2026-10-31
---

# Catalog research: providers and tools

First-pass research on every provider and tool in `packages/core/src/model-catalog.ts` (28 tools, 17 providers). Written by Haiku subagents from official sources only (docs.kie.ai, kie.ai/market, provider sites). Nobody has reviewed it, so treat every file as `draft`. Claims that could not be verified are marked "unverified" and missing prices are marked "unknown".

## Providers and tools

| Provider | Tools |
|---|---|
| [Alibaba](providers/alibaba.md) | [qwen_image](tools/qwen_image.md), [z_image](tools/z_image.md), [wan_video](tools/wan_video.md), [wan_image](tools/wan_image.md), [wan_animate](tools/wan_animate.md) |
| [Black Forest Labs](providers/black-forest-labs.md) | [flux_kontext_image](tools/flux_kontext_image.md), [flux2_image](tools/flux2_image.md) |
| [ByteDance](providers/bytedance.md) | [bytedance_seedream_image](tools/bytedance_seedream_image.md), [bytedance_seedance_video](tools/bytedance_seedance_video.md), [omnihuman_video](tools/omnihuman_video.md) |
| [ElevenLabs](providers/elevenlabs.md) | [elevenlabs_tts](tools/elevenlabs_tts.md), [elevenlabs_ttsfx](tools/elevenlabs_ttsfx.md) |
| [Google](providers/google.md) | [nano_banana_image](tools/nano_banana_image.md), [veo3_generate_video](tools/veo3_generate_video.md), [gemini_omni](tools/gemini_omni.md) |
| [HappyHorse](providers/happyhorse.md) (made by Alibaba) | [happyhorse_video](tools/happyhorse_video.md) |
| [Ideogram](providers/ideogram.md) | [ideogram_reframe](tools/ideogram_reframe.md) |
| [Kling (Kuaishou)](providers/kling.md) | [kling_video](tools/kling_video.md), [kling_avatar](tools/kling_avatar.md) |
| [MeiGen (InfiniteTalk)](providers/meigen-infinitalk.md) | [infinitalk_lip_sync](tools/infinitalk_lip_sync.md) |
| [Midjourney](providers/midjourney.md) | [midjourney_generate](tools/midjourney_generate.md) |
| [MiniMax](providers/minimax.md) | [hailuo_video](tools/hailuo_video.md) |
| [OpenAI](providers/openai.md) | [gpt_image](tools/gpt_image.md) |
| [Recraft](providers/recraft.md) | [recraft_remove_background](tools/recraft_remove_background.md) |
| [Runway](providers/runway.md) | [runway_aleph_video](tools/runway_aleph_video.md) |
| [Suno](providers/suno.md) | [suno_generate_music](tools/suno_generate_music.md) |
| [Topaz Labs](providers/topaz-labs.md) | [topaz_upscale_image](tools/topaz_upscale_image.md) |
| [xAI](providers/xai.md) | [grok_imagine](tools/grok_imagine.md) |

## Findings that need a decision

Reported by the agents, not yet confirmed by a person. Each is a lead, not a fact.

Catalog state:
- **runway_aleph_video** is `active` in the catalog, but Kie's own page says Aleph is no longer available and its `evidenceUrl` returns 404. Spot-checked in the research file.
- **veo3_generate_video**: Google shut down the Veo 3.1 preview models on 2026-10-22. Whether Kie's route still works is unverified.
- **grok_imagine**: Kie's `grok-imagine/upscale` is a video upscale, but the tool treats it as image upscale. `grok-imagine-image-quality` retires on 2026-11-02.
- **bytedance_seedream_image**: Seedream 5 Lite is retired in local docs, released in Kie docs, and absent from the tool.
- Several `evidenceUrl` values point at the generic market quickstart or at pages that return 404 (Ideogram, Runway, Kontext).

Likely code defects:
- **kling_avatar** sends `kling/ai-avatar-v1-pro` and `kling/v1-avatar-standard`; Kie documents `kling/ai-avatar-pro` and `kling/ai-avatar-standard`.
- **elevenlabs_tts** sends voice names (default `Rachel`); Kie asks for 20-character voice IDs.
- **hailuo_video** schema allows only `768p`, and text and image modes never send `resolution`.
- **topaz_upscale_image** accepts factor `8`; Kie lists only 1x, 2x, 4x.
- **gpt_image** does not enforce that `background` works only at 1K.
- Prompt or file limits differ between repo and Kie for Kling 3.0, Z-Image, InfiniteTalk, FLUX.2 and Wan Animate.

Policy risk:
- **Midjourney** and **Suno** have no official public API. Midjourney's terms reportedly ban third-party apps and automation. A person should read the terms against Kie's resale.

Pricing: Kie per-variant prices are unknown for many tools. Add a rate-card formula only with official evidence, per `CLAUDE.md`.
