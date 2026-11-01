---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5
  - https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2
  - https://kie.ai/market/elevenlabs
  - https://kie.ai/elevenlabs-tts
  - https://kie.ai/pricing
  - https://elevenlabs.io/docs/overview/models
  - https://elevenlabs.io/pricing/api
  - https://elevenlabs.io/use-policy
---

# elevenlabs_tts: research

## Contents

1. What it does
2. Model version and modes
3. Key parameters and limits
4. Public pricing
5. Strengths and weaknesses
6. Best use cases
7. Alternatives in this catalog
8. Open questions

## 1. What it does

Generates speech audio from text. The tool creates a Kie.ai task and returns a `task_id`. The result is read through the task status tool or the callback URL. Sources: repository code in `packages/core/src/tools/elevenlabs_tts.ts` and https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5

## 2. Model version and modes

Catalog entry: `elevenlabs_tts`, model `elevenlabs-tts`, capability "text to speech". Source: `packages/core/src/model-catalog.ts`.

The tool has two modes, selected by the `model` field:

| Tool value | Kie.ai model ID | Official model |
|---|---|---|
| `turbo` (default) | `elevenlabs/text-to-speech-turbo-2-5` | `eleven_turbo_v2_5` (deprecated, equivalent to `eleven_flash_v2_5`) |
| `multilingual` | `elevenlabs/text-to-speech-multilingual-v2` | `eleven_multilingual_v2` |

Sources: https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5, https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2, https://elevenlabs.io/docs/overview/models

Kie's ElevenLabs market page lists the Turbo 2.5 and Multilingual v2 models. Source: https://kie.ai/elevenlabs-tts

## 3. Key parameters and limits

| Field | Tool rule | Kie.ai docs | Source |
|---|---|---|---|
| `text` | required, 1 to 5,000 characters | max 5,000 characters | Kie docs |
| `voice` | enum of 21 **names** (for example `Rachel`), default `Rachel` | 20-character **voice IDs**; the Kie docs state 67 voice IDs in one place and roughly 80 in another. Default `EkK5I93UQWFDigLMpZcX` (James). Names are not accepted. | Kie docs |
| `stability` | 0 to 1, default 0.5 | 0 to 1, default 0.5 | Kie docs |
| `similarity_boost` | 0 to 1, default 0.75 | 0 to 1, default 0.75 | Kie docs |
| `style` | 0 to 1, default 0 | 0 to 1, default 0 | Kie docs |
| `speed` | 0.7 to 1.2, default 1 | 0.7 to 1.2, default 1 | Kie docs |
| `timestamps` | boolean, default false | boolean (default not stated) | Kie docs |
| `previous_text`, `next_text` | max 5,000 each; sent only for `multilingual` | max 5,000 each | Kie docs |
| `language_code` | sent only for `turbo`; ISO 639-1 | enforced only by Turbo v2.5 and Flash v2.5; other models return an error | Kie docs |
| `callBackUrl` | optional URL; falls back to `KIE_AI_CALLBACK_URL` | optional, recommended for production | Kie docs |

Notes:

- The tool sends `voice` as a name. The Kie docs require an ID. The default name `Rachel` is not in the Kie voice list. Live behavior is unverified, but the default call may fail or pick a different voice. This is the main defect candidate found in this research.
- Kie docs error codes: 401, 402 (insufficient credits), 408 (no result after 10 minutes), 422 (validation), 429 (rate limit), 501 (generation failed), and others. Source: https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5
- Kie rate limits: unknown. Only 429 is documented.
- Output: a URL in `resultUrls`. The docs example ends in `.mp3`. Audio format and timestamp structure: unverified.

## 4. Public pricing

**Kie.ai**

- Multilingual v2: "12 credits per 1,000 characters (≈ $0.06)." Source: https://kie.ai/elevenlabs-tts
- Kie credit rate: "1 credit ≈ $0.005." Source: https://kie.ai/pricing
- Turbo 2.5: unknown. The Kie pricing page lists "from $0.03 per 1,000 characters (6 credits)" under an unnamed ElevenLabs text to speech entry. That figure is not assigned to a model here.

**Provider (ElevenLabs API, USD)**

- Flash and Turbo models: $0.04 per 1,000 characters. The page does not give a version number. Source: https://elevenlabs.io/pricing/api
- Multilingual v2: $0.08 per 1,000 characters. Source: https://elevenlabs.io/pricing/api

## 5. Strengths and weaknesses

Strengths:

- Two modes in one tool, selected by a single field.
- Full set of voice-control fields (stability, similarity, style, speed).
- Continuity fields (`previous_text`, `next_text`) for multi-part audio.
- Official sources show low latency for the Flash family. Source: https://elevenlabs.io/docs/overview/models

Weaknesses:

- Voice names in the tool do not match the Kie voice ID format. Unverified live.
- The default Turbo 2.5 model is deprecated on the official side. Source: https://elevenlabs.io/docs/overview/models
- Turbo price on Kie is unknown, so cost cannot be compared.
- The tool's error hints list voices that the Kie docs do not name.

## 6. Best use cases

- Short narration, notices, and voice-overs where a fast default is enough (turbo).
- Multi-paragraph narration needing continuity between chunks (multilingual with `previous_text` and `next_text`).
- Batch generation through the CLI with a callback URL.

## 7. Alternatives in this catalog

- `elevenlabs_ttsfx`: generates sound effects from text, not speech. Source: `packages/core/src/tools/elevenlabs_ttsfx.ts`.
- Other speech tools in the catalog were not reviewed in this pass.

## 8. Open questions

- Does Kie accept `Rachel` as a voice value, or does it reject the name? Needs one live call with a test key. Unverified.
- Which Kie voice ID corresponds to each enum name in the tool? Not documented.
- Kie price for `elevenlabs/text-to-speech-turbo-2-5`: unknown.
- Output audio format and sample rate on Kie: unverified.
- Supported language list for Kie's multilingual model: unknown.
- The tool text gives time ranges for generation ("15-60 seconds" and "30-120 seconds"). No source in this research confirms them. Treated as unverified.
