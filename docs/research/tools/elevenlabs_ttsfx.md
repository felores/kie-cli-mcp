---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/elevenlabs/sound-effect-v2
  - https://kie.ai/market/elevenlabs
  - https://kie.ai/elevenlabs-sound-effects
  - https://kie.ai/pricing
  - https://elevenlabs.io/docs/overview/capabilities/sound-effects
  - https://elevenlabs.io/pricing/api
---

# elevenlabs_ttsfx: research

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

Generates a sound effect from a text description. The tool creates a Kie.ai task and returns a `task_id`. Sources: `packages/core/src/tools/elevenlabs_ttsfx.ts` and `packages/core/src/kie-ai-client.ts` (`generateElevenLabsSoundEffects`).

## 2. Model version and modes

Catalog entry: `elevenlabs_ttsfx`, model `elevenlabs-sound-effects`, capability "sound effects". Source: `packages/core/src/model-catalog.ts`.

The client sends model `elevenlabs/sound-effect-v2`. Source: `packages/core/src/kie-ai-client.ts`.

Mode: one. The tool has no mode switch. Loop mode is a flag (`loop`).

**Kie.ai docs status:** the page `https://docs.kie.ai/market/elevenlabs/sound-effect-v2` returned HTTP 404. The Kie ElevenLabs provider page lists no sound effects product. The page `https://kie.ai/elevenlabs-sound-effects` returned HTTP 404. So the Kie model ID, its parameters, and its availability are **unverified** from official Kie sources.

**Official ElevenLabs:** the default sound effects model is `eleven_text_to_sound_v2`. The newer `eleven_text_to_sound_v3` (SFX v3) is limited access. Source: https://elevenlabs.io/docs/overview/capabilities/sound-effects

The mapping from Kie `sound-effect-v2` to official `eleven_text_to_sound_v2` is **unverified**.

## 3. Key parameters and limits

| Field | Tool rule | Official ElevenLabs | Source |
|---|---|---|---|
| `text` | required, 1 to 5,000 characters | not stated | repository code |
| `duration_seconds` | 0.5 to 22, step 0.1, optional | 0.1 to 30 seconds | repository code; official docs |
| `prompt_influence` | 0 to 1, step 0.01, default 0.3 | numeric range unknown (described as High for literal, Low for creative) | repository code; official docs |
| `loop` | boolean, default false | supported; output designed to repeat seamlessly | repository code; official docs |
| `output_format` | enum of mp3, pcm, ulaw, alaw, and opus formats; code default `mp3_44100_192` | MP3 for all effects; WAV 48 kHz for non-looping effects | repository code; official docs |
| `callBackUrl` | optional URL; falls back to `KIE_AI_CALLBACK_URL` | not applicable | repository code |

Notes:

- The duration range in the tool (0.5 to 22 seconds) differs from the official range (0.1 to 30 seconds). The Kie-side limit is the one that applies to this tool, and it is **unverified** because no Kie docs page was found.
- The error hint for `output_format` says the default is `mp3_44100_128`, while the code default is `mp3_44100_192`. Mismatch in the repository.
- The tool text says generation "typically takes 30-90 seconds." No source confirms this. Treated as unverified.

## 4. Public pricing

**Kie.ai:** unknown. No Kie price for this model was found on the Kie provider page, the Kie pricing page, or the (missing) model page.

**Official ElevenLabs:**

- Credit cost: 40 credits per second when a duration is set. The cost without a duration is unknown. Source: https://elevenlabs.io/docs/overview/capabilities/sound-effects
- Sound effects listed at $0.12 per minute on the API pricing page. Source: https://elevenlabs.io/pricing/api
- The two official figures are not reconciled in this research. They may describe different billing units or plans. Treat both as unverified until checked.

## 5. Strengths and weaknesses

Strengths:

- Single purpose and simple parameter set.
- Loop option for ambient or repeating audio. Source: https://elevenlabs.io/docs/overview/capabilities/sound-effects
- Several output formats, including PCM and telephony codecs. Source: repository code.

Weaknesses:

- No verified Kie documentation for the model. High risk of parameter drift.
- Duration limits in the tool do not match the official range.
- Default format is documented in two different ways in the code.
- No verified Kie price.

## 6. Best use cases

- Short sound effects (impacts, UI sounds, ambience) described in text.
- Looping ambient beds, if the Kie route supports `loop` (unverified).

## 7. Alternatives in this catalog

- `elevenlabs_tts`: speech, not effects. Source: `packages/core/src/tools/elevenlabs_tts.ts`.
- Other sound or music tools in the catalog were not reviewed in this pass. Suno (`suno_generate_music`) is listed in the catalog for music, not effects. Source: `packages/core/src/model-catalog.ts`.

## 8. Open questions

- Does Kie document `elevenlabs/sound-effect-v2`? Not found. Needs a live check with a test key or a Kie contact.
- Kie duration range and default format: unverified.
- Kie price: unknown.
- Official `prompt_influence` numeric range: unknown.
- Which official SFX version Kie runs (v2 or v3): unknown.
- Source of the "30-90 seconds" generation time in the tool text: unverified.
