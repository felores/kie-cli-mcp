---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/happyhorse-1-1/text-to-video
  - https://kie.ai/happyhorse-1-1
  - https://kie.ai/market
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference
  - https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference
  - https://www.sec.gov/Archives/edgar/data/0001577552/000110465926060224/tm2614494d1_ex99-1.htm
---

# happyhorse_video (HappyHorse 1.1)

Research date: 2026-10-31. Provider context: [HappyHorse provider research](../providers/happyhorse.md).

## Table of contents

1. [What it does](#what-it-does)
2. [Model version](#model-version)
3. [Modes](#modes)
4. [Key parameters and limits](#key-parameters-and-limits)
5. [Public pricing](#public-pricing)
6. [Strengths](#strengths)
7. [Weaknesses](#weaknesses)
8. [Best use cases](#best-use-cases)
9. [Alternatives in this catalog](#alternatives-in-this-catalog)
10. [Open questions](#open-questions)

## What it does

`happyhorse_video` creates a HappyHorse 1.1 video task on Kie.ai and returns a task ID. The caller then polls for the result. Kie.ai lists the 1.1 model as "text, image, and reference-to-video generation". Sources: https://kie.ai/happyhorse-1-1 and https://docs.kie.ai/market/happyhorse-1-1/text-to-video

The repo tool routes to one of three Kie.ai model IDs and does not expose video editing (1.0 only, removed here). Repo wiring: `packages/core/src/model-catalog.ts` (toolName `happyhorse_video`, model `happyhorse-1.1`) and `packages/core/src/tools/happyhorse_video.ts`.

## Model version

- Kie.ai version: HappyHorse-1.1. Source: https://docs.kie.ai/market/happyhorse-1-1/text-to-video
- Alibaba version: HappyHorse 1.1 (`happyhorse-1.1-t2v`, `-i2v`, `-r2v`). Source: https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference
- Maker: Alibaba. Alibaba's 6-K calls HappyHorse "a multimodal model for video generation". Source: https://www.sec.gov/Archives/edgar/data/0001577552/000110465926060224/tm2614494d1_ex99-1.htm

## Modes

| Mode | Kie.ai model ID | Input rule | Source |
| --- | --- | --- | --- |
| text-to-video | `happyhorse-1-1/text-to-video` | `prompt` required, max 5000 non-Chinese characters (2500 Chinese) | https://docs.kie.ai/market/happyhorse-1-1/text-to-video |
| image-to-video | `happyhorse-1-1/image-to-video` | one first-frame image in `image_urls`; prompt optional | https://kie.ai/happyhorse-1-1 (page lists the input form) |
| reference-to-video | `happyhorse-1-1/reference-to-video` | 1-9 reference images; prompt used to point at images as "[Image 1]" etc. | https://kie.ai/happyhorse-1-1 |

Mode selection in the repo: `mode` if given; else `reference_image` gives reference mode; else `image_urls` gives image mode; else text mode. Source: `packages/core/src/tools/happyhorse_video.ts`.

## Key parameters and limits

| Parameter | Limit | Source |
| --- | --- | --- |
| `prompt` | max 5000 non-Chinese characters, or 2500 Chinese | https://docs.kie.ai/market/happyhorse-1-1/text-to-video |
| `image_urls` | exactly 1 image; JPEG, PNG, WEBP, JPG; 20 MB max; width and height at least 300 px; aspect ratio between 1:2.5 and 2.5:1 | https://kie.ai/happyhorse-1-1 |
| `reference_image` | 1-9 images; JPEG, PNG, WEBP, JPG; 20 MB max; shortest side at least 400 px | https://kie.ai/happyhorse-1-1 |
| `resolution` | `720p` or `1080p`; default `1080p` | https://docs.kie.ai/market/happyhorse-1-1/text-to-video |
| `duration` | integer 3-15 seconds; default 5 | https://docs.kie.ai/market/happyhorse-1-1/text-to-video |
| `aspect_ratio` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `4:5`, `5:4`, `9:21`, `21:9`; default `16:9`; text and reference only | https://docs.kie.ai/market/happyhorse-1-1/text-to-video |
| `callBackUrl` | optional on the current Kie.ai doc; the repo client omits it and polls | https://docs.kie.ai/market/happyhorse-1-1/text-to-video |

Repo note: `docs/TOOLS.md` gives text prompt max 4999. The Kie.ai doc says 5000. The Zod schema uses 5000. Resolved in favour of the schema and Kie.ai text.

Alibaba's API adds 480P and a 1.1 `aspect_ratio` list identical to Kie.ai. Source: https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference . Kie.ai does not expose 480P.

## Public pricing

**Kie.ai (reseller):**

- 720p: 22.5 credits per second, $0.1125 per second.
- 1080p: 29 credits per second, $0.145 per second.
- Top-up bonus: tiers above a threshold include +10% bonus credits, so the effective price is about 10% lower.
- Source: https://kie.ai/happyhorse-1-1 . The single pricing line is on the reference-to-video view of the page. Text and image pricing were not shown separately.

**Alibaba Cloud Model Studio (provider, USD per second, global deployments):**

- 480P: $0.0618845
- 720P: $0.123769
- 1080P: $0.165026
- Singapore (international): 480P $0.07, 720P $0.14, 1080P $0.18. Singapore gives 10 free seconds per 1.1 mode.
- Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing (last updated Oct 29, 2026 per the page). Billing applies to successful tasks only.

Comparison at the same resolution: Kie.ai's 720p price is below Alibaba's global 720P price, and the 1080p price is below Alibaba's global 1080P price. Kie.ai and Alibaba bill in different currencies and units, so this comparison is for the figures found, not a full cost model.

**Unknown:** Chinese-yuan prices and Kie.ai image-to-video and text-to-video prices as separate lines.

## Strengths

- Covers text, one-image, and multi-reference generation in one tool, with mode auto-detection.
- Kie.ai's stated price is below Alibaba's global list price for the same resolution, per the figures found.
- Parameters are simple: resolution, duration, aspect ratio.
- Kie.ai's API uses the same task model as other repo tools (create then poll).

## Weaknesses

- Short clips only: 3-15 seconds per task.
- No video editing in 1.1; 1.0 editing is removed from this repo.
- No audio, seed, or camera controls in the repo schema. Alibaba's API lists a seed, but the repo does not expose it.
- Image-to-video does not accept an aspect ratio. Source: https://docs.kie.ai/market/happyhorse-1-1/text-to-video (the aspect field is for text and reference modes).
- Reference mode needs a prompt. Source: `packages/core/src/tools/happyhorse_video.ts` error text, and https://kie.ai/happyhorse-1-1 .
- Third-party reports disagree on clip length (3-15 s in some, 4-15 s in others). The official docs say 3-15 s. Source for the official value: https://docs.kie.ai/market/happyhorse-1-1/text-to-video

## Best use cases

- Short product, social, or marketing clips where a fixed 720p or 1080p price matters.
- Reference-to-video for keeping a character or product consistent across shots (up to 9 reference images).
- Text-to-video drafts where a 5-second default fits.

## Alternatives in this catalog

These are catalog tools from `docs/TOOLS.md`. Their pricing and fit were not researched in this document.

- `bytedance_seedance_video`: text and image video; ByteDance family.
- `kling_video`: text and image video; Kling family.
- `veo3_generate_video`: Google Veo; higher-resolution path exists (`veo3_get_1080p_video`).
- `wan_video`: Alibaba Wan family; same maker, different model line. See the provider doc.
- `grok_imagine`, `hailuo_video`, `gemini_omni`, `omnihuman_video`, `runway_aleph_video`, `wan_animate`: other video options.

## Open questions

- Kie.ai prices for text-to-video and image-to-video as separate lines: unknown. Only the reference-page line was found.
- Kie.ai watermark behaviour: unverified.
- `callBackUrl`: the current Kie.ai doc lists it as optional, but `docs/kie/happyhorse_1-1.md` says it is absent. The client omits it. Needs a check against the live API before changing the code.
- Aspect ratio list: the Kie.ai doc lists 9 values. `docs/kie/happyhorse_1-1.md` lists 6. `docs/TOOLS.md` lists 9. The Zod schema accepts 9. The `docs/kie` file should be updated after a live check.
- Alibaba's image-to-video API page was not fetched in full in this session (rate limit). Its parameters are unverified beyond the Kie.ai page.
- Whether Kie.ai routes HappyHorse calls to Alibaba's endpoints: unverified.
- No paid generation was run for this document.
