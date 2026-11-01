---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image
  - https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image
  - https://docs.kie.ai/market/grok-imagine/text-to-video
  - https://docs.kie.ai/market/grok-imagine/image-to-video
  - https://docs.kie.ai/market/grok-imagine/upscale
  - https://docs.kie.ai/market/common/get-task-detail
  - https://kie.ai/market
  - https://kie.ai/pricing
  - https://kie.ai/grok-imagine-image-2
  - https://kie.ai/blog/grok-imagine-image-2-0-release
  - https://docs.x.ai/developers/models
  - https://docs.x.ai/developers/model-capabilities/imagine
  - https://docs.x.ai/docs/guides/image-generation
  - https://docs.x.ai/docs/guides/video-generation
  - https://docs.x.ai/developers/migration/imagine-image-quality-nov-2
  - https://x.ai/news/grok-imagine-image-2
---

# grok_imagine

Catalog entry: `grok_imagine`, model `grok-imagine-image-2-0`, provider `xai`, status `active`
(`packages/core/src/model-catalog.ts`). Tool source: `packages/core/src/tools/grok_imagine.ts`.
Provider research: `docs/research/providers/xai.md`.

## Contents

1. What it does
2. Model version
3. Modes and endpoints
4. Key parameters and limits
5. Pricing
6. Strengths
7. Weaknesses and mismatches with the provider docs
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

One MCP tool (`grok_imagine`) that routes to five Kie.ai task types for xAI Grok Imagine: image generation, image editing, text-to-video, image-to-video, and upscale. Mode is chosen from the parameters, or from `generation_mode` ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image)). The tool returns a `task_id`. Results come from `get_task_status` or a callback.

## 2. Model version

