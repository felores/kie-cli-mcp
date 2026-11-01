---
status: draft
date: 2026-10-31
sources:
  - https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
  - https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
  - https://developers.openai.com/api/docs/pricing
  - https://developers.openai.com/api/docs/guides/image-generation
  - https://openai.com/policies/usage-policies/
  - https://openai.com/index/introducing-chatgpt-images-2-5/
  - https://openai.com/api/pricing/
  - https://openai.com/about/
  - https://kie.ai/gpt-image-2-5
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md
  - https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md
  - https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-text-to-image.md
---

# OpenAI: provider research

Date: 2026-10-31. Slug: `openai`. Catalog tool in scope: `gpt_image` (see `docs/research/tools/gpt_image.md`). Local Kie contract: `docs/kie/gpt_image-2-5.md`.

Verification note: `openai.com` returned HTTP 403 to every WebFetch call in this run (`/about/`, `/api/pricing/`, `/policies/usage-policies/`, `/index/introducing-chatgpt-images-2-5/`). Claims that rest only on search snippets are marked `unverified`. The developer site `developers.openai.com` and the Kie.ai pages were read directly.

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths
4. Weaknesses
5. Usage and content policy
6. Pricing (provider)
7. How Kie.ai resells it
8. Open questions

## 1. Who they are

- OpenAI publishes its own developer documentation at `developers.openai.com`, including model pages and the image generation guide. Source: https://developers.openai.com/api/docs/guides/image-generation
- Company background (founding year, headquarters, ownership, mission statement): unverified. `openai.com/about/` returned HTTP 403.
- The Kie.ai catalog lists GPT Image 2.5 as an OpenAI model family. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md

## 2. Product lineup for media generation

Current image models on the official developer site:

| Model | ID | Role (as the provider describes it) | Source |
|---|---|---|---|
| GPT-Image-2.5 Flare | `gpt-image-2.5-flare` | "Fast, high-quality everyday image generation." Default snapshot `gpt-image-2.5-flare-2026-09-08`. | https://developers.openai.com/api/docs/models/gpt-image-2.5-flare |
| GPT-Image-2.5 Sunburst | `gpt-image-2.5-sunburst` | "Our most capable model for image generation and editing." Default snapshot `gpt-image-2.5-sunburst-2026-09-08`. | https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst |
| GPT Image 2 | (not read) | Earlier model. Listed on the pricing page at the same token rates as 2.5. | https://developers.openai.com/api/docs/pricing |
| gpt-image-1 | (not read) | Listed on the pricing page with no price. Shutdown date (October 23, 2026) reported in a search snippet only. | unverified |

Both 2.5 models accept text and image input and output images only. Both support inpainting, quality settings `low`, `medium`, `high`, `xhigh`, `max`, and `auto`, and the Image API generation and edit endpoints plus Batch. Source: both model pages above.

Sora (video): the repository has five Sora 2 contracts in `docs/kie/sora-2-*.md`. They are not in `packages/core/src/model-catalog.ts`, so they are out of scope for the catalog. The official OpenAI Sora pages were not read in this run: unverified.

## 3. Strengths

- Editing and inpainting are documented for both 2.5 models. Source: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- Custom sizes: any `WIDTHxHEIGHT` where width and height are multiples of 16, aspect ratio between 1:3 and 3:1, edges at most 3840 px, total pixels between 655,360 and 8,294,400. Source: https://developers.openai.com/api/docs/guides/image-generation
- Output formats: PNG (default), JPEG, WebP. Transparent backgrounds need PNG or WebP. Source: https://developers.openai.com/api/docs/guides/image-generation
- Batch rates are about half the Standard output rate ($15 vs $30 per 1M image output tokens). Source: https://developers.openai.com/api/docs/pricing
- Two models with a documented speed or precision split. The developer guide suggests starting with Sunburst and switching to Flare if latency matters. Source: https://developers.openai.com/api/docs/guides/image-generation

