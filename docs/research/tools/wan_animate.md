---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/wan/2-2-animate-move.md
  - https://kie.ai/pricing
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
  - https://docs.aimlapi.com/api-references/video-models/alibaba-cloud/wan-2.2-14b-animate-replace-image-to-video (third-party, reference only)
  - /Users/felo/Documents/GitHub/kie-cli-mcp/packages/core/src/types.ts
  - /Users/felo/Documents/GitHub/kie-cli-mcp/packages/core/src/kie-ai-client.ts
---

# wan_animate

Catalog entry: `wan_animate`, model `wan-animate`. Provider: Alibaba Wan team (Wan 2.2 Animate). Category: video.

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

Two jobs on one tool. `animate` transfers motion and expressions from a reference video onto a still character image. `replace` swaps the character in a video with a still image. Source: `packages/core/src/types.ts` (`WanAnimateSchema`) and `packages/core/src/tools/wan_animate.ts`.

## 2. Model versions

- Kie.ai endpoints used by the repo client: `wan/2-2-animate-move` for `animate` and `wan/2-2-animate-replace` for `replace`. Source: `packages/core/src/kie-ai-client.ts`, `generateWanAnimate`.
- The official Kie.ai doc for `wan/2-2-animate-move` was read. It has no `mode` parameter. Source: https://docs.kie.ai/market/wan/2-2-animate-move.md
- The `wan/2-2-animate-replace` Kie.ai doc was not found. Its endpoint name comes from a third-party connector page. Unverified.
- Alibaba: "Wan 2.2 Animate" is named in Kie.ai pricing. Alibaba's Model Studio pricing page did not list an animate model in the part read. Official Alibaba doc: unverified.

## 3. Modes

| Repo mode | Inputs | Kie.ai endpoint |
| --- | --- | --- |
| `animate` (default) | `video_url` (motion source), `image_url` (character) | `wan/2-2-animate-move` |
| `replace` | `video_url` (video to edit), `image_url` (new character) | `wan/2-2-animate-replace`, unverified |

## 4. Key parameters and limits

| Parameter | Repo schema | Kie.ai official doc (`move`) | Conflict |
| --- | --- | --- | --- |
| `video_url` | MP4, QuickTime, Matroska, max 10 MB, max 30 s | Max 100 MB, MP4, QuickTime, Matroska. No length rule stated | Size and length differ |
| `image_url` | JPEG, PNG, WebP, max 10 MB. Cropped to video aspect | JPEG, PNG, WebP, max 5 MB | Size differs |
| `resolution` | `480p`, `580p`, `720p`. Default `480p` | Only `720p` allowed. Default `720p` | Yes, the options and default differ |
| `mode` | `animate` or `replace` | Not present in the `move` doc | Mode is a routing choice in the repo |
| `nsfw_checker` | Not in repo schema | Default `false` | |

The repo schema must be checked against Kie.ai before any release. Source of the Kie.ai column: https://docs.kie.ai/market/wan/2-2-animate-move.md

## 5. Pricing

- Kie.ai pricing page lists "Wan Animate" (labeled "wan 2.2 Animate") from $0.03 per second, 6 credits per second. It is a starting price for the lowest option. Source: https://kie.ai/pricing
- The Kie.ai `move` doc states no price or credit rate for a task. A sample callback shows 1.23 credits. That is a sample value, not a rate. Source: https://docs.kie.ai/market/wan/2-2-animate-move.md
- Whether the per-second rate applies to the `move` endpoint, the `replace` endpoint, or both: unknown.
- Alibaba per-second price for Wan 2.2 Animate: not found in the Model Studio pricing page part read. Unknown.

## 6. Strengths

- One tool covers motion transfer and character replacement.
- Kie.ai pricing lists a per-second rate, which makes cost estimation possible once confirmed.
- Simple input set: one video and one image.

## 7. Weaknesses

- The repo schema and the Kie.ai `move` doc disagree on file limits and resolution options. A request valid in the repo may fail on Kie.ai, or the reverse.
- Kie.ai `move` only accepts 720p. The repo default of 480p would be rejected by the official contract.
- The `replace` endpoint is not verified against an official Kie.ai page.
- The repo description calls it "seamless environmental integration." That is not verified against an official source.
- Official Alibaba documentation for Wan 2.2 Animate was not found.

## 8. Best use cases

- Animating a still character with motion from a short reference clip.
- Replacing a character in a short clip, once `replace` is verified.

## 9. Alternatives in this catalog

- `wan_video`: generate a new clip from images, video, audio, documents, or links.
- `runway_aleph_video`: video editing and enhancement.
- `omnihuman_video`, `kling_avatar`, `infinitalk_lip_sync`: avatar and lip-sync options.
- `kling_video`: image-to-video.

## 10. Open questions

- Which resolution and size limits does Kie.ai enforce on the live endpoints? Unknown until a contract check is run. Do not paid-test without approval.
- Does `wan/2-2-animate-replace` exist on Kie.ai with the schema the repo sends? Unverified.
- Which Kie.ai contract should win in the repo, the doc or the schema? Decision needed.
- Price basis on Kie.ai for each endpoint. Unknown.
- Official Alibaba Wan 2.2 Animate documentation and price. Unknown.
