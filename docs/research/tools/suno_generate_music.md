---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/suno-api/generate-music.md
  - https://kie.ai/suno-api
  - https://kie.ai/market
  - https://kie.ai/pricing
  - https://suno.com/pricing
  - https://suno.com/terms
  - https://suno.com/community-guidelines
---

# suno_generate_music (research)

Provider detail: `docs/research/providers/suno.md`. Endpoint contract: `docs/kie/suno_v6.md`. Tool code: `packages/core/src/tools/suno_generate_music.ts`.

## Contents

1. What it does
2. Model version
3. Modes
4. Key parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Creates a Suno music generation task through Kie.ai. The tool returns a `taskId`. Results come from polling or a callback. Source: https://docs.kie.ai/suno-api/generate-music.md

Endpoint: `POST https://api.kie.ai/api/v1/jobs/createTask`, model `ai-music-api/generate`. Polling: `GET /api/v1/jobs/recordInfo?taskId=...`. Source: https://docs.kie.ai/suno-api/generate-music.md

## 2. Model version

- The tool accepts `V6`, `V6_MINI` and `V6_WILD`. Default is `V6`. Source: https://docs.kie.ai/suno-api/generate-music.md
- Older values (V4, V4_5, V4_5PLUS, V4_5ALL, V5, V5_5) are listed as discontinued. Source: same.
- Conflict: Kie.ai market says the Suno entry supports "the latest V5.5 model." Source: https://kie.ai/market. Unverified which is live.

## 3. Modes

- **Custom mode** (`customMode: true`): needs `title` (max 80 chars) and at least one of `style`, `lyrics` or `negativeTags`. Enables duration, variety, vocal gender and weight controls.
- **Non-custom mode** (`customMode: false`): needs one of `image_urls`, `video_urls`, `audio_urls`, `style` or `lyrics`. A prompt alone is not enough. Custom-only fields must not be sent.
- **Instrumental** (`instrumental: true`): no vocals.

Source for both modes: https://docs.kie.ai/suno-api/generate-music.md

## 4. Key parameters and limits

| Parameter | Limit |
|---|---|
| `prompt` | 3000 chars non-custom; used as lyrics in custom mode when `instrumental` is false |
| `lyrics` | 5000 chars; overrides `prompt` in custom mode |
| `style` | 1000 chars |
| `title` | 80 chars, required in custom mode |
| `duration` | 10 to 360 s, custom only |
| `variety` | integer 0 to 4, default 1, custom only |
| `style_weight`, `weirdness_constraint`, `audio_weight` | 0 to 1, 2 decimals, custom only. `audio_weight` needs vocals |
| `persona_id`, `persona_model` | `style_persona` or `voice_persona` |
| `image_urls` | up to 5, each 10 MB, jpeg/png/webp/bmp |
| `video_urls` | 1 file, 100 MB, 241 s, mp4/mov/webm |
| `audio_urls` | 6 s to 30 min each, 500 MB each |
| Attachments total | style + lyrics + images + videos + audio must be 10 or fewer |

Source: https://docs.kie.ai/suno-api/generate-music.md. The tool schema matches these limits in `packages/core/src/types.ts` (`SunoGenerateSchema`).

Callback: optional `callBackUrl`, stages `text`, `first` and `complete`. Source: https://docs.kie.ai/suno-api/generate-music.md

## 5. Pricing

- **Kie.ai per request for V6, V6_MINI, V6_WILD**: unknown. The model page was not retrieved (HTTP 404 and 403).
- Kie.ai pricing page shows credits at "1 credit ≈ $0.005" and a Suno starting price of "from 0.4 per request" (about $0.002). It does not map that figure to a named V6 option. Source: https://kie.ai/pricing. Treat as unverified for this tool.
- Kie.ai lists "Generate Voice is free" and other Suno operations in credits. Generate Music has no per-request amount in the extracted page text. Source: https://kie.ai/suno-api
- **Provider (Suno) plans**: Free $0 with 50 daily credits, Pro $8/month with 2,500 credits, Premier $24/month with 10,000 credits. Source: https://suno.com/pricing. Those are Suno consumer plans, not API pricing.
- Insufficient-credit error is code 402. Source: https://docs.kie.ai/suno-api/generate-music.md

## 6. Strengths

- Full songs with vocals or instrumentals in one call. Source: https://docs.kie.ai/suno-api/generate-music.md
- Fine control in custom mode (duration, variety, weights).
- Persona and voice options.
- Reference media for non-custom mode.
- The repo already has a tested tool, a DB record and a callback fallback.

## 7. Weaknesses

- No official Suno API. Unverified terms for the Kie path.
- Output files are kept only 14 days on Kie.ai. Source: https://kie.ai/suno-api. Download and store results.
- Version conflict between V5.5 (Kie market) and V6 (docs). Source: https://kie.ai/market and https://docs.kie.ai/suno-api/generate-music.md
- Doc inconsistency: old prompt limits still appear in the prompt field description. Source: https://docs.kie.ai/suno-api/generate-music.md
- Price not verified, so cost per song cannot be stated.
- Copyright: Suno makes no guarantee copyright vests in output. Source: https://suno.com/terms

## 8. Best use cases

- Background music or jingles where a fast, complete track is needed.
- Instrumental beds, with `instrumental: true`.
- Songs from user-supplied lyrics in custom mode.
- Tests of persona or style workflows.

Avoid for: releases that need a clear copyright claim, voice or likeness of a real person (Suno prohibits it), or any commercial use on a Free tier account if the Kie path does not grant rights. Sources: https://suno.com/terms and https://suno.com/community-guidelines

## 9. Alternatives in this catalog

- No other music generation tool in the catalog. Checked `packages/core/src/model-catalog.ts`.
- `elevenlabs_ttsfx` (sound effects) and `elevenlabs_tts` (speech) cover other audio, not songs.

## 10. Open questions

1. Which version is live on Kie.ai, V5.5 or V6? Check the Kie.ai model page and a real `GET recordInfo` response.
2. Per-request price for each of V6, V6_MINI and V6_WILD. Needed for `packages/core/src/model-catalog.ts` price state (currently unknown).
3. Commercial-use rights for output generated through Kie.ai. Read Kie.ai's terms of service.
4. Whether the `KIE_AI_CALLBACK_URL` fallback is the best default, given the 14-day file retention.
