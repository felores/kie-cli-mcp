---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/qwen3/text-to-image.md
  - https://docs.kie.ai/market/qwen3/image-to-image.md
  - https://docs.kie.ai/market/qwen3/pro-text-to-image (returned 404 on fetch)
  - https://kie.ai/pricing
  - https://kie.ai/qwen-image-2
  - https://qwenlm.github.io/blog/qwen-image/
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
  - /Users/felo/Documents/GitHub/kie-cli-mcp/docs/kie/qwen3_image.md
  - /Users/felo/Documents/GitHub/kie-cli-mcp/packages/core/src/types.ts
---

# qwen_image

Catalog entry: `qwen_image`, model `qwen3`. Provider: Alibaba. Category: image.

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

Text-to-image generation and image editing with up to 3 reference images. The tool picks the mode from the presence of `image_urls`. Source: `packages/core/src/tools/qwen_image.ts` and https://docs.kie.ai/market/qwen3/text-to-image.md

## 2. Model versions

- `qwen3` (default) and `qwen3-pro` (Pro). Kie.ai endpoints: `qwen3/text-to-image`, `qwen3/image-to-image`, and `qwen3/pro-text-to-image` and `qwen3/pro-image-to-image`.
- The Pro endpoint pages could not be read. `docs.kie.ai/market/qwen3/pro-text-to-image` returned 404 without the `.md` suffix, and with the `.md` suffix the page returned empty. Pro contract: unverified.
- Alibaba does not list a model named `qwen3` for images on its Model Studio pricing page. The Alibaba image models are `qwen-image-3.0`, `qwen-image-3.0-pro`, `qwen-image-2.0`, `qwen-image-2.0-pro`, `qwen-image-2.1-pro`, and `qwen-image-2.1-turbo`. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Which Alibaba version `qwen3` maps to is unknown.
- Kie.ai's `qwen-image-2` page is a separate model (`qwen2/text-to-image`, `qwen2/image-edit`). It is not `qwen3`. Source: https://kie.ai/qwen-image-2

## 3. Modes

| Mode | Trigger | Endpoint |
| --- | --- | --- |
| Text-to-image | No `image_urls` | `qwen3/text-to-image` or Pro |
| Image editing | 1 to 3 `image_urls` | `qwen3/image-to-image` or Pro |

Source: https://docs.kie.ai/market/qwen3/image-to-image.md

## 4. Key parameters and limits

| Parameter | Kie.ai doc | Repo schema | Note |
| --- | --- | --- | --- |
| `prompt` | Required, 1 to 5000 characters | 1 to 5000 | Chinese and English |
| `image_urls` | 1 to 3, JPEG, PNG, WebP, BMP, GIF, TIFF, max 10 MB each | 1 to 3 URLs | Editing only |
| `resolution` | `1K` or `2K`, no default stated | `1K` default | Repo default differs from doc |
| `image_size` | Default `16:9`. 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9 | Same | |
| `output_format` | `png` or `jpeg`, "set explicitly" | `png` default | |
| `prompt_extend` | Default `true` (prompt rewriting) | Not confirmed in read | |
| `negative_prompt` | 0 to 5000 characters | Not confirmed in read | |
| `seed` | 0 to 2147483647 | Not confirmed in read | |
| `nsfw_checker` | Default `false` | Not confirmed in read | |
| `callBackUrl` | Optional | Env fallback `KIE_AI_CALLBACK_URL` | |

Repo rejects old fields (`image_url`, inference steps, guidance, acceleration, safety checker, sync mode). Source: `docs/kie/qwen3_image.md` in this repo.

## 5. Pricing

- Kie.ai (qwen3 and qwen3-pro): the official doc states no price. Unknown.
- Kie.ai pricing page lists "Qwen image" from $0.02 per megapixel and "Qwen image 3.0 and 3.0 Pro" from $0.0025 per image. Mapping to `qwen3` is unverified, so not used. Source: https://kie.ai/pricing
- Alibaba (per image, Singapore): `qwen-image-3.0` $0.03 at 1K and 2K, plus input at $0.003. `qwen-image-3.0-pro` $0.04 at 1K and $0.075 at 2K. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Alibaba (per image, Beijing): `qwen-image-3.0` $0.024754 at 1K and 2K. `qwen-image-3.0-pro` $0.03438 at 1K and $0.068761 at 2K.

## 6. Strengths

- Text rendering in English and Chinese. Source: https://qwenlm.github.io/blog/qwen-image/ (describes Qwen-Image 1.0).
- Multi-reference editing with up to 3 images.
- Simple schema: one tool switches mode.

## 7. Weaknesses

- Pro contract and `qwen3` price are not verified.
- Prompt rewriting is on by default, which can change the output from the literal prompt. The OpenAI adapter disables it in this repo.
- 2K is the top resolution. No 4K.
- Version identity (which Alibaba model `qwen3` is) is unknown.

## 8. Best use cases

- Image edits that combine up to 3 references.
- Text-heavy images with mixed English and Chinese text.

## 9. Alternatives in this catalog

- `z_image`: photorealistic generation, 1 to 5000 characters, aspect ratios only, Kie price 0.8 credits per image (about $0.004).
- `wan_image`: up to 9 references, 4K on Pro, bounding-box editing. Kie price 4.8 credits (about $0.024) per image for standard.
- `gpt_image`, `nano_banana_image`, `bytedance_seedream_image`, `flux2_image`, `flux_kontext_image`: other generation and editing options.

## 10. Open questions

- Which Alibaba model is `qwen3`, and which is `qwen3-pro`? Unverified.
- Kie.ai price for `qwen3` and `qwen3-pro`. Unknown.
- Pro endpoint contract. Unverified.
- Repo default for `resolution` (1K) is not stated in the Kie doc. Confirm with Kie.ai.
- Whether `nsfw_checker` is the only filter on Kie.ai for this model. Kie.ai's default is off.
