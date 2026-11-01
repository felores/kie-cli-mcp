---
status: draft
date: 2026-10-31
sources:
  - https://elevenlabs.io/about
  - https://elevenlabs.io/use-policy
  - https://elevenlabs.io/docs/overview/models
  - https://elevenlabs.io/docs/overview/capabilities/sound-effects
  - https://elevenlabs.io/pricing/api
  - https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5
  - https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2
  - https://docs.kie.ai/market/elevenlabs/sound-effect-v2
  - https://kie.ai/market/elevenlabs
  - https://kie.ai/elevenlabs-tts
  - https://kie.ai/elevenlabs-sound-effects
  - https://kie.ai/pricing
---

# ElevenLabs: provider research

## Contents

1. Who they are
2. Product lineup for media generation
3. Models used in this catalog
4. Strengths and weaknesses
5. Usage and content policy
6. How Kie.ai resells ElevenLabs
7. Gaps and open questions

## 1. Who they are

- ElevenLabs describes itself as an "AI research and product company transforming the way we interact with technology." Its stated mission is to "make communication and creation seamless." Source: https://elevenlabs.io/about
- Founding year, founders, and headquarters: unverified. The about page does not state them.
- Named executives on the about page: Ethan Tandowsky (Chief Financial Officer) and Ashley Kramer (Chief Revenue Officer). Source: https://elevenlabs.io/about

## 2. Product lineup for media generation

The about page groups the products as follows. Source: https://elevenlabs.io/about

- Text to speech and speech to text: core models.
- ElevenAgents: voice and chat agents for support and sales.
- ElevenCreative: speech, music, sound effects, images, and video. Tools include AI Dubbing, Voice Cloning, Voice Design, and Studio.
- ElevenAPI: audio foundation models with low-latency streaming and SDKs.

Text to speech models named in the official model overview. Source: https://elevenlabs.io/docs/overview/models

- `eleven_v4`: 90+ languages, 10,000 character limit.
- `eleven_v4_turbo`: 90+ languages, median latency about 100 ms (excludes application and network latency).
- `eleven_v3`: 70+ languages, 5,000 character limit.
- `eleven_v3_conversational`: 70+ languages, median latency about 165 ms.
- `eleven_multilingual_v2`: 29 languages, 10,000 character limit. The docs call it "most stable on long-form generations."
- `eleven_flash_v2_5`: 32 languages, median latency about 100 ms, 40,000 character limit.
- `eleven_flash_v2`: English only, median latency about 135 ms, 30,000 character limit.
- `eleven_turbo_v2_5` and `eleven_turbo_v2`: deprecated. The docs say they are functionally equivalent to the Flash models, with higher average latency on the Turbo variants.

Sound effects model named in the official docs. Source: https://elevenlabs.io/docs/overview/capabilities/sound-effects

- `eleven_text_to_sound_v2` is the default model. The page names no display name for it.
- `eleven_text_to_sound_v3` (SFX v3) is listed as limited access.
- Duration range: 0.1 to 30 seconds.
- Looping is supported. Output: MP3 for all effects, and WAV at 48 kHz for non-looping effects.
- Credit cost: 40 credits per second when a duration is set. The cost without a duration is unknown.

## 3. Models used in this catalog

Kie.ai model IDs, from the Kie docs and the repository code.

| Catalog tool | Kie model ID | Official equivalent |
|---|---|---|
| `elevenlabs_tts` (turbo) | `elevenlabs/text-to-speech-turbo-2-5` | `eleven_turbo_v2_5` (deprecated, see section 2) |
| `elevenlabs_tts` (multilingual) | `elevenlabs/text-to-speech-multilingual-v2` | `eleven_multilingual_v2` |
| `elevenlabs_ttsfx` | `elevenlabs/sound-effect-v2` | `eleven_text_to_sound_v2` (mapping unverified) |

