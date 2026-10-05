# Qwen3 image generation and editing

Verified on 2026-10-04 against official [standard generation](https://docs.kie.ai/market/qwen3/text-to-image.md), [standard editing](https://docs.kie.ai/market/qwen3/image-to-image.md), [Pro generation](https://docs.kie.ai/market/qwen3/pro-text-to-image.md), and [Pro editing](https://docs.kie.ai/market/qwen3/pro-image-to-image.md) contracts.

Select `qwen3`, the default, or `qwen3-pro` through `qwen_image.model`. Provider routes are `qwen3/{pro-}{text-to-image|image-to-image}`. Creation/polling use the jobs endpoints. Presence of 1-3 `image_urls` selects editing.

Prompt limit is 5000 characters. Resolution is 1K/2K; image_size is an aspect ratio, default 16:9, from 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, or 21:9. Output is PNG/JPEG. `prompt_extend` defaults to true. Negative prompt, seed, filtering, and callback are optional; callbacks support the environment fallback.

The old single `image_url`, inference-step, guidance, acceleration, safety-checker, and sync-mode controls are rejected. `kie-qwen-image` keeps its public OpenAI ID while routing to Qwen3, supporting 1K/2K and three references. That adapter disables prompt rewriting to retain direct prompt control. Pro selection remains MCP/CLI-only. Pricing remains unknown; no paid generation was performed.
