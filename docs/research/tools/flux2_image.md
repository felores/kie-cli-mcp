---
status: draft
date: 2026-10-31
sources:
  - https://bfl.ai/blog/flux-2
  - https://docs.bfl.ai/flux_2/flux2_overview
  - https://docs.bfl.ai/quick_start/pricing.md
  - https://docs.bfl.ai/release-notes
  - https://bfl.ai/legal/usage-policy
  - https://kie.ai/flux-2
  - https://kie.ai/pricing
  - https://docs.kie.ai/market/flux2/pro-text-to-image.md
  - https://docs.kie.ai/market/flux2/pro-image-to-image.md
  - https://docs.kie.ai/market/flux2/flex-text-to-image.md
---

# flux2_image

Catalog entry: `packages/core/src/model-catalog.ts`, model `flux-2-pro`. Repo spec: `docs/kie/flux2_image.md`. Tool code: `packages/core/src/tools/flux2_image.ts`. Client mapping: `packages/core/src/kie-ai-client.ts` (around line 1232).

## Contents

- What it does
- Model version
- Modes
- Key parameters and limits
- Public pricing
- Strengths
- Weaknesses
- Best use cases
- Alternatives in this catalog
- Open questions

## What it does

Text-to-image and multi-reference image-to-image with FLUX.2 through Kie.ai. The tool also accepts `model_type: flex`. Source: `packages/core/src/tools/flux2_image.ts`.

## Model version

- FLUX.2 family, launched by Black Forest Labs on Nov 25, 2025. Source: https://bfl.ai/blog/flux-2
- FLUX.2 [pro] was about 2x faster on Mar 3, 2026, with no price change. Its `flux-2-pro` endpoint is a fixed snapshot. `flux-2-pro-preview` gets updates first. Source: https://docs.bfl.ai/release-notes and https://docs.bfl.ai/flux_2/flux2_overview
- Kie model ID for pro: `flux-2/pro-text-to-image` and `flux-2/pro-image-to-image`. Source: https://docs.kie.ai/market/flux2/pro-text-to-image.md and https://docs.kie.ai/market/flux2/pro-image-to-image.md
- Kie model ID for flex text-to-image: `flux-2/flex-text-to-image`. Source: https://docs.kie.ai/market/flux2/flex-text-to-image.md
- Kie flex image-to-image ID: unverified. The client maps it to `flux-2/flex-image-to-image`, but no Kie page was checked.

## Modes

- Text-to-image: omit `input_urls`.
- Image-to-image: set `input_urls` with 1 to 8 URLs. The Kie page says these must be file URLs from an upload, not raw file content. Source: https://docs.kie.ai/market/flux2/pro-image-to-image.md
- The tool decides mode from `input_urls` presence only.

## Key parameters and limits

From the Kie pages and the Zod schema (`packages/core/src/types.ts`):

| Parameter | Value |
|---|---|
| `prompt` | Required. 3 to 5000 characters. |
| `input_urls` | Optional. 1 to 8 items in the schema. Kie: JPEG, PNG or WebP, max 10.0 MB each. |
| `aspect_ratio` | `1:1` (default), `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`. `auto` is in the schema and Kie allows it only with an input image. |
| `resolution` | `1K` (default) or `2K`. Kie docs list no other values. |
| `model_type` | `pro` (default) or `flex`. |
| `callBackUrl` | Optional. Falls back to `KIE_AI_CALLBACK_URL`. |

Notes:

- Kie's output is "PNG or JPEG". The tool does not set an output format. The repo's OpenAI adapter accepts only PNG. Source: `docs/kie/flux2_image.md`
- `nsfw_checker` is in the Kie API. Kie's API docs default it to `false`. Kie's FLUX.2 page says the Playground default is `true`. The tool does not expose it. Source: https://docs.kie.ai/market/flux2/pro-text-to-image.md and https://kie.ai/flux-2
- BFL states up to 4 MP output. Source: https://bfl.ai/blog/flux-2
- Tool's `resolution` maps to 1K and 2K only. The 4 MP BFL ceiling is not exposed.
- The repo spec says the provider limit is 30 MiB per reference, and the adapter applies a 25 MiB ceiling. Kie's live page says 10.0 MB per image. Mismatch, see open questions.

