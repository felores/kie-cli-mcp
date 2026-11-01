---
status: draft
date: 2026-10-31
sources:
  - https://www.minimax.io/
  - https://www.minimax.io/blog/minimax-h3
  - https://www.minimax.io/terms
  - https://platform.minimax.io/docs/guides/pricing-paygo
  - https://platform.minimax.io/docs/guides/video-generation
  - https://docs.kie.ai/llms.txt
  - https://docs.kie.ai/market/minimax-h3/text-to-video.md
  - https://docs.kie.ai/market/minimax-h3/image-to-video.md
  - https://docs.kie.ai/market/minimax-h3/reference-to-video.md
  - https://kie.ai/minimax-h3
  - https://kie.ai/pricing
---

# MiniMax (Hailuo)

Provider slug: `minimax`. Catalog tool: `hailuo_video` (model `minimax-h3`).

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths and weaknesses
4. Usage and content policy
5. How Kie.ai resells it
6. Open questions

## 1. Who they are

- MiniMax describes itself as "A World-Leading General AI Technology Company." Its stated mission is "Intelligence with Everyone" ([minimax.io](https://www.minimax.io/)).
- It builds proprietary foundation models for text and multimodal tasks, plus AI-native products and an open platform for developers and enterprises ([minimax.io](https://www.minimax.io/)).
- Founding date and headquarters: unverified. The homepage does not state them.
- Hailuo is the name of its video line and of its consumer app. The H3 blog says a demo is at hailuoai.video ([MiniMax H3 blog](https://www.minimax.io/blog/minimax-h3)). The H3 teaser used the name "Hailuo 03" (unverified beyond third-party reports).

## 2. Product lineup for media generation

| Product | Status per official source | Source |
|---|---|---|
| MiniMax H3 (video with native stereo audio) | Launched, dated 2026-07-31 | [MiniMax H3 blog](https://www.minimax.io/blog/minimax-h3), [minimax.io](https://www.minimax.io/) |
| Hailuo 2.3, Hailuo 2.3-Fast, Hailuo 02 | Listed as pay-as-you-go models | [pricing](https://platform.minimax.io/docs/guides/pricing-paygo) |
| Speech 2.8, Music 3.0 | Announced on homepage | [minimax.io](https://www.minimax.io/) |
| H3-Highspeed, H3-Lite, H3-Max | Listed in pricing as H3 variants | [pricing](https://platform.minimax.io/docs/guides/pricing-paygo) |

Notes:

- The H3 blog describes text-to-image and text-to-audio as part of pretraining, but the public pricing page lists only video rows. Whether image or standalone audio output is sold: unverified.
- The H3 variants Highspeed, Lite and Max are in the official price table. Only the standard H3 is wired in this repository (see the tool document).
- Kie.ai sells only the standard `minimax-h3` family in this catalog.

## 3. Strengths and weaknesses

Strengths (from official sources):

- Generates video with a stereo audio track. The blog says audio is "jointly modeled" for voice, sound effects and music ([blog](https://www.minimax.io/blog/minimax-h3)).
- Supports 2K output, up to 15 seconds ([blog](https://www.minimax.io/blog/minimax-h3), [video docs](https://platform.minimax.io/docs/guides/video-generation)).
- Accepts text, first and last frames, and mixed reference images, videos and audio in one model ([video docs](https://platform.minimax.io/docs/guides/video-generation)).
- Official price table is per second and split by resolution ([pricing](https://platform.minimax.io/docs/guides/pricing-paygo)).
- The blog claims "industry-leading price-performance" and "less than a third of mainstream models" at 2K. These are vendor claims. No comparison models or absolute prices are named, so they are not verified.

Weaknesses (stated by the vendor or visible in the docs):

- The blog says visual detail "can still be improved in certain scenarios," and that model size and multimodal understanding have "significant room to improve" ([blog](https://www.minimax.io/blog/minimax-h3)).
- No benchmark scores are published on the blog. The technical report is promised "soon" ([blog](https://www.minimax.io/blog/minimax-h3)).
- Audio cannot be turned off ([Kie text-to-video docs](https://docs.kie.ai/market/minimax-h3/text-to-video.md)).
- Video Packages do not support H3 yet ([pricing](https://platform.minimax.io/docs/guides/pricing-paygo)).
- Open weights: the blog says MiniMax plans to open weights "in the coming days, subject to applicable laws and regulations," with no license or download location named. A later release status: unverified (IR page not fetched directly).

## 4. Usage and content policy

- The H3 blog contains no content policy, moderation, or safety statement. Its only constraint is the weights caveat above ([blog](https://www.minimax.io/blog/minimax-h3)).
- The video docs state no content or usage policy ([video docs](https://platform.minimax.io/docs/guides/video-generation)).
- The terms page at `minimax.io/terms` was fetched and contains no usage-policy text in the extracted result. The policy text itself: unverified.
- Prohibited categories (deepfakes, real people, minors, violence): unverified.
- Kie.ai lists the model as "Commercial use" and links to its own Terms of Use, Privacy Policy and Refund Policy ([kie.ai/minimax-h3](https://kie.ai/minimax-h3)). Those pages were not fetched in this pass.

## 5. How Kie.ai resells it

Kie.ai resells the H3 family at roughly half the official per-second rate, as stated on its model page: "50% of the official price." The official figures match that claim.

| Item | MiniMax official (USD) | Kie.ai (USD, as listed) | Kie.ai (credits) |
|---|---|---|---|
| Output, 768P | $0.08/s | $0.04/s | 8 credits/s |
| Output, 2K | $0.13/s | $0.065/s | 13 credits/s |
| Input video (per s) | $0.08/s (768P), $0.13/s (2K) | Billed at the same per-second rate, added to output | Same |
| Extra image beyond free quota | $0.04/image | $0.02/image | 4 credits/image |
| Free images per task | First 5 | First 5 | First 5 |
| Audio input | Free | Free | Free |

- Kie.ai credit rate: "1 credit ≈ $0.005" ([kie.ai/pricing](https://kie.ai/pricing)).
- Official table source: [pricing-paygo](https://platform.minimax.io/docs/guides/pricing-paygo). It states all prices are in USD and does not give a date.
- Kie.ai model page for the top-up tiers: "approximately 90% of the listed price" for high-tier top-ups ([kie.ai/minimax-h3](https://kie.ai/minimax-h3)). The effective rate for each tier: unverified.
- Kie.ai's `kie.ai/pricing` page shows only "from $0.02 per image" for H3 and does not list per-second prices. The per-second values come from the model page.
- Third-party aggregators quote other MiniMax prices (for example a flat $0.08/s). They conflict with the official table and were not used.

## 6. Open questions

1. Official pricing table has no effective date. Confirm current rates before budgeting.
2. Whether MiniMax publishes an acceptable-use policy for H3 outputs. None found.
3. Whether the open weights were released and under which license. Blog says "in the coming days." Status: unverified.
4. Whether `minimax.io/blog` and `platform.minimax.io` have an H3 API changelog after 2026-07-31. Not checked.
5. Founding year and headquarters. Not verified.
