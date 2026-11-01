---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md
  - https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md
  - https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-text-to-image.md
  - https://kie.ai/gpt-image-2-5
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
  - https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
  - https://developers.openai.com/api/docs/pricing
  - https://developers.openai.com/api/docs/guides/image-generation
---

# gpt_image: tool research

Date: 2026-10-31. Catalog entry: `gpt_image` / model `gpt-image-2-5-flare` (`packages/core/src/model-catalog.ts`). Local tool: `packages/core/src/tools/gpt_image.ts`. Local contract: `docs/kie/gpt_image-2-5.md`. Provider notes: `docs/research/providers/openai.md`.

## Contents

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

Generates an image from a text prompt, or edits and remixes up to 16 reference images. Output resolution is 1K, 2K, or 4K. Background can be set to transparent, opaque, or auto. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md

## 2. Model version

- Provider model: GPT Image 2.5, two variants: Flare (`gpt-image-2.5-flare`) and Sunburst (`gpt-image-2.5-sunburst`). Source: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare and https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- Kie.ai model IDs: `gpt-image-2-5-flare-text-to-image`, `gpt-image-2-5-flare-image-to-image`, `gpt-image-2-5-sunburst-text-to-image`, and the Sunburst image-to-image ID. Source: the three docs.kie.ai pages in the front matter.
- The tool's `model` field maps `flare` (default) or `sunburst`. The retired `gpt_image_2` name is gone. Source: local `docs/kie/gpt_image-2-5.md`.

## 3. Modes

- Text-to-image: no `input_urls`.
- Image-to-image: 1 to 16 `input_urls`. Presence of `input_urls` selects editing. Source: local `packages/core/src/types.ts` (`GptImage2Schema`) and https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md
- Reference uploads: JPEG, PNG, WEBP, or JPG, up to 30 MB each. Source: https://kie.ai/gpt-image-2-5
- The Kie.ai page warns that a request using `image_urls` instead of `input_urls` ignores the reference. Source: https://kie.ai/gpt-image-2-5

## 4. Key parameters and limits

