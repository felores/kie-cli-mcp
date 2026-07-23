# OmniHuman 1.5

- Official API: https://docs.kie.ai/market/omnihuman-1-5
- Endpoint: `POST /api/v1/jobs/createTask`
- Model: `omnihuman-1-5`

`input.image_url` and `input.audio_url` are required. Optional inputs are up to five `mask_url` values, `prompt`, `output_resolution` (`720` or `1080`), `pe_fast_mode`, and `seed`. Audio must be under 60 seconds.

Use `GET /api/v1/jobs/recordInfo?taskId=...` for task status.
