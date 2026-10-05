# HappyHorse 1.1 video

Verified on 2026-10-04 against official [text-to-video](https://docs.kie.ai/market/happyhorse-1-1/text-to-video.md), [image-to-video](https://docs.kie.ai/market/happyhorse-1-1/image-to-video.md), and [reference-to-video](https://docs.kie.ai/market/happyhorse-1-1/reference-to-video.md) contracts.

`happyhorse_video` routes to `happyhorse-1-1/{text-to-video|image-to-video|reference-to-video}` through `POST /api/v1/jobs/createTask`. Poll via `/jobs/recordInfo`.

- Text mode requires a prompt shorter than 5000 characters.
- One `image_urls` image selects image mode; prompt is optional and aspect ratio is not supported.
- `reference_image` selects reference mode, accepts 1-9 images, and requires a prompt.
- Image/reference prompts accept up to 5000 characters; all modes accept at most 2500 Chinese characters.
- Resolution is 720p/1080p and duration is an integer 3-15 seconds, default 5.
- Text/reference aspect ratios include 16:9, 9:16, 1:1, 3:4, 4:3, and 21:9.
- Image files are at most 20 MB. Their width/height and ratio constraints remain provider validation.

Video editing, seed, audio controls, and callback flags from the old tool are removed. The current request schema forbids additional envelope fields and does not list `callBackUrl`, despite generic callback guidance elsewhere on the page. The client therefore omits it and uses polling.

The current OpenAI ID is `kie-happyhorse-1-1-video`; `kie-happyhorse-1-0-video` remains a compatibility alias to 1.1, not an old provider route. Pricing remains unknown; no paid generation was performed.
