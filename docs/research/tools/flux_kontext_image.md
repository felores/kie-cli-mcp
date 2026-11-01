---
status: draft
date: 2026-10-31
sources:
  - https://bfl.ai/announcements/flux-1-kontext
  - https://docs.bfl.ai/kontext/kontext_text_to_image
  - https://docs.bfl.ai/quick_start/pricing.md
  - https://kie.ai/flux-kontext-api
  - https://kie.ai/pricing
  - https://kie.ai/market/black-forest-labs
  - https://bfl.ai/legal/usage-policy
  - https://docs.bfl.ai/release-notes
---

# flux_kontext_image

Catalog entry: `packages/core/src/model-catalog.ts`, model `flux-kontext-pro`. Repo spec: `docs/kie/flux_kontext_image.md`. Tool code: `packages/core/src/tools/flux_kontext_image.ts`.

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

Text-to-image generation and instruction-based editing of a reference image with the FLUX.1 Kontext family, through Kie.ai. Source: `packages/core/src/tools/flux_kontext_image.ts`.

## Model version

- Family: FLUX.1 Kontext, announced May 29, 2025 by Black Forest Labs. Source: https://bfl.ai/announcements/flux-1-kontext
- Tiers used by the tool: `flux-kontext-pro` (default) and `flux-kontext-max`. Source: `docs/kie/flux_kontext_image.md`
- The BFL Kontext page documents `flux-kontext-pro` at `https://api.bfl.ai/v1/flux-kontext-pro`. Max endpoint on BFL: unverified. Source: https://docs.bfl.ai/kontext/kontext_text_to_image

## Modes

- Text-to-image: omit `inputImage`.
- Image editing: set `inputImage` to a public image URL.
- The tool decides mode from `inputImage` presence only. Source: tool code.

## Key parameters and limits

From the repo's copy of the Kie spec (`docs/kie/flux_kontext_image.md`) and the Zod schema in `packages/core/src/types.ts`:

| Parameter | Value |
|---|---|
| `prompt` | Required. 1 to 5000 characters in the schema. Kie docs say English only. |
| `inputImage` | Optional URL. Editing mode. |
| `aspectRatio` | `21:9`, `16:9` (default), `4:3`, `1:1`, `3:4`, `9:16` in the schema. |
| `model` | `flux-kontext-pro` (default) or `flux-kontext-max`. |
| `outputFormat` | `jpeg` (default) or `png`. |
| `safetyTolerance` | 0 to 6 for generation, 0 to 2 for editing. Default 2. |
| `promptUpsampling`, `enableTranslation`, `uploadCn`, `watermark`, `callBackUrl` | Optional. |

Notes:

- Kie's public page lists six ratios including `16:21` and does not list all six. Source: https://kie.ai/flux-kontext-api. The schema lacks `16:21`. Mismatch, see open questions.
- BFL's Kontext [pro] page lists ratios from 3:7 to 7:3 and about 1 MP output. Source: https://docs.bfl.ai/kontext/kontext_text_to_image. Kie's rules may differ.
- Kie's page gives no input image size or count limit. Unverified.

## Public pricing

- Kie.ai, Kontext pro: 5 credits per image, about $0.025. Source: https://kie.ai/flux-kontext-api
- Kie.ai, Kontext max: 10 credits per image, about $0.05. Source: https://kie.ai/flux-kontext-api
- Credit rate: 1 credit is about $0.005. Failed tasks are not charged. Source: https://kie.ai/pricing
- Provider (BFL) price per image for pro and max: unknown. The BFL pricing pages fetched did not show numeric Kontext prices. Sources: https://docs.bfl.ai/quick_start/pricing.md and https://bfl.ai/pricing (calculator only).
- Third-party listings quoted $0.04 and $0.08. Not used, because they are not official.

## Strengths

- BFL claims pro has "the highest scores in text editing and character preservation" in its own evaluation. Source: https://bfl.ai/announcements/flux-1-kontext
- Editing is plain-text instruction based, with no finetuning. Source: same.
- Pro is the cheaper tier at 5 credits. Max is 10 credits.

## Weaknesses

- BFL says "Excessive multi-turn editing sessions can introduce visual artifacts." Source: https://bfl.ai/announcements/flux-1-kontext
- Limited world knowledge and occasional ignored instructions. Source: same.
- English prompts only on Kie. Source: https://kie.ai/flux-kontext-api
- Max is labeled "experimental" in BFL's announcement.

## Best use cases

- Iterative edits on one reference image where the subject must stay consistent.
- Text edits inside an image, where BFL reports strong results.
- Quick text-to-image at the 5-credit tier when FLUX.2 quality is not needed.

## Alternatives in this catalog

- `flux2_image` (FLUX.2 [pro]): up to 8 reference images, 1K and 2K. Higher price at 2K (7 credits). See `docs/research/tools/flux2_image.md`.
- Other editing tools in this catalog (for example `qwen_image-edit`, `google_nano-banana-edit`, `gpt_image`): compare in their own docs. Not researched here.

## Open questions

1. Kie endpoint: the Kie page says send `flux1-kontext` to `POST /api/v1/jobs/createTask`. The repo client calls `/flux/kontext/generate` (`packages/core/src/kie-ai-client.ts`). Which one is live? Confirm with a test task, not docs alone.
2. Aspect ratios: schema allows six values without `16:21`. Kie's page lists `16:21`. Decide which set is correct.
3. Kie's `docs.kie.ai` Kontext page returned 404 on fetch. The repo spec is unverified against the live page.
4. Official BFL price for pro and max: unknown.
5. Max endpoint and parameters on BFL: unverified.
6. Input image size, count and format limits on Kie: unverified.
7. Prompt limit: schema says 5000 characters. Kie's playground counter reads "0/2000". Source: https://kie.ai/flux-kontext-api. Decide which is correct.
