---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/z-image/z-image.md
  - https://docs.kie.ai/market/common/get-task-detail
  - https://kie.ai/pricing
  - https://github.com/Tongyi-MAI/Z-Image
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - /Users/felo/Documents/GitHub/kie-cli-mcp/docs/kie/z-image.md
  - /Users/felo/Documents/GitHub/kie-cli-mcp/packages/core/src/types.ts
---

# z_image

Catalog entry: `z_image`, model `z-image`. Provider: Alibaba Tongyi-MAI. Category: image.

## Contents

1. What it does
2. Model versions
3. Modes
4. Key parameters and limits
5. Pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Text-to-image generation. The repo tool description says "photorealistic" images with fast Turbo performance and bilingual Chinese and English text rendering. Source: `packages/core/src/tools/z_image.ts`. The bilingual and photorealism claims are repo descriptions. Official confirmation: unverified.

## 2. Model versions

- Official model: Z-Image, released January 27, 2026. Turbo (8 steps) released November 26, 2025. Source: https://github.com/Tongyi-MAI/Z-Image
- Z-Image-Edit is listed as "To be released" on GitHub. It is not available. Source: https://github.com/Tongyi-MAI/Z-Image
- Kie.ai exposes only `z-image`. Kie.ai does not say which Z-Image checkpoint (base or Turbo) it runs. Unverified.
- Alibaba Model Studio lists `z-image-turbo`, not `z-image`. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing

## 3. Modes

Generation only. No image input, no editing, no image-to-image on Kie.ai. Source: https://docs.kie.ai/market/z-image/z-image.md

## 4. Key parameters and limits

| Parameter | Kie.ai doc | Repo schema | Note |
| --- | --- | --- | --- |
| `prompt` | Required, max 1000 characters | Required, 1 to 5000 characters | Conflict. Repo is looser than Kie.ai doc. |
| `aspect_ratio` | Required. `1:1`, `4:3`, `3:4`, `16:9`, `9:16` | Same. Default `1:1` | |
| `nsfw_checker` | Default `false`. No extra filtering when false | Not in repo schema | |
| `callBackUrl` | Recommended for production | Optional, env fallback | |

Output: PNG, returned by callback or the task detail endpoint. Kie.ai doc: https://docs.kie.ai/market/z-image/z-image.md

Model resolution limits on the official Z-Image card: total pixels from 512 by 512 up to 2048 by 2048, any aspect ratio. Source: https://github.com/Tongyi-MAI/Z-Image. Kie.ai exposes only five fixed ratios and no resolution control.

## 5. Pricing

- Kie.ai: 0.8 credits per image, about $0.004. Source: https://kie.ai/pricing (listed as "Qwen z-image"). The Kie.ai Z-Image doc states no price. The mapping from "Qwen z-image" to `z-image` is inferred from the name and from this repo's rate card. Mapping: unverified.
- Alibaba Model Studio, `z-image-turbo`, per image: Singapore $0.015 without prompt rewriting, $0.03 with it. Beijing $0.01434 and $0.02868. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Kie.ai's price is below Alibaba's Singapore price for the Turbo model. The Kie.ai model may not be Turbo. Unknown.

## 6. Strengths

- Low cost per image on Kie.ai (about $0.004, per pricing page).
- Fast Turbo variant on the official card (8 steps). Source: https://github.com/Tongyi-MAI/Z-Image
- Open license for the model family: Apache-2.0. Source: https://github.com/Tongyi-MAI/Z-Image

## 7. Weaknesses

- Generation only. No edit or reference input on Kie.ai.
- Fixed five aspect ratios. No explicit resolution control.
- Prompt limit conflict: 1000 (Kie.ai doc) against 5000 (repo schema). Must be fixed in one place.
- The Kie.ai checkpoint is not identified.

## 8. Best use cases

- Cheap, quick photorealistic images from a text prompt.
- Prompts with short text to render in English or Chinese, pending verification of text rendering quality.

## 9. Alternatives in this catalog

- `qwen_image`: generation and editing with up to 3 references, 1K and 2K. Price unknown on Kie.ai.
- `wan_image`: standard Wan 2.7 Image, 4.8 credits per image, about $0.024. Supports editing and 1K and 2K.
- `gpt_image`, `nano_banana_image`, `flux2_image`: other generation options.

## 10. Open questions

- Prompt limit: 1000 or 5000 characters? Confirm with Kie.ai and align `ZImageSchema` in `packages/core/src/types.ts`.
- Which Z-Image checkpoint Kie.ai runs (base or Turbo). Unverified.
- Whether "Qwen z-image" on Kie.ai pricing is the same endpoint as `z-image`. Unverified.
- Whether bilingual text rendering holds at the Kie.ai output. Not tested here. No paid generation was run.
