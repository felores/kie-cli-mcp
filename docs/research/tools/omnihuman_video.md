---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/omnihuman-1-5.md
  - https://kie.ai/omnihuman-1-5
  - https://arxiv.org/abs/2508.19209
  - https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing
---

# omnihuman_video - Research

## Contents

1. What it does
2. Model version
3. Modes
4. Key parameters and limits
5. Public pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Animates a portrait, pet, or character from one image and one audio track, producing an MP4 with audio. Optional masks pick which subject speaks. Sources: `packages/core/src/tools/omnihuman_video.ts`, https://docs.kie.ai/market/omnihuman-1-5.md

## 2. Model version

- Kie model ID: `omnihuman-1-5` (hyphen). The catalog and local doc use `omnihuman-1.5` (dot). Source: https://docs.kie.ai/market/omnihuman-1-5.md
- Provider research paper: "OmniHuman-1.5: Instilling an Active Mind in Avatars via Cognitive Simulation", arXiv 2508.19209, submitted 26 August 2025. Source: https://arxiv.org/abs/2508.19209
- The paper's ByteDance affiliation was not shown on the abstract page. Unverified.

## 3. Modes

Single mode: image plus audio to video. Masks are optional and select the speaking subject when several subjects appear. No text-to-video mode.

Source: https://docs.kie.ai/market/omnihuman-1-5.md

## 4. Key parameters and limits

| Parameter | Kie docs (live) | Local schema or tool |
|---|---|---|
| `image_url` | required; JPEG, PNG, or WebP; max 10 MB; any aspect ratio | required URL |
| `audio_url` | required; MPEG, WAV, AAC, OGG, or MP4 audio; max 10 MB; under 60 s, 15 s or less recommended | required URL |
| `mask_url` | up to 5 images; JPEG, PNG, or WebP; max 10 MB each | array, max 5 |
| `prompt` | up to 300 characters; Chinese, English, Japanese, Korean, Spanish, Indonesian | max 1000 |
| `output_resolution` | `720` or `1080`; default `1080`; keeps the input aspect ratio | enum, default `1080` |
| `pe_fast_mode` | default `false`; faster at some quality cost | optional boolean |
| `seed` | default `-1` (random) | integer |
| `callBackUrl` | optional; recommended over polling | optional URL |

Output is an MP4 whose length matches the input audio. Source: https://docs.kie.ai/market/omnihuman-1-5.md

Subject detection and human identification endpoints are free on Kie. Source: https://kie.ai/omnihuman-1-5

## 5. Public pricing

| Item | Kie.ai | Provider (BytePlus) |
|---|---|---|
| OmniHuman 1.5 | 27 credits per second, about $0.135 per second | not listed |
| Per resolution (720 or 1080) | not stated | not listed |
| High-tier top-up | about 10% bonus, effective about $0.122 per second | not listed |

Sources: https://kie.ai/omnihuman-1-5 and https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing (the BytePlus table lists Seedream and Seedance only; OmniHuman was marked "Not listed").

Third-party marketplaces were found with other prices. They are not official and are excluded.

## 6. Strengths

- Only one tool in this catalog for audio-driven talking video from a single portrait with lip sync.
- Mask inputs (up to 5) support multi-subject scenes. Provider paper says it extends to multi-person and non-human subjects.
- The paper describes an LLM step that adds emotional and contextual motion guidance, beyond audio rhythm.
- Subject detection is free on Kie, so masks can be prepared before paid generation.
- `seed` allows repeatable output.

## 7. Weaknesses

- No per-resolution price on Kie, so 720 versus 1080 cost is unknown.
- No provider price on BytePlus.
- Audio is capped at 60 seconds and quality drops with long audio (Kie recommends 15 seconds or less).
- The local prompt cap (1000) is above the Kie limit (300). Prompts over 300 characters may fail on Kie.
- Provider claims about multi-character conversation conflict across sources. Not verified against an official BytePlus doc.

## 8. Best use cases

- Short narration or greeting clips from one portrait, 15 seconds or less.
- Pet or character animation driven by a voice track.
- Multi-speaker scenes that use masks to pick the speaker.

## 9. Alternatives in this catalog

- The Kling avatar entry (`kling-avatar`, lip sync and talking avatar) in `packages/core/src/model-catalog.ts`.
- `bytedance_seedance_video` for scenes that need motion without a fixed audio track.

Cost and quality comparisons are not researched here.

## 10. Open questions

- Price difference between 720 and 1080 on Kie.
- Whether `pe_fast_mode` changes the Kie price.
- Official BytePlus OmniHuman 1.5 price and docs.
- Correct model string for the catalog: `omnihuman-1.5` or `omnihuman-1-5`. The Kie endpoint uses the hyphen form.
- Authorship and affiliation of the arXiv paper, as ByteDance-owned or not.