- Catalog model: `grok-imagine-image-2-0` (Kie naming). xAI's official name is Imagine Image 2.0, ID `grok-imagine-image-2.0` ([source](https://x.ai/news/grok-imagine-image-2)).
- Video: Kie's endpoints are `grok-imagine/text-to-video`, `grok-imagine/image-to-video`, and `grok-imagine/upscale`. Kie's market lists "Grok Imagine Video 1.5" ([source](https://kie.ai/market)). The xAI video version behind these Kie names is unverified.

## 3. Modes and endpoints

All calls go to `POST https://api.kie.ai/api/v1/jobs/createTask`.

| Tool mode | Kie model | Required input | Source |
|---|---|---|---|
| text-to-image | `grok-imagine-image-2-0/text-to-image` | `prompt`, `aspect_ratio` | [source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image) |
| image-to-image | `grok-imagine-image-2-0/image-edit` | `prompt`, `image_urls` (1 to 5), `aspect_ratio` | [source](https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image) |
| text-to-video | `grok-imagine/text-to-video` | `prompt` | [source](https://docs.kie.ai/market/grok-imagine/text-to-video) |
| image-to-video | `grok-imagine/image-to-video` | one `image_urls` entry, or `task_id` | [source](https://docs.kie.ai/market/grok-imagine/image-to-video) |
| upscale | `grok-imagine/upscale` | `task_id`, optional `resolution` | [source](https://docs.kie.ai/market/grok-imagine/upscale) |

Note: the tool's `upscale` mode sends only `task_id` to `grok-imagine/upscale`. Kie documents that endpoint as a video upscale. See section 7.

## 4. Key parameters and limits

Tool schema (`GrokImagineSchema`): `prompt` (max 5000), `image_urls` (max 5 in schema), `task_id`, `index` (0 to 5), `aspect_ratio` (`1:1`, `2:3`, `3:2`, `16:9`, `9:16`, `auto`), `mode` (`fun`, `normal`, `spicy`), `generation_mode`, and `callBackUrl`.

Kie API limits per page:

- text-to-image: prompt max 8,000 characters. `aspect_ratio` enum `1:1`, `2:3`, `3:2`, `16:9`, `9:16` ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image)).
- image-edit: `image_urls` 1 to 5. `aspect_ratio` also accepts `auto`. Formats JPEG, PNG, WEBP, up to 30 MB each, per the Kie model page ([source](https://kie.ai/grok-imagine-image-2)). The docs page itself does not state formats.
- text-to-video: prompt max 5,000 characters. `aspect_ratio` default `2:3`. `mode` default `normal`. `duration` 6 to 30 seconds (the page's example sends the string `'6'`). `resolution` `480p` (default), `720p`, `1080p` ([source](https://docs.kie.ai/market/grok-imagine/text-to-video)).
- image-to-video: up to 7 image URLs (JPEG, PNG, WEBP, 10 MB each). Only one image at 1080p. `task_id` must come from a `grok-imagine-image-2-0/text-to-image` task, with `index` 0 to 1. Spicy mode is unavailable with external images. `aspect_ratio` default `16:9` for multi-image mode ([source](https://docs.kie.ai/market/grok-imagine/image-to-video)).
- upscale: `task_id` must come from a successful `grok-imagine/text-to-video` or `grok-imagine/image-to-video` task, Kie-generated only. `resolution` `720p` (default) or `1080p` ([source](https://docs.kie.ai/market/grok-imagine/upscale)).

Output count for image modes is not stated on the Kie pages. Example responses show one URL. xAI's official API allows up to 10 images per request ([source](https://docs.x.ai/developers/model-capabilities/imagine)). Kie's exposure of that count is unverified.

Common: `callBackUrl` is optional, and Kie recommends it for production. Callbacks return `state`, `resultJson.resultUrls`, and `creditsConsumed` ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image)). Status is checked with the Get Task Details endpoint ([source](https://docs.kie.ai/market/common/get-task-detail)).

## 5. Pricing

| Source | Item | Price | URL |
|---|---|---|---|
| Provider (xAI) | Image 2.0 (`grok-imagine-image-2.0`) | $0.04 / image | [source](https://docs.x.ai/developers/models) |
| Provider (xAI) | Video 1.5 (`grok-imagine-video-1.5`) | $0.080 / sec | [source](https://docs.x.ai/developers/models) |
| Provider (xAI) | Image edit | Billed for input image plus output image | [source](https://docs.x.ai/developers/model-capabilities/imagine) |
| Provider (xAI) | Resolution-specific video prices | unknown | official page does not list them |
| Kie.ai | Image 2.0 text-to-image and edit | 4 credits per image (about $0.02) per Kie pricing page; Kie Image 2.0 page says "4 credits per image (= $0.02)" | [source](https://kie.ai/pricing), [source](https://kie.ai/grok-imagine-image-2) |
| Kie.ai | Grok Imagine video | from $0.012 per second (2.4 credits) for `grok-imagine`, per Kie pricing page | [source](https://kie.ai/pricing) |
| Kie.ai | Upscale, image-to-video, text-to-video for this catalog's model names | unknown: per-option prices not shown | [source](https://docs.kie.ai/market/grok-imagine/upscale) |
| Kie.ai | Credit rate | 1 credit is about $0.005 | [source](https://kie.ai/pricing) |

Catalog and tool: the tool reports `pricing: "unknown: no verified local rate-card formula"`. This matches the rule to keep price state `unknown` until each dimension has official evidence.

Conflict: xAI lists $0.04 per Image 2.0 image. Kie's Image 2.0 page cites an "official $0.06 rate." Kie's pricing page shows $0.02. These cannot all be right for the same operation. Unverified which one Kie bills.

## 6. Strengths

- One tool covers five Kie Grok operations (image generation, editing, two video modes, upscale) through one endpoint family.
- Image editing accepts up to 5 source images ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image)).
- Video output includes synchronized audio, and dialogue written in the prompt is spoken. Audio cannot be turned off ([source](https://docs.kie.ai/market/grok-imagine/text-to-video)).
- Failed tasks report `creditsConsumed` 0 ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image)).
- Vendor claims for Image 2.0 quality (Arena Elo ranking, editing tools). Treat as claims, not verified benchmarks ([source](https://x.ai/news/grok-imagine-image-2)).

## 7. Weaknesses and mismatches with the provider docs

1. **Upscale is described wrong.** The catalog says "image upscale," and `TOOLS.md` and the tool text describe upscale as an image pick by `index` 0 to 5. Kie's `grok-imagine/upscale` page is a video upscale: its `task_id` must come from a Grok video task, the output is video, and `resolution` is 720p or 1080p ([source](https://docs.kie.ai/market/grok-imagine/upscale)). The client sends only `task_id`, so the request shape does not match the page. Treat this mode as a defect until tested.
2. **`index` range conflicts.** The tool schema allows `index` 0 to 5 ("Grok generates 6 images per task"). Kie's image-to-video page allows 0 to 1, for a source `grok-imagine-image-2-0/text-to-image` task. Kie does not document a 6-image output for these tasks. Unverified.
3. **Default aspect ratio differs.** The client sends `aspect_ratio: "1:1"` as the default for text-to-video. Kie's text-to-video default is `2:3` ([source](https://docs.kie.ai/market/grok-imagine/text-to-video)). Image-to-video default on Kie is `16:9`, but the client sends no default there.
4. **Schema allows `auto` for text-to-image.** Kie's text-to-image enum is `1:1`, `2:3`, `3:2`, `16:9`, `9:16` only ([source](https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image)). The tool schema allows `auto` for every image mode. Kie may reject it. Unverified.
5. **Not exposed by the tool.** Video `duration` and `resolution` (other than upscale), `nsfw_checker`, the image output count, and the xAI `quality` option (`low`, `medium`, `auto`) are not in the schema ([source](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2)).
6. **Retirement risk.** xAI retires `grok-imagine-image-quality` on 2026-11-02. Its requests then go to `grok-imagine-image-2.0` at `quality: "low"`. The tool uses the Kie slug, so the effect is unverified ([source](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2)).
7. **Price is unknown to the tool.** No cost is reported to the user, and the rate card is not set.
8. **Image-to-video from a generated image needs the source task to be a Grok text-to-image task.** Other sources are not documented.

## 8. Best use cases

- Quick text-to-image and image editing with a fixed set of 5 aspect ratios, in one tool.
- Short video clips with synchronized audio from text or one reference image (up to 30 seconds, 1080p with the image-to-video single-image rule).
- Two-step chains: generate an image, then animate it using `task_id` (after the mismatch in section 7.2 is resolved).

Not a good fit when a fixed per-image price is required before generation, since no verified local price exists.

## 9. Alternatives in this catalog

Image: `nano_banana` (multi-mode image tool), `openai_4o_image`, `bytedance_seedream_image`, `qwen_image`, `z_image`, per `docs/TOOLS.md` and `docs/ENDPOINTS.md`. Not compared here: unverified for this document.

Video: `veo3_generate_video`, `kling_video`, `bytedance_seedance_video`, `hailuo_video`, `happyhorse_video`, `wan_video`, per `docs/TOOLS.md`. Not compared here: unverified for this document.

## 10. Open questions

1. Does `grok-imagine/upscale` need a fix in the client to match Kie's video-upscale contract, or should the tool be renamed? Owner decision. Source: section 7.1.
2. Which per-image price does Kie bill for `grok-imagine-image-2-0`: $0.02, $0.04, or $0.06? Source: section 5.
3. Which xAI video version do Kie's `grok-imagine/*` video models run? Source: section 2.
4. Does the 2026-11-02 retirement of `grok-imagine-image-quality` change Kie's behavior for this slug? Source: section 7.6.
5. Does Kie accept `auto` on text-to-image? Source: section 7.4.
6. Does Kie return more than one image per image task? Source: section 4.
7. Video price per resolution and duration on Kie: unknown.
