---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/runway-api/quickstart
  - https://docs.kie.ai/runway-api/generate-aleph-video
  - https://kie.ai/runway
  - https://kie.ai/runway-api
  - https://docs.dev.runwayml.com/guides/models/
  - https://docs.dev.runwayml.com/api-details/api_changelog/
  - https://runway.com/pricing
  - https://runway.com/about
  - https://runway.com/news/introducing-aleph-2-and-edit-studio
  - https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio
  - https://runway.com/terms-of-use
---

# Runway (provider research)

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths and weaknesses
4. Usage and content policy
5. How Kie.ai resells Runway
6. Open questions

## 1. Who they are

- Runway is an AI media company. Its stated mission is "to simulate the world through merging art and science." Source: https://runway.com/about
- Offices listed: New York, San Francisco, Seattle, London, Paris, Tel Aviv and Tokyo. Source: https://runway.com/about
- Founding year, headquarters and leadership: unverified. The About page did not state them.

## 2. Product lineup for media generation

Model list from the Runway Dev model guide. Prices are USD per second as shown on the cards. Source: https://docs.dev.runwayml.com/guides/models/

| Model (ID) | Mode | Price shown | Released |
|---|---|---|---|
| Aleph 2.0 (`aleph2`) | Video-to-video editing | $0.28/sec | 2026-06-02 |
| Gen-4.5 (`gen4.5`) | Text-to-video, image-to-video | $0.12/sec | 2026-02-10 |
| Gen-4 Turbo (`gen4_turbo`) | Image-to-video | $0.05/sec | 2025-04-04 |
| Act-Two (`act_two`) | Character performance | $0.05/sec | 2025-07-21 |

Retirements and aliases from the Runway API changelog. Source: https://docs.dev.runwayml.com/api-details/api_changelog/

- Gen-4 Aleph (`gen4_aleph`) is no longer available on Runway Dev as of 2026-07-30. Migrate to `aleph2`.
- `aleph2_alpha` remains as a deprecated alias. No retirement date was found.
- 2026-08-20: `sdr_rec709_10bit` output added for Aleph 2.0. HDR delivery goes through `/v1/video_to_hdr`.

Plans on the Runway pricing page (annual billing, USD). Source: https://runway.com/pricing

| Plan | Monthly price | Included credits |
|---|---|---|
| Free | $0 | 125 one-time |
| Standard | $12 (list $15) | 625/mo |
| Pro | $28 (list $35) | 2,250/mo |
| Max | $76 (list $95) | 9,500/mo |

Monthly-billing prices: unverified. Runway lists Aleph 2.0 at 140 credits per 5 seconds, which is 28 credits per second. Source: https://runway.com/pricing

## 3. Strengths and weaknesses

Strengths (per Runway's own pages):

- Aleph 2.0 edits existing footage and keeps unrelated parts unchanged. It can apply one edit across several shots. Source: https://runway.com/news/introducing-aleph-2-and-edit-studio
- It takes image-level control: a reference frame guides the edit. Source: https://runway.com/news/introducing-aleph-2-and-edit-studio
- Public, per-second USD prices exist for each model on the model guide. Source: https://docs.dev.runwayml.com/guides/models/

Weaknesses and limits:

- Aleph 2.0 input is 2 to 30 seconds, 480p to 1080p, with at most 10 cuts. Conventional aspect ratios only. Source: https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio
- Runway's pricing sources disagree on Aleph 2.0 cost. The Help Center gives a flat 28 credits per second with a 56-credit minimum. A third-party search summary of the Academy page adds input-based fees per second of input video (480p 10, 720p 15, 1080p 34). The Academy page was not fetched directly. Treat the cost as unverified until resolved.
- Aleph 2.0 is for paid plans. Credit purchase is not available on the Free plan. Source: https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio
- Older Aleph is gone from Runway Dev. Code that sends `gen4_aleph` fails.

## 4. Usage and content policy

Source: https://runway.com/terms-of-use (last updated 2026-10-23, per the page).

- Content may not contain nudity, violence, sexually explicit, dangerous, hateful, harassing or fraudulent material.
- Users may not post a photograph of another person without that person's permission.
- Apps may not impersonate any person, organization or brand in a way likely to mislead.
- Users must be 13 or older. Users under 18 need parental permission. Apps may not be directed to children under 18.
- Violations can lead to suspension or termination.
- The terms point to a separate Usage Policy at runway.com/safety/usage-policy. That page was not reachable in this research. Rules on AI-generated likeness of real people: unverified.

## 5. How Kie.ai resells Runway

- Kie.ai's Runway Aleph endpoint is marked deprecated. Its page says: "Runway Aleph is no longer available on Kie AI." Source: https://docs.kie.ai/runway-api/generate-aleph-video
- Kie.ai's Runway landing page lists only one Runway model, a video extend tool on Gen-4 Turbo. Prices: 720p 12 credits (about $0.06) and 1080p 30 credits (about $0.15) per video. Source: https://kie.ai/runway
- The Kie.ai Runway API overview page lists no Aleph model. Source: https://kie.ai/runway-api
- The Kie.ai quickstart that this catalog cites (https://docs.kie.ai/runway-api/quickstart) returned HTTP 404 during this research.

## 6. Open questions

- Is Runway Aleph still sold on Kie.ai? The Kie.ai doc says no, but the catalog entry `runway_aleph_video` is `status: "active"`. Decision needed: deprecate the catalog entry, or confirm the doc is stale.
- Kie.ai price for any Runway model used by this repo: unknown.
- Which Aleph 2.0 cost is correct (flat 28 credits per second, or input-based fees)? Unverified until the Academy page is read directly.
- Founding year, headquarters and leadership: unverified.
