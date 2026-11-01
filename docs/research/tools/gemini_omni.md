---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/gemini-omni-video.md
  - https://docs.kie.ai/market/google/gemini-omni-flash-1-1.md
  - https://docs.kie.ai/market/gemini-omni-audio.md
  - https://docs.kie.ai/market/gemini-omni-character.md
  - https://docs.kie.ai/llms.txt
  - https://kie.ai/pricing
  - https://kie.ai/market
  - https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash
  - https://ai.google.dev/gemini-api/docs/pricing
  - https://ai.google.dev/gemini-api/docs/video
---

# gemini_omni

Research note for the MCP tool `gemini_omni` (catalog model `gemini-omni`, provider Google). Source: `packages/core/src/tools/gemini_omni.ts`.

## Table of contents

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

One tool with three operations, selected by `operation`:

- `video` (default): generates video from a prompt plus optional images, one video clip, audio IDs, and character IDs.
- `character`: creates a reusable character from one image and a description (`POST /omni/character/create` in the repo client).
- `audio`: registers a voice from an audio ID and a name (`POST /omni/audio/create` in the repo client).

Kie's docs split these into three pages: `gemini-omni-video`, `gemini-omni-character`, and `gemini-omni-audio` ([video](https://docs.kie.ai/market/gemini-omni-video.md)).

## 2. Model version

- Google's stable model is `gemini-omni-1.1-flash`. The preview ID `gemini-omni-flash-preview` is shut down ([Google model page](https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash)).
- Kie exposes two model IDs: `gemini-omni-video` (Kie docs for the video endpoint) and `google/gemini-omni-flash-1-1` (Kie's Flash 1.1 page). The repo tool sends neither ID directly. The repo client calls `/omni/...` paths. Which Kie model ID the repo client maps to is **unverified**; see Open questions.

## 3. Modes

Inputs for `video` operation, as listed on Kie:

- Text: `prompt`, required.
- Reference images: `image_urls`, up to 7.
- Video input: `video_list`, one clip with `url`, `start`, and `ends`.
- Characters: `character_ids`, up to 3.
- Audio: `audio_ids`, up to 3.
- First frame (Flash 1.1 page only): `first_frame_url`, optional `last_frame_url`. First-frame mode cannot be combined with `image_urls`, `video_list`, `character_ids`, or `audio_ids`.

The repo zod refine requires a prompt and a quota at or below 7 for video. Character mode requires `descriptions` and exactly one image. Audio mode requires `audio_id` and `name`.

## 4. Key parameters and limits

| Parameter | Repo schema | Kie video page |
|---|---|---|
| `prompt` | max 20,000 chars | max 20,000 chars, required |
| `image_urls` | max 7 | max 7; each file 20 MB or less; public URL |
| `audio_ids` | max 3 | max 3 |
| `video_list` | max 1; `ends` must be greater than `start` | max 1; source 100 MB or less, 30 s or less; clip span 10 s or less |
| `character_ids` | max 3 | max 3 |
| `duration` | `4`, `6`, `8`, `10`; optional | `4`, `6`, `8`, `10`; required on video page; ignored when a video input is used |
| `aspect_ratio` | `16:9`, `9:16` | `16:9`, `9:16` |
| `resolution` | `720p`, `1080p`, `4k` | `720p` (default), `1080p`, `4k`. Flash 1.1 page adds `360p`. |
| `seed` | integer 0 to 2147483647 | same |
| `callBackUrl` | optional URL | optional |

Quota: images count 1 each, one video counts 2, each character ID counts 1. The sum must be 7 or less. The Kie video page says this sum "must not exceed 7" ([video docs](https://docs.kie.ai/market/gemini-omni-video.md)).

Conflict: Kie's character ID text says each ID uses "1 image slot (2 if created with portrait + body images)", but the quota section says each ID uses 1 unit. Unresolved.

Kie's error codes listed for this model: 401, 402, 422, 429, 500. HTTP status is 200 even on failure.

## 5. Pricing

Kie (lowest "from" price, [kie.ai/pricing](https://kie.ai/pricing)):

- gemini-omni-video: from $0.315 per video (63 credits).
- google/gemini-omni-flash-1-1: from $0.315 per video (63 credits).

The "from" price does not say what duration or resolution it covers. Per-second or per-resolution Kie prices: **unknown**.

Google (paid tier only, per [pricing page](https://ai.google.dev/gemini-api/docs/pricing)):

- Input: $1.50 per 1M tokens (text, image, video, audio).
- Output video: $17.50 per 1M tokens.
- Google states a rate of 5,792 tokens per second of 720p video, "approximately $0.10 per second" at standard pricing. Prices for 1080p and 4K are not on the page: **unknown**.

Google's listed 720p rate implies that a 10-second clip costs about $1.00 at list price. The Kie "from" price of $0.315 is lower than that. The Kie duration basis is not stated, so this comparison is not conclusive.

## 6. Strengths

- Multi-input video: images, a video clip for editing or extension, characters, and voice IDs in one call.
- Reusable character and voice objects, so repeat use does not need re-upload.
- Google lists Gemini Omni Flash as stable and generally available on paid tier. It is the default video model in Google's current guidance.
- Output resolutions up to 4K on Google's model page, and on Kie's video page.

## 7. Weaknesses

- Google's model page does not state aspect ratio or audio support. Kie does list aspect ratios (`16:9`, `9:16`).
- Kie's character quota statement conflicts within the same page.
- Kie's "from" price does not show per-duration or per-resolution rates.
- The repo's client targets `/omni/...` paths, while Kie's docs show `POST /api/v1/jobs/createTask` for video and `/api/v1/omni/character/create` and `/api/v1/omni/audio/create` for character and audio. The video path does not match the repo client.
- The Kie Flash 1.1 page lists `360p` and `first_frame_url`. The repo schema does not include either.
- Google's own deepmind.google Omni page returned 404 when fetched. Google's ai.google.dev model page was used instead.

## 8. Best use cases

- Video edits or extensions from an existing clip (up to 10 s input) using `video_list`.
- Consistent characters across several clips, using `character` then `character_ids`.
- Custom voices using `audio` then `audio_ids`.
- Short 4 s to 10 s clips at 720p or 1080p for drafts.

## 9. Alternatives in this catalog

From `packages/core/src/model-catalog.ts`: `veo3_generate_video` (Veo 3.1 family; Google preview routes shut down October 22, 2026), `bytedance_seedance_video` (Seedance 2.5, reference-to-video and audio), `midjourney_generate` (image to video). The repo does not compare them.

## 10. Open questions

- Which Kie model ID does the repo client use for video: `gemini-omni-video` or `google/gemini-omni-flash-1-1`? The repo client's `/omni/...` path does not match the video endpoint on Kie's page. Unverified.
- Is the catalog `model` field `gemini-omni` a valid Kie ID? Kie docs use `gemini-omni-video`. Unverified.
- Per-second Kie prices, and whether $0.315 covers 10 s at 720p. Status: unknown.
- Aspect ratio and audio support on Google's own Omni Flash page. Not found; Kie lists aspect ratios.
- Should `360p`, `first_frame_url`, and `last_frame_url` be added to the repo schema? Product decision.
- The character quota conflict on Kie (1 unit vs 2 image slots for portrait plus body images). Ask Kie support or test with a real account.
