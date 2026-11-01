---
title: Kuaishou Kling AI provider research
status: draft
date: 2026-10-31
sources:
  - https://www.bernama.com/en/news.php/?id=2520897
  - https://kling.ai/
  - https://kling.ai/dev/pricing
  - https://kling.ai/docs/user-policy
  - https://www.taiwannews.com.tw/news/6370880
  - https://docs.kie.ai/market/kling/kling-3-0
  - https://docs.kie.ai/market/kling/ai-avatar-standard
  - https://docs.kie.ai/market/kling/ai-avatar-pro
  - https://kie.ai/kling-3-0
  - https://kie.ai/kling-ai-avatar
  - https://kie.ai/kling-4-0
  - https://kie.ai/pricing
  - https://morphic.com/resources/models/kling-3-0-turbo
---

# Kuaishou Kling AI provider research

Scope: who Kling is, its media generation lineup, its terms, and how Kie.ai resells it. Tool-level detail lives in `docs/research/tools/kling_video.md` and `docs/research/tools/kling_avatar.md`.

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths
4. Weaknesses and risks
5. Usage and content policy
6. How Kie.ai resells Kling
7. Open questions

## 1. Who they are

- Kling AI is the video and image generation product of Kuaishou. Source: [Bernama, Kling 3.0 launch](https://www.bernama.com/en/news.php/?id=2520897), which reports Kuaishou's official announcement on February 6, 2026.
- The Kling homepage shows the copyright line "2024-2026 kling.ai" and does not name a company, parent, or founding year. Source: [kling.ai](https://kling.ai/).
- Kuaishou's company profile (headquarters, listing, founding year): unverified. The [kuaishou.com](https://www.kuaishou.com/en) fetch returned no readable company text in this research.

## 2. Product lineup for media generation

| Product | Status | Source |
|---|---|---|
| Video 3.0, Video 3.0 Omni, Image 3.0, Image 3.0 Omni (launch series) | Launched February 6, 2026 | [Bernama](https://www.bernama.com/en/news.php/?id=2520897) |
| Kling 4.0 (reference-to-video, keyframe-to-video) | Listed as "New" on the Kling homepage and on Kie.ai | [kling.ai](https://kling.ai/), [kie.ai/kling-4-0](https://kie.ai/kling-4-0) |
| Kling Image 3.0 | Listed on the Kling homepage | [kling.ai](https://kling.ai/) |
| Kling 3.0 Turbo | Third-party claim of a June 2026 launch. Unverified by an official source. | [Morphic](https://morphic.com/resources/models/kling-3-0-turbo) |
| Kling AI Avatar (Standard and Pro) | Documented on Kie.ai. The provider's own avatar page: not found. | [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard), [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro) |
| Kling Omni 3 (O3) | Kie.ai says it is still exploring support. | [kie.ai/kling-3-0](https://kie.ai/kling-3-0) |

Kling 3.0 capabilities confirmed through Kie.ai documentation: flexible 3-15 second duration, native audio, multi-shot, character elements, and std, pro, and 4K modes. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0).

Bernama's summary of the launch says the 3.0 series adds consistency, photorealistic output, up to 15 second videos, and native multilingual audio. Source: [Bernama](https://www.bernama.com/en/news.php/?id=2520897).

## 3. Strengths

- Native audio for 3.0: speech, sound effects, and ambience, switched on with a `sound` flag. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0).
- Multi-shot generation with up to 5 shots, each 1-12 seconds. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0).
- Character and object elements for identity consistency across shots. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0), [Bernama](https://www.bernama.com/en/news.php/?id=2520897).
- Commercial scale: Kling AI revenue above RMB 650 million in Q1 2026, up more than 300% year on year, per the company release as reproduced by Taiwan News. Secondary source. The primary Kuaishou filing was not checked. Source: [Taiwan News](https://www.taiwannews.com.tw/news/6370880).

## 4. Weaknesses and risks

- 3.0 clips are capped at 15 seconds per task. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0).
- Public documentation conflicts. Prompt length, pixel sizes, and avatar model names differ between Kie.ai pages and this repository. See the tool docs.
- The provider's own price list is not readable. The [kling.ai/dev/pricing](https://kling.ai/dev/pricing) page fetched without any price lines. Provider-side prices: unknown.
- Output terms restrict commercial use. Section 4.6 says that without written permission you may not use outputs "for any commercial purposes." Source: [Kling user policy](https://kling.ai/docs/user-policy).
- Outputs must carry Kling branding or otherwise indicate Kling generated them (section 4.5). Source: [Kling user policy](https://kling.ai/docs/user-policy).
- Kling receives a broad license to inputs and outputs (section 4.7.1), and may train its own models on user content (section 4.7.3(f)). Source: [Kling user policy](https://kling.ai/docs/user-policy). This matters for client material.

## 5. Usage and content policy

Source for all items in this section: [Kling user policy](https://kling.ai/docs/user-policy), effective 2026/04/21.

- Minimum age: users under 13, or the higher age set by local law, may not use the service (section 2.1(a)). Minors must register through a parent or guardian (section 2.1(b)). Some countries set higher ages. Brazil's supplement covers ages 13 to 16 (section 17(a)).
- Prohibited content includes material that is defamatory, obscene, pornographic, hateful, or inflammatory (section 3.1(q)), and content that gives instructions for criminal offences (section 3.1(r)).
- Prohibited use: using the service or its outputs to create, test, or train AI models (section 3.1(w)). Impersonation is prohibited (section 3.1(i)).
- Real people: the terms have no specific face or likeness rule for image generation. Third-party personality and portrait rights are referenced (sections 4.3 and 4.6). Treat likeness use as a legal review item.
- Kling may remove content that breaks the rules or draws complaints (section 3.5).
- Content may be made available to other users for related use (section 4.8).

## 6. How Kie.ai resells Kling

- Single task endpoint for all Kie.ai models: `POST https://api.kie.ai/api/v1/jobs/createTask`, with Bearer auth and an optional `callBackUrl`. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0), [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard).
- Model names on Kie.ai: `kling-3.0/video`, `kling/ai-avatar-standard`, `kling/ai-avatar-pro`. Source: the same Kie.ai pages.
- Billing is in credits. Kie.ai states a top-up bonus of about 10% that lowers effective price. Source: [kie.ai/kling-3-0](https://kie.ai/kling-3-0), [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar).
- Kie.ai lists Kling 4.0 with its own price lines and a "commercial use" label. Kling 3.0 pages show no such label. Source: [kie.ai/kling-4-0](https://kie.ai/kling-4-0), [kie.ai/pricing](https://kie.ai/pricing).
- Kie.ai's own terms for generated outputs: unverified. Not fetched in this research.
- Per-model prices and parameters: see the tool docs.

## 7. Open questions

1. Is Kling 3.0 being replaced by Kling 4.0 on Kie.ai? Kie.ai does not say so. Source: [kie.ai/kling-4-0](https://kie.ai/kling-4-0).
2. Are Kie.ai's Kling 3.0 and avatar prices the same as the provider's API prices? Provider prices: unknown.
3. Does the commercial-use permission requirement (section 4.6) apply to outputs generated through Kie.ai? Legal review needed. Unverified.
4. Kuaishou corporate facts and the primary revenue figure: unverified.
5. Does Kie.ai's terms page add or remove any of the provider's license terms? Unverified.
