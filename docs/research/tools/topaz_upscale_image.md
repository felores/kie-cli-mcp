---
status: draft
date: 2026-10-31
sources:
  - https://kie.ai/topaz-image-upscale
  - https://kie.ai/market/topaz
  - https://kie.ai/pricing
  - https://kie.ai/terms-of-use
  - https://docs.kie.ai/market/topaz/image-upscale
  - https://developer.topazlabs.com/overview.md
  - https://www.topazlabs.com/api
  - https://www.topazlabs.com/
---

# topaz_upscale_image

Research for the catalog tool `topaz_upscale_image` (model `topaz-image-upscale`, Kie.ai model ID `topaz/image-upscale`). Provider research: `docs/research/providers/topaz-labs.md`.

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

Upscales and enhances a single image through Kie.ai's Topaz image model. Kie.ai describes it as an "AI image enhancement model that increases resolution and restores detail." Source: https://kie.ai/topaz-image-upscale

The official page also claims unblur, sharpening, and denoising. The API exposes no separate parameter for those tasks, so they are not controllable through this tool. Source: https://kie.ai/topaz-image-upscale

The local tool posts to `POST /api/v1/jobs/createTask` through `KieAiClient.generateTopazUpscaleImage`. Source: local, `packages/core/src/kie-ai-client.ts` (line 1442) and `packages/core/src/tools/topaz_upscale_image.ts`.

## 2. Model version

- Kie.ai model ID: `topaz/image-upscale`. Source: https://kie.ai/topaz-image-upscale and https://docs.kie.ai/market/topaz/image-upscale (listing from search; direct fetch returned empty).
- Topaz model version behind the Kie.ai ID: unknown. No official Kie page names it. Source: https://kie.ai/market/topaz
- Local `api_type` stored in the task DB: `topaz-upscale`. Source: local, `packages/core/src/tools/topaz_upscale_image.ts`.

## 3. Modes

The tool has one mode: image in, enlarged image out.

- Upscale: `upscale_factor` of `"1"`, `"2"`, `"4"`, or `"8"` in the local schema. Source: local, `packages/core/src/types.ts` (line 1910).
- Official Kie.ai page lists only `1x`, `2x`, and `4x`. The factor `8` is absent from the official page. Source: https://kie.ai/topaz-image-upscale
- Text-to-image, editing, and video: not supported by this tool.

## 4. Key parameters and limits

| Parameter | Required | Type | Values | Source |
|---|---|---|---|---|
| `image_url` | yes | string URL | JPEG, PNG, WEBP; max 10 MB | https://kie.ai/topaz-image-upscale |
| `upscale_factor` | no in local schema (default `"2"`) | string enum | Local: `"1"`, `"2"`, `"4"`, `"8"`. Official: `1x`, `2x`, `4x` | https://kie.ai/topaz-image-upscale; local types.ts |
| `callBackUrl` | no | string URL | Falls back to `KIE_AI_CALLBACK_URL` | local tool file |
| `nsfw_checker` | unverified | boolean | Listed as optional on the Kie product page, default true in the playground | https://kie.ai/topaz-image-upscale |

Limits:
- Longest side of the input multiplied by `upscale_factor` cannot exceed 20,000 px. Source: https://kie.ai/topaz-image-upscale
- Minimum input size: unknown. Source: https://kie.ai/topaz-image-upscale (not stated)
- Output format and dimensions per factor: unknown. The official page does not state them. Source: https://kie.ai/topaz-image-upscale
- Output type: image. Source: https://kie.ai/topaz-image-upscale
- Rate limits and concurrency: unknown. Source: https://kie.ai/topaz-image-upscale (not stated)
- Processing time: unverified. The page says "within seconds" with no figure. The local tool text says 30-90 seconds, which has no official source.

Conflicts to resolve:
- The `nsfw_checker` parameter is listed as optional on the official product page. The local client does not send it. A search snippet for the docs page did not show it in the example. Source: https://kie.ai/topaz-image-upscale and https://docs.kie.ai/market/topaz/image-upscale
- The local docs file (`docs/kie/topaz_image-upscale.md`) says the output keeps the input extension, and the local factor list includes `8` ("8x segun UI"). The official page states neither. Source: local docs file vs https://kie.ai/topaz-image-upscale

## 5. Pricing

