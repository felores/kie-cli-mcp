---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/google/nanobanana2.md
  - https://docs.kie.ai/market/google/nano-banana-2-lite.md
  - https://docs.kie.ai/market/google/nano-banana-2
  - https://kie.ai/pricing
  - https://ai.google.dev/gemini-api/docs/pricing
  - https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash
  - https://policies.google.com/terms/generative-ai/use-policy
---

# nano_banana_image

Research note for the MCP tool `nano_banana_image` (catalog model `nano-banana-2`, provider Google).

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

Generates images from text and edits images from one to fourteen reference images. The tool is in `packages/core/src/tools/nano_banana_image.ts`. It also accepts `model: "nano-banana-2-lite"`, which the catalog does not list (see Open questions).

Kie describes Nano Banana 2 as Google's Gemini 3.1 Flash Image model with text-to-image and multi-reference editing ([Kie NB2](https://docs.kie.ai/market/google/nanobanana2.md)).

## 2. Model version

- `nano-banana-2` = Google `gemini-3.1-flash-image` ([Google pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- `nano-banana-2-lite` = Google `gemini-3.1-flash-lite-image`, a 1K model with up to 10 references ([Kie Lite](https://docs.kie.ai/market/google/nano-banana-2-lite.md)).

## 3. Modes

Mode is chosen by the repo client from `image_input`:

- **Generate:** `prompt` only. The client sends `image_input: []`.
- **Edit:** `prompt` plus `image_input` (one or more URLs). The repo's stored API type is `nano-banana-edit`, and the repo does not show the Kie endpoint details beyond the request shape.

Lite: `image_input` is sent as `image_urls`, and the Kie page allows up to 10 URLs. Lite does not accept `resolution` or `output_format` in the repo client.

## 4. Key parameters and limits

| Parameter | Repo schema | Kie NB2 page | Kie Lite page |
|---|---|---|---|
| `prompt` | max 5000 chars (tool text says 20K for NB models) | max 20,000 chars | max 20,000 chars |
| `image_input` | 1 to 14 URLs | max 10 items | `image_urls` max 10 |
| `aspect_ratio` | enum incl. `1:4`, `1:8`, `4:1`, `8:1`; repo doc default `1:1` | enum incl. `auto`; default `auto` | enum incl. `auto`; no default stated |
| `resolution` | `1K`, `2K`, `4K`; default `1K` | `1K`, `2K`, `4K`; default `1K` | not supported (1K only per tool text) |
| `output_format` | `png`, `jpg`; default `png` | `png`, `jpg`; default `jpg` | Output is JPEG only |
| `google_search` | boolean, default false | not on the fetched page | not on the fetched page |
| Reference file | n/a | jpeg, png, webp; max 30 MB; URL, not inline bytes | same |

The repo's `aspect_ratio` default (`1:1`) and `image_input` maximum (14) differ from the Kie page (`auto` and 10). Verify before relying on either value.

## 5. Pricing

Kie (lowest "from" price, [kie.ai/pricing](https://kie.ai/pricing)):

- nano-banana-2: from $0.04 per image (8 credits).
- nano-banana-2-lite: from $0.02 per image (4 credits).

Kie per-resolution breakdown: the repo doc `docs/kie/google_nano-banana-2.md` gives 1K = 8, 2K = 12, 4K = 18 credits, but the Kie NB2 page shows `creditsConsumed: 8` for a 2K task. The repo table is not confirmed by the Kie docs. Status: **unverified** for 2K and 4K.

Google list prices, paid tier, per image ([pricing](https://ai.google.dev/gemini-api/docs/pricing)):

- Nano Banana 2 (`gemini-3.1-flash-image`): $0.045 (0.5K), $0.067 (1K), $0.101 (2K), $0.151 (4K).
- Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`): $0.0336 (1K).

Kie's "from" price for NB2 ($0.04) is below Google's 1K list price ($0.067). The reason is not stated on either page.

## 6. Strengths

- Per-resolution pricing is published by Google. The Lite tier is cheaper on both Kie and Google.
- Up to 4K output (NB2) and reference-image editing in one tool.
- Google Search grounding option in the repo schema (not verified on Kie or Google pages for this tool).

## 7. Weaknesses

- Kie and repo disagree on the reference count (14 vs 10), default aspect ratio, and 2K/4K credit cost.
- Lite is JPEG only and does not expose resolution.
- The repo's catalog entry lists only `nano-banana-2`, so Lite is hidden from catalog-based discovery.
- Generated images carry Google's SynthID watermark (see provider note).

## 8. Best use cases

- Quick text-to-image drafts with NB2 at 1K, and Lite for high-volume cheap drafts.
- Multi-reference edits, such as combining product and style images, within the 10 or 14 reference limit.
- Final 2K or 4K output when the higher-resolution credit cost is confirmed.

## 9. Alternatives in this catalog

From `packages/core/src/model-catalog.ts`: `bytedance_seedream_image` (Seedream 5 Pro), `gpt_image` (GPT Image 2.5), `flux_kontext_image` (Flux Kontext Pro), `flux2_image` (Flux 2 Pro), `qwen_image` (Qwen3), `z_image` (Z-Image). The repo does not compare their prices or quality.

## 10. Open questions

- Is the 14-reference limit (repo) or 10-reference limit (Kie) correct? Unverified.
- Is the repo's 1K/2K/4K credit table (8/12/18) correct? Kie's callback example says 8 for 2K. Unverified.
- Does `google_search` work on Kie's NB2 endpoint? Not on the fetched page. Unverified.
- Should `nano-banana-2-lite` be added to `model-catalog.ts`? The tool supports it, the catalog does not list it.
- Kie's `kie.ai/market` page lists a Nano Banana 2.1 entry; this tool does not use it. Not evaluated.
