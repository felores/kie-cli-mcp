---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/mj-api/generate-mj-image
  - https://docs.kie.ai/market-api/quickstart
  - https://kie.ai/market
  - https://kie.ai/pricing
  - https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans
  - https://docs.midjourney.com/hc/en-us/articles/32016412137741-GPU-Speed-Fast-Relax-Turbo
  - https://docs.midjourney.com/hc/en-us/articles/37460773864589-Video
  - https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version
  - https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service
---

# midjourney_generate (tool research)

## Contents

1. What it does
2. Model and version
3. Modes
4. Key parameters and limits
5. Pricing
6. Strengths and weaknesses
7. Best use cases
8. Alternatives in this catalog
9. Open questions

## 1. What it does

`midjourney_generate` is one catalog tool that submits Midjourney jobs through Kie.ai. It covers image generation, image-to-image, style and omni reference, and image-to-video. It calls `KieAiClient.generateMidjourney` and stores a task row with `api_type: "midjourney"`. Source: `packages/core/src/tools/midjourney_generate.ts` and `packages/core/src/kie-ai-client.ts` in this repo.

Results are fetched later by task ID, using the status path in the Kie docs (`/api/v1/mj/record-info`). Source: https://docs.kie.ai/mj-api/generate-mj-image

## 2. Model and version

- Model line: Midjourney, via Kie.ai. Kie.ai lists versions `7` (recommended), `6.1`, `6`, and `niji6`. Source: https://docs.kie.ai/mj-api/generate-mj-image
- Tool default version: `7`. Source: `packages/core/src/tools/midjourney_generate.ts` (help text).
- Midjourney's own current default is V8.2 (snippet of the official Version page, July 24, 2026). The mapping between Kie's `7` and Midjourney's V8 line is unverified.

## 3. Modes

| Mode | `taskType` | Input | Notes |
|---|---|---|---|
| Text to image | `mj_txt2img` | `prompt` | Default when no image is given. |
| Image to image | `mj_img2img` | `prompt` + `fileUrls` or `fileUrl` | Auto-detected from image input. |
| Style reference | `mj_style_reference` | `prompt` + `sref` | Schema has `sref`. Kie doc wording unverified. |
| Omni reference | `mj_omni_reference` | `prompt` + `ow` (1-1000) | Auto-detected from `ow`. |
| Video | `mj_video` | `prompt` + image + `motion` | Auto-detected from `motion`, `videoBatchSize`, or HD flag. |
| HD video | `mj_video_hd` | as video, `high_definition_video: true` | Auto-detected. |

Source: `packages/core/src/tools/midjourney_generate.ts`, `packages/core/src/types.ts`, and https://docs.kie.ai/mj-api/generate-mj-image

Official video facts (snippet): about 5-second videos; Fast mode on all plans; Relax video on Pro and Mega only, SD only. Sources: https://docs.midjourney.com/hc/en-us/articles/37460773864589-Video and https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans

## 4. Key parameters and limits

| Parameter | Schema limit (repo) | Doc or help text | Note |
|---|---|---|---|
| `prompt` | 1 to 4000 chars | help says max 2000 | Mismatch. |
| `fileUrls` | max 5 URLs | "recommended" | Legacy `fileUrl` also accepted. |
| `aspectRatio` | `1:1, 9:16, 16:9, 4:3, 3:4, 21:9, 2:3, 3:2` | help lists `1:2, 9:16, 2:3, 3:4, 5:6, 6:5, 4:3, 3:2, 1:1, 16:9, 2:1` | Mismatch; schema lacks `1:2`, `5:6`, `6:5`, `2:1`, and has `21:9`. |
| `speed` | `relax, fast, turbo` | help says `relaxed, fast, turbo`; Kie example uses `relaxed` | Mismatch on `relax` vs `relaxed`. Kie-side accepted value unverified. |
| `processMode` | `relax` (default) or `fast` | not in Kie doc | Overlaps with `speed`. Purpose unclear. |
| `variety` | 0-100, step 5 | same | Kie doc does not list it in the sample. |
| `stylization` | 0-1000 | same | Schema also has `stylize` (0-1000). Two names for one control. |
| `weirdness` | 0-3000 | same | Schema also has `weird` (0-1000). Two names. |
| `quality` | 0.1-1, step 0.1 | not in help | |
| `repeat` | 1-40 | not in help | |
| `motion` | number 0-100 | help says "high/low" | Mismatch with help text. |
| `videoBatchSize` | 1-4 | help says 1/2/4 | Match on values. |
| `ow` | string, 1-4000 chars | help says 1-1000 | Mismatch. |
| `callBackUrl` | URL, optional | env fallback `KIE_AI_CALLBACK_URL` | Kie callback must answer within 15 seconds (Kie doc). |
| `waterMark` | max 100 chars | | |