| Parameter | Local tool | Kie.ai contract | Source |
|---|---|---|---|
| `prompt` | required, 1 to 20,000 chars | 1 to 20,000 chars | https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md |
| `model` | `flare` (default), `sunburst` | Model ID per variant | same |
| `input_urls` | 1 to 16 URLs | max 16, no minimum stated | https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md |
| `aspect_ratio` | `auto` (default), `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `27:16`, `16:27`, `9:8`, `8:9` | same list | same |
| `resolution` | `1K` (default), `2K`, `4K` | `1K`, `2K`, `4K`; default not stated | https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md |
| `background` | `transparent`, `opaque`, `auto` (optional) | same; supported only at 1K | same |
| `callBackUrl` | optional, falls back to `KIE_AI_CALLBACK_URL` | optional | same |

Limits:

- `27:16`, `16:27`, `9:8`, `8:9` are 1K only. The local tool enforces this in `refine`. Source: `packages/core/src/types.ts`.
- Transparent background at 2K or 4K: the Kie.ai page says it needs a prompt describing an isolated subject with no backdrop. Source: https://kie.ai/gpt-image-2-5
- A 2K or 4K request with `27:16` failed with an overload error and consumed 0 credits in the Kie.ai tests. Source: https://kie.ai/gpt-image-2-5
- Error codes: 402 insufficient credits, 429 rate limit, 422 and 500 check parameters. HTTP status is 200 even on failure, so `code` must be read. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md
- Output count per task: unverified.
- Output format: PNG in the Kie.ai tests. Source: https://kie.ai/gpt-image-2-5

## 5. Pricing

Kie.ai (credits per image, same for Flare and Sunburst):

- 1K: 6 credits (about $0.03). 2K: 10 credits (about $0.05). 4K: 16 credits (about $0.08). Source: https://kie.ai/gpt-image-2-5
- Credit value: about $0.005. Source: https://kie.ai/pricing
- Pricing page "from $0.03 per image." Source: https://kie.ai/pricing
- Top-up bonus: 10% on higher-tier top-ups, per the page. Source: https://kie.ai/gpt-image-2-5
- New users: 80 free credits. Source: https://kie.ai/gpt-image-2-5
- The `creditsConsumed: 3` value in the Kie.ai callback example is an illustration, not a price. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md

Provider (OpenAI): token-based. Image output $30 per 1M tokens Standard, $15 Batch. Image input $8 per 1M. Per-image price: unknown. Source: https://developers.openai.com/api/docs/pricing

Kie.ai per-image cost by mode: the page lists one price per resolution and says it applies to both modes. Unknown whether image-to-image adds input cost.

## 6. Strengths

- Up to 16 references in one call. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md
- Clear per-resolution credit table on Kie.ai. Source: https://kie.ai/gpt-image-2-5
- 4K output and transparent background in one tool. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md
- Two variants behind one tool name. Source: local `packages/core/src/tools/gpt_image.ts`

## 7. Weaknesses

- Prompt cap of 20,000 characters is high; no guidance on effective length is given. Unverified.
- Transparency is restricted at 2K and 4K, and the tool does not enforce that rule. The Kie.ai page says `background` is "only supported when the resolution is 1K." The local Zod schema has no matching `refine`. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md and `packages/core/src/types.ts`.
- Kie.ai spec inconsistency: the image-to-image `aspect_ratio` metadata lists ratios that are not in the enum (`5:4`, `4:5`, `2:1`, `1:2`, `3:1`, `1:3`, `9:21`). The tool follows the enum. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md
- Reference image formats and file size on the API spec: not stated in the spec. The Kie.ai page gives 30 MB. Source: https://kie.ai/gpt-image-2-5
- Default `resolution` and `background` on the Kie.ai API: not stated. The tool sets `1K` as its own default. Source: local `packages/core/src/types.ts`.
- Provider-side per-image cost is not published. Source: https://developers.openai.com/api/docs/pricing
- Organization verification is required at the provider. Source: https://developers.openai.com/api/docs/guides/image-generation

## 8. Best use cases

- Product or brand images that need a transparent background at 1K.
- Multi-reference edits, up to 16 inputs, such as combining a product with a style reference.
- Batch-style image generation at a fixed credit cost per resolution.
- High-resolution (4K) outputs where opaque background is acceptable.

## 9. Alternatives in this catalog

Catalog tool names from `packages/core/src/model-catalog.ts`. Capabilities are as stated in the catalog only; quality and price comparisons were not made in this run.

- `nano_banana_image`: Google image model family in the catalog.
- `bytedance_seedream_image`: Seedream 5 Pro and Flash; generation, editing, and layer decomposition per the catalog.
- `qwen_image`: Qwen3 and Qwen3 Pro; generation and editing per the catalog.
- `flux_kontext_image`: generation and editing per the catalog.
- `flux2_image`: generation and image-to-image per the catalog.
- `z_image`: generation only per the catalog.
- `midjourney_generate`: artistic generation.
- `wan_image`: Wan image model in the catalog.

## 10. Open questions

1. Does the Kie.ai API reject or ignore `background` at 2K or 4K? The local tool does not block it. Needs one paid or sandbox test.
2. Default `resolution` and `background` on the Kie.ai API: not stated. Needs confirmation from Kie.ai.
3. Does image-to-image cost differ from text-to-image on Kie.ai? The page says no; not independently checked.
4. Number of output images per task: unverified.
5. `kie.ai/pricing` says "from $0.03" for GPT Image 2.5, while `kie.ai/market` lists no price for it. The per-resolution table on `kie.ai/gpt-image-2-5` was used as the source.
6. Is the `sunburst` image-to-image ID documented on Kie.ai? The Sunburst text-to-image page was read; the image-to-image page was not.
7. OpenAI per-image cost by size and quality: needs the calculator on the OpenAI guide.
