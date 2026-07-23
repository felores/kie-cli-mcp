# Nano Banana 2 Lite

- Official API: https://docs.kie.ai/market/google/nano-banana-2-lite
- Endpoint: `POST /api/v1/jobs/createTask`
- Model: `nano-banana-2-lite`

`input` requires `prompt` and `aspect_ratio`; `image_urls` is optional with a maximum of 10 URLs. Lite produces 1K images only. Supported aspect ratios are `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, and `auto`.

Use the common `GET /api/v1/jobs/recordInfo?taskId=...` endpoint to poll tasks.
