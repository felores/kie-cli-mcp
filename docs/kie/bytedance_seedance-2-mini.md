# ByteDance Seedance 2.0 Mini

- Official API: https://docs.kie.ai/market/bytedance/seedance-2-mini
- Endpoint: `POST /api/v1/jobs/createTask`
- Model: `bytedance/seedance-2-mini`

Mini supports text, first/last-frame, and multimodal-reference video generation. Frame inputs and reference inputs are mutually exclusive. References support up to 9 images, 3 videos, and 3 audio files. Other inputs include `generate_audio`, `resolution` (`480p` or `720p`), `aspect_ratio`, `duration`, `web_search`, and `nsfw_checker`.

Use `GET /api/v1/jobs/recordInfo?taskId=...` for task status.