Sources: https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5 and https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2. The sound effects mapping is unverified because the Kie docs page for it returned HTTP 404 (https://docs.kie.ai/market/elevenlabs/sound-effect-v2).

## 4. Strengths and weaknesses

Strengths, from official sources:

- Broad language coverage in the v4 and v3 families (90+ and 70+ languages). Source: https://elevenlabs.io/docs/overview/models
- Low latency on the Flash and v4 Turbo models (median about 100 ms, excluding network). Source: https://elevenlabs.io/docs/overview/models
- Clear product line for speech, agents, music, sound effects, and dubbing. Source: https://elevenlabs.io/about

Weaknesses and risks:

- Model naming changes over time. The Turbo 2.5 model used by Kie is deprecated in the official docs. Source: https://elevenlabs.io/docs/overview/models
- Official API price per 1,000 characters is listed in US dollars, not credits, and the page gives no credit rates per character. Source: https://elevenlabs.io/pricing/api
- Voice cloning and impersonation rules add review cost for any user-supplied voice. Source: https://elevenlabs.io/use-policy

## 5. Usage and content policy

From the ElevenLabs use policy. Source: https://elevenlabs.io/use-policy

- Prohibited categories include: minors, dangerous activities, deception and impersonation, elections, hate and harassment, sexual content, privacy violations, circumventing safeguards (including "Voice CAPTCHA"), IP and publicity rights, and high-impact decisions without human oversight.
- Voice cloning requires "explicit and informed consent or other valid authorization."
- Voice recordings of anyone under 18 may not be submitted to create or train a voice model.
- Deceased individuals: prohibited "in a manner that is reasonably likely to cause harm."
- Disclosure: users must disclose AI interaction where required by law.
- Watermarks and provenance signals must not be removed, altered, or concealed.
- Enforcement: content removal, restriction, suspension, or termination. Penalty tiers: unknown.

## 6. How Kie.ai resells ElevenLabs

- Kie.ai exposes ElevenLabs models through `POST https://api.kie.ai/api/v1/jobs/createTask` with a bearer token. Source: https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5
- The response returns a task ID and record ID. Results come from the task query endpoint or the `callBackUrl`. Source: same page.
- Kie documents these status codes: 200, 401, 402 (insufficient credits), 404, 408 (no result after 10 minutes), 422, 429, 455, 500, 501 (generation failed), and 505. Source: same page.
- Kie bills in credits. Its pricing page states "1 credit ≈ $0.005." Source: https://kie.ai/pricing
- Kie's ElevenLabs text to speech page lists Multilingual v2 at "12 credits per 1,000 characters (≈ $0.06)." Source: https://kie.ai/elevenlabs-tts
- Turbo 2.5 price on Kie: unknown.
- Sound effects on Kie: the provider page at https://kie.ai/market/elevenlabs lists no sound effects product, and https://kie.ai/elevenlabs-sound-effects returned HTTP 404. Kie price: unknown.

### Price comparison (per 1,000 characters, USD)

| Model | Kie.ai | ElevenLabs official | Source |
|---|---|---|---|
| Turbo or Flash (version not stated on the page) | unknown (Kie page lists "from $0.03 per 1,000 characters (6 credits)" without naming the model) | $0.04 | https://kie.ai/pricing and https://elevenlabs.io/pricing/api |
| Multilingual v2 | $0.06 (12 credits) | $0.08 | https://kie.ai/elevenlabs-tts and https://elevenlabs.io/pricing/api |

The Kie figure for the "from $0.03" entry does not name its model, so it is not used in the table.

## 7. Gaps and open questions

- The Kie docs for sound effects (`elevenlabs/sound-effect-v2`) were not found. Existence and parameters on Kie are unverified.
- Voice format on Kie: the Kie docs say voices are 20-character IDs and names are not accepted. The repository sends voice names. See the tool docs.
- Founding year and headquarters: unverified.
- Output audio format on Kie: unverified. The docs example ends in `.mp3`.
- Kie per-task cost for every model except Multilingual v2: unknown.
- Rate limits on Kie: unknown. The docs document only the 429 status.
- Supported language list for Kie's Multilingual v2: unknown.
