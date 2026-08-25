# Kie Flux 2 image API contract

Verified: 2026-08-24

Official sources:

- https://docs.kie.ai/market/flux2/pro-text-to-image
- https://docs.kie.ai/market/flux2/pro-image-to-image
- https://docs.kie.ai/market/common/get-task-detail

## OpenAI adapter profile

The OpenAI transport exposes the fixed Pro profile as
`kie-flux-2-pro-image`. It supports generation and multipart editing through
the core `flux2_image` schema and `KieAiClient.generateFlux2Image()`.

- Generation submits `flux-2/pro-text-to-image`.
- Editing submits `flux-2/pro-image-to-image` with uploaded `input_urls`.
- Supported ratios are `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, and
  `2:3`.
- Supported resolutions are 1K and 2K.
- The provider documents a 30 MiB per-reference limit. The transport accepts up
  to eight references, matching the canonical core schema, and deliberately
  applies a stricter 25 MiB per-file and total multipart safety ceiling.
- Provider examples return one PNG URL per task. The adapter therefore accepts
  only `output_format=png` and uses one task per requested image.

## Status

Flux 2 uses the shared Market jobs status endpoint:
`GET /api/v1/jobs/recordInfo?taskId=<TASK_ID>`. Successful records expose a
JSON-encoded `resultJson.resultUrls` array.
