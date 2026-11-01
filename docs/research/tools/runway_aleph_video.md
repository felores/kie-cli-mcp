---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/runway-api/generate-aleph-video
  - https://docs.kie.ai/runway-api/quickstart
  - https://kie.ai/runway
  - https://kie.ai/runway-api
  - https://docs.dev.runwayml.com/guides/models/
  - https://docs.dev.runwayml.com/api-details/api_changelog/
  - https://runway.com/pricing
  - https://runway.com/news/introducing-aleph-2-and-edit-studio
  - https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio
  - https://runway.com/terms-of-use
---

# runway_aleph_video (research)

Catalog entry: `runway_aleph_video`, model `runway-aleph`, provider slug `runway`. Source: `packages/core/src/model-catalog.ts`.

## Contents

1. Status alert
2. What it does
3. Model version
4. Modes
5. Parameters and limits
6. Pricing
7. Strengths
8. Weaknesses
9. Best use cases
10. Alternatives in this catalog
11. Open questions

## 1. Status alert

The catalog says `status: "active"`. Kie.ai's own endpoint page says the opposite: "Runway Aleph is no longer available on Kie AI." It also labels the endpoint deprecated. Source: https://docs.kie.ai/runway-api/generate-aleph-video

The catalog's `evidenceUrl` (https://docs.kie.ai/runway-api/quickstart) returned HTTP 404 during this research. The catalog status needs an owner decision before any further use.

## 2. What it does

Edits an existing video from a text prompt (video-to-video). Kie.ai submits the job to `POST /api/v1/aleph/generate` and returns a `taskId`. Output arrives by callback or by status polling. Sources: https://docs.kie.ai/runway-api/generate-aleph-video and `packages/core/src/tools/runway_aleph_video.ts`.

## 3. Model version

- Kie.ai's page does not name the Runway model version behind the endpoint: unverified.
- Runway's current Aleph is Aleph 2.0, model ID `aleph2`, released 2026-06-02. Gen-4 Aleph (`gen4_aleph`) was retired on Runway Dev on 2026-07-30. Source: https://docs.dev.runwayml.com/api-details/api_changelog/

## 4. Modes

- Video editing only, from one input video plus a prompt. Optional reference image for style or content. Source: https://docs.kie.ai/runway-api/generate-aleph-video
- Text-to-video and image-to-video are not offered by this endpoint.

## 5. Parameters and limits

From the Kie.ai OpenAPI spec (https://docs.kie.ai/runway-api/generate-aleph-video) and the Zod schema in `packages/core/src/types.ts`:

| Field | Required | Limit or values |
|---|---|---|
| `prompt` | yes | 1 to 1000 characters |
| `videoUrl` | yes | URL of the input video |
| `aspectRatio` | no | `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9`. Default `16:9` |
| `waterMark` | no | up to 100 characters. Empty string means no mark |
| `uploadCn` | no | boolean, default `false` |
| `seed` | no | integer. Schema hint says 1 to 999999 |
| `referenceImage` | no | image URL |
| `callBackUrl` | no | falls back to `KIE_AI_CALLBACK_URL` |

Input video length, size, and output duration and resolution on Kie.ai: unverified. The Kie.ai page does not state them.

Callback results: `result_video_url` is valid for 14 days. Callback error code `400` covers content-policy and technical failures. Source: https://docs.kie.ai/runway-api/generate-aleph-video (callback page)

Runway's own Aleph 2.0 limits, for comparison: input 2 to 30 seconds, 480p to 1080p, at most 10 cuts, conventional aspect ratios only. Source: https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio

The tool's `next_steps` text says "3-8 minutes." That figure has no source: unverified.

## 6. Pricing

- Kie.ai price for this endpoint: unknown. The Kie.ai Runway pages do not list Aleph. Sources: https://kie.ai/runway and https://kie.ai/runway-api
- Runway price: Runway's model guide lists Aleph 2.0 at $0.28 per second. Source: https://docs.dev.runwayml.com/guides/models/
- Runway credits: 28 credits per second with a 56-credit minimum, per the Help Center. Source: https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio
- Conflict: a third-party search summary of Runway's Academy page describes extra input-based fees per second of input video. That page was not fetched directly. Unverified.

## 7. Strengths

- Targeted edits that keep unchanged parts of the footage. Source: https://runway.com/news/introducing-aleph-2-and-edit-studio
- Multi-shot edits from one prompt, within the 30-second limit. Source: https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio
- Simple single-endpoint call with the Zod schema validated before submission.

## 8. Weaknesses

- Discontinued on Kie.ai per its own docs. Calls may fail or stop being served.
- The catalog's evidence link is a 404.
- Cost on Kie.ai is unknown. A user cannot budget it.
- Kie.ai's doc omits input video limits, output resolution, and duration.
- Some parameters (`uploadCn`, `waterMark`) are Kie-specific and have no Runway counterpart documented in this research.

## 9. Best use cases

- Restyling or changing elements of short existing clips, if the endpoint is still served.
- Only after the status question in section 1 is settled.

## 10. Alternatives in this catalog

Capabilities are from `docs/ENDPOINTS.md` in this repo. Pricing and limits for these alternatives were not researched here.

- `wan_animate`: animation and character replacement.
- `kling_video`, `bytedance_seedance_video`, `happyhorse_video`: generation tools, not video-to-video editing as listed in the catalog. Use only if a generate-from-prompt path fits.

Runway's own API (https://docs.dev.runwayml.com/guides/models/) would be the direct route to `aleph2`, outside this catalog.

## 11. Open questions

- Should `runway_aleph_video` move to deprecated in the catalog, given the Kie.ai notice? Decision owner: Felo.
- Which Aleph cost applies on Runway: flat 28 credits per second, or input-based fees?
- Kie.ai price for this endpoint: unknown.
- Input video limits, output resolution, and duration on Kie.ai: unverified.
- Does the Kie.ai quickstart page still exist at the catalog's evidence URL? It returned 404.