Kie.ai (public):
- 2K or smaller: 10 credits, $0.05. Source: https://kie.ai/topaz-image-upscale
- 4K: 20 credits, $0.10. Source: https://kie.ai/topaz-image-upscale
- Credit value: 1 credit ≈ $0.005. Source: https://kie.ai/pricing
- Failed tasks are never charged. Source: https://kie.ai/pricing
- Credits never expire. Source: https://kie.ai/pricing
- Top-ups: larger top-ups include bonus credits (example: 10% on $1,250). Source: https://kie.ai/pricing
- Derived effective rates on the product page (about $0.045 for 2K and $0.09 for 4K with top-up bonus): these are derived from the bonus claim, not a published price. Source: https://kie.ai/topaz-image-upscale
- Mapping of factor 1x, 2x, 4x, 8x to the 2K and 4K tiers: unknown. The official page shows only the two tiers. Source: https://kie.ai/topaz-image-upscale
- 8K tier (40 credits, cited in the local tool description): unverified. Not on the official page. Source: local tool file.
- 1x price: unknown. Source: https://kie.ai/topaz-image-upscale (not stated)

Provider (Topaz direct, for comparison):
- Developer plan: $50/mo, 500 credits, $0.10 per credit. Source: https://www.topazlabs.com/api
- Scale plan: $240/mo, 3,000 credits, $0.08 per credit. Source: https://www.topazlabs.com/api
- Enhance endpoint: 1 credit up to 24 MP output, up to 16 credits at 512 MP. The API page is inconsistent about 24 MP vs 32 MP per credit. Source: https://www.topazlabs.com/api
- Whether Kie.ai's flat price equals a Topaz direct credit charge for the same output: unverified. No public mapping exists.

## 6. Strengths

- Flat, low per-image price at 2K or smaller on Kie.ai (10 credits). Source: https://kie.ai/topaz-image-upscale
- Failed tasks are not charged, and credits do not expire. Source: https://kie.ai/pricing
- Simple interface: one image URL and one factor. Source: https://kie.ai/topaz-image-upscale
- Covered by the catalog's callback pattern and task DB. Source: local tool file.
- Output stays a single image, with no reinterpretation step. Source: local docs file (claim unverified against the official page).

## 7. Weaknesses

- Only two published price tiers. 1x, 8x, and the factor-to-tier mapping are not public. Source: https://kie.ai/topaz-image-upscale
- `8` is in the local schema but absent from the official factor list. Source: local types.ts vs https://kie.ai/topaz-image-upscale
- No control over denoise, sharpen, or face settings through this tool. Source: https://kie.ai/topaz-image-upscale
- Output format, minimum input size, and processing time are not stated. Source: https://kie.ai/topaz-image-upscale
- Backend model version is not named. Source: https://kie.ai/market/topaz
- Public terms do not state commercial rights to outputs. Source: https://kie.ai/terms-of-use

## 8. Best use cases

- Restoring low-resolution or soft photos, and product shots for e-commerce. Source: https://kie.ai/topaz-image-upscale (use cases listed on the product page)
- Preparing AI-generated art or portraits for larger prints, once output size is verified in a test run. Source: https://kie.ai/topaz-image-upscale
- Enlarging a generated image without re-prompting, so the composition stays the same. Source: local docs file (claim is the team's own note; the official page says "increases resolution")

## 9. Alternatives in this catalog

- `grok_imagine`: its catalog capabilities include "image upscale" alongside text-to-image. Source: local `packages/core/src/model-catalog.ts` (line 207).
- `nano_banana_image`, `gpt_image`, `bytedance_seedream_image`: image generation or editing tools that can regenerate at higher resolution. Their output changes the image, unlike an upscaler. Source: local `packages/core/src/model-catalog.ts`.
- No other catalog tool is named for a dedicated upscaler. Source: local catalog grep.

## 10. Open questions

1. What Topaz model and version backs `topaz/image-upscale`.
2. Price for 1x, and for 8x (and the 8K tier cited locally).
3. Mapping of factors to the 2K and 4K price tiers.
4. Whether `nsfw_checker` is accepted, and its default.
5. Output format, minimum input size, and processing time.
6. Whether the local claim that output keeps the input extension is correct.
7. Commercial use rights to outputs: the Kie.ai "Commercial use" label has no matching terms text.
8. Whether the local schema's `8` should stay, given the official list of 1x, 2x, and 4x.
