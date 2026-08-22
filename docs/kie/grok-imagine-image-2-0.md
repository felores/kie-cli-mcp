# Grok Imagine Image 2.0

Source verified 2026-08-22:

- https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image
- https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image

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

## Intentional limits

The official contracts do not define an aspect-ratio default, generated-image
count, accepted source MIME types, source byte limits, or a numeric price. This
project supplies `1:1` when `aspect_ratio` is omitted to preserve the existing
tool contract, does not add file restrictions beyond URI validation, and reports
pricing as `unknown`.
