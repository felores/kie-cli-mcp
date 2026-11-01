---
status: draft
date: 2026-10-31
sources:
  - https://seed.bytedance.com/en/
  - https://seed.bytedance.com/en/seedream5_0_pro
  - https://seed.bytedance.com/en/seedance2_5
  - https://seed.bytedance.com/en/disclaimer
  - https://arxiv.org/abs/2508.19209
  - https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing
  - https://docs.byteplus.com/en/docs/legal/acceptable_use_policy_byteplus_genai
  - https://docs.kie.ai/market/seedance-2-5
  - https://docs.kie.ai/market/bytedance/seedance-2-5
  - https://docs.kie.ai/market/seedream/5-pro-text-to-image.md
  - https://docs.kie.ai/market/seedream/5-flash-text-to-image.md
  - https://docs.kie.ai/market/seedream/5-lite-text-to-image.md
  - https://docs.kie.ai/market/omnihuman-1-5.md
  - https://kie.ai/pricing
  - https://kie.ai/seedream-5-0-pro
  - https://kie.ai/seedream-5-0-flash
  - https://kie.ai/seedance-2-5
  - https://kie.ai/omnihuman-1-5
  - https://kie.ai/terms-of-use
---

# ByteDance (Seed) - Provider Research

Scope: who ByteDance is for media generation, the lineup this repo exposes, strengths and weaknesses, usage policy, and how Kie.ai resells it. Price figures are per unit as published; "unverified" marks claims not confirmed on an official page.

## Contents

1. Who they are
2. Product lineup for media generation
3. Access points
4. Strengths and weaknesses
5. Usage and content policy
6. Pricing: Kie.ai versus provider
7. How Kie.ai resells it
8. Gaps

## 1. Who they are

- ByteDance Seed is the research and model group behind the models. Its site describes its mission as "Advancing the frontier of intelligence, in service of humanity." Source: https://seed.bytedance.com/en/
- The site footer names "Bytedance Seed" as copyright holder. The disclaimer names Beijing Chuntian Zhiyun Technology Co., Ltd. as the rights claimant for site content. Source: https://seed.bytedance.com/en/disclaimer
- OmniHuman-1.5 is described in an arXiv preprint (submitted 26 August 2025). The abstract page fetched did not show an affiliation, so the ByteDance attribution is unverified from that page. Source: https://arxiv.org/abs/2508.19209

## 2. Product lineup for media generation

| Area | Product | Status in this repo | Source |
|---|---|---|---|
| Image | Seedream 5.0 Pro | Exposed as `bytedance_seedream_image` (`5-pro`) | https://seed.bytedance.com/en/seedream5_0_pro |
| Image | Seedream 5.0 Flash | Exposed (`5-flash`) | https://docs.kie.ai/market/seedream/5-flash-text-to-image.md |
| Image | Seedream 5.0 Lite | Not exposed by the MCP tool. Kie docs mark it released. See gaps. | https://docs.kie.ai/market/seedream/5-lite-text-to-image.md |
| Video | Seedance 2.5 | Exposed as `bytedance_seedance_video` | https://seed.bytedance.com/en/seedance2_5 |
| Video | Seedance 1.0 Lite / Pro | Local docs exist, no tool or catalog entry | https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing |
| Avatar | OmniHuman 1.5 | Exposed as `omnihuman_video` | https://docs.kie.ai/market/omnihuman-1-5.md |
| Audio | Seed Audio 1.0 | Not in repo. Listed on Seed site. | https://seed.bytedance.com/en/ |

The Seed homepage lists no avatar product. OmniHuman appears only on the paper and third-party marketplace pages in the sources above.

## 3. Access points

- Dreamina (consumer creative app): https://dreamina.capcut.com/ (named on the Seed homepage)
- Dola (general assistant): https://www.dola.com/chat/
- BytePlus Playground and ModelArk API: https://ai.byteplus.com/en/playground and https://www.byteplus.com/en/product/modelark
- Kie.ai (third-party aggregator used by this repo): https://kie.ai

## 4. Strengths and weaknesses

Provider claims are marketing text on Seed pages. No benchmark numbers were verified in this pass.

Strengths (provider-stated):
- Seedream 5.0 Pro: editing guided by "spatial annotations and sketch-based guidance", layer separation, text rendering for posters and education, and "a dozen" prompt languages. Source: https://seed.bytedance.com/en/seedream5_0_pro
- Seedance 2.5: up to 30 seconds per generation, with two extensions; reference video used for "intention, framing, and cinematic language"; editing; green-screen editing and camera control. Source: https://seed.bytedance.com/en/seedance2_5
- OmniHuman 1.5 (paper): audio plus image plus text prompt, with an LLM step that turns conditions into motion guidance. Source: https://arxiv.org/abs/2508.19209

