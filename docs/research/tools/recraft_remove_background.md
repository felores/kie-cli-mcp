---
status: draft
date: 2026-10-31
sources:
  - https://kie.ai/recraft-remove-background
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://docs.kie.ai/market/recraft/remove-background
  - https://www.recraft.ai/docs/api-reference/pricing
  - https://www.recraft.ai/docs/api-reference/pricing.md
  - https://www.recraft.ai/about
  - https://www.recraft.ai/terms
---

# recraft_remove_background: tool research

Date: 2026-10-31. Catalog entry: `recraft_remove_background` / model `recraft-remove-background` (`packages/core/src/model-catalog.ts`). Local tool: `packages/core/src/tools/recraft_remove_background.ts`. Local contract: `docs/kie/recraft_remove_background.md`.

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

Removes the background from one image and returns a transparent PNG. Source: https://kie.ai/recraft-remove-background

## 2. Model version

- Kie.ai model ID: `recraft/remove-background`. Source: https://kie.ai/recraft-remove-background
- Provider: Recraft AI. Source: https://kie.ai/recraft-remove-background
- Provider-side model version: unverified. The Kie.ai page does not state one, and the provider's background removal pricing row is not versioned (https://www.recraft.ai/docs/api-reference/pricing).

## 3. Modes

One mode: image in, transparent PNG out. Source: https://kie.ai/recraft-remove-background

There is no text-to-image or prompt input. The local schema (`packages/core/src/types.ts`, `RecraftRemoveBackgroundSchema`) accepts only `image` and `callBackUrl`.

## 4. Key parameters and limits

Input `image` (required, URL): Source: https://kie.ai/recraft-remove-background and local schema.
- Formats: JPEG, PNG, WEBP. The Kie.ai page also lists JPG in one section.
- Max file size: 5MB.
- Max resolution: 16MP.
- Max dimension: 4096px. Min dimension: 256px.

Optional `callBackUrl`: POST notification on completion (success or fail). Source: local doc `docs/kie/recraft_remove_background.md`.

Task flow: `POST https://api.kie.ai/api/v1/jobs/createTask`, then `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...`. Source: local doc `docs/kie/recraft_remove_background.md`.

Other limits: no rate limit stated on the provider pricing page (https://www.recraft.ai/docs/api-reference/pricing). Kie.ai rate limits: unverified.

Parameter `nsfw_checker`: the Kie.ai page says it defaults to true in the playground (https://kie.ai/recraft-remove-background). It is not in the local schema. Whether the API accepts it is unverified.

## 5. Pricing

Kie.ai:
- 1 credit (about $0.005) per output image. Source: https://kie.ai/recraft-remove-background
- 1 credit is about $0.005. Credits never expire. Source: https://kie.ai/pricing
- New users: 80 free credits. Source: https://kie.ai/recraft-remove-background

Provider (Recraft API):
- $0.01 per request (10 API units). Source: https://www.recraft.ai/docs/api-reference/pricing
- Units: $1 per 1,000. Purchased units do not expire, and packages are non-refundable. Source: https://www.recraft.ai/docs/api-reference/pricing

Comparison: the Kie.ai per-image price is about half the provider's listed API price. The reason is unverified.

## 6. Strengths

- Low per-image cost on both channels: about $0.005 on Kie.ai and $0.01 at the provider (sources above).
- One call, one image, no extra parameters. Simple to use through this catalog.
- Output is a transparent PNG. Source: https://kie.ai/recraft-remove-background
- Commercial use is listed as allowed on Kie.ai. Source: https://kie.ai/recraft-remove-background
- Provider's API has no stated rate limit or minimum purchase. Source: https://www.recraft.ai/docs/api-reference/pricing

## 7. Weaknesses

- Single mode. No control over edge quality, mask, or output size. Source: https://kie.ai/recraft-remove-background (only documented inputs).
- Hard input limits: 5MB, 4096px max dimension, 256px min. Source: https://kie.ai/recraft-remove-background
- Input must be a public URL. Source: local schema (`z.string().url()`).
- Content policy restrictions apply to uploads. Source: https://www.recraft.ai/terms
- Price and terms on Kie.ai are not documented on docs.kie.ai, which returned no content on fetch (https://docs.kie.ai/market/recraft/remove-background).
- Local tool description says removal "typically takes 30-60 seconds". This is an internal estimate, not a sourced figure.

## 8. Best use cases

- Product photos and e-commerce images that need a transparent PNG.
- Batch cleanup of logos or cut-outs before compositing, within the size limits above.
- Pre-processing before upscaling or editing in other catalog tools.

## 9. Alternatives in this catalog

- `topaz_upscale_image` (model `topaz-image-upscale`): upscale, not background removal. Source: `packages/core/src/model-catalog.ts`.
- Within the catalog, no other background removal entry was found (grep of `model-catalog.ts` for "background").
- Provider-side alternative: Recraft's own "replace background" and "generate background" edits are $0.04 raster per image on the provider API. These are not in this catalog. Source: https://www.recraft.ai/docs/api-reference/pricing

## 10. Open questions

- Which provider model version sits behind `recraft/remove-background`? Unverified.
- Why is the Kie.ai price about half the provider's listed API price? Unverified. Check the Kie.ai billing page or contact Kie.ai.
- Does the Kie API accept `nsfw_checker`, and what does it filter? Unverified.
- Are Kie.ai rate limits and the output retention period documented? Unverified.
- Does the Kie.ai output keep transparency at all sizes and formats? Unverified.
- Is the `recraft/remove-background` price on Kie.ai the same product, tier and terms as the provider's API? Unverified.