## Public pricing

Kie.ai (credit rate 1 credit is about $0.005, failed tasks are not charged; source https://kie.ai/pricing):

- FLUX.2 [pro], 1K: 5 credits, about $0.025 per image. Source: https://kie.ai/flux-2
- FLUX.2 [pro], 2K: 7 credits, about $0.035 per image. Source: https://kie.ai/flux-2
- Effective price with high-tier top-ups: about $0.0225 (1K) and $0.0315 (2K). Source: https://kie.ai/flux-2
- Reference images: Kie says they can be uploaded "at no extra cost." Source: https://kie.ai/flux-2
- FLUX.2 [flex] price: unknown. The flex page shows a callback example of 14 credits for a 1K 1:1 task. The page says that is an example, not a published price. Source: https://docs.kie.ai/market/flux2/flex-text-to-image.md
- Kie's FLUX.2 [max] price: unknown. Not in this catalog.

Black Forest Labs (provider):

- FLUX.2 [pro] "from $0.03/MP" at launch. Source: https://docs.bfl.ai/release-notes
- FLUX.2 pricing is megapixel-based. The per-model table on the pricing page did not show numeric values to the fetch tool. Source: https://docs.bfl.ai/quick_start/pricing.md
- BFL exact 1K and 2K prices, flex price and reference-image surcharge: unknown. Use the calculator at https://bfl.ai/pricing (it shows a rate of $0.048 per image for an unnamed option, per fetch; mapping unknown).

## Strengths

- Up to 8 reference images through the API on Kie. Source: https://kie.ai/flux-2
- BFL claims reliable fine text in production (infographics, memes, UI mockups). Source: https://bfl.ai/blog/flux-2
- Kie's 1K tier is 5 credits and its 2K tier is 7 credits. Source: https://kie.ai/flux-2

## Weaknesses

- 2K costs 40 percent more than 1K (7 vs 5 credits).
- The tool exposes no seed, steps or guidance. The flex variant is the one BFL positions for step and guidance control, but the tool does not pass those.
- `auto` aspect ratio works only in edit mode.
- Kie's FLUX.2 page warns that its NSFW filter may not catch everything. Source: https://kie.ai/flux-2 (paraphrase)
- Repo spec and Kie's docs disagree on file size limits.

## Best use cases

- Multi-reference composition, such as product plus scene plus style references.
- Text-heavy images at 1K or 2K.
- Batch-style generation where the 5-credit 1K price is the main constraint.

## Alternatives in this catalog

- `flux_kontext_image`: single-reference iterative editing. 5 credits (pro) or 10 credits (max) per image. See `docs/research/tools/flux_kontext_image.md`.
- Other image tools in `packages/core/src/model-catalog.ts` (for example `gpt_image`, `seedream_5-pro`, `google_nano-banana-pro`): compare in their own docs. Not researched here.

## Open questions

1. Which BFL endpoint does Kie map to: `flux-2-pro` (fixed snapshot) or `flux-2-pro-preview` (updated first)? Source needed from Kie. Decides whether results change over time.
2. Reference file size: Kie live docs say 10.0 MB per image. Repo spec says 30 MiB provider limit and 25 MiB adapter ceiling. Decide which to enforce, and check the repo spec against the live Kie page.
3. Flex image-to-image ID: `flux-2/flex-image-to-image` is in the client but unverified on Kie.
4. Flex and max prices on Kie: unknown.
5. `nsfw_checker` default: Kie API docs say `false`, Kie's FLUX.2 page says `true` in the Playground. Confirm the API default with one test task.
6. BFL 2K and flex prices: unknown.
7. The Kie docs page for FLUX.2 says `resolution` is required. The schema has a default of `1K`. The tool fills in the default before sending. Confirm the API does not reject omitted values.
