---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/wan/2-7-image.md
  - https://docs.kie.ai/market/wan/2-7-image-pro.md
  - https://kie.ai/wan-2-7-image
  - https://kie.ai/pricing
  - https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - /Users/felo/Documents/GitHub/kie-cli-mcp/docs/kie/wan_2-7-image.md
  - /Users/felo/Documents/GitHub/kie-cli-mcp/packages/core/src/tools/wan_image.ts
---

# wan_image

Catalog entry: `wan_image`, models `wan/2-7-image` (default) and `wan/2-7-image-pro`. Provider: Alibaba Wan team (Model Studio names `wan2.7-image` and `wan2.7-image-pro`). Category: image.

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

Text-to-image, image editing with up to 9 input images, sequential image sets, color palettes, and bounding-box editing. Source: `packages/core/src/tools/wan_image.ts` and https://docs.kie.ai/market/wan/2-7-image.md

## 2. Model versions

- `wan/2-7-image`: standard. Repo default.
- `wan/2-7-image-pro`: Pro. Adds 4K for text-to-image only.
- Alibaba names: `wan2.7-image` and `wan2.7-image-pro`. Source: https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
- Kie.ai's `wan/2-7-image` and Alibaba's `wan2.7-image` appear to be the same family. Mapping is inferred from the names. Unverified.

## 3. Modes

| Mode | Trigger | Notes |
| --- | --- | --- |
| Text-to-image | No `input_urls` | `aspect_ratio` applies |
| Editing | 1 to 9 `input_urls` | `aspect_ratio` is ignored when an input image is given |
| Standard set | `enable_sequential: false` | `n` 1 to 4, default 4 |
| Sequential set | `enable_sequential: true` | `n` 1 to 12, default 12 |
| Thinking mode | `thinking_mode: true` | Text-only, non-sequential, otherwise disabled |
| Color palette | `color_palette` | Non-sequential only. 3 to 10 entries, 8 recommended |
| Bounding-box edit | `bbox_list` | One inner list per input image. Max 2 boxes per image, `[x1,y1,x2,y2]` integers |

Source: https://docs.kie.ai/market/wan/2-7-image.md and https://docs.kie.ai/market/wan/2-7-image-pro.md

## 4. Key parameters and limits

| Parameter | Value | Note |
| --- | --- | --- |
| `prompt` | Required, max 5000 characters | Chinese and English |
| `input_urls` | Up to 9 images | Editing trigger |
| `aspect_ratio` | `1:1`, `16:9`, `4:3`, `21:9`, `3:4`, `9:16`, `8:1`, `1:8` | Text-to-image only |
| `resolution` | `1K`, `2K` default, `4K` on Pro only | 4K on Pro only for text-to-image, non-sequential |
| `watermark` | Default `false` | |
| `seed` | 0 to 2147483647 | |
| `nsfw_checker` | Default `false` | No extra filtering when false |
| `callBackUrl` | Optional | Recommended over polling |

Alibaba limits, for comparison: custom size 768 by 768 to 2048 by 2048 for standard, up to 4096 by 4096 on Pro text-to-image. Prompt truncated after 5000 characters. Aspect ratio 1:8 to 8:1. Source: https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference

Note: Alibaba's standard `n` default is 1. Kie.ai's default is 4. Use the Kie.ai value for this tool.

## 5. Pricing

Kie.ai, per image, billed by successful outputs (repo rate card keys on these two rates):

- `wan/2-7-image`: 4.8 credits, about $0.024. Source: https://kie.ai/wan-2-7-image
- `wan/2-7-image-pro`: 12 credits, about $0.06. Source: https://kie.ai/wan-2-7-image
- Kie.ai's example callback for 4 images at 2K in edit mode shows 19.2 credits, which matches 4 times 4.8. Source: https://docs.kie.ai/market/wan/2-7-image.md. Sample value.
- Kie.ai says high-tier top-ups with a 10 percent bonus lower the effective price about 10 percent. Source: https://kie.ai/wan-2-7-image

Alibaba Model Studio, per image (successful images only are billed):

| Model | Singapore | Beijing |
| --- | --- | --- |
| `wan2.7-image` | $0.03 | $0.027504 |
| `wan2.7-image-pro` | $0.075 | $0.068761 |

Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing

Unknown: whether a sequential set bills each image separately on Kie.ai. The doc gives no rule. The pricing check should use `n` times the per-image rate as the upper bound until verified.

## 6. Strengths

- Up to 9 references in one call.
- Clear per-image price on Kie.ai (4.8 credits standard).
- Bounding-box editing and color palettes give controls few other catalog tools expose.
- 2K default and 4K on Pro.

## 7. Weaknesses

- 4K is limited to Pro text-to-image, non-sequential.
- Sequential mode can produce 12 images in one call, so cost scales quickly.
- Thinking mode is text-only and non-sequential.
- Kie.ai does not state a rule for billing a sequential set.

## 8. Best use cases

- Multi-image editing with specific regions set by bounding boxes.
- Batches of up to 12 related images in one set.
- Brand palettes with a fixed color ratio.

## 9. Alternatives in this catalog

- `qwen_image`: up to 3 references, 1K and 2K. Kie.ai price unknown.
- `z_image`: generation only, about $0.004 per image on Kie.ai.
- `gpt_image`, `nano_banana_image`, `bytedance_seedream_image`, `flux2_image`, `flux_kontext_image`, `midjourney_generate`: other image generation and editing options.

## 10. Open questions

- Sequential billing rule on Kie.ai. Unknown.
- Whether `wan/2-7-image` on Kie.ai maps to Alibaba `wan2.7-image` exactly. Unverified.
- Official Alibaba limits for bounding boxes and palettes. Only the Kie.ai contract was checked.
- Repo `WanImageSchema` defaults were not compared line by line. Verify.
