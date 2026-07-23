# Kie Model Integration Plan

## Scope

Integrate six Kie.ai capabilities discovered from the model marketplace. Each integration has a focused commit, schema validation, task persistence when the API is asynchronous, endpoint documentation, and registry coverage.

## Decisions

1. **Nano Banana 2 Lite**: extend `nano_banana_image` with a `model` selector. Lite uses `nano-banana-2-lite`, accepts up to 10 image URLs, supports 1K output only, and must not receive Nano Banana 2-only fields.
2. **Seedream 5.0 Pro**: extend `bytedance_seedream_image` with `version: "5-pro"`. Route text and image requests to their distinct model IDs and add Pro-specific output format and safety controls.
3. **Seedance 2.0 Mini**: extend `bytedance_seedance_video` with `mode: "mini"`. Preserve the existing mutually exclusive frame/reference modes and route Mini to `bytedance/seedance-2-mini`.
4. **Suno 5.5**: add `V5_5` to `suno_generate_music`; expose `duration` only for that model.
5. **OmniHuman 1.5**: add `omnihuman_video`, an asynchronous image-and-audio portrait animation tool using `omnihuman-1-5`.
6. **Gemini Omni**: add one unified `gemini_omni` tool. Its `operation` selects synchronous voice creation, synchronous character creation, or asynchronous video generation. Validate the video input quota before calling Kie.

## Authoritative Contracts

- [Nano Banana 2 Lite](https://docs.kie.ai/market/google/nano-banana-2-lite): `POST /api/v1/jobs/createTask`, model `nano-banana-2-lite`.
- [Seedream 5.0 Pro text-to-image](https://docs.kie.ai/market/seedream/5-pro-text-to-image) and [image-to-image](https://docs.kie.ai/market/seedream/5-pro-image-to-image): `POST /api/v1/jobs/createTask`.
- [Seedance 2.0 Mini](https://docs.kie.ai/market/bytedance/seedance-2-mini): `POST /api/v1/jobs/createTask`, model `bytedance/seedance-2-mini`.
- [Suno music generation](https://docs.kie.ai/suno-api/generate-music): `POST /api/v1/generate`; `duration` applies only to `V5_5`.
- [OmniHuman 1.5](https://docs.kie.ai/market/omnihuman-1-5): `POST /api/v1/jobs/createTask`, model `omnihuman-1-5`.
- [Gemini Omni video](https://docs.kie.ai/market/gemini-omni-video), [character](https://docs.kie.ai/market/gemini-omni-character), and [audio](https://docs.kie.ai/market/gemini-omni-audio).

## Verification

- Add focused schema/client payload tests for each integration.
- Run `npm test` and `npm run build` after all integrations.
- Commit only the files belonging to each integration; preserve unrelated worktree changes.
