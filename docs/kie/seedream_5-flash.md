# Seedream 5 Flash

Verified on 2026-10-04 against official [generation](https://docs.kie.ai/market/seedream/5-flash-text-to-image.md), [editing](https://docs.kie.ai/market/seedream/5-flash-image-to-image.md), and [layer decomposition](https://docs.kie.ai/market/seedream/5-flash-layer-decomposition.md) contracts. Playground: <https://kie.ai/seedream-5-0-flash>.

Select `version: "5-flash"` on `bytedance_seedream_image`. Model IDs are `seedream/5-flash-{text-to-image|image-to-image|layer-decomposition}`. Creation and polling use the unified jobs endpoints.

Generation/editing use `size` 1K/1.5K/2K, default 1K, rather than Pro's `quality`. Prompt is required, 3-5000 characters; editing accepts 1-10 `image_urls`. Layers accept one `image_url`, optional prompt of at least 3 characters when supplied, and size auto/1K/1.5K/2K. PNG/JPEG, mode detection, and callback behavior follow [5 Pro](seedream_5-pro.md).

MCP/CLI expose Flash and layers. The selected-model OpenAI transport continues exposing Pro generation/editing only. Pricing remains unknown. No paid generation was performed.
