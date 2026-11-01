---
status: draft
date: 2026-10-31
sources:
  - https://www.recraft.ai/about
  - https://www.recraft.ai/docs/api-reference/pricing
  - https://www.recraft.ai/docs/api-reference/pricing.md
  - https://www.recraft.ai/blog/pricing-update
  - https://www.recraft.ai/terms
  - https://www.recraft.ai/pricing?tab=api
  - https://kie.ai/recraft-remove-background
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://docs.kie.ai/market/recraft/remove-background
---

# Recraft: provider research

Date: 2026-10-31. Scope: Recraft as a provider of media generation, and how Kie.ai resells it in this catalog.

## Contents

1. Who they are
2. Product lineup relevant to media generation
3. Strengths and weaknesses
4. Usage and content policy
5. Pricing (provider and Kie.ai)
6. How Kie.ai resells it
7. Gaps and unverified items

## 1. Who they are

- Recraft is an AI design tool for designers, illustrators and marketers. Source: https://www.recraft.ai/about
- Founded 2022, with US origins. Headquarters listed as London, UK. Source: https://www.recraft.ai/about
- The official about page does not name founders. Founder names found in search results are secondary sources and are unverified here.

## 2. Product lineup relevant to media generation

Source for the whole section: https://www.recraft.ai/about

- Recraft Studio: a design tool that combines several AI models.
- Image creation: AI image, vector, mockup and ad generators.
- Editing: vector editor, background remover, SVG converter, upscaler, AI eraser, prompt-based editor, format converter.
- Own models: V2 through V4.1. Model-level details are in the provider docs (https://www.recraft.ai/docs/api-reference/pricing).
- Third-party image and video models are also offered on the platform.
- API for automated visual workflows, with a pricing page at https://www.recraft.ai/pricing?tab=api.
- Integrations: Figma, Framer, Chrome extension, Google Docs and Slides add-ons.

Unverified: the V4 release date (May 2026) appears only in aggregator pages. Vendor-level confirmation was not found.

## 3. Strengths and weaknesses

Strengths (verified from the official pages above):
- Vector and SVG output is a core product focus (vector generators, SVG converter, vector editor).
- Background removal is a standalone, low-cost API tool.
- No rate limit, minimum purchase or maximum image size is stated on the API pricing page (https://www.recraft.ai/docs/api-reference/pricing).

Weaknesses (verified):
- API units are non-refundable and non-cancellable once bought (https://www.recraft.ai/docs/api-reference/pricing).
- Free-tier outputs cannot be used commercially (https://www.recraft.ai/terms, section 7.1).
- Input prompts and uploads are used for training by default, with an opt-out in account settings (https://www.recraft.ai/terms).

Unverified: quality comparisons against other providers. Marketing claims (for example, leaderboard rankings) are not used here.

## 4. Usage and content policy

Source: https://www.recraft.ai/terms

- Prohibited: illegal use, IP or privacy infringement, harassment, fraud, obscene content, child sexual exploitation material (banned), impersonation, political deepfakes meant to mislead voters, and non-consensual intimate imagery including deepfakes of real people (section 8).
- Do not remove AI-content markings or watermarks (section 8.2).
- Prompts that imitate third-party brands or identifiable people make the user responsible for rights (section 8.4).
- Commercial use: paid subscriptions may use outputs for business. Free-tier outputs are personal use only (sections 7.1 and 7.2).
- Uploaded inputs: the user must hold rights to what they upload. Recraft does not monitor use (terms, inputs section).

The Kie.ai page for this model says its `nsfw_checker` parameter defaults to true in the playground and that filtering is not guaranteed (https://kie.ai/recraft-remove-background). Whether the Kie API applies the same check is unverified.

## 5. Pricing

Provider (Recraft API):
- Remove background: $0.01 per request, equal to 10 API units. Source: https://www.recraft.ai/docs/api-reference/pricing
- API units: $1 per 1,000 units. Units do not expire. Source: https://www.recraft.ai/docs/api-reference/pricing
- Other image prices (for context): vectorize $0.01, crisp upscale $0.004, erase region $0.002. Source: https://www.recraft.ai/docs/api-reference/pricing.md

Kie.ai:
- Model `recraft/remove-background`: 1 credit (about $0.005) per output image. Source: https://kie.ai/recraft-remove-background
- Credits: 1 credit is about $0.005. Source: https://kie.ai/pricing
- Credits never expire and there is no subscription. Source: https://kie.ai/pricing
- Top-ups: one example is a $1,250 top-up with 10% bonus. Other tiers unverified. Source: https://kie.ai/pricing
- New users get 80 free credits. Source: https://kie.ai/recraft-remove-background

## 6. How Kie.ai resells it

- Kie.ai lists the model as `recraft/remove-background`, "by Recraft AI", available for commercial use. Source: https://kie.ai/recraft-remove-background
- Access is a single `createTask` call with an `image` URL, polled by `recordInfo` or a callback. Source: https://kie.ai/recraft-remove-background and the local doc `docs/kie/recraft_remove_background.md`.
- Price per output image on Kie.ai (about $0.005) is half of the provider's listed API price ($0.01). This gap is a finding, but the cause is unverified. It may be a different price tier or a different plan.
- The model is not found on the Kie.ai market listing page checked (https://kie.ai/market), which showed only a subset of 117 models. Source: https://kie.ai/market
- The docs.kie.ai model page returned no content on fetch. Source: https://docs.kie.ai/market/recraft/remove-background. The local file `docs/kie/recraft_remove_background.md` is the working contract.

## 7. Gaps and unverified items

- Unknown: the provider-side model version behind `recraft/remove-background`. Unverified.
- Unverified: founder names, V4 release date, and leaderboard claims.
- Unverified: whether Kie.ai's 1 credit price is the same product, tier and terms as the provider's $0.01 API price.
- Unknown: Kie.ai top-up tiers beyond the single example.
- Unverified: whether the Kie API applies the `nsfw_checker` filter.
