---
title: kling_avatar research (Kling AI Avatar)
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/kling/ai-avatar-standard
  - https://docs.kie.ai/market/kling/ai-avatar-pro
  - https://kie.ai/kling-ai-avatar
  - https://kie.ai/pricing
  - https://kling.ai/docs/user-policy
---

# kling_avatar research (Kling AI Avatar)

Catalog entry: `kling_avatar`, model `kling-avatar`, provider slug `kling`. Provider context: `docs/research/providers/kling.md`.

## Contents

1. What it does
2. Model version and names
3. Modes and quality tiers
4. Parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Turns one portrait image and one audio clip into a talking avatar video. The prompt guides expression, movement, and camera. Speech comes from the audio. Source: [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard), [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).

## 2. Model version and names

- Kie.ai endpoints: `kling/ai-avatar-standard` and `kling/ai-avatar-pro`. Source: [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard), [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).
- Kie.ai's landing page titles the product "Kling AI Avatar 2.0". The docs do not name a version. Version: unverified. Source: [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar).
- **Mismatch in this repository.** `packages/core/src/kie-ai-client.ts` (`generateKlingAvatar`) sends `kling/ai-avatar-v1-pro` for pro and `kling/v1-avatar-standard` for standard. These names do not appear in the Kie.ai docs reviewed here. Verify against a live call before any release.

## 3. Modes and quality tiers

| Tier | Resolution | Source |
|---|---|---|
| Standard | 720p | [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard) |
| Pro | 1080p (48 fps per landing page README) | [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro), [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar) |

There is one mode: image plus audio plus prompt. The Kie.ai endpoints take no quality or resolution field. The tier is chosen by endpoint (`ai-avatar-standard` or `ai-avatar-pro`).

## 4. Parameters and limits

Kie.ai docs for both endpoints:

| Parameter | Required | Kie.ai limit | Repository (`types.ts`) | Gap |
|---|---|---|---|---|
| `image_url` | Yes | JPEG or PNG, max 10.0 MB | URL, described as JPEG, PNG, WEBP, max 10 MB | Repository allows WEBP. Docs do not. |
| `audio_url` | Yes | MPEG, WAV, X-WAV, AAC, MP4, OGG. Max 100 MB. Max 5 minutes. | URL, described as max 10 MB | Size limit mismatch (10 MB in code, 100 MB in docs). |
| `prompt` | Yes per docs ("Required, non-empty", max 5,000 characters) | Landing page FAQ says optional. Standard docs example sends an empty string. | `min(1)`, `max(1500)` | Length mismatch (1,500 vs 5,000). Required status conflicting: verify. |
| `quality` | Not in Kie.ai API | n/a | `standard` or `pro`, selects the endpoint | Repository-only mapping. |
| `callBackUrl` | No, recommended | Callback codes 200 success, 501 failure | Optional, env fallback | Consistent. |

Output: the callback returns `resultJson` with `resultUrls`. The example URL ends in `.mp4`. Container and codec: not stated. Source: [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard).

Duration follows the audio length. The only limit stated is 5 minutes of audio. Source: [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).

Image guidance on the landing page: clear facial features, good lighting, minimal occlusion, forward-facing or slightly angled pose. Source: [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar).

## 5. Pricing

Kie.ai, from [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar) and [kie.ai/pricing](https://kie.ai/pricing):

| Tier | Credits per second | Approx. USD per second |
|---|---|---|
| Standard (720p) | 8 | $0.04 |
| Pro (1080p) | 16 | $0.08 |

- Top-up bonus of 10% in the high tier: about $0.036 and $0.072 per second. Source: [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar).
- The pricing applies to generations up to 300 seconds. At the cap, computed from the stated rates: about $12 (Standard) and $24 (Pro) at list price.
- The Kie.ai endpoint docs contain no pricing text. Source: [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard), [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).
- The repository returns `pricing: "unknown"` at runtime (`kling_avatar.ts`). This can be updated to the per-second rates above with a source URL.
- Provider (Kling) API price: unknown.

## 6. Strengths

- Two clear tiers with stated resolutions. Source: [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard).
- Long audio: up to 5 minutes. Source: [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).
- Simple input: one image, one audio file, one prompt. Source: the same pages.
- Published per-second price. Source: [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar).

## 7. Weaknesses

- Prompt requirement, prompt length, audio size limit, and model names conflict between sources. See section 4 and section 2.
- No quality or resolution control inside the endpoint. The tier is set by endpoint choice only.
- No provider-side avatar page was found, so provider-side terms for avatar output were not checked beyond the general user policy. Source: [Kling user policy](https://kling.ai/docs/user-policy). That policy covers likeness only indirectly. See the provider doc.
- Kie.ai marks the model with a "Commercial use" label. Its meaning beyond the label is not explained. Source: [kie.ai/kling-ai-avatar](https://kie.ai/kling-ai-avatar).

## 8. Best use cases

- Talking-head video from a single portrait and a recorded voice track.
- Short presenter or explainer clips where lip sync matters more than full scene control.
- Longer narration up to 5 minutes of audio, using the Pro tier for 1080p output.

Consent for the portrait subject is a required check before use. Source: [Kling user policy](https://kling.ai/docs/user-policy) (likeness and third-party rights).

## 9. Alternatives in this catalog

| Tool | Model | Note |
|---|---|---|
| `omnihuman_video` | `omnihuman-1.5` | Talking avatar and lip sync. Source: `packages/core/src/model-catalog.ts`. Comparison unverified. |
| `gemini_omni` | `gemini-omni` | Character and voice. Source: `packages/core/src/model-catalog.ts`. Comparison unverified. |

## 10. Open questions

1. Are the repository model names (`kling/ai-avatar-v1-pro`, `kling/v1-avatar-standard`) valid on Kie.ai? The docs name `kling/ai-avatar-pro` and `kling/ai-avatar-standard`. Test with a live call.
2. Is the prompt required? Docs say required. Landing page FAQ says optional. Verify.
3. Should the repository prompt limit change from 1,500 to 5,000 characters? Source: [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).
4. Should `image_url` accept WEBP? Docs say JPEG and PNG only. Source: [docs.kie.ai Standard](https://docs.kie.ai/market/kling/ai-avatar-standard).
5. Should `audio_url` size be 100 MB as in the docs? Source: [docs.kie.ai Pro](https://docs.kie.ai/market/kling/ai-avatar-pro).
6. Is this avatar "2.0" (landing page title) or an earlier version? Unverified.
7. Provider API price for avatar: unknown.