Retention: generated files are kept 15 days on Kie (https://docs.kie.ai/mj-api/generate-mj-image).
Errors: 402 means insufficient credits. 429 means rate limited. Source: same page.
Source for schema and help text: `packages/core/src/types.ts` and `packages/core/src/tools/midjourney_generate.ts`.

## 5. Pricing

- Kie.ai credit value: $0.005 per credit. Source: https://kie.ai/pricing
- Kie.ai credit cost per Midjourney task (image, video, HD video, reference modes): unknown. The Kie market page does not show it in fetched text. Source: https://kie.ai/market
- Midjourney official plans (snippet, comparison page): Basic $10, Standard $30, Pro $60, Mega $120 per month. Source: https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans
- Midjourney Fast GPU hours per tier: older snippet says 3.3, 15, 30, 60 hours. Current value unverified. Extra GPU time older snippet says $4 per hour. Unverified for current pricing.
- Midjourney does not price per image in the sources read. Source: https://docs.midjourney.com/hc/en-us/articles/32016412137741-GPU-Speed-Fast-Relax-Turbo (snippet)

Price per call on this tool: unknown. Do not quote a number until Kie publishes it.

## 6. Strengths and weaknesses

Strengths
- One tool covers several modes through auto-detection.
- Task rows are stored in the local SQLite table, so status can be checked later.
- Kie's credit model is simple: $0.005 per credit (https://kie.ai/pricing).

Weaknesses
- Kie.ai route is a third-party resale. Midjourney's terms, as read in snippet, ban automated tools and third-party apps (https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service). Legal fit is an open risk.
- Parameter names and enums disagree between the schema, help text, and Kie docs (see section 4).
- Output URLs expire after 15 days.
- Price per task is unknown.

## 7. Best use cases

- Prototype image and short video generation where a Midjourney look is wanted.
- Image-to-image restyling from a source URL (`fileUrls`).
- Short image-to-video clips with `motion` set, in SD or HD.

Not a good fit for: production pipelines that need a fixed price per call, or any use that depends on a sanctioned official API.

## 8. Alternatives in this catalog

- Image: `nano_banana_image`, `bytedance_seedream_image`, `qwen_image`, `gpt_image`, `flux_kontext_image`, `flux2_image`, `ideogram_reframe`.
- Video: `veo3_generate_video`, `bytedance_seedance_video`, `kling_video`, `hailuo_video`, `wan_video`, `runway_aleph_video`.

Source: `packages/core/src/model-catalog.ts`. Pricing comparison is not done here.

## 9. Open questions

1. Kie.ai credit cost per Midjourney task: unknown. Needs a Kie pricing source with per-model rows.
2. Does `speed` accept `relax` or `relaxed` on the Kie API? Schema and doc disagree.
3. Is `processMode` used by Kie, or is it dead schema?
4. Does Kie's `version: "7"` map to Midjourney V8.x, or to an older line?
5. Which `aspectRatio` values does Kie accept? Schema and help differ.
6. Is `motion` a number (schema) or `high/low` (help)?
7. Is the Kie route allowed under Midjourney's terms? Needs a human read of the full ToS and Community Guidelines. Official pages returned HTTP 403 to fetch.
8. Kie docs page at https://docs.kie.ai/mj-api/generate-mj-image returned empty text on fetch. Parameters here come from the repo copy in `docs/kie/midjourney_generate.md`.
