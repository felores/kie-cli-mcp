---
status: draft
date: 2026-10-31
sources:
  - https://kie.ai/ideogram/v3
  - https://kie.ai/market/ideogram
  - https://ideogram.ai/pricing/?pricing_tab=api
  - https://developer.ideogram.ai/v2/api-reference/images/reframe/ideogram-3
  - https://developer.ideogram.ai/v1/api-reference/tools/reframe-v3
  - https://developer.ideogram.ai/ideogram-api/api-overview
  - https://docs.kie.ai/market-api/quickstart
---

# ideogram_reframe

Catalog entry: `ideogram_reframe` -> model `ideogram-v3-reframe` (`packages/core/src/model-catalog.ts`, capability "image reframe", status active).
Provider context: `docs/research/providers/ideogram.md`.

## Contents

1. What it does
2. Model version and modes
3. Parameters and limits
4. Pricing
5. Strengths
6. Weaknesses
7. Best use cases
8. Alternatives in this catalog
9. Open questions

## 1. What it does

Reframes an image to a new size or aspect ratio using Ideogram V3 Reframe. The repo tool (`packages/core/src/tools/ideogram_reframe.ts`) creates an async task and stores it in SQLite with `api_type: "ideogram-reframe"`. The result arrives by callback or by polling `get_task_status`.

Kie.ai's V3 page describes reframe as: "Reframes square images into new resolutions or aspect ratios" using "intelligent outpainting" (https://kie.ai/ideogram/v3).

## 2. Model version and modes

- Model ID: `ideogram/v3-reframe` (repo Kie doc, `docs/kie/ideogram_reframe_image.md`). Kie's public V3 page lists only `ideogram/v3-text-to-image`, `ideogram/v3-edit`, and `ideogram/v3-remix`. The reframe ID is not confirmed on a public Kie page.
- Official Ideogram model: Ideogram 3.0. Official reframe endpoint: `POST /v2/image/reframe/ideogram-3` (https://developer.ideogram.ai/v2/api-reference/images/reframe/ideogram-3).
- Mode: one mode, reframe. Input is a source image plus a target size. No prompt field exists in the repo schema or the Kie doc.

## 3. Parameters and limits

Repo schema and Kie doc (`packages/core/src/types.ts`, `docs/kie/ideogram_reframe_image.md`):

| Field | Type | Required | Values and default |
|---|---|---|---|
| `image_url` | URL | yes | JPEG, PNG, WEBP. Max 10MB (Kie doc). |
| `image_size` | enum | yes | `square`, `square_hd` (default), `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` |
| `rendering_speed` | enum | no | `TURBO`, `BALANCED` (default), `QUALITY` |
| `style` | enum | no | `AUTO` (default), `GENERAL`, `REALISTIC`, `DESIGN` |
| `num_images` | string | no | `"1"` to `"4"`, default `"1"` |
| `seed` | number | no | default 0 |
| `callBackUrl` | URL | no | falls back to `KIE_AI_CALLBACK_URL` |

Official Ideogram 3.0 reframe for comparison (v2 reference):
- Input: JPEG, PNG, WEBP, max 25MB, multipart upload.
- `resolution`: enum of 69 values (not the six Kie presets).
- `rendering_speed`: `turbo`, `default`, `quality`.
- `num_images`: integer 1 to 8.
- `seed`: integer 0 to 2147483647.
- `style_preset`, `color_palette`, `style_codes`, `style_reference_images` (max 10, 25MB each).
- `async` and `dry_run` (dry run returns a price quote and bills nothing).

Mismatches to note:
- Kie `num_images` is a string, official is an integer.
- Kie `image_size` has six presets, official `resolution` has 69 values.
- Kie `style` replaces official `style_preset`. Unverified whether Kie passes style codes.
- Kie input cap is 10MB, official is 25MB.
- Kie doc default image URL is a Kie-hosted sample. It is not a repo test asset.

Output pixel sizes per preset: unverified. Official docs do not list them in the pages read.

## 4. Pricing

Provider (Ideogram official, https://ideogram.ai/pricing/?pricing_tab=api, "Apps and tools" > Reframe):
- Ideogram 3.0 Turbo: US $0.03 per reframe.
- Ideogram 3.0 Default: US $0.06 per reframe.
- Ideogram 3.0 Quality: US $0.09 per reframe.
- Billed per image. Official reframe uses "Same rate as generation" for the model.

Kie.ai:
- Reframe price on Kie: unknown. No reframe-specific price was found on https://kie.ai/ideogram/v3 or https://kie.ai/market/ideogram.
- Kie's V3 family price, shown on its model page: 3.5 credits ($0.0175) Turbo, 7 credits ($0.035) Balanced, 10 credits (about $0.05) Quality, per image. Whether reframe bills this rate: unverified.
- Kie's public page says the V3 model "offers text-to-image, image editing, reframing, and remixing", with prices for "each rendering speed". This does not state a reframe rate.

Catalog note: `docs/kie/ideogram_reframe_image.md` and the tool response contain no price field. Cost must be checked in the Kie dashboard before bulk use.

## 5. Strengths

- A dedicated reframe endpoint, not a generic prompt edit.
- Keeps the source image in the center and fills the new area (official v2 reference). Useful for square-to-widescreen or vertical crops.
- Per-image pricing is published for the official route (section 4).
- Async flow with callback or polling, matching the repo's other generation tools.

## 6. Weaknesses

- Kie reframe price is unknown.
- Reframe is listed on official docs for 3.0 only. Quality is tied to that model generation.
- Kie input cap of 10MB is lower than the official 25MB.
- The repo tool claims `image_size` options that Kie documents, but output dimensions per option are not verified.
- The catalog's evidence link `https://docs.kie.ai/market-api/quickstart` returns HTTP 404 (checked 2026-10-31). The catalog's source for this tool is broken.
- Result image URLs expire (official overview). Download results promptly.

## 7. Best use cases

- Turning a square campaign image into 16:9 or 9:16 for social posts or video thumbnails.
- Extending a product or subject image to a new aspect ratio without redrawing the subject.
- Batch format adaptation where the prompt is not needed.

Poor fit: edits that need a new subject or a text change. Use an edit or generate tool instead.

## 8. Alternatives in this catalog

Only tools listed in `docs/TOOLS.md` were considered. Whether any of them reframe an image without a prompt was not verified. Check each `docs/kie/` file before use.

- `nano_banana_image`: image generation and editing. Reframe support unverified.
- `gpt_image`: generation and editing with input images. Reframe support unverified.
- `flux_kontext_image`: context-aware editing. Reframe support unverified.
- `bytedance_seedream_image`: generation and editing. Reframe support unverified.
- `qwen_image`: generation and editing. Reframe support unverified.
- `topaz_upscale_image`: upscaling only. Not a reframe substitute.

## 9. Open questions

1. What is the Kie price for `ideogram/v3-reframe`, per image, per rendering speed?
2. Does Kie `BALANCED` map to official `default`, or is it a Kie-only tier? Unverified.
3. Does Kie accept the official 25MB input, or is the 10MB cap enforced? Kie doc says 10MB.
4. What are the output pixel sizes for each `image_size` preset?
5. Does Kie accept official style codes or style presets? The repo schema has neither.
6. Does the catalog need a new evidence URL, since `https://docs.kie.ai/market-api/quickstart` returns 404?
