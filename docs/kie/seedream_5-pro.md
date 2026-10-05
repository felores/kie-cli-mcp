# Seedream 5 Pro

Verified on 2026-10-04 against official [generation](https://docs.kie.ai/market/seedream/5-pro-text-to-image.md), [editing](https://docs.kie.ai/market/seedream/5-pro-image-to-image.md), and [layer decomposition](https://docs.kie.ai/market/seedream/5-pro-layer-decomposition.md) contracts. Playground: <https://kie.ai/seedream-5-0-pro>.

`bytedance_seedream_image` defaults to `version: "5-pro"`. Creation uses `POST /api/v1/jobs/createTask` and polling uses `GET /api/v1/jobs/recordInfo?taskId=...`.

| Mode | Model | Contract |
| --- | --- | --- |
| Text-to-image | `seedream/5-pro-text-to-image` | Prompt 3-5000 characters, aspect ratio, quality basic/high for 1K/2K |
| Image-to-image | `seedream/5-pro-image-to-image` | Same controls plus 1-10 `image_urls` |
| Layer decomposition | `seedream/5-pro-layer-decomposition` | One `image_url`, optional prompt, size auto/1K/1.5K/2K |

`image_urls` selects editing; `image_url` or `operation: "layer-decomposition"` selects layers. Mixed inputs are rejected. Generation/editing default to PNG and layers to JPEG. Both PNG and JPEG are available; filtering is generation/editing-only. `callBackUrl` is optional with the environment fallback. Layer mode does not accept ratio or quality.

V4 and 5 Lite are no longer selectable. [5 Flash](seedream_5-flash.md) is the other current variant. Pricing remains unknown. No paid generation was performed.
