---
status: draft
date: 2026-10-31
sources:
  - https://www.minimax.io/blog/minimax-h3
  - https://www.minimax.io/
  - https://platform.minimax.io/docs/guides/pricing-paygo
  - https://platform.minimax.io/docs/guides/video-generation
  - https://docs.kie.ai/llms.txt
  - https://docs.kie.ai/market/minimax-h3/text-to-video.md
  - https://docs.kie.ai/market/minimax-h3/image-to-video.md
  - https://docs.kie.ai/market/minimax-h3/reference-to-video.md
  - https://kie.ai/minimax-h3
  - https://kie.ai/pricing
  - https://kie.ai/market
---

# hailuo_video (MiniMax H3)

Catalog entry: `packages/core/src/model-catalog.ts` (`toolName: "hailuo_video"`, `model: "minimax-h3"`, `status: "active"`, `defaultProfile: "hailuo-safe"`).
Tool file: `packages/core/src/tools/hailuo_video.ts`. Schema: `HailuoVideoSchema` in `packages/core/src/types.ts`. Client: `generateHailuoVideo` in `packages/core/src/kie-ai-client.ts`.
Repo reference: `docs/kie/minimax-h3.md`.

## Contents

1. What it does
2. Model version
3. Modes and routing
4. Key parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions and repository gaps

## 1. What it does

