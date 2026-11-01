---
status: draft
date: 2026-10-31
sources:
  - https://ai.google.dev/gemini-api/docs/pricing
  - https://ai.google.dev/gemini-api/docs/video
  - https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash
  - https://policies.google.com/terms/generative-ai/use-policy
  - https://deepmind.google/models/synthid/
  - https://docs.kie.ai/market/google/nanobanana2.md
  - https://docs.kie.ai/market/google/nano-banana-2-lite.md
  - https://docs.kie.ai/veo3-api/generate-veo-3-video.md
  - https://docs.kie.ai/market/gemini-omni-video.md
  - https://docs.kie.ai/market/google/gemini-omni-flash-1-1.md
  - https://docs.kie.ai/llms.txt
  - https://kie.ai/pricing
  - https://kie.ai/market
---

# Google (media generation)

Scope: Google models that the Kie.ai catalog in this repo uses for image and video generation. Text, audio, and music models are out of scope.

## Table of contents

1. Who they are
2. Product lineup for media generation
3. Strengths
4. Weaknesses
5. Usage and content policy
6. Watermarking
7. How Kie.ai resells Google models
8. Discrepancies with this repo
9. Open questions

## 1. Who they are

Google develops the Gemini model family, the Nano Banana image models (Gemini image models), and the Veo and Gemini Omni video models. Google publishes the developer-facing API through the Gemini API at `ai.google.dev` ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).

## 2. Product lineup for media generation

Image (Nano Banana family, per the [Google pricing page](https://ai.google.dev/gemini-api/docs/pricing)):

| Model ID | Name on Google page | Status on page |
|---|---|---|
| `gemini-3.1-flash-image` | Nano Banana 2 | Listed, standard paid tier |
| `gemini-3.1-flash-lite-image` | Nano Banana 2 Lite | Listed, standard paid tier |
| `gemini-3-pro-image` | Nano Banana Pro | Listed, standard paid tier |
| `gemini-nano-banana-2.1` | Nano Banana 2.1 | Listed, standard paid tier |
| `gemini-2.5-flash-image` | Nano Banana | Deprecated, shutdown March 15, 2027 |

Video:

| Model ID | Status on Google page | Source |
|---|---|---|
| `gemini-omni-1.1-flash` | Stable, paid tier only. Free tier: not available. | [Gemini Omni Flash](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash) |
| `gemini-omni-flash-preview` | Shut down | [Gemini Omni Flash](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash) |
| `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview` | Preview models shut down October 22, 2026. Google directs users to Gemini Omni Flash or to GA models on the Gemini Enterprise Agent Platform. | [Video generation](https://ai.google.dev/gemini-api/docs/video) (last updated 2026-10-22 UTC) |

Gemini Omni Flash, per Google's model page:

- Inputs: text, image, and video (video up to 10 s, for editing and extension).
- Output: video, 3 s to 10 s, at 360p, 720p, 1080p, or 4K, 24 FPS.
- Context window: 1,048,576 tokens.
- Aspect ratios and audio: not stated on the page.

## 3. Strengths

- Image pricing is published per resolution (0.5K to 4K) for each Nano Banana model, with the token price alongside ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- Gemini Omni Flash is stable and listed as generally available on the paid tier ([model page](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash)).
- Google states that Gemini Omni Flash is the default for video generation and that Veo 3.1 is suggested only for scene extension, last-frame control, or legacy pipelines (per a secondary search summary; not verified on Google's page, see Open questions).

## 4. Weaknesses

- The Veo 3.1 preview endpoints named in the repo's catalog are shut down on Google's side as of October 22, 2026 ([video](https://ai.google.dev/gemini-api/docs/video)).
- Google's pricing page has no Veo price. It only links to the Veo models page ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- Gemini Omni Flash does not publish aspect ratios or audio behavior on its model page ([model page](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash)).
- Image models have a deprecation path: Nano Banana (2.5 Flash Image) shuts down March 15, 2027 ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).

## 5. Usage and content policy

Source: [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy).

- Prohibited: dangerous or unlawful acts, including exploitation of children, violent extremism, self-harm encouragement, and privacy or IP infringement.
- Prohibited: security abuse (spam, phishing, malware, getting around safety filters).
- Prohibited: hateful, violent, or harassing content.
- Prohibited: deception, including scams, impersonation, and misleading election or health claims.
- Prohibited: impersonating a living or deceased person to mislead without clear disclosure. Non-consensual intimate imagery is also banned.
- Prohibited: any sexual abuse material involving minors, and sexually explicit material.
- Political content: no blanket ban. The concern is misleading claims about government or democratic processes.
- Exceptions may apply for educational, documentary, scientific, or artistic work.

## 6. Watermarking

Google's [SynthID](https://deepmind.google/models/synthid/) adds an invisible watermark to AI-generated images and video at creation. A public verification portal (SynthID Detector) is open to everyone and checks images, video, and audio for SynthID watermarks. The page says the detector launched "In 2025."

## 7. How Kie.ai resells Google models

Kie.ai bills in credits. The Kie pricing page states that 1 credit is about $0.005 ([kie.ai/pricing](https://kie.ai/pricing)).

Kie "from" prices (lowest option per model, not the full table) ([kie.ai/pricing](https://kie.ai/pricing)):

| Kie model | From price |
|---|---|
| nano-banana-2 | $0.04 per image (8 credits) |
| nano-banana-2-lite | $0.02 per image (4 credits) |
| Veo 3.1 (veo3 family) | $0.025 per video (5 credits). Per-variant prices not visible. |
| gemini-omni-video | $0.315 per video (63 credits) |
| google/gemini-omni-flash-1-1 | $0.315 per video (63 credits) |

The Kie listing does not say which duration or resolution the "from" price covers. Kie's Veo docs say that 1080p and 4k cost the 720p price plus an upgrade price, and point to kie.ai/pricing for amounts ([Veo docs](https://docs.kie.ai/veo3-api/generate-veo-3-video.md)). Those amounts were not visible in the fetched content.

Kie's Gemini Omni docs say the video model is `gemini-omni-video` and that a separate `google/gemini-omni-flash-1-1` model exists ([video docs](https://docs.kie.ai/market/gemini-omni-video.md), [flash docs](https://docs.kie.ai/market/google/gemini-omni-flash-1-1.md)).

Kie's public docs index is at [llms.txt](https://docs.kie.ai/llms.txt).

## 8. Discrepancies with this repo

- The repo's `docs/kie/google_nano-banana-2.md` lists NB2 at 1K = 8, 2K = 12, 4K = 18 credits. Kie's Nano Banana 2 docs show a callback example with `creditsConsumed: 8` for a 2K task. Unresolved.
- Kie's Veo docs use `POST /api/v1/jobs/createTask` with `model: "veo-3-1"` and `input.model` set to `veo3`, `veo3_fast`, or `veo3_lite`. The repo's Veo tool posts to `/veo/generate`. Unresolved.
- Google's Veo 3.1 preview endpoints are shut down. Whether Kie's Veo route is affected is unverified.

## 9. Open questions

- Does Kie's Veo route still work after Google's October 22, 2026 shutdown of Veo 3.1 preview models? Unverified.
- Per-second Google price for Gemini Omni Flash at 1080p and 4k. Google's page gives about $0.10 per second at 720p only ([pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- Official Google page for Gemini Omni's aspect ratios and audio support. Not found.
- Whether Google's own Veo replacement guidance (Omni Flash for default, Veo 3.1 for extension) is on an official Google page. Only a secondary search summary was seen; unverified.
