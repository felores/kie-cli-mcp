---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/veo3-api/generate-veo-3-video.md
  - https://docs.kie.ai/veo3-api/quickstart
  - https://docs.kie.ai/veo3-api/get-veo-3-1080-p-video.md
  - https://docs.kie.ai/llms.txt
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://ai.google.dev/gemini-api/docs/video
  - https://ai.google.dev/gemini-api/docs/pricing
---

# veo3_generate_video (and veo3_get_1080p_video)

Research note for the MCP tools `veo3_generate_video` (catalog model `veo3`, provider Google) and `veo3_get_1080p_video`. Source: `packages/core/src/tools/veo3_generate_video.ts` and `veo3_get_1080p_video.ts`.

## Table of contents

1. What it does
2. Model version
3. Modes
4. Key parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

`veo3_generate_video` creates a Veo video from a text prompt, or from one or two images. `veo3_get_1080p_video` fetches the 1080p version of a finished Veo task by `task_id` and optional `index`. The 1080p tool is not available for fallback-mode videos.

The catalog entry lists `text to video`, `image to video`, and `audio` as capabilities. The Kie docs say Veo videos include background audio by default ([Kie Veo docs](https://docs.kie.ai/veo3-api/generate-veo-3-video.md)).

## 2. Model version

Kie calls the family "Veo 3.1". Tiers on the Kie docs page:

- `veo3`: Quality tier, described as the flagship.
- `veo3_fast`: default on Kie, described as cost-efficient.
- `veo3_lite`: described as the lowest-cost option for high volume.

Google's Veo 3.1 preview model IDs (`veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview`) were shut down on October 22, 2026. Google points users to Gemini Omni Flash or to GA models on the Gemini Enterprise Agent Platform ([Google video docs](https://ai.google.dev/gemini-api/docs/video)).

## 3. Modes

Kie's `generation_type` values, inferred from `image_urls` when omitted:

- `TEXT_2_VIDEO`: prompt only.
- `FIRST_AND_LAST_FRAMES_2_VIDEO`: one image (first frame), or two images (first and last frame).
- `REFERENCE_2_VIDEO`: one to three reference images. Only `veo3_fast` and `veo3_lite`, and only 8-second duration.

The repo tool maps `imageUrls` of length 1 to "unfold around it" and length 2 to "start to end frame". It does not expose `REFERENCE_2_VIDEO` or the reference-only limits.

## 4. Key parameters and limits

Repo schema (`Veo3GenerateSchema`) vs Kie `input` fields:

| Parameter | Repo | Kie |
|---|---|---|
| `prompt` | required, max 2000 chars | required, no length given |
| `imageUrls` | 1 to 2 URLs | `image_urls`, 1 to 2 (frame modes) or 1 to 3 (reference mode) |
| `model` | `veo3`, `veo3_fast`; default `veo3` | `veo3`, `veo3_fast` (default), `veo3_lite` |
| `aspectRatio` | `16:9`, `9:16`, `Auto`; default `16:9` | same; `Auto` center-crops toward the input image |
| `resolution` | not exposed | `720p` (default), `1080p`, `4k` |
| `duration` | not exposed | `4`, `6`, `8` seconds; default `8` |
| `seeds` | integer 10000 to 99999 | not on the fetched page |
| `watermark` | max 100 chars | string |
| `enableFallback` | boolean, default false | marked deprecated; Kie says remove it from requests |
| `enableTranslation` | boolean | `enable_translation`, translates prompt to English |
| `callBackUrl` | optional URL | optional, recommended for production |

Notes:

- The repo `veo3_get_1080p_video` tool exists because Kie provides 1080p as a separate fetch for 16:9 (the Kie page says 1080p and 4k URLs are in `resultJson.data.result_urls` and 720p in `data.origin_urls`).
- Kie callbacks return `originUrls` only when `aspect_ratio` is not 16:9.
- Kie does not give a numeric prompt length limit or image file size limit.
- Kie error code 402 means insufficient credits. Code 429 means rate limit, no number given.
- HTTP status is 200 even on failure. Check the `code` field.

## 5. Pricing

Kie:

- "Veo 3.1" from $0.025 per video (5 credits), the lowest listed option ([kie.ai/pricing](https://kie.ai/pricing)).
- Per-variant prices (`veo3`, `veo3_fast`, `veo3_lite`) are not visible on the fetched pages. Status: **unknown**.
- 1080p and 4k cost the 720p price plus an upgrade price. The amounts are on kie.ai/pricing and were not visible. Status: **unknown**.

Google: the [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists no Veo price. It links to the Veo models page. Status for Google Veo prices: **unknown**.

## 6. Strengths

- Native audio in the output, per Kie's docs.
- Three tiers with a cheap option (`veo3_lite`) for volume work.
- Supports first and last frame control, which Google's own page suggests keeping on Veo 3.1 for legacy pipelines (secondary source, unverified).
- 1080p and 4k output through Kie, with a separate fetch tool in the repo.

## 7. Weaknesses

- Google shut down the Veo 3.1 preview endpoints on October 22, 2026. The repo's Veo tool depends on a provider route whose status after that date is **unverified**.
- The repo request shape (`POST /veo/generate`, `aspectRatio`, `model` values `veo3` and `veo3_fast`) does not match the Kie docs page, which uses `POST /api/v1/jobs/createTask` with `model: "veo-3-1"` (see Open questions).
- The repo tool does not expose `resolution`, `duration`, or `veo3_lite`, so users cannot choose them through this tool.
- Repo still sends `enableFallback` (deprecated on Kie).
- Kie's Veo quickstart URL in the catalog (`docs.kie.ai/veo3-api/quickstart`) returned no content when fetched. The generate page's `.md` version was used.

## 8. Best use cases

- Short 720p clips from text on `veo3_fast` for drafts.
- Image-to-video with a start frame, or a start-to-end transition with two frames.
- Finished 16:9 clips that need a 1080p copy through `veo3_get_1080p_video`.

## 9. Alternatives in this catalog

From `packages/core/src/model-catalog.ts`: `gemini_omni` (Gemini Omni video, character, and voice; Google's suggested default after Veo 3.1 preview shutdown), `bytedance_seedance_video` (Seedance 2.5), `midjourney_generate` (image to video). The repo does not compare quality or price.

## 10. Open questions

- Does `POST /veo/generate` still work on Kie, or should the tool move to `POST /api/v1/jobs/createTask` with `model: "veo-3-1"`? Unverified.
- Does Kie's Veo route continue after Google's October 22, 2026 shutdown of Veo 3.1 preview models? Unverified.
- Per-variant and per-resolution Kie prices for `veo3`, `veo3_fast`, `veo3_lite`, 1080p, and 4k. Status: unknown.
- Should `resolution`, `duration`, and `veo3_lite` be exposed in the tool schema? This is a product decision, not a research result.
- Does `seeds` apply to Kie's endpoint? Not on the fetched page.