`hailuo_video` creates an asynchronous video task on Kie.ai for MiniMax H3 (also called Hailuo 03). It returns a `task_id`. The result is read later with `get_task_status` or through `callBackUrl`. Output is an MP4 with a stereo audio track ([Kie text-to-video](https://docs.kie.ai/market/minimax-h3/text-to-video.md)).

## 2. Model version

- Name on the provider side: "MiniMax H3", described as "a general-purpose multimodal generation model" ([MiniMax H3 blog](https://www.minimax.io/blog/minimax-h3)). The blog dates the launch 2026-07-31.
- Kie.ai model IDs: `minimax-h3/text-to-video`, `minimax-h3/image-to-video`, `minimax-h3/reference-to-video`. Kie docs say: "The page gives no separate version number beyond 'H3.'" ([Kie reference-to-video](https://docs.kie.ai/market/minimax-h3/reference-to-video.md)).
- The official price table also lists H3-Highspeed, H3-Lite and H3-Max. The Kie docs list only the three standard H3 models ([Kie llms index](https://docs.kie.ai/llms.txt)). Source for the variant list: [pricing-paygo](https://platform.minimax.io/docs/guides/pricing-paygo).

## 3. Modes and routing

The tool picks a mode from its inputs. Routing is in `hailuo_video.ts` (mode label) and `generateHailuoVideo` in the client (model ID):

| Mode | Trigger in code | Kie model ID | Notes |
|---|---|---|---|
| Image-to-video | `imageUrl` present | `minimax-h3/image-to-video` | `endImageUrl` adds last frame. Reference inputs are not allowed. |
| Reference-to-video | any of `referenceImageUrls`, `referenceVideoUrls`, `referenceAudioUrls` | `minimax-h3/reference-to-video` | Needs at least one reference image or video. Audio alone is rejected by Kie. |
| Text-to-video | none of the above | `minimax-h3/text-to-video` | `aspectRatio` is sent. Adaptive is not allowed. |

Kie's rule: at least one of `first_frame_url` or `last_frame_url` is required in image mode ([Kie image-to-video](https://docs.kie.ai/market/minimax-h3/image-to-video.md)). The repo's `docs/kie/minimax-h3.md` says the same in other words.

## 4. Key parameters and limits

Public parameters (repo schema, checked against Kie docs):

| Parameter | Type | Modes | Limit or allowed values | Default | Source |
|---|---|---|---|---|---|
| `prompt` | string | all | 1 to 7,000 characters | none | Kie docs |
| `duration` | integer | all | 4 to 15 seconds, whole numbers | 6 | Kie docs, schema `4..15` |
| `aspectRatio` | enum | text, reference | Text: `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`. Reference adds `adaptive`. | text: required. reference: `adaptive` | Kie docs |
| `imageUrl` | URL | image | JPG, JPEG, PNG, WEBP, HEIC, HEIF. Max 30 MB. Each side 256 to 5,760 px. Aspect 0.4 to 2.5. | none | Kie docs |
| `endImageUrl` | URL | image | Same as `imageUrl`. Requires `imageUrl`. | none | Kie docs |
| `referenceImageUrls` | URL[] | reference | 1 to 9 items. JPG, JPEG, PNG, WEBP, HEIC, HEIF. Max 30 MB. | none | Kie docs, schema `max(9)` |
| `referenceVideoUrls` | URL[] | reference | 1 to 3 items. MP4 or MOV, H.264 or H.265. Max 50 MB each. 2 to 15 s per clip, 15 s total. | none | Kie docs, schema `max(3)` |
| `referenceAudioUrls` | URL[] | reference | 1 to 3 items. WAV or MP3. Max 15 MB each. 2 to 15 s per clip, 15 s total. Must pair with an image or video. | none | Kie docs, schema `max(3)` |
| `resolution` | enum | see gap | Schema allows only `"768p"`. Kie accepts `768P` or `2K`. | Kie: `2K` | Schema, Kie docs |
| `callBackUrl` | URL | all | Optional. Falls back to `KIE_AI_CALLBACK_URL`. | none | Repo convention |

Other limits:

- Reference images and video must be public `http`, `https`, or `oss` URLs ([Kie reference-to-video](https://docs.kie.ai/market/minimax-h3/reference-to-video.md)).
- Official limits match these ([video docs](https://platform.minimax.io/docs/guides/video-generation)): request body up to 64 MB. Video references must be H.264 or H.265. Reference frame rate 23.976 to 60 fps.
- Kie error codes: 401 (key), 402 (insufficient credits), 429 (rate limit), 422 or 500 (request could not be processed). HTTP is 200 even on failure, so check `code` ([Kie text-to-video](https://docs.kie.ai/market/minimax-h3/text-to-video.md)).
- Callback: `code` 200 on success, 501 on failure. `creditsConsumed` is 0 for failed tasks.
- Output: stereo audio always on. It cannot be turned off.

Parameters that the legacy Hailuo 02 docs used (`version`, `quality`, `promptOptimizer`) do not apply to H3 ([docs/kie/minimax-h3.md](/Users/felo/Documents/GitHub/kie-cli-mcp/docs/kie/minimax-h3.md)).

## 5. Pricing

### Kie.ai (resale)

| Item | Price, as listed | Source |
|---|---|---|
| Output 768P | 8 credits/s, $0.04/s | [kie.ai/minimax-h3](https://kie.ai/minimax-h3) |
| Output 2K | 13 credits/s, $0.065/s | [kie.ai/minimax-h3](https://kie.ai/minimax-h3) |
| Input video | Billed per second at the same rate as output, added to total | [kie.ai/minimax-h3](https://kie.ai/minimax-h3) |
| Extra image | 4 credits/image, $0.02/image. First 5 free. | [kie.ai/minimax-h3](https://kie.ai/minimax-h3) |
| Audio input | Free | [kie.ai/minimax-h3](https://kie.ai/minimax-h3) |
| Credit to USD | 1 credit ≈ $0.005 | [kie.ai/pricing](https://kie.ai/pricing) |

Total cost formula on Kie: `Unit Price × (Generated Video Duration + Input Video Duration) + Additional Image Cost` ([kie.ai/minimax-h3](https://kie.ai/minimax-h3)).

Kie's own model docs (`docs/kie`-style pages) list no per-second price. The `kie.ai/pricing` page shows only "from $0.02 per image" for H3 ([kie.ai/pricing](https://kie.ai/pricing)). The model page is the source for the per-second figures.

Example, unverified arithmetic from the stated rates: a 6 s text video at 2K costs 6 × 13 = 78 credits, or $0.39. At 768P it costs 6 × 8 = 48 credits, or $0.24. The tool cannot choose 768P in text or image mode (see gaps).

### MiniMax official (pay-as-you-go, USD)

| Model | Output | Output per s | Input video per s | Extra image |
|---|---|---|---|---|
| MiniMax-H3 | 2K | $0.13 | $0.13 | $0.04 |
| MiniMax-H3 | 768P | $0.08 | $0.08 | $0.04 |
| MiniMax-H3-Highspeed | 768P | $0.06 | $0.06 | $0.03 |
| MiniMax-H3-Lite | 768P | $0.04 | $0.04 | $0.02 |

Source: [pricing-paygo](https://platform.minimax.io/docs/guides/pricing-paygo). No date on the table. Video Packages do not cover H3 yet.

Kie's 768P and 2K prices are exactly half of the official rates, which matches the claim on the Kie model page.

## 6. Strengths

- Native stereo audio with voice, sound effects and music described in the prompt ([blog](https://www.minimax.io/blog/minimax-h3)).
- Three modes behind one tool, with a single schema for first and last frames and multimodal references ([Kie docs](https://docs.kie.ai/market/minimax-h3/reference-to-video.md)).
- Reference inputs can mix images, video and audio, up to 9 + 3 + 3 files ([video docs](https://platform.minimax.io/docs/guides/video-generation)).
- Duration 4 to 15 s at 2K is a wide range for a short-form clip.
- Lower price than the official API via Kie (half the official rate), with the same stated limits.

## 7. Weaknesses

- Vendor says visual detail "can still be improved in certain scenarios" ([blog](https://www.minimax.io/blog/minimax-h3)). No independent benchmark found.
- No benchmark scores on the launch page. The technical report is promised, not published ([blog](https://www.minimax.io/blog/minimax-h3)).
- Audio always on. Silent clips need post-processing.
- Duration is integer seconds only.
- Max prompt 7,000 characters. Reference video total 15 s.
- The tool exposes only `768p`, so text and image modes always get the API default (2K), which costs twice as much per second. This is a repository gap, not a provider limit.
- Kie's model page says duration is "5 to 15 seconds" in the FAQ and "4-15" in the input form. The API docs say 4 to 15. The repo uses 4 to 15.

## 8. Best use cases

- Short product, brand or advertising clips where native audio saves a step. The vendor lists advertising, branding, e-commerce, product design, UI/UX, gaming, film opening titles and product websites as target uses ([blog](https://www.minimax.io/blog/minimax-h3)).
- Image-to-video from a fixed first frame, with an optional fixed last frame to control the ending.
- Reference-driven clips that combine a character image, a motion clip and a music or voice track.
- Budget-sensitive batches, if the 2K default is acceptable. Use the Kie price table above to estimate cost before generating.

## 9. Alternatives in this catalog

These are other `ToolDef` tools in `model-catalog.ts`. Price and feature comparisons were not researched in this pass, so no ranking is given.

| Tool | Model (catalog) | Why compare |
|---|---|---|
| `bytedance_seedance_video` | ByteDance Seedance 2.5 | Also text, image and multi-reference video |
| `kling_video` | Kling 3.0 | Text, image, audio and multi-shot |
| `veo3_generate_video` | Veo 3 | Native audio, Google model |
| `wan_video` | wan/3-0-video | Text, image, reference and file-to-video |
| `happyhorse_video` | (see catalog) | Video, not compared |
| `grok_imagine` | (see catalog) | Video, not compared |
| `gemini_omni` | (see catalog) | Multimodal, not compared |

Open question for each: same per-second price basis and same reference limits as H3? Not checked.

## 10. Open questions and repository gaps

1. Resolution gap. The schema accepts only `"768p"` (lowercase). Kie docs say `768P` or `2K`, default `2K`. The client sends `resolution` only in reference mode. Text and image modes therefore always get 2K. The tool cannot request 768P there. Verify against the live API before changing code. Do not change code in this research task.
2. Case mismatch. Schema `"768p"` against Kie `"768P"`. The API may accept either. Unverified.
3. `aspectRatio` in text mode. Schema says required. Client sends `input.aspect_ratio = request.aspectRatio`, which is `undefined` if missing. Whether the schema enforces it at parse time: unverified in this pass.
4. Documentation gap. `docs/kie/minimax-h3.md` lists no `resolution` parameter, though the tool and client handle it. Kie's API accepts it in all three modes.
5. Duration minimum. Kie FAQ says 5. API and form say 4. The repo uses 4. Confirm with a live call.
6. Orphaned docs. `docs/kie/hailuo_02-*.md` (four files) describe Hailuo 02 models. No catalog entry uses them. Not a current tool.
7. Open weights. The blog says weights are coming "in the coming days." Release and license: unverified.
8. Content policy. No provider or Kie policy text found in this pass. Kie's Terms of Use were not fetched. Moderation behavior of the API on refusals: unverified.
9. Pricing date. Both price sources are undated. Re-check before any cost quote.
10. Kie model listing. `kie.ai/market` (first page of cards) does not show the H3 entry. It is listed on the `kie.ai/minimax-h3` page.
