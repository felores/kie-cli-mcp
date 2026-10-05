# GPT Image 2.5

Verified on 2026-10-04 using the [playground](https://kie.ai/gpt-image-2-5) and official API contracts:

- [Flare generation](https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-text-to-image.md)
- [Flare editing](https://docs.kie.ai/market/gpt/gpt-image-2-5-flare-image-to-image.md)
- [Sunburst generation](https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-text-to-image.md)
- [Sunburst editing](https://docs.kie.ai/market/gpt/gpt-image-2-5-sunburst-image-to-image.md)

`gpt_image_2` remains the public tool name. `model: "flare"` is the default; `sunburst` is optional. Presence of 1-16 `input_urls` selects editing. Provider IDs are `gpt-image-2-5-{flare|sunburst}-{text-to-image|image-to-image}`.

All requests use `POST /api/v1/jobs/createTask`; polling uses `/jobs/recordInfo`. Prompt limit is 20000 characters. Resolution is 1K, 2K, or 4K. `background` accepts `opaque` or `transparent`. Ratios include auto, 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, and 21:9. Ratios 27:16, 16:27, 9:8, and 8:9 require 1K. Callback is optional with the environment fallback.

The existing OpenAI ID `kie-gpt-image-2` now routes to Flare. It keeps its narrower PNG-only transport contract; transparency and Sunburst selection remain MCP/CLI capabilities. The historical GPT Image 2 smoke result does not verify this replacement. No paid generation or exact price verification was performed.
