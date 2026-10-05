# Suno V6 music generation

Verified against [Kie documentation](https://docs.kie.ai/suno-api/generate-music.md) and the [Generate playground](https://kie.ai/suno-api) on 2026-10-04. The playground exposes V6. Its marketing description still mentions V5.5; the documented request contract takes precedence.

- Create: `POST /api/v1/jobs/createTask`, outer model `ai-music-api/generate`.
- Select `V6`, `V6_MINI`, or `V6_WILD` in `input.model`. Older versions are discontinued and are not selectable.
- Poll: `GET /api/v1/jobs/recordInfo?taskId=...`. New tasks persist as `suno-v6`; historical `suno` tasks retain their legacy polling route.
- Required input fields: `custom_mode`, `instrumental`, `model`.
- Custom mode requires a title of up to 80 characters and at least one of `style`, `lyrics`, or `negative_tags`. Lyrics override the optional prompt. Lyrics/prompt are bounded to 5000 characters, style to 1000.
- Non-custom mode requires 1-10 attachments across style, lyrics, image, video, and audio references. A prompt alone is insufficient; it is optional and bounded to 3000 characters. Images: at most 5, each 10 MB. Video: at most 1, 100 MB, 241 seconds. Audio: 6 seconds to 30 minutes, at most 500 MB per file.
- Duration 10-360 seconds and variety 0-4 are custom-only. Provider defaults are 20 seconds and variety 1. Vocal and weight controls are also custom-only; `audio_weight` requires vocals.
- Optional persona/voice selection uses `persona_id` and `persona_model`, either `style_persona` or `voice_persona`.
- Optional `callBackUrl` belongs to the request envelope, with `KIE_AI_CALLBACK_URL` fallback.

The tool retains camelCase flags such as `customMode`, `negativeTags`, `vocalGender`, and `personaId`. The client maps them to the provider's snake_case fields. No direct `/generate` creation remains.

No exact price formula is installed. Verification uses mocked provider responses, not paid generation.
