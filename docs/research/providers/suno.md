---
status: draft
date: 2026-10-31
sources:
  - https://suno.com/about
  - https://suno.com/terms
  - https://suno.com/pricing
  - https://suno.com/community-guidelines
  - https://kie.ai/suno-api
  - https://kie.ai/market
  - https://kie.ai/pricing
  - https://docs.kie.ai/suno-api/generate-music.md
  - https://www.musicbusinessworldwide.com/suno-explores-developer-api-seeking-apps-that-unlock-experiences-generative-music-makes-possible-for-the-first-time/
---

# Suno (provider research)

## Contents

1. Who they are
2. Product lineup relevant to media generation
3. Official API status
4. Strengths and weaknesses
5. Usage and content policy
6. Commercial use and licensing
7. How Kie.ai resells Suno
8. Gaps and conflicts

## 1. Who they are

- Suno describes itself as "a music company building the world's first creative entertainment platform." Source: https://suno.com/about
- The About page says Suno was founded in 2022 and has "4 offices" and "250+" team members. It does not state a headquarters city. Source: https://suno.com/about

## 2. Product lineup relevant to media generation

From https://suno.com/about:

- **Music models**: described as "World-class music models" built with artists and producers.
- **Suno Studio**: "A browser-based studio suite."
- **Voices and Personas**: tools to keep a consistent artistic identity.
- **Apps**: web, iOS and Android.
- **Other links**: Remix, Stem Separation, Custom Models and MCP. The page lists these without descriptions.

Model versions by plan, from https://suno.com/pricing:

- Free: model `v6-mini`.
- Pro and Premier: `v6` and `v6-wild`.

## 3. Official API status

- The official Suno site does not mention an API, developer access or API terms. Checked pages: https://suno.com/about, https://suno.com/terms, https://suno.com/pricing. The Terms page has no API statement.
- A trade press search snippet (Music Business Worldwide) says Suno "does not currently offer an official public API." The full article was not retrieved (HTTP 403). Status: unverified beyond the snippet.
- Kie.ai's own API page uses "Suno API" and "Part of the Suno API family." It does not claim an official Suno partnership. Source: https://kie.ai/suno-api

## 4. Strengths and weaknesses

Strengths (from official pages):

- Full songs with vocals and instrumentals, with style and lyrics controls.
- Persona and voice tools for a consistent artist identity.
- Stem separation and remix features in the product.
- Paid plans grant commercial rights on downloaded output (see section 6).

Weaknesses:

- No official public API found. Any programmatic access depends on a third party, such as Kie.ai. Terms of that third-party path are not verified here.
- Free tier is limited to personal, non-commercial use.
- Commercial rights depend on downloading output through an approved channel.
- Output may not be copyrighted (see section 6).

## 5. Usage and content policy

From https://suno.com/community-guidelines (section summaries only, the full text was not read):

- Prohibits uploading copyrighted material and reproducing existing songs.
- Prohibits using a real person's voice or likeness without permission.
- Prohibits impersonating people, artists or organizations, and deceptive audio presented as real.
- Prohibits hate speech, credible threats, terrorism, graphic violence and animal abuse.
- Prohibits exploitation of minors. The platform is 13+.

From https://suno.com/terms ("User Conduct", "Voice Model"):

- Users may not impersonate any person or entity.
- Users "expressly agree not to create, or attempt to create, a Voice Model of another person."
- Suno may remove content that violates the Terms.

## 6. Commercial use and licensing

Source: https://suno.com/terms

- **Free or Basic tier**: outputs are for "your lawful, personal and non-commercial purposes" only.
- **Paid tiers**: "You may commercially exploit Output solely to the extent it adheres to Suno's Conditions of Access and Use." This applies only to Output obtained through a permitted Download.
- **Unlicensed use**: "You may not commercially exploit Output that has not been downloaded by you through an approved channel."
- **Durability**: download-based commercial rights are "perpetual" and survive cancellation or downgrade.
- **Remixes**: "Nothing in this paragraph permits commercial use of any Remix."
- **Copyright**: "Suno makes no representation or warranty to you that any copyright will vest in any Output."

Note for Kie.ai users: the Suno Terms apply to Suno's own service. Kie.ai's own terms for API output were not retrieved. Status: unverified.

## 7. How Kie.ai resells Suno

Source: https://kie.ai/suno-api and https://kie.ai/market

- Kie.ai lists "Suno API" under the Suno family and describes it as "an AI music-generation model that converts text prompts into full vocal and instrumental tracks."
- The Kie.ai market page shows the Suno entry as supporting "the latest V5.5 model." This conflicts with the repo's documented V6 endpoint (see section 8).
- Kie.ai says output is "commercial-ready, watermark-free" and that "generated files are kept for 14 days." Source: https://kie.ai/suno-api (README text as extracted).
- Kie.ai pricing is credit based. Source: https://kie.ai/pricing. The page states "1 credit ≈ $0.005." It shows a Suno starting price of "from 0.4 per request" (about $0.002), but it says each model's full price list is on its model page. That page was not retrievable.

## 8. Gaps and conflicts

- **Version conflict**: Kie.ai market says V5.5. The repo's `docs/kie/suno_v6.md` (verified 2026-10-04) and `docs.kie.ai` say V6, V6_MINI and V6_WILD. The docs.kie.ai page is the documented contract, so V6 is used here. Needs a live check.
- **Suno API status**: no official Suno page confirms or denies an API. Unverified beyond the trade press snippet.
- **Kie per-request price for V6**: unknown. Model page not retrieved.
- **Suno credits per song**: no official per-song credit figure was found. Unknown.
- **Kie Terms of Service** for output rights: not retrieved. Unverified.
