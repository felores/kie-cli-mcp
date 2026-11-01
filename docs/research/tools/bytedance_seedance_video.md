---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/bytedance/seedance-2-5
  - https://kie.ai/seedance-2-5
  - https://seed.bytedance.com/en/seedance2_5
  - https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing
  - https://kie.ai/terms-of-use
---

# bytedance_seedance_video - Research

## Contents

1. What it does
2. Model version
3. Modes
4. Key parameters and limits
5. Public pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Generates video from text, from first and last frames, or from multimodal references (images, video, audio). It can also pass an undocumented `extension_task_id` for semantic continuation. Sources: `packages/core/src/tools/bytedance_seedance_video.ts`, https://docs.kie.ai/market/bytedance/seedance-2-5

## 2. Model version

- Kie model ID: `bytedance/seedance-2-5`. Only value accepted. Source: https://docs.kie.ai/market/bytedance/seedance-2-5
- Provider: Seedance 2.5, "a next-generation audio-video joint generation model". Source: https://seed.bytedance.com/en/seedance2_5
- The catalog and tool cover 2.5 only. Seedance 1.0 Lite and Pro have local docs in `docs/kie/` but no tool entry.

## 3. Modes

| Mode | Inputs | Notes |
|---|---|---|
| Text-to-video | `prompt` | |
| Semantic continuation (experimental) | `prompt` plus `extension_task_id` | Not in the public schema. Does not guarantee frame continuity. |
| Image-to-video, first frame | `prompt` plus `first_frame_url` | |
| Image-to-video, first and last frame | plus `last_frame_url` | `last_frame_url` requires `first_frame_url`. |
| Multimodal reference | `prompt` plus any of reference image, video, or audio arrays | Cannot combine with frame modes. |

Source for mutual exclusion: https://docs.kie.ai/market/bytedance/seedance-2-5

## 4. Key parameters and limits

| Parameter | Kie docs (live) | Local schema or tool |
|---|---|---|
| `prompt` | max 20,480 characters | min 1 character, no max read |
| `resolution` | `480p`, `720p`, `1080p`; default `720p` | passed through |
| `aspect_ratio` | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `adaptive`; default `adaptive` | passed through |
| `duration` | integer 4 to 30; default 5; `-1` lets the model choose | integer |
| `generate_audio` | default `true` | optional boolean |
| `return_last_frame` | default `false`; returns JPEG in `resultJson.lastFrameUrl` | optional boolean |
| Reference images | max 30; jpeg, png, webp; 300 to 6000 px; under 30 MB each | arrays, no max read |
| Reference videos | max 10; mp4, mov, mkv; 2 to 30 s each; 30 s combined | arrays, no max read |
| Reference audio | max 10; wav, mp3, aac, ogg; 2 to 30 s each; 30 s combined | arrays, no max read |
| `output_format` | `mp4` or `mov`; default `mp4` | not confirmed in read schema |
| `draft` | default `false`; draft limited to 480p; draft IDs valid 7 days | not confirmed |
| `web_search`, `nsfw_checker` | listed on Kie docs | not confirmed |

Source for Kie column: https://docs.kie.ai/market/bytedance/seedance-2-5. The local schema was only partly read, so the right-hand column is incomplete.

## 5. Public pricing

Kie.ai, per second of billed video (source: https://kie.ai/seedance-2-5):

| Resolution | With video input | Without video input (text or images only) |
|---|---|---|
| 480p | 17 credits ($0.085) | 28 credits ($0.14) |
| 720p | 38 credits ($0.19) | 63 credits ($0.315) |
| 1080p | 95 credits ($0.475) | 158 credits ($0.79) |

Billing rule on Kie: with video input, rate times (uploaded reference video duration plus output duration). Without, rate times output duration. Reference images and audio add no billable seconds. Prices are beta and "may be adjusted". Audio on or off has no separate price.

Provider (BytePlus), per million tokens (source: https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing):
- 480p and 720p: $10.70 without video input, $6.40 with video input.
- 1080p: $11.70 without video input, $7.00 with video input.
- Per-video example, 16:9, 5 s: 720p without video $1.156 ($0.231/s); 1080p without video $2.843 ($0.569/s).

Kie is higher than the BytePlus example at both tiers. The BytePlus per-second figures are derived from one example, so this is an estimate.

## 6. Strengths

- Up to 30 seconds in one generation, plus two extensions (provider claim). Source: https://seed.bytedance.com/en/seedance2_5
- Multimodal references, including reference video for "framing and cinematic language" (provider claim).
- Optional generated audio, synchronized to video.
- Last-frame return supports chaining clips.
- Kie callbacks report `failCode` and `creditsConsumed` (0 on failure).

## 7. Weaknesses

- Highest per-second price in this catalog on Kie (17 credits per second at the cheapest tier).
- `extension_task_id` is undocumented and may change. Visual continuity needs `first_frame_url` instead.
- Reference video is billed by its own duration, which raises the cost of video-driven edits.
- Pricing is in beta on Kie.
- The provider page gives no resolution, aspect ratio, or limit tables.

## 8. Best use cases

- Longer single clips (up to 30 seconds).
- Shots that match a reference video's framing or motion.
- Chained clips using the returned last frame and `first_frame_url`.
- Audio-led clips with `generate_audio` on.

## 9. Alternatives in this catalog

- `kling_video` (Kling 3.0): text-to-video, image-to-video, audio, multi-shot. Catalog entry in `packages/core/src/model-catalog.ts`.
- `gemini_omni`: video, character, and voice. Catalog entry in the same file.

Cost and duration comparisons with these are not researched here.

## 10. Open questions

- Does `extension_task_id` still work on Kie, and does it carry billing changes?
- Do `output_format`, `draft`, and `web_search` reach the MCP tool? The read schema did not confirm them.
- Does `generate_audio` default to true when the tool omits it? Kie says yes, but the tool sends the field only when set.
- Kie's per-second price with audio on versus off (not stated).
- Prompt length: local schema has no max, Kie allows 20,480 characters.
