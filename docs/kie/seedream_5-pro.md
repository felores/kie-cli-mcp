# Seedream 5.0 Pro

- Text-to-image API: https://docs.kie.ai/market/seedream/5-pro-text-to-image
- Image-to-image API: https://docs.kie.ai/market/seedream/5-pro-image-to-image
- Endpoint: `POST /api/v1/jobs/createTask`
- Models: `seedream/5-pro-text-to-image`, `seedream/5-pro-image-to-image`

Both operations accept `prompt`, `aspect_ratio`, `quality` (`basic` for 1K or `high` for 2K), optional `output_format` (`png` or `jpeg`), and `nsfw_checker`. Image-to-image additionally accepts up to 10 `image_urls`.

Use `GET /api/v1/jobs/recordInfo?taskId=...` for task status.