## 4. Weaknesses

- No per-image price on the official pricing page. Cost is token-based, and per-image estimates come from a calculator the page points to. Source: https://developers.openai.com/api/docs/pricing
- Rate limits are tier-based. Build tier: 250,000 TPM and 20 IPM for Flare. Source: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
- Sunburst does not support Chat Completions, Responses, or Realtime. It supports the Image generation, edit, and Batch endpoints. Source: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- Organization verification is required before using GPT Image models. Source: https://developers.openai.com/api/docs/guides/image-generation
- Input image count limit is not stated. Source: https://developers.openai.com/api/docs/guides/image-generation
- Context window and max output for the image models are not stated. Source: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare

## 5. Usage and content policy

- All prompts and generated images are filtered under the content policy. Blocked requests return `error.type = "image_generation_user_error"` and `error.code = "moderation_blocked"`. The `moderation` parameter accepts `auto` (default) or `low`. Source: https://developers.openai.com/api/docs/guides/image-generation
- `safety_identifier` is recommended but optional. Source: https://developers.openai.com/api/docs/guides/image-generation
- Usage policy details on real people, likeness, and minors: the policy page returned HTTP 403. A search snippet describes a ban on using someone's likeness without consent in ways that could confuse authenticity, and a ban on sexualizing or exploiting minors. Source (snippet only): https://openai.com/policies/usage-policies/. Status: unverified.
- Most detailed real-person and minor rules found in search come from Sora documentation, not from GPT Image. Status: unverified for GPT Image.

## 6. Pricing (provider)

Source: https://developers.openai.com/api/docs/pricing (Standard and Batch, per 1M tokens)

| Model | Modality | Standard input | Standard output | Cached input | Batch output |
|---|---|---|---|---|---|
| GPT Image 2.5 Flare | Image | $8.00 | $30.00 | $2.00 | $15.00 |
| GPT Image 2.5 Flare | Text | $5.00 | not billed | $1.25 | n/a |
| GPT Image 2.5 Sunburst | Image | $8.00 | $30.00 | $2.00 | $15.00 |
| GPT Image 2.5 Sunburst | Text | $5.00 | not billed | $1.25 | n/a |

Per-image price from OpenAI: unknown. The calculator was not read.

## 7. How Kie.ai resells it

- Kie.ai sells GPT Image 2.5 as credits per image: 6 credits at 1K, 10 at 2K, 16 at 4K. The page says the same price applies to Flare and Sunburst, and to text-to-image and image-to-image. Source: https://kie.ai/gpt-image-2-5
- Kie.ai credit value: about $0.005 per credit. Source: https://kie.ai/pricing
- Kie.ai's pricing page shows "from $0.03 per image" for GPT Image 2.5 Flare and Sunburst. Source: https://kie.ai/pricing
- The Kie.ai market page does not list GPT Image 2.5 entries with a price. It lists GPT Image 2 with no "from" price. Source: https://kie.ai/market. This conflicts with the pricing page; see open questions.
- Kie.ai API: `POST https://api.kie.ai/api/v1/jobs/createTask`, polling through task detail, model IDs `gpt-image-2-5-{flare|sunburst}-{text-to-image|image-to-image}`. Source: https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md
- New accounts get 80 free credits. Source: https://kie.ai/gpt-image-2-5

## 8. Open questions

1. Official per-image price for each size and quality: the calculator on the OpenAI image guide was not read. Owner: needs one run of the calculator.
2. Kie.ai GPT Image 2.5 price shown on `kie.ai/pricing` ("from $0.03") vs no price on `kie.ai/market`. Recommendation: treat the per-resolution credit table on `kie.ai/gpt-image-2-5` as the source, after checking the account credit balance API.
3. Usage policy text for GPT Image specifically: the policy page must be read from a non-blocked source.
4. Company background: `openai.com/about/` returned 403.
