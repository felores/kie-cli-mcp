---
status: draft
date: 2026-10-31
sources:
  - https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service
  - https://docs.midjourney.com/hc/en-us/articles/32013696484109-Community-Guidelines
  - https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans
  - https://docs.midjourney.com/hc/en-us/articles/32016412137741-GPU-Speed-Fast-Relax-Turbo
  - https://docs.midjourney.com/hc/en-us/articles/37460773864589-Video
  - https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version
  - https://docs.midjourney.com/hc/en-us/articles/27870375276557-Using-Images-Videos-Commercially
  - https://www.midjourney.com/
  - https://kie.ai/market
  - https://kie.ai/pricing
  - https://docs.kie.ai/market-api/quickstart
  - https://docs.kie.ai/mj-api/generate-mj-image
---

# Midjourney (provider research)

## Contents

1. Summary
2. Who they are
3. Product lineup for media generation
4. Strengths and weaknesses
5. Usage and content policy
6. How Kie.ai resells Midjourney
7. Gaps and open questions

## 1. Summary

Midjourney is a subscription image and video generator. Its official product is the web app, the Discord bot, and subscriptions. It does not publish an official public API. Kie.ai offers a third-party "Midjourney API" that wraps Midjourney models. Whether that resale fits Midjourney's terms is the main open risk for this catalog entry (see section 5).

## 2. Who they are

- Midjourney describes its service through its official site and docs. The site at https://www.midjourney.com/ returned HTTP 403 to automated fetches, so its own wording is unverified here.
- Official docs live at https://docs.midjourney.com/. Automated fetches of these pages also returned HTTP 403. The facts below come from search-engine snippets of official URLs and are marked as such.
- Version status (search snippet of the official Version page): the current default model is V8.2, which became default on July 24, 2026. Source: https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version

## 3. Product lineup for media generation

| Capability | Official status | Source |
|---|---|---|
| Text to image | Core product, all plans | https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans (snippet) |
| Image to video | Video of about 5 seconds per job (snippet). Fast mode on all plans. | https://docs.midjourney.com/hc/en-us/articles/37460773864589-Video (snippet) |
| HD video | Listed as a mode in the tool and Kie docs. Official HD details unverified. | https://docs.kie.ai/mj-api/generate-mj-image |
| Relax video | Pro and Mega tiers only, SD resolution only (snippet) | https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans (snippet) |
| Style and omni reference | Listed by Kie.ai. Official wording unverified. | https://docs.kie.ai/mj-api/generate-mj-image |

Speed tiers (Fast, Relax, Turbo) are described on the GPU Speed page. Snippet-level detail only: https://docs.midjourney.com/hc/en-us/articles/32016412137741-GPU-Speed-Fast-Relax-Turbo

## 4. Strengths and weaknesses

Strengths
- Model line is current: V8.2 is the default per the official Version page (snippet). Output quality is not assessed here (unverified).
- Relax mode gives unlimited image generation on Standard and higher tiers (snippet of the plans comparison).
- Video generation exists in the same product family as image generation.

Weaknesses
- No official public API (snippet of the Terms summary; search results from official-domain pages state no public API).
- Relax video is SD only and limited to Pro and Mega (snippet).
- Generation is priced by GPU time, not by image. Cost per job is not a fixed price (snippet).
- Kie.ai's own docs say generated image URLs are kept for 15 days (https://docs.kie.ai/mj-api/generate-mj-image, repo copy in `docs/kie/midjourney_generate.md`).

## 5. Usage and content policy

- Terms of Service (snippet, version effective May 27, 2026 per the search summary): users own their assets with exceptions. Larger companies need Pro or Mega to own assets. Content is public and remixable by default unless Stealth is bought on Pro or Mega.
- Community Guidelines (snippet): content must be safe for work. Gore, adult content, political campaign imagery, deception, and sexualized deepfakes of real people are restricted.
- Automation (snippet of Terms and Guidelines): automated tools and third-party apps are banned, and Midjourney offers no public API. Source: https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service

Risk: Kie.ai sells programmatic access to Midjourney. On the snippet reading above, that conflicts with the ban on automated tools and third-party apps. This document does not decide legal status. Verify the full Terms text before relying on the Kie route for production use.

Commercial use: the snippet of "Using Images & Videos Commercially" was not read in full. Unverified.

## 6. How Kie.ai resells Midjourney

- Kie.ai's market lists Midjourney as a provider filter. No Midjourney model card or price was visible in the fetched market page. Source: https://kie.ai/market
- Kie.ai's Midjourney docs describe task types (`mj_txt2img`, `mj_img2img`, `mj_video`, and others), speeds, versions, a 15-day retention window, and status codes 402 and 429. Source: https://docs.kie.ai/mj-api/generate-mj-image (the live page returned empty text on fetch; the repo copy in `docs/kie/midjourney_generate.md` is the captured version).
- Kie.ai credit value: "Each credit is valued at $0.005 USD." Source: https://kie.ai/pricing (embedded page data).
- Per-task Midjourney credit cost on Kie.ai: unknown.

## 7. Gaps and open questions

1. Midjourney official plan page, terms, and docs could not be fetched (HTTP 403). All official facts above are snippet-level. Re-check with a browser before approval.
2. Kie.ai Midjourney price per task: unknown.
3. Kie.ai docs page text was empty on fetch. Parameter list is taken from the repo copy in `docs/kie/`.
4. Whether Kie.ai's route is permitted under Midjourney's terms: needs a human or legal read.
