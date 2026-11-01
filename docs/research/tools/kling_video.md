---
title: kling_video research (Kling 3.0)
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/kling/kling-3-0
  - https://kie.ai/kling-3-0
  - https://kie.ai/pricing
  - https://kie.ai/kling-4-0
  - https://kling.ai/dev/pricing
  - https://www.bernama.com/en/news.php/?id=2520897
  - https://kling.ai/docs/user-policy
  - https://morphic.com/resources/models/kling-3-0-turbo
---

# kling_video research (Kling 3.0)

Catalog entry: `kling_video`, model `kling-3.0`, provider slug `kling`. Provider context: `docs/research/providers/kling.md`.

## Contents

1. What it does
2. Model version
3. Modes
4. Parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Generates a video from a text prompt, from one or two images, or as a multi-shot sequence. Native audio is optional. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0).

## 2. Model version

- Kie.ai model name: `kling-3.0/video`. The page says it is the only allowed value. Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0).
- Launch: Kling 3.0 series announced February 6, 2026. Source: [Bernama](https://www.bernama.com/en/news.php/?id=2520897).
- Kie.ai lists Kling 4.0 and Kling 3.0 Turbo as separate models. Kie.ai does not say whether 4.0 replaces 3.0. Source: [kie.ai/kling-4-0](https://kie.ai/kling-4-0), [kie.ai/kling-3-0](https://kie.ai/kling-3-0).

## 3. Modes

| Mode | Input | Source |
|---|---|---|
| Text-to-video | `prompt`, no images, `multi_shots: false` | [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0) (term "text-to-video" is inferred, not used by the page) |
| Image-to-video | `prompt` plus 1 image (first frame) or 2 images (first and last frame) | [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0) |
| Multi-shot | `multi_shots: true`, `multi_prompt` up to 5 shots, first-frame image only | [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0) |
| Audio | `sound: true` for speech, sound effects, ambience | [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0) |
| Elements | `kling_elements`, up to 3 per task, referenced as `@name` in prompts | [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0) |

## 4. Parameters and limits

Kie.ai documentation is the source for the table. The repository columns come from `packages/core/src/types.ts` (`KlingVideoSchema`) and `packages/core/src/kie-ai-client.ts` (`generateKlingVideo`).

| Parameter | Kie.ai docs | Repository | Gap |
|---|---|---|---|
| `prompt` | Up to 2,500 characters. Required when `multi_shots` is false. | Max 5,000 characters, min 1 | Length conflicts. Kie.ai's `docs/kie/kling-3.0.md` says 5,000. |
| `image_urls` | 1 or 2 items. Multi-shot: first frame only. | Max 2 | Multi-shot image restriction not enforced. |
| `duration` | String `"3"` to `"15"`. Multi-shot: sum of shot durations. | `"3"` to `"15"`, default `"5"` | Multi-shot sum not enforced. |
| `aspect_ratio` | `16:9`, `9:16`, `1:1`. No default stated. Ignored when images given (follows first frame). | Enum, default `16:9` | Default is a repository choice, not a Kie.ai default. |
| `mode` | `std`, `pro`, `4K` | `std`, `pro` only | 4K not exposed. |
| `sound` | Boolean, required per docs. Affects price. | Default `false` | Code comment says "with audio is 2x credits". Kie.ai shows 14 to 20 credits (std) and 18 to 27 (pro). |
| `multi_shots` / `multi_prompt` | Up to 5 shots. Each `prompt` max 500 characters. Each shot `duration` integer 1-12. | Shot duration 1-12. No shot count or prompt length limit. | Missing limits. |
| `kling_elements` | Max 3. Fields: `name`, `description`, `element_input_urls` (2-4 images or 1 video), `element_input_audio_urls`, `start_time`, `end_time`. | Fields `name`, `description`, `element_input_urls`, `element_input_video_urls`. No count or audio fields. | Schema does not match docs. |
| `callBackUrl` | Optional, recommended for production. Callback codes: 200 success, 501 failure. | Optional, env fallback `KIE_AI_CALLBACK_URL` | Consistent. |

Output resolutions (Kie.ai):

| Aspect | std | pro | 4K |
|---|---|---|---|
| 16:9 | 1280x720 | 1920x1080 | 3840x2160 |
| 9:16 | 720x1280 | 1080x1920 | 2160x3840 |
| 1:1 | 720x720 | 1440x1440 or 1080x1080 (page conflicts) | 2160x2160 |

Source: [docs.kie.ai Kling 3.0](https://docs.kie.ai/market/kling/kling-3-0). The pro 1:1 value conflicts within the same page.

## 5. Pricing

Kie.ai, per second of output, from [kie.ai/kling-3-0](https://kie.ai/kling-3-0):

| Mode | No audio | With audio |
|---|---|---|
| std | 14 credits (about $0.07) | 20 credits (about $0.10) |
| pro | 18 credits (about $0.09) | 27 credits (about $0.135) |
| 4K | 67 credits (about $0.335), same with audio | 67 credits (about $0.335) |

- Multi-shot billing is the sum of shot durations. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
- Kie.ai's pricing page shows "from $0.07 per second (14 credits), 6 price options" for Kling 3.0. Source: [kie.ai/pricing](https://kie.ai/pricing).
- Kie.ai says top-up bonuses make effective pricing about 10% lower. Source: [kie.ai/kling-3-0](https://kie.ai/kling-3-0).
- Kie.ai's claim that 4K is about 80% of the official provider price: unverified.
- Provider (Kling) API price: unknown. The [kling.ai/dev/pricing](https://kling.ai/dev/pricing) page returned no price lines.

Worked example, from the rates above: a 10 second std clip with audio costs 200 credits (20 credits per second times 10), about $1.00. Computed here from the stated rates.

## 6. Strengths

- Flexible duration from 3 to 15 seconds in one endpoint. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
- Native audio option. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
- Multi-shot in one request, with per-shot durations. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
- Element references for identity consistency. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
- Price per second is published on Kie.ai and is lower than the 4K tier at lower modes. Source: [kie.ai/kling-3-0](https://kie.ai/kling-3-0).

## 7. Weaknesses

- Max 15 seconds per task. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
- Repository schema does not match Kie.ai on prompt length, elements, 4K mode, and multi-shot limits. See section 4.
- Commercial output needs written permission under the provider terms, and outputs must be branded. Source: [Kling user policy](https://kling.ai/docs/user-policy).
- Provider may use uploaded content to train its own models (section 4.7.3(f) of the same policy). Source: [Kling user policy](https://kling.ai/docs/user-policy).
- Kie.ai lists Kling Omni 3 as not yet supported. Source: [kie.ai/kling-3-0](https://kie.ai/kling-3-0).

## 8. Best use cases

- Short cinematic clips (3 to 15 seconds) with optional native audio.
- Storyboard-style multi-shot sequences where per-shot timing matters.
- Image-to-video with a fixed start frame, or start and end frames.
- Recurring characters across shots, using elements.

## 9. Alternatives in this catalog

| Tool | Model | Why consider it |
|---|---|---|
| `wan_video` | `wan/3-0-video` | Text, image, reference, file, link, and audio inputs. Source: `packages/core/src/model-catalog.ts`. |
| `hailuo_video` | `minimax-h3` | Text, image, and reference-to-video. Source: `packages/core/src/model-catalog.ts`. |
| `gemini_omni` | `gemini-omni` | Text-to-video, character, and voice. Source: `packages/core/src/model-catalog.ts`. |

Parity, price, and quality comparisons against these tools: unverified. Not researched here.

## 10. Open questions

1. Prompt limit: 2,500 characters (Kie.ai page) or 5,000 (repository and `docs/kie/kling-3.0.md`)? Verify against a live call. Source of conflict: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
2. Is "with audio is 2x credits" in `types.ts` correct? Kie.ai numbers show 1.43x (std) and 1.5x (pro). Source: [kie.ai/kling-3-0](https://kie.ai/kling-3-0).
3. Should the repository expose `4K` mode? Kie.ai documents it. Source: [docs.kie.ai](https://docs.kie.ai/market/kling/kling-3-0).
4. Does Kling 4.0 replace 3.0 on Kie.ai? Unverified. Source: [kie.ai/kling-4-0](https://kie.ai/kling-4-0).
5. Provider API prices for 3.0: unknown.
6. Kling 3.0 Turbo (June 2026 launch): unverified by an official source. Source: [Morphic](https://morphic.com/resources/models/kling-3-0-turbo).
