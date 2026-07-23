# Gemini Omni

- Video API: https://docs.kie.ai/market/gemini-omni-video
- Character API: https://docs.kie.ai/market/gemini-omni-character
- Audio API: https://docs.kie.ai/market/gemini-omni-audio

Video uses `POST /api/v1/jobs/createTask` with model `gemini-omni-video`. Images consume one quota unit, a video consumes two, and character IDs consume one; the total must not exceed seven. Video accepts prompt, images, one trimmed video, audio IDs, character IDs, duration, ratio, resolution, and seed.

Characters use `POST /api/v1/omni/character/create` with one image and `descriptions`. Voices use `POST /api/v1/omni/audio/create` with `audio_id` and `name`. Poll video tasks via `GET /api/v1/jobs/recordInfo?taskId=...`.
