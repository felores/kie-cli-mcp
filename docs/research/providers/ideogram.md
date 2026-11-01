---
status: draft
date: 2026-10-31
sources:
  - https://ideogram.ai/news/ideogram-4.0/
  - https://ideogram.ai/licensing/
  - https://ideogram.ai/pricing/?pricing_tab=api
  - https://ideogram.ai/legal/usage-policy/
  - https://ideogram.ai/legal/api-tos/
  - https://developer.ideogram.ai/ideogram-api/api-overview
  - https://developer.ideogram.ai/v2/api-reference/images/reframe/ideogram-3
  - https://developer.ideogram.ai/v1/api-reference/tools/reframe-v3
  - https://kie.ai/market/ideogram
  - https://kie.ai/ideogram/v3
---

# Ideogram: provider research

Scope: Ideogram as a media-generation provider, and how Kie.ai resells its models. Tool-level detail is in `docs/research/tools/ideogram_reframe.md`.

## Contents

1. Who they are
2. Product lineup for media generation
3. Strengths and weaknesses
4. Usage and content policy
5. How Kie.ai resells Ideogram
6. Open questions

## 1. Who they are

- Ideogram is an image-model research lab. Its press release says it was "Founded in 2023" and is "headquartered in Toronto and San Francisco" (source: https://ideogram.ai/news/ideogram-4.0/, read from search snippet; the page returned HTTP 403 to WebFetch).
- Ideogram 4.0 is described as "a frontier image model with open weights" released "with a commercial license" (same press release; license terms at https://ideogram.ai/licensing/, not fetched).
- Conflict: Wikipedia gives a 2022 founding year and a June 3, 2026 release date. Wikipedia is not an official source and is not used as evidence here. Founding year and release date: unverified against an official page beyond the press release.

## 2. Product lineup for media generation

Source: https://developer.ideogram.ai/ideogram-api/api-overview (v2 API, default docs).

| Capability | Model or endpoint | Notes |
|---|---|---|
| Generate | Ideogram 4.5, 4.0, 3.0, 2a, 2.0, 1.0 | Per-model endpoints under `POST /v2/image/generate/{model}`. |
| Precise edit | Ideogram 4.5 | Pixels outside the edit are "copied exactly from your image". |
| Remix and inpaint | Ideogram 4.0 remix; 3.0 inpaint | Remix and inpaint are v2 endpoints. |
| Reframe | Ideogram 3.0 | `POST /v2/image/reframe/ideogram-3`. The only reframe model listed by the official docs. |
| Replace background | Ideogram 3.0 | Same rate as generation. |
| Upscale | Topaz models, Ideogram choice | Priced per output megapixel. |
| Vector | Ideogram Vector 1 | Text-to-SVG and image-to-SVG. |
| Video | Third-party models (Seedance, MiniMax Hailuo 3, Kling) | Listed on the pricing page, billed at each provider's list rate. |
| Tools | Background remover, object remover, describe, layerize, ad resizer | Ready-made workflows. |
| Character and custom models | Custom model training and generation | Training is a paid one-time run. |

## 3. Strengths and weaknesses

Strengths (source-backed):
- Typography and text-in-image is the brand's stated focus (press release and API overview). Quality claims are vendor claims and are unverified by independent tests.
- Per-image prices are fixed and published by rendering speed. See section 5.
- Reframe is a dedicated endpoint, and the official docs describe it as expanding an image "keeping the source pixels in the center and filling the new area" (v2 reframe reference).
- Official upload limit for reframe is 25MB per image (v2 reference), larger than the 10MB limit on the Kie.ai route.

Weaknesses (source-backed):
- The official reframe endpoints listed are for 3.0 (plus a third-party Bria Expand). The lineup is larger, but no 4.x reframe endpoint appears in the official docs.
- Images and result URLs expire. The API overview says "image URLs expire, so download anything you want to keep."
- Output may be public by default. The pricing FAQ says "By default, all images on Ideogram are published", and only Plus and Pro subscribers can generate unpublished images.
- Rate limit: default 10 in-flight requests (pricing page). More needs sales contact.

## 4. Usage and content policy

Usage policy (https://ideogram.ai/legal/usage-policy/):
- Restricted: content that is "invasive of privacy or publicity rights", including "uploading images of individuals to the Services without their consent".
- Restricted: uploading copyrighted images without the owner's consent.
- Restricted: sexual content described as "obscene", "lewd", or "pornographic"; "excessively violent" content; harassment; "political campaigning or lobbying purposes".
- Restricted: presenting output as "entirely human generated" or "an actual photograph of a real event".
- The policy has no separate rule named for public figures or minors. It bans "harmful to children" content.

Developer API Agreement (https://ideogram.ai/legal/api-tos/, shows "Last revised: August 14, 2024"):
- Attribution: developers must identify output as "created by the Ideogram AI Model", for example with a "Powered by Ideogram" tagline (section 2.3.1).
- AI disclosure: developers are "encouraged to proactively disclose" AI origin (section 2.3.6(H)).
- Training: Ideogram "shall not use any User Input or User Output to train" its model, except flagged content used "to train and improve" the model (section 2.2).
- Suspension: API use "may be temporarily suspended or permanently blocked" for rate-limit or agreement breaches (section 2.2).
- Fees: changes to the pricing page take effect "fourteen (14) days after they are posted" (section 3.1).
- Output ownership: the agreement does not expressly say who owns output. Unverified beyond the pricing FAQ, which says Ideogram does "not claim ownership of your generated images".

## 5. How Kie.ai resells Ideogram

Source: https://kie.ai/market/ideogram and https://kie.ai/ideogram/v3.

- Kie.ai lists two families: Ideogram V3 (text-to-image, edit, remix, and reframe per its marketing copy) and Ideogram Character.
- Kie.ai V3 price per image, stated on its model page: 3.5 credits ($0.0175) Turbo, 7 credits ($0.035) Balanced, 10 credits (about $0.05) Quality. The page gives no separate reframe price. Reframe pricing on Kie: unknown.
- Kie.ai's credit value implied by its own numbers is $0.005 per credit. Ideogram's official pay-as-you-go rate is 1 cent per credit (pricing page). The two credit systems differ. Unverified why.
- New Kie.ai users get 80 free credits (kie.ai/ideogram/v3).
- The Kie.ai model page lists the V3 model IDs as `ideogram/v3-text-to-image`, `ideogram/v3-edit`, and `ideogram/v3-remix`. The reframe model ID appears only in the repo's own Kie doc (`docs/kie/ideogram_reframe_image.md`), not on Kie's public page.
- Kie.ai reframe requests go to `POST https://api.kie.ai/api/v1/jobs/createTask` (repo Kie doc). Parameter names differ from Ideogram's official API. See the tool doc.

## 6. Open questions

1. Kie.ai reframe price: unknown. Needs the Kie dashboard price for `ideogram/v3-reframe`, or a Kie price card for that model.
2. Whether Kie `BALANCED` maps to official `default`: unverified.
3. Whether Kie accepts the official 25MB reframe input limit: unverified (Kie doc says 10MB).
4. Ideogram founding year and 4.0 release date: unverified against an official page.
5. Commercial license terms for 4.0 weights: not fetched (https://ideogram.ai/licensing/).
6. The catalog's `marketDocs` link (https://docs.kie.ai/market-api/quickstart) returns HTTP 404. The catalog evidence link is broken.