Weaknesses (verified gaps):
- The Seed pages give no resolution, aspect ratio, or limit tables for Seedream or Seedance. The Kie docs fill those in.
- No official per-second price for Seedance 2.5 appears on the Seed pages. Pricing is on the BytePlus pricing table, which bills video by token.
- Third-party price pages gave conflicting Seedance numbers. They were excluded.
- OmniHuman 1.5 has no published BytePlus price in the pricing table fetched.

## 5. Usage and content policy

- Seed disclaimer: covers site data collection and IP only. It has no acceptable-use rules for generated media. Source: https://seed.bytedance.com/en/disclaimer
- BytePlus GenAI Acceptable Use Policy: the fetch returned no body text, so the clauses below come from search excerpts and are unverified. Source: https://docs.byteplus.com/en/docs/legal/acceptable_use_policy_byteplus_genai
  - Users must not delete, alter, or conceal AI labels on output (excerpt; section not confirmed).
  - Users must disclose that content is AI generated, and must not present it as human-made (excerpt).
  - Use of BytePlus or Seedance names and logos needs written consent (excerpt).
  - Seedance 2.0 and 2.5 reference portraits of real people are restricted (excerpt, section 6-4 per search summary).
  - Playground output is for private, non-commercial use (excerpt). This applies to the Playground, not the API. Applicability to the API is unverified.
- Kie.ai Terms of Use: prohibit unlawful, infringing, or "otherwise inappropriate" uploads; reserve removal and moderation at Kie's discretion; say nothing on ownership of generated output; credits "never expire". Source: https://kie.ai/terms-of-use
- Operators who resell Seedance APIs must not integrate them into UGC platforms, per a BytePlus search excerpt (unverified).

Practical reading: the BytePlus AUP and the Kie terms both apply when this repo calls the models. Confirm the governing agreement before commercial use.

## 6. Pricing: Kie.ai versus provider

| Model | Kie.ai (USD) | BytePlus (USD) | Note |
|---|---|---|---|
| Seedream 5 Pro, basic 1K | $0.035 (7 credits) | $0.045 up to 2.61 MP | Kie: https://kie.ai/seedream-5-0-pro |
| Seedream 5 Pro, high 2K | $0.07 (14 credits) | $0.045 up to 2.61 MP (2K mapping unverified) | |
| Seedream 5 Flash, 1K and 2K | $0.0162 (3.24 credits) | $0.018 | Kie: https://kie.ai/seedream-5-0-flash |
| Seedream 5 Lite | $0.0275 (5.5 credits, basic) | $0.035 | Kie: https://kie.ai/pricing |
| Seedance 2.5, 720p, no video input | $0.315/s (63 credits) | $0.231/s (per-video example, 5 s) | Kie: https://kie.ai/seedance-2-5 |
| Seedance 2.5, 1080p, no video input | $0.79/s (158 credits) | $0.569/s (per-video example, 5 s) | |
| OmniHuman 1.5 | $0.135/s (27 credits) | not listed | Kie: https://kie.ai/omnihuman-1-5 |

Provider Seedance prices are per million tokens: $10.70 without video input, $6.40 with video input at 480p and 720p. Per-second values above are derived from the provider's 5-second example, so they are estimates. Source: https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing

Seedance 1.0 Pro on BytePlus: $2.5 per million tokens online, $1.25 offline. Source: same page.

## 7. How Kie.ai resells it

- API base: `https://api.kie.ai/api/v1/jobs/createTask`, bearer auth, polling via `GET /api/v1/jobs/recordInfo?taskId=...`. Sources: https://docs.kie.ai/market/seedream/5-pro-text-to-image.md and https://docs.kie.ai/market/bytedance/seedance-2-5
- Prices are in credits with a USD equivalent. Kie's pricing page lists only "from" prices. Source: https://kie.ai/pricing
- Kie states its Seedream Flash 1K and 2K price is "10% below official pricing", and that top-ups give a bonus of about 10%. Source: https://kie.ai/seedream-5-0-flash
- Seedance 2.5 prices are marked beta and "may be adjusted in the future". Source: https://kie.ai/seedance-2-5
- Kie callbacks report `creditsConsumed`, which is 0 for failed tasks. Source: https://docs.kie.ai/market/seedream/5-pro-text-to-image.md

## 8. Gaps

- Seedance 1.0 Lite and Pro have local docs but no catalog entry or MCP tool.
- Seedream 5 Lite status conflicts: local docs say it is no longer selectable, Kie docs and pricing show it released.
- OmniHuman has no official BytePlus price. Its Kie price has no per-resolution split.
- The BytePlus AUP body was not retrieved. Policy points above are excerpts only.
- Seed Audio 1.0 was not researched.
