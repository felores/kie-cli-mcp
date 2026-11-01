---
status: draft
date: 2026-10-31
sources:
  - https://docs.x.ai/developers/models
  - https://docs.x.ai/docs/models
  - https://docs.x.ai/developers/model-capabilities/imagine
  - https://docs.x.ai/docs/guides/image-generation
  - https://docs.x.ai/docs/guides/video-generation
  - https://docs.x.ai/developers/migration/imagine-image-quality-nov-2
  - https://x.ai/news/grok-imagine-image-2
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://kie.ai/grok-imagine-image-2
  - https://kie.ai/blog/grok-imagine-image-2-0-release
  - https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image
  - https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image
  - https://docs.kie.ai/market/grok-imagine/text-to-video
  - https://docs.kie.ai/market/grok-imagine/image-to-video
  - https://docs.kie.ai/market/grok-imagine/upscale
---

# xAI (provider): Grok Imagine

Scope: the xAI media models relevant to this catalog (Grok Imagine), and how Kie.ai resells them.
Tool research: `docs/research/tools/grok_imagine.md`.

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths
4. Weaknesses and open points
5. Usage and content policy
6. How Kie.ai resells it
7. Open questions

## 1. Who they are

- xAI is the provider of the Grok models. Its official API documentation is at docs.x.ai and lists the Grok Imagine models ([docs.x.ai models](https://docs.x.ai/developers/models)).
- Corporate background (ownership, funding, headcount) is not covered by the sources used here. Unverified.

## 2. Product lineup for media generation

Official model IDs and prices from the xAI models page ([source](https://docs.x.ai/developers/models)). The same six IDs appear on [docs.x.ai/docs/models](https://docs.x.ai/docs/models).

| Model ID | Type | Official price |
|---|---|---|
| `grok-imagine-image-2.0` | Image generation and editing | $0.04 / image |
| `grok-imagine-image` | Image | $0.02 / image |
| `grok-imagine-image-quality` | Image | $0.05 / image (retires 2026-11-02, see below) |
| `grok-imagine-video-1.5` | Video | $0.080 / sec |
| `grok-imagine-video-1.5-lite` | Video | $0.020 / sec |
| `grok-imagine-video` | Video (editing and older generation) | $0.050 / sec |

Notes from the official Imagine overview ([source](https://docs.x.ai/developers/model-capabilities/imagine)):

- Image generation and editing use `grok-imagine-image-2.0`.
- Video generation uses `grok-imagine-video-1.5`. Video editing uses `grok-imagine-video`.
- Reference-to-video on `grok-imagine-video-1.5` accepts up to 14 reference images and 3 voice references.
- Image output: up to 10 images per request. Editing: up to 5 source images.
- Video duration: up to 15 seconds.

Imagine Image 2.0 launched 2026-08-07 as the Quality Mode in the Grok apps, with API access following ([source](https://x.ai/news/grok-imagine-image-2)). Its features are a region-selective "magic wand" edit, segmentation, background removal, multi-reference editing (up to 5 images), and smart resize.

## 3. Strengths

- Image 2.0 has a broad editing feature set: region edits, background removal, multi-reference editing up to 5 images ([source](https://x.ai/news/grok-imagine-image-2)).
- Multiple outputs per request (up to 10) on the official API ([source](https://docs.x.ai/developers/model-capabilities/imagine)).
- Video with synchronized audio on Kie's video endpoints ([source](https://docs.kie.ai/market/grok-imagine/text-to-video)).
- Enterprise statements on the official overview: SOC 2 Type II, HIPAA eligibility with BAA, GDPR compliance, data residency options, SSO/RBAC ([source](https://docs.x.ai/developers/model-capabilities/imagine)). Unverified for any specific account; treat as vendor claims.
- Ranking claim: "second in the world in both text-to-image generation and image editing," with the stated basis "Overall Elo" from Arena leaderboards as of 2026-08-07 ([source](https://x.ai/news/grok-imagine-image-2)). This is the vendor's own claim; the scores are not shown on the page.

## 4. Weaknesses and open points

- Pricing conflicts across official and reseller pages. xAI lists $0.04 per image for Image 2.0 ([source](https://docs.x.ai/developers/models)). Kie's Image 2.0 page cites an "official $0.06 rate" ([source](https://kie.ai/grok-imagine-image-2)). Kie's pricing page lists "from $0.02 per image" for `grok-imagine-image-2-0` ([source](https://kie.ai/pricing)). Verify before budgeting.
- Official pages do not enumerate supported aspect ratios or resolutions for Imagine generation. The docs say they are "configurable" ([source](https://docs.x.ai/docs/guides/image-generation), [source](https://docs.x.ai/docs/guides/video-generation)).
- Official pages do not list per-resolution video prices. Third-party pages list resolution tiers; those are unverified.
- Launch-page claims (ranking, feature list) are vendor statements, not independent benchmarks.
- The xAI Imagine release-notes and news pages were partly unavailable during this research (HTTP 403 on x.ai/news). Unverified: any news after that page.

## 5. Usage and content policy

- Official policy text, verbatim in both guides: "Generated media is subject to content policy review and is not used for training" ([source](https://docs.x.ai/docs/guides/image-generation), [source](https://docs.x.ai/docs/guides/video-generation)).
- The official pages do not list specific content rules. The xAI launch page links to Safety and Acceptable Use Policy pages in its footer; those were not fetched. Unverified.
- Kie's video pages describe a `mode` setting with `fun`, `normal`, and `spicy`. Spicy is unavailable for external reference images. An `nsfw_checker` field is listed, described as adding no extra filtering when false ([source](https://docs.kie.ai/market/grok-imagine/text-to-video)).
- Retirement notice: `grok-imagine-image-quality` retires on 2026-11-02. After that date, requests to that slug are served by `grok-imagine-image-2.0` at `quality: "low"`, and the migration page says to switch the model field before that date ([source](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2)). Note the migration page mentions a `quality` parameter that Kie's catalog schema does not expose (see the tool document).

## 6. How Kie.ai resells it

- Kie exposes Grok Imagine through a single `POST /api/v1/jobs/createTask` endpoint with a model field, for example `grok-imagine-image-2-0/text-to-image` and `grok-imagine/text-to-video` ([source](https://docs.kie.ai/market/grok-imagine/text-to-video)).
- Kie's model names differ from xAI's model IDs. Kie's image-edit model is `grok-imagine-image-2-0/image-edit`. Kie's video names are `grok-imagine/text-to-video`, `grok-imagine/image-to-video`, and `grok-imagine/upscale` ([source](https://docs.kie.ai/market/grok-imagine/upscale)).
- Kie's credit rule: 1 credit is about $0.005. Per the pricing page, Kie lists `grok-imagine-image-2-0` at 4 credits per image (from $0.02), `grok-imagine` video at about 2.4 credits per second (from $0.012 per second), and `grok-imagine-video-1-5-preview` at the same rate ([source](https://kie.ai/pricing)). The per-option video prices are not shown on that page.
- Kie's market page lists Grok Imagine Video 1.5 and Grok chat models. No prices are shown there ([source](https://kie.ai/market)).
- Kie's Get Task Details endpoint and callback return `creditsConsumed`. Failed tasks show 0 credits ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image)).

## 7. Open questions

1. Which xAI price applies to Kie's `grok-imagine-image-2-0` tasks: xAI's $0.04, Kie's stated $0.02 (4 credits), or another? Kie's docs do not state a per-image price. Unverified.
2. Does Kie's `grok-imagine-image-2-0` route ever use `quality`? Kie's docs do not list it, so the xAI retirement change on 2026-11-02 may or may not affect Kie. Unverified.
3. Which xAI video model version does Kie's `grok-imagine/text-to-video` and `grok-imagine/image-to-video` run? Kie's market lists "Grok Imagine Video 1.5." Kie's API pages do not name the xAI version. Unverified.
4. Kie per-resolution and per-duration video prices: not found on any official page. Unknown.
