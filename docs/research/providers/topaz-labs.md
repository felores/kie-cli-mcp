---
status: draft
date: 2026-10-31
sources:
  - https://www.topazlabs.com/
  - https://www.topazlabs.com/api
  - https://www.topazlabs.com/enterprise
  - https://developer.topazlabs.com/overview.md
  - https://kie.ai/market/topaz
  - https://kie.ai/topaz-image-upscale
  - https://kie.ai/pricing
  - https://kie.ai/terms-of-use
  - https://docs.kie.ai/market/topaz/image-upscale
---

# Topaz Labs

Provider research for the `topaz-labs` slug. Scope: media generation and enhancement, as used through Kie.ai in this repository.

## Table of contents

1. Who they are
2. Product lineup relevant to media
3. Developer API (Topaz direct)
4. How Kie.ai resells Topaz
5. Strengths
6. Weaknesses
7. Usage and content policy
8. Open questions

## 1. Who they are

- Topaz Labs is a software company that makes AI image and video enhancement tools. Source: https://www.topazlabs.com/
- The homepage structured data lists founding in 2005, Addison, Texas as founding location, and Dallas, Texas as address. Source: https://www.topazlabs.com/
- The homepage claims "over 2 billion images processed" and "over 1 million" photographers and filmmakers as users. These are company claims, not independently verified. Source: https://www.topazlabs.com/
- The homepage also states "Emmy Award winning technology." Company claim, unverified. Source: https://www.topazlabs.com/

## 2. Product lineup relevant to media

Desktop and web products named on the homepage (source: https://www.topazlabs.com/):

| Product | Type | Stated focus |
|---|---|---|
| Topaz Studio | Bundle | Bundle of company apps |
| Topaz Video | Desktop, local or cloud | Video enhancement |
| Topaz Photo | Desktop | Image enhancement for photographers |
| Topaz Gigapixel | Desktop | Image upscaling, "up to 16x pixels" |
| Topaz for Web, Video | Browser, cloud | Video upscaling and enhancement |
| Topaz for Web, Image | Browser, cloud | Image enhancement |
| Topaz for Mobile | iPhone app | AI models and workflows |

Stated capabilities across the lineup: upscaling, denoising, sharpening, unblurring, face enhancement, lighting adjustment, photo restoration, frame interpolation, slow motion, SDR-to-HDR conversion, and stabilization. Source: https://www.topazlabs.com/

Model names listed on the developer overview:
- Video: Starlight Precise 2.6, Starlight Fast 3, Hyperion 2.5, Proteus. Source: https://developer.topazlabs.com/overview.md
- Image: Wonder 3.5, Bloom 2, Denoise Max, Standard 2. Source: https://developer.topazlabs.com/overview.md

## 3. Developer API (Topaz direct)

- The API page says it covers "Topaz Photo, Video, and Gigapixel APIs." Source: https://www.topazlabs.com/api
- Access is self-serve (a "Start now" registration path) or enterprise (contact sales). Source: https://www.topazlabs.com/api
- Plans listed on the API page:
  - Developer: $50/mo, 500 credits/mo, $0.10 per credit, credits carry over. Source: https://www.topazlabs.com/api
  - Scale: $240/mo, 3,000 credits/mo, $0.08 per credit. Source: https://www.topazlabs.com/api
  - Enterprise: no public price ("Let's talk"). Source: https://www.topazlabs.com/api
- The API page gives a credit table for the Enhance endpoint, with one credit up to 24 MP and higher credits for larger outputs up to 16 credits at 512 MP. The page is internally inconsistent: its heading says "1 API credit = 32MP," while the body says 24 MP. Source: https://www.topazlabs.com/api
- Developer docs: the overview lists endpoints only by reference and links an API Reference and Request Parameters page. The fetched content did not include endpoint parameters. Source: https://developer.topazlabs.com/overview.md
- Rate limits and content restrictions for the direct API: unverified. The API page states neither. Source: https://www.topazlabs.com/api
- Enterprise page: "AI image and video enhancement built for enterprise and production workflows," with contact-sales routing. Source: https://www.topazlabs.com/enterprise

## 4. How Kie.ai resells Topaz

- Kie.ai lists "Topaz Image Upscale" (model `topaz/image-upscale`, type image to image) and "Topaz Video Upscaler" (video to video, 1080p or 4K). Source: https://kie.ai/market/topaz
- Kie.ai's product page for the image model states "10 credits ($0.05)" for a 2K or smaller image, and "20 credits ($0.10)" for 4K. Source: https://kie.ai/topaz-image-upscale
- Kie.ai's pricing page states "1 credit ≈ $0.005," "credits never expire," and "failed tasks are never charged." Source: https://kie.ai/pricing
- Kie.ai's pricing page states that larger top-ups include bonus credits, for example "a $1,250 top-up adds 10%." Source: https://kie.ai/pricing
- Whether Kie.ai routes this model to the Topaz direct API (Enhance) or to another Topaz backend: unverified. No official Kie page names the backend.
- Which Topaz model (for example Standard 2 or Wonder 3.5) backs the Kie model: unverified.

## 5. Strengths

- Mature brand in AI image enhancement, with a large desktop and web product line. Source: https://www.topazlabs.com/
- Clear public credit pricing on the direct API (Developer and Scale plans). Source: https://www.topazlabs.com/api
- Kie.ai offers a flat per-image price for 2K or smaller outputs, which is simple to budget. Source: https://kie.ai/topaz-image-upscale

## 6. Weaknesses

- The direct API is not fully documented on public pages. Parameters, output format, and limits sit behind the developer portal, and the fetched pages did not include them. Source: https://developer.topazlabs.com/overview.md
- Internal inconsistency in the Enhance credit table (24 MP vs 32 MP per credit). Source: https://www.topazlabs.com/api
- Kie.ai's public pricing covers only two price points (2K and 4K) on the product page. 1x and 8x pricing are not on the official page. Source: https://kie.ai/topaz-image-upscale
- Kie.ai's public pages do not name the Topaz backend model or its version. Source: https://kie.ai/market/topaz

## 7. Usage and content policy

- Kie.ai terms (section 3, "User Content"): users must not upload content that "Violates any laws or regulations" or "Infringes on any third party's intellectual property or rights." Content that "Is offensive, abusive, defamatory, or otherwise inappropriate" is also barred. Source: https://kie.ai/terms-of-use
- Kie.ai terms state that users "retain ownership of your User Content." The terms do not state whether generated outputs may be used commercially. Source: https://kie.ai/terms-of-use
- Kie.ai product page carries a "Commercial use" label on the Topaz image model. The page does not explain the label's terms. Source: https://kie.ai/topaz-image-upscale
- Kie.ai product page on NSFW filtering: "There is no guarantee that everything can be filtered out." Source: https://kie.ai/topaz-image-upscale
- Topaz direct terms of use and acceptable-use policy: unverified. The candidate URL `https://www.topazlabs.com/terms` returned HTTP 404 on fetch.
- Topaz direct API content restrictions: unverified. Source: https://www.topazlabs.com/api

## 8. Open questions

1. Which Topaz backend model and version serves `topaz/image-upscale` on Kie.ai.
2. Whether Kie.ai applies the Topaz direct API's credit table or its own flat price.
3. Full Topaz direct API endpoint parameters, output format, and rate limits (request parameters page on developer.topazlabs.com).
4. Topaz direct terms of use on output ownership and commercial use.
5. Whether Kie.ai's published "commercial use" label is backed by a clause in its terms.
