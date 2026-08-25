# Grok Imagine Image 2.0

Source verified 2026-08-22:

- https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image
- https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image
- https://docs.kie.ai/market/grok-imagine/text-to-video
- https://docs.kie.ai/market/grok-imagine/image-to-video

Both operations create tasks through `POST /api/v1/jobs/createTask`. `callBackUrl`
is optional. The callback delivers task state and `resultJson.resultUrls` after
completion.

## Text-to-image

- Model: `grok-imagine-image-2-0/text-to-image`
- Required input: `prompt`, `aspect_ratio`
- `aspect_ratio`: `1:1`, `2:3`, `3:2`, `16:9`, or `9:16`

## Image edit

- Model: `grok-imagine-image-2-0/image-edit`
- Required input: `prompt`, `image_urls`, `aspect_ratio`
- `image_urls`: one to five URI strings
- `aspect_ratio`: `1:1`, `2:3`, `3:2`, `16:9`, `9:16`, or `auto`

## Text-to-video

- Model: `grok-imagine/text-to-video`
- Required input: `prompt`
- Supported fields: `aspect_ratio` and `mode`
- `aspect_ratio`: `1:1`, `2:3`, `3:2`, `16:9`, or `9:16`
- `mode`: `fun`, `normal`, or `spicy`

## Image-to-video

- Model: `grok-imagine/image-to-video`
- Required input: one `image_urls` entry
- Optional input: `prompt`, `aspect_ratio`, and `mode`
- External-image requests cannot use `mode=spicy`

The OpenAI transport exposes only `mode=normal` through `kie-grok-video` and
does not expose duration, resolution, synchronized audio, image-generation,
image-editing, or upscale operations through the standard video route.

## Intentional limits

The Image 2.0 image contracts do not define an aspect-ratio default,
generated-image count, accepted source MIME types, source byte limits, or a
numeric price. This project supplies `1:1` when `aspect_ratio` is omitted for
those image modes and reports pricing as `unknown`. The separate Grok video
image-input contract documents a 20 MiB maximum, which the OpenAI video adapter
enforces before upload.
