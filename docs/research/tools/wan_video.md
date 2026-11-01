---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/wan/3-0-video.md
  - https://docs.kie.ai/market/wan/3-0-video-prime.md
  - https://kie.ai/wan3.0-video
  - https://kie.ai/pricing
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - https://www.alibabacloud.com/help/id/model-studio/wan3-video-generation-api-reference (search snippet only)
  - https://propakistani.pk/2026/08/24/alibaba-launches-wan-3-0-ai-video-model-after-raising-10-billion/ (secondary press)
  - /Users/felo/Documents/GitHub/kie-cli-mcp/docs/kie/wan_3-0-video.md
  - /Users/felo/Documents/GitHub/kie-cli-mcp/packages/core/src/types.ts
---

# wan_video

Catalog entry: `wan_video`, models `wan/3-0-video` (standard, default) and `wan/3-0-video-prime`. Provider: Alibaba Wan team. Category: video.

## Contents

1. What it does
2. Model versions
3. Modes
4. Key parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Multimodal video generation: text, first and last frame, reference images, reference video, reference audio, one document, or one public webpage. Output includes an audio track by default. Source: https://docs.kie.ai/market/wan/3-0-video.md

## 2. Model versions

- `wan/3-0-video`: standard. Repo default.
- `wan/3-0-video-prime`: described on Kie.ai as "a high-speed model." No latency figures on the page. Source: https://docs.kie.ai/market/wan/3-0-video-prime.md
- Alibaba launch date and product claims come from secondary press only: public beta on August 6, 2026 and general launch on August 24, 2026. Unverified against an Alibaba source.
- Wan 2.7 video editing and reference endpoints are excluded in this repo. Source: `docs/kie/wan_3-0-video.md`.

## 3. Modes

| Mode | Inputs | Limit |
| --- | --- | --- |
| Text-to-video | `prompt` only | Prompt up to 20,000 characters |
| Keyframes | `first_frame_url`, optional `last_frame_url` | 1 image each. Not with `reference_*` |
| Reference-to-video | `reference_image_urls` | Up to 10 images, addressed as Image1, Image2 |
| Reference video | `reference_video_urls` | Up to 5 clips, 1 to 15 s each, 15 s total. Input plus output duration must be at most 30 s |
| Reference audio | `reference_audio_urls` | Up to 5 clips, 1 to 15 s each, 15 s total |
| File-to-video | `reference_file_urls` | 1 document, up to 100 MB, 50 pages for paged formats. Not with link or keyframes |
| Link-to-video | `reference_link_urls` | 1 public webpage, no login. Not with file or keyframes |

Source: https://docs.kie.ai/market/wan/3-0-video.md

## 4. Key parameters and limits

| Parameter | Value | Note |
| --- | --- | --- |
| `resolution` | `480P`, `720P`, `1080P`. Default `1080P` | |
| `aspect_ratio` | `adaptive` (default), `16:9`, `4:3`, `1:1`, `3:4`, `9:16` | |
| `duration` | 2 to 30 seconds, or `-1` for model choice. Default `5` | With reference video, input plus output at most 30 s |
| `audio` | Default `true` | |
| `seed` | 0 to 2147483647 | Random if omitted |
| `nsfw_checker` | Default `false` | No extra filtering when false |
| `callBackUrl` | Optional | Kie.ai recommends callbacks over polling |

Image inputs: JPEG, PNG without transparency, BMP, WEBP. Sides 240 to 8000 px, aspect at most 8:1, at most 20 MB. Video inputs: MP4 or MOV, up to 100 MB each. Audio inputs: WAV or MP3, up to 15 MB each.

## 5. Pricing

Kie.ai, billed per second (output duration plus reference video duration). Failed tasks consume no credits.

| Resolution | Kie.ai credits per second | Kie.ai USD per second |
| --- | --- | --- |
| 480P | 8 | $0.04 |
| 720P | 16 | $0.08 |
| 1080P | 32 | $0.16 |

Source: https://kie.ai/wan3.0-video (Kie.ai says these are 20 percent below official pricing). Kie.ai pricing page lists Wan 3.0 video from $0.04 per second. Source: https://kie.ai/pricing

Alibaba Model Studio, per output second, Singapore, from the official pricing page (the `wan3.0-video` 480P, 720P, and 1080P rates are marked "limited-time 30% off"):

| Model | 480P | 720P | 1080P |
| --- | --- | --- | --- |
| `wan3.0-video` | $0.05 | $0.10 | $0.20 |
| `wan3.0-video-prime` | $0.068 | $0.14 | $0.28 |

Beijing rates for `wan3.0-video`: $0.041256, $0.082513, $0.165025. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing

Prime on Kie.ai: no rate on the page. Only a sample callback with a value of 61 credits, which is not a rate. Unknown.

## 6. Strengths

- Broad input set in one tool: frames, images, video, audio, document, and web link.
- Native audio track by default.
- 1080P and up to 30 seconds per clip. Source: Kie.ai doc.
- Per-second billing with a clear formula. Source: Kie.ai doc.

## 7. Weaknesses

- Prime speed claim is not quantified.
- Input rules are strict: keyframes cannot mix with references, and file and link inputs cannot mix.
- Standard and Prime prices on Kie.ai are not both listed, so cost planning for Prime is unknown.
- Not open weights. The open Wan line reportedly stops at Wan 2.2. Unverified.
- Alibaba API reference was only read as search snippets. Its details may differ from Kie.ai.

## 8. Best use cases

- Short product or ad clips that combine a still image, a voiceover, and a brand document.
- Shots where a first and last frame must be set.

## 9. Alternatives in this catalog

- `veo3_generate_video`, `kling_video`, `bytedance_seedance_video`, `happyhorse_video`, `hailuo_video`: other text and image to video options. Prices and modes are not compared in this document.
- `wan_animate`: character animation and replacement, not general video.

## 10. Open questions

- Prime endpoint pricing on Kie.ai. Unknown.
- Official Alibaba Wan 3.0 launch post and full API reference. Not read. Unverified.
- Whether Kie.ai `duration` default of 5 matches Alibaba's default. Snippet says 5. Unverified.
- Whether `audio: true` increases cost. Kie.ai does not state it. Unknown.
- Repo `Wan30VideoSchema` defaults were not compared line by line with the Kie.ai doc. Verify.
