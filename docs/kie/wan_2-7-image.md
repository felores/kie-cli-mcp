# Wan 2.7 Image and Image Pro

Verified on 2026-10-04 against official [standard](https://docs.kie.ai/market/wan/2-7-image.md) and [Pro](https://docs.kie.ai/market/wan/2-7-image-pro.md) contracts.

`wan_image` selects `wan/2-7-image`, default, or `wan/2-7-image-pro`. Creation and polling use the unified jobs endpoints; persisted api_type is `wan-image`.

Prompt is required, maximum 5000 characters. Up to 9 `input_urls` select editing. Text-to-image supports aspect_ratio 1:1, 16:9, 4:3, 21:9, 3:4, 9:16, 8:1, or 1:8. Resolution is 1K/2K/4K, default 2K.

- Standard mode: `enable_sequential: false`, n 1-4, default 4.
- Sequential/group mode: `enable_sequential: true`, n 1-12, default 12.
- Thinking mode is text-only and non-sequential.
- Color palettes are non-sequential-only, with 3-10 `{hex, ratio}` entries. The ratio is a percentage string with two decimal places.
- `bbox_list` editing input has one list per reference image, at most two `[x1,y1,x2,y2]` boxes per image. Empty inner lists are valid. The CLI accepts this nested array as JSON.
- Pro 4K requires non-sequential text-to-image.
- Seed, filtering, watermark, and callback are optional; callbacks support the environment fallback.

Approval plans record the selected model and the resolved n default. MCP/CLI expose these models. OpenAI excludes them because its image adapters require one result per task and these models have multi-image/sequential output. Wan 2.7 video editing/reference endpoints were explicitly excluded from this upgrade. Pricing remains unknown; no paid generation was performed.
