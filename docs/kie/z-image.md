# Kie Z-Image API contract

Verified: 2026-08-24

Official sources:

- https://docs.kie.ai/market/z-image/z-image
- https://docs.kie.ai/market/common/get-task-detail
- https://docs.kie.ai/common-api/download-url

## Submission

Create a task with `POST /api/v1/jobs/createTask` using model `z-image`.
The documented input includes a required `prompt` and an `aspect_ratio`. The
successful response returns `data.taskId`.

The OpenAI adapter deliberately exposes generation only. It maps OpenAI image
sizes to the core `aspect_ratio` vocabulary and rejects `n`, `quality`, explicit
`output_format`, and image-edit multipart requests before upload, journal
reservation, or provider submission.

## Status and results

Poll `GET /api/v1/jobs/recordInfo?taskId=<TASK_ID>`. The shared Market task
contract returns `data.state` and a JSON-encoded `data.resultJson` containing
`resultUrls` on success.

The adapter uses one paid Kie task for one logical image and requires exactly
one result URL. Multiple or missing results are treated as invalid provider
responses and never trigger more paid work.

## Download trust

Kie's generated-file documentation shows generated assets on
`tempfile.aiquickdraw.com` and documents the authenticated download-link API for
Kie-generated URLs. The adapter preserves the transport's existing exact-host
policy for `file.aiquickdraw.com` and `tempfile.aiquickdraw.com`; redirects and
private, loopback, link-local, reserved, wildcard, path-bearing, or credentialed
targets are rejected.
