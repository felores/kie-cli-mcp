---
status: draft
date: 2026-10-31
sources:
  - https://bfl.ai/about
  - https://bfl.ai/blog/flux-2
  - https://bfl.ai/announcements/flux-1-kontext
  - https://bfl.ai/legal/usage-policy
  - https://docs.bfl.ai/release-notes
  - https://docs.bfl.ai/flux_2/flux2_overview
  - https://docs.bfl.ai/quick_start/pricing.md
  - https://docs.bfl.ai/kontext/kontext_text_to_image
  - https://kie.ai/pricing
  - https://kie.ai/market/black-forest-labs
  - https://kie.ai/flux-kontext-api
  - https://kie.ai/flux-2
  - https://docs.kie.ai/market/flux2/pro-text-to-image.md
  - https://docs.kie.ai/market/flux2/pro-image-to-image.md
  - https://docs.kie.ai/market/flux2/flex-text-to-image.md
---

# Black Forest Labs (provider research)

Slug: `black-forest-labs`. Catalog tools: `flux_kontext_image` (flux-kontext-pro) and `flux2_image` (flux-2-pro).

## Contents

- Who they are
- Product lineup for media generation
- Strengths and weaknesses
- Usage and content policy
- How Kie.ai resells it
- Gaps

## Who they are

- Black Forest Labs describes itself as "the frontier AI research lab for visual intelligence." It works from labs in Freiburg and San Francisco. Its founding team includes people behind Latent Diffusion, Stable Diffusion and FLUX.1. Source: https://bfl.ai/about
- Founding year, founders by name, and investors: unverified. The About page does not state them.

## Product lineup for media generation

| Family | Status (per official sources) | Relevance to this catalog |
|---|---|---|
| FLUX.1 Kontext [pro] | Announced May 29, 2025. Image generation and editing from text and reference images. | `flux_kontext_image`, model `flux-kontext-pro` |
| FLUX.1 Kontext [max] | Same announcement. Positioned for maximum quality, prompt adherence and typography. | `flux_kontext_image`, model `flux-kontext-max` |
| FLUX.1 Kontext [dev] | Open weights, non-commercial license. Commercial use needs a license. | Not in catalog |
| FLUX.2 [pro] | Launched Nov 25, 2025. Mar 3, 2026: about 2x faster, no price change. Snapshot endpoint `flux-2-pro`, moving endpoint `flux-2-pro-preview`. | `flux2_image`, model `flux-2-pro` |
| FLUX.2 [flex] | Launched Nov 25, 2025. Adjustable steps and guidance, aimed at typography and fine detail. | Tool code maps `model_type: flex`. See tool doc. |
| FLUX.2 [max] | Dec 16, 2025 per release timeline. Only tier with grounding search. | Not in catalog |
| FLUX.2 [klein] 4B / 9B | Launched Jan 15, 2026. 4B is Apache 2.0. 9B uses a non-commercial license. | Not in catalog |
| FLUX.2 [dev] | Open weights, local use. | Not in catalog |

Sources: https://bfl.ai/blog/flux-2 ; https://bfl.ai/announcements/flux-1-kontext ; https://docs.bfl.ai/release-notes ; https://docs.bfl.ai/flux_2/flux2_overview

Note: the Dec 16, 2025 date for FLUX.2 [max] comes from a search summary, not a fetched official page. Treat it as unverified.

## Strengths and weaknesses

Strengths (official claims, not independently tested here):

- Kontext: "the highest scores in text editing and character preservation" for pro, per BFL's own evaluation. Editing works from plain text instructions without finetuning. Source: https://bfl.ai/announcements/flux-1-kontext
- FLUX.2: up to 10 reference images in the Playground and up to 8 through the API, output up to 4 MP, and "legible fine text." Source: https://bfl.ai/blog/flux-2 and https://docs.bfl.ai/flux_2/flux2_overview
- FLUX.2 [pro] pricing is "from $0.03/MP" per BFL release notes. Source: https://docs.bfl.ai/release-notes

Weaknesses (official statements):

- Kontext: "Excessive multi-turn editing sessions can introduce visual artifacts." It sometimes ignores prompt requirements and has limited world knowledge. Source: https://bfl.ai/announcements/flux-1-kontext
- Kontext [max] is described as "experimental" in the announcement.
- FLUX.2 pricing is megapixel-based, so cost rises with resolution. Source: https://docs.bfl.ai/quick_start/pricing.md
- Kie.ai's Kontext page says "Prompts only support English." Source: https://kie.ai/flux-kontext-api

## Usage and content policy

Source: https://bfl.ai/legal/usage-policy

- Prohibited: sexual, intimate, degrading or defamatory depictions of real people without verified consent; child sexual abuse material and non-consensual intimate imagery; disinformation, including election-related content; deceptive content unless disclosed; removing C2PA credentials or digital watermarks; harassment; military, surveillance and law-enforcement uses; biometric processing; fully automated decisions with legal effect.
- EU users may not build a high-risk AI system under the EU AI Act.
- Users must review outputs themselves. Violations go to legal@blackforestlabs.ai.
- Moderation process, filter strength and penalties: unverified. The usage policy links to Terms of Use that were not reviewed.

Kie.ai's own content settings are per model. See the tool docs for `safetyTolerance` and `nsfw_checker`.

## How Kie.ai resells it

Kie.ai lists BFL models on its market page. Source: https://kie.ai/market/black-forest-labs

- Credit rate: "1 credit ≈ $0.005". Failed tasks are not charged. Source: https://kie.ai/pricing
- FLUX.2 [pro] on Kie: 5 credits (about $0.025) for 1K and 7 credits (about $0.035) for 2K. Source: https://kie.ai/flux-2
- FLUX.1 Kontext on Kie: pro is 5 credits (about $0.025) and max is 10 credits (about $0.05) per image. Source: https://kie.ai/flux-kontext-api
- Kie model IDs seen in its docs: `flux-2/pro-text-to-image`, `flux-2/pro-image-to-image`, `flux-2/flex-text-to-image`, and `flux1-kontext` with `input.model` set to `flux-kontext-pro` or `flux-kontext-max`. Sources: the Kie docs URLs above.
- Kie's FLUX.2 price is per resolution tier. BFL's price is "from $0.03/MP". Whether Kie's 1K price matches BFL's megapixel rule is unknown. The BFL 2K price is also unknown.

## Gaps

- Official BFL per-image price for Kontext pro and max: unknown. The BFL pricing calculator did not expose numbers to the fetch tool. Third-party figures ($0.04 / $0.08) were found in search and were not used.
- Official BFL price for FLUX.2 at 2K and for flex: unknown.
- Kie.ai Kontext endpoint: the Kie page says `POST /api/v1/jobs/createTask` with `model: flux1-kontext`. The repo client calls `/flux/kontext/generate`. See the Kontext tool doc.
- Kie.ai docs.kie.ai Kontext page returned 404 on fetch. Its parameters were taken from the repo's copy of the spec in `docs/kie/flux_kontext_image.md`, which is unverified against the live page today.
