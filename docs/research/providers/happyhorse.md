---
status: draft
date: 2026-10-31
sources:
  - https://www.sec.gov/Archives/edgar/data/0001577552/000110465926060224/tm2614494d1_ex99-1.htm
  - https://www.alibabacloud.com/help/en/model-studio/model-pricing
  - https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference
  - https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference
  - https://docs.kie.ai/market/happyhorse-1-1/text-to-video
  - https://kie.ai/happyhorse-1-1
  - https://technode.com/2026/06/23/alibaba-unveils-happyhorse-1-1-video-generation-model-launches-global-ai-filmmaking-competition/
  - https://picsart.com/blog/happyhorse-1-1-alibaba-video-generation/
  - https://help.aliyun.com/en/model-studio/use-video-generation
---

# HappyHorse: provider research

Research date: 2026-10-31. Scope: who makes HappyHorse, the media-generation lineup, usage and content terms, and how Kie.ai resells it. Tool-level detail lives in [happyhorse_video](../tools/happyhorse_video.md).

## Table of contents

1. [Summary](#summary)
2. [Who makes it](#who-makes-it)
3. [Product lineup](#product-lineup)
4. [Strengths and weaknesses](#strengths-and-weaknesses)
5. [Usage and content policy](#usage-and-content-policy)
6. [Public pricing](#public-pricing)
7. [How Kie.ai resells it](#how-kieai-resells-it)
8. [Gaps and open questions](#gaps-and-open-questions)

## Summary

- HappyHorse is a video generation model family from Alibaba. Alibaba's own SEC filing names it as "a multimodal model for video generation".
- The model is served by Alibaba Cloud Model Studio (its own API, with regional endpoints) and by Kie.ai.
- The current version in this repo is HappyHorse 1.1 (`happyhorse-1.1`). It covers text-to-video, image-to-video, and reference-to-video.
- Kie.ai prices HappyHorse 1.1 below Alibaba's global list price at both 720p and 1080p, per the figures found (see pricing).

## Who makes it

**Verified (official):**

- Alibaba Group's Exhibit 99.1 in its FY2026 Form 6-K says: "advancing specialized models including HappyOyster ... and HappyHorse, a multimodal model for video generation." The filing is by Alibaba itself. Source: https://www.sec.gov/Archives/edgar/data/0001577552/000110465926060224/tm2614494d1_ex99-1.htm
- The API is published in Alibaba Cloud Model Studio documentation, which names Alibaba Cloud as the publisher. Sources: https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference and https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference
- Kie.ai's page describes HappyHorse-1.1 as "Alibaba's AI video generation model" and lists it in the "Alibaba API family". Source: https://kie.ai/happyhorse-1-1

**Secondary only (not verified against an official Alibaba page):**

- The unit that built it is reported as Alibaba's Future Life Lab inside Taotian Group. Source: https://picsart.com/blog/happyhorse-1-1-alibaba-video-generation/ (third-party blog). The TechNode article on the 1.1 launch does not name a division. Source: https://technode.com/2026/06/23/alibaba-unveils-happyhorse-1-1-video-generation-model-launches-global-ai-filmmaking-competition/
- Earlier reports say HappyHorse 1.0 first ranked anonymously on a video arena before Alibaba was revealed as its maker. This is third-party reporting only, and the source is not an Alibaba statement.

**Verdict:** The maker is Alibaba Group. The official confirmation is the 6-K filing and the Model Studio docs. The internal team name is unverified.

## Product lineup

Only the lineup relevant to media generation is listed.

| Model (Alibaba ID) | Modes | Status in sources |
| --- | --- | --- |
| HappyHorse 1.1 (`happyhorse-1.1-t2v`, `happyhorse-1.1-i2v`, `happyhorse-1.1-r2v`) | text-to-video, first-frame image-to-video, reference-to-video (1-9 images) | Listed in Model Studio pricing and API reference. Launch date given as June 23, 2026 by TechNode and Picsart. |
| HappyHorse 1.0 (`happyhorse-1.0-*`) | text-to-video, image-to-video, reference-to-video, video-edit (`happyhorse-1.0-video-edit`) | Listed in Model Studio pricing. Kie.ai still lists 1.0 pages and 1.0 video-edit; this repo removed 1.0 editing. |

Sources: https://www.alibabacloud.com/help/en/model-studio/model-pricing , https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference , https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference

Model names in the Model Studio API reference use a dot (`happyhorse-1.1-t2v`). Kie.ai uses a hyphen (`happyhorse-1-1/text-to-video`). Both refer to the same version by the sources checked.

## Strengths and weaknesses

**Strengths (from official pages):**

- Same parameter set across the three 1.1 modes: 720p or 1080p, 3-15 second clips, up to 9 reference images in reference mode. Source: https://www.alibabacloud.com/help/en/model-studio/happyhorse-reference-to-video-api-reference
- Clear billing: the Model Studio page says billing applies only to successful tasks, and failed requests are not billed. Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- Asynchronous task workflow with documented polling. Source: https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference

**Strengths (third-party claims, unverified):**

- Ranked high on the Artificial Analysis video arena at launch. No primary Artificial Analysis page was checked, so treat this as unverified.
- Improved motion, consistency, and prompt adherence over 1.0. Source: https://technode.com/2026/06/23/alibaba-unveils-happyhorse-1-1-video-generation-model-launches-global-ai-filmmaking-competition/ (TechNode lists the upgrade areas; it gives no metrics).

**Weaknesses:**

- Output is short: 3-15 seconds per request, per both Alibaba and Kie.ai docs.
- Results are URL-based and expire. The Alibaba `video_url` is valid for 24 hours, so output must be saved to permanent storage. Source: https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference
- Regional lock: the model, endpoint, and API key must share one region, and cross-region calls fail. Same source.
- Default output carries a watermark on the Alibaba text-to-video API. The docs say it shows "HappyHorse" in the lower-right corner and is on by default. Source: https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference
- Kie.ai does not list audio controls or seed in the current 1.1 docs. Watermark behavior on Kie.ai is unverified.

## Usage and content policy

- Alibaba's Model Studio video docs say AI-generated output in the console carries a visible "AI generated" label that cannot be turned off in the UI. The API default for Wan video models is no watermark. Source (search summary, page not fetched in full): https://help.aliyun.com/en/model-studio/use-video-generation
- The Model Studio service-specific terms say AI-generated content must be clearly labeled, and users must not remove such labels. Source: same page family, search summary only; full terms unverified.
- Alibaba disclaims warranties for generated output and says users should not rely solely on it. Source: search summary of Alibaba Cloud International Product Terms, not fetched in full: https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0
- Kie.ai marks the 1.1 page "Commercial use". The Kie.ai terms and any content rules for HappyHorse were not fetched. Source: https://kie.ai/happyhorse-1-1
- Unverified: whether HappyHorse-specific content restrictions exist beyond the general Alibaba terms.

## Public pricing

All Alibaba prices are USD per second of output, from the Model Studio pricing page (last updated Oct 29, 2026 per the page). Source: https://www.alibabacloud.com/help/en/model-studio/model-pricing

| Model | Resolution | Singapore (international) | China (Beijing) | Global (Germany, US, Japan) |
| --- | --- | --- | --- | --- |
| happyhorse-1.1 (t2v, i2v, r2v) | 480P | $0.07 | $0.0618845 | $0.0618845 |
| happyhorse-1.1 | 720P | $0.14 | $0.123769 | $0.123769 |
| happyhorse-1.1 | 1080P | $0.18 | $0.165026 | $0.165026 |
| happyhorse-1.0 (t2v, i2v, r2v) | 720P | $0.14 | $0.123769 | $0.123769 (Germany, US only) |
| happyhorse-1.0 | 1080P | $0.24 | $0.220034 | $0.220034 (Germany, US only) |

- Singapore gives 10 free seconds per 1.1 mode. Same source.
- Chinese-yuan (CNY) prices: unverified. A search summary cited help.aliyun.com with 0.9 CNY/s for 720P and 1.6 CNY/s for 1080P, but the page was not fetched.

Kie.ai public price: 22.5 credits per second ($0.1125) at 720p, and 29 credits per second ($0.145) at 1080p. The Kie.ai page says top-ups above a tier include +10% bonus credits, which makes the effective price about 10% lower. Source: https://kie.ai/happyhorse-1-1 . The docs.kie.ai pages checked do not list prices.

## How Kie.ai resells it

- Kie.ai exposes HappyHorse 1.1 through its own job API: `POST /api/v1/jobs/createTask`, with model IDs `happyhorse-1-1/text-to-video`, `happyhorse-1-1/image-to-video`, and `happyhorse-1-1/reference-to-video`. Polling is via the Kie task-detail endpoint. Source: https://docs.kie.ai/market/happyhorse-1-1/text-to-video
- Kie.ai's text-to-video doc lists `callBackUrl` as optional. Source: same page. The repo's `docs/kie/happyhorse_1-1.md` says the request schema does not list `callBackUrl`. That claim now disagrees with the current docs.
- Kie.ai's HappyHorse pages list 720p and 1080p only. The Alibaba API also accepts 480P. Sources: https://docs.kie.ai/market/happyhorse-1-1/text-to-video and https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference
- Kie.ai's text-to-video doc gives aspect ratios 16:9, 9:16, 1:1, 4:3, 3:4, 4:5, 5:4, 9:21, 21:9.
- Kie.ai's market index lists HappyHorse 1.0 and 1.1 entries and their reference pages. Source: https://kie.ai/market (no prices shown there).
- Kie.ai does not show the upstream provider path. It says the model is "Alibaba's", but whether its calls route to Alibaba Cloud endpoints is unverified.

## Gaps and open questions

- Kie.ai pricing for text-to-video and image-to-video is not shown separately. The one pricing line found appears on the reference-to-video view, which lists all three modes.
- Kie.ai watermark behavior: unverified.
- Kie.ai `callBackUrl`: current docs say optional, repo doc says absent. Needs a code or test check, not a guess.
- Kie.ai aspect ratios: docs page lists 9 values, repo doc lists 6. The Zod schema in `packages/core/src/types.ts` accepts 9.
- Alibaba image-to-video API page could not be fetched in this session (rate limit). Its parameters rely on search summary.
- Alibaba CNY pricing: unverified.
- Full content policy text: unverified.
- Benchmark claims (Artificial Analysis rank, Elo values): reported by third parties only, and sources disagree.
- Whether the Future Life Lab attribution is correct: third-party only.
