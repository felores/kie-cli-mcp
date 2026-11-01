---
status: draft
date: 2026-10-31
sources:
  - https://www.alibabagroup.com/en-US/about-alibaba
  - https://qwenlm.github.io/blog/qwen-image/
  - https://github.com/Tongyi-MAI/Z-Image
  - https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - https://www.alibabacloud.com/help/en/model-studio/data-retention-policy
  - https://docs.kie.ai/market/qwen3/text-to-image.md
  - https://docs.kie.ai/market/z-image/z-image.md
  - https://docs.kie.ai/market/wan/3-0-video.md
  - https://docs.kie.ai/market/wan/2-7-image.md
  - https://docs.kie.ai/market/wan/2-2-animate-move.md
  - https://kie.ai/pricing
---

# Alibaba (Qwen, Tongyi-MAI, Wan teams)

Slug: `alibaba`. Catalog tools: `qwen_image`, `z_image`, `wan_video`, `wan_image`, `wan_animate`.

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths and weaknesses
4. Usage and content policy
5. How Kie.ai resells it
6. Open questions and gaps

## 1. Who they are

- Alibaba Group describes itself as "a global technology company focused on AI + Cloud and commerce." Its AI and cloud units include Alibaba Cloud and the Qwen family of AI models. Source: https://www.alibabagroup.com/en-US/about-alibaba
- The group was founded in 1999 by Jack Ma. The headquarters location is not stated on the page used here. Headquarters: unverified.
- The three teams in this catalog are the Qwen team (image models named Qwen-Image), the Tongyi-MAI team (Z-Image), and the Wan team (video and image models). The Wan and Tongyi-MAI team names come from the catalog brief. The official pages checked name the models, not the teams in detail.
- Alibaba Cloud Model Studio is the official API surface for these models. Source: https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference

## 2. Product lineup for media generation

| Family | Official model names seen | Modes | Source |
| --- | --- | --- | --- |
| Qwen-Image | Qwen-Image 1.0 (Aug 2025, 20B); later versions listed on Model Studio pricing (qwen-image-3.0, qwen-image-3.0-pro, qwen-image-2.0, qwen-image-2.1-pro, qwen-image-2.1-turbo) | Generation, editing, text rendering | https://qwenlm.github.io/blog/qwen-image/ ; https://www.alibabacloud.com/help/en/model-studio/model-pricing |
| Z-Image | Z-Image (Jan 27, 2026, 6B, Apache-2.0); Z-Image-Turbo (Nov 26, 2025, 8 steps); Model Studio name z-image-turbo | Generation. Z-Image-Edit weights listed "To be released" | https://github.com/Tongyi-MAI/Z-Image |
| Wan 2.7 Image | wan2.7-image, wan2.7-image-pro | Text-to-image, image sets, editing, bounding-box editing, multi-reference | https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference |
| Wan 3.0 Video | wan3.0-video, wan3.0-video-prime | Text, images, audio, video, documents, web pages to video. Up to 30 seconds, 1080p | https://www.alibabacloud.com/help/en/model-studio/model-pricing (prices); mode and limit details from Kie.ai, see tool docs |
| Wan 2.2 Animate | Animate and replace variants | Motion transfer and character replacement | Kie.ai pricing lists a starting price. Alibaba pricing page does not list it in the part read. |

The Qwen3 name used by Kie.ai (`qwen3`) does not appear as an Alibaba image model name on the Model Studio pricing page read. Mapping is unverified. See the tool doc for `qwen_image`.

## 3. Strengths and weaknesses

Strengths, from official sources:

- Qwen-Image is described by its official post as strong at text rendering in both alphabetic and logographic languages, with English and Chinese in one image. Source: https://qwenlm.github.io/blog/qwen-image/
- Z-Image is described on its GitHub page as a 6B model under Apache-2.0 with a Turbo variant at 8 steps. Source: https://github.com/Tongyi-MAI/Z-Image
- Wan 2.7 Image Model Studio docs list many modes in one API: text-to-image, image sets, editing, bounding boxes, and multi-reference. Source: https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference
- Alibaba publishes per-unit prices per model on Model Studio, which makes cost checks possible. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing

Weaknesses and limits:

- Wan 3.0 is not open-weight. Secondary reports say the open Wan line stops at Wan 2.2 under Apache-2.0. Official confirmation: unverified.
- Qwen-Image 3.0 is reported as shipping without open weights or a technical report. Source for this: secondary reporting only. Unverified.
- Z-Image-Edit is not released yet per the GitHub page. Source: https://github.com/Tongyi-MAI/Z-Image
- Model names differ between Alibaba and Kie.ai (for example `z-image-turbo` on Alibaba, `z-image` on Kie.ai). Mapping must be checked per model.
- Some Kie.ai docs and Alibaba docs disagree on limits. See each tool doc.

## 4. Usage and content policy

- Alibaba Model Studio runs content-safety moderation inline with inference. The data retention page says no switch fully turns off these guardrails, and that enabling zero data retention does not bypass moderation. Source: https://www.alibabacloud.com/help/en/model-studio/data-retention-policy (read from search snippet, not the full page; verify before relying on it).
- Flagged content is kept for no longer than 2 years under the privacy policy, per the Japanese version of the same page. Snippet only; unverified for the English page.
- Model Studio offers an optional guardrails add-on that checks inputs and outputs. Blocked calls return a `DataInspectionFailed` error. Source: search snippet; the guardrails page itself was not read. Unverified in full.
- Customers must make sure end users follow the Model Studio usage policy. The list of prohibited content categories was not read. Usage policy categories: unverified.
- Kie.ai exposes `nsfw_checker`, default `false`, on the Qwen, Z-Image, and Wan endpoints. Kie.ai says that when false, no extra filtering is applied. Source: each Kie.ai doc listed in the tool docs.

## 5. How Kie.ai resells it

- Kie.ai exposes these models through one unified task API: `POST https://api.kie.ai/api/v1/jobs/createTask` and task polling. Source: https://docs.kie.ai/market/wan/3-0-video.md
- Kie.ai bills in credits. Its pricing page uses 1 credit about 0.005 USD. Source: https://kie.ai/pricing
- Kie.ai's Wan 3.0 page says its rates are 20 percent below official pricing, and that top-ups with a 10 percent bonus lower the effective price further. Source: https://kie.ai/wan3.0-video
- Failed tasks consume no credits on the Kie.ai callback examples. Source: each Kie.ai doc.
- Kie.ai prices differ from Alibaba prices per model. See the price table in each tool doc.

## 6. Open questions and gaps

- The Alibaba Wan 3.0 official launch post and API reference were not fetched in full. Launch date and limits come from search snippets and secondary press. Unverified.
- Alibaba's usage policy list of prohibited content: not read. Unverified.
- Whether Kie.ai `qwen3` routes to a specific Alibaba Qwen-Image version: unknown.
- Kie.ai price for `qwen3` and `qwen3-pro`: unknown. The Kie.ai pricing page lists "Qwen image 3.0" but the mapping to `qwen3` is unverified.
- Alibaba pages list Singapore and Beijing prices. The Kie.ai pricing basis is not stated per region. Unknown.
