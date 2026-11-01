---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/infinitalk/from-audio
  - https://kie.ai/infinitalk
  - https://kie.ai/market/infinitetalk
  - https://kie.ai/market/lip-sync
  - https://github.com/MeiGen-AI/InfiniteTalk
  - https://arxiv.org/abs/2508.14033
---

# infinitalk_lip_sync

Catalog tool for the InfiniteTalk model (Kie.ai model `infinitalk/from-audio`). Provider: [MeiGen-AI](../providers/meigen-infinitalk.md).

## Contents

1. What it does
2. Model version
3. Modes
4. Parameters and limits
5. Pricing
6. Strengths and weaknesses
7. Best use cases
8. Alternatives in this catalog
9. Open questions

## 1. What it does

Turns one portrait image and one audio file into a talking video with lip sync, facial expression, and head movement. The repo tool description matches this ([tool file](../../../packages/core/src/tools/infinitalk_lip_sync.ts)). Kie.ai describes it as a speech-to-video lip-sync API ([kie.ai/infinitalk](https://kie.ai/infinitalk)).

## 2. Model version

- Kie.ai docs give API spec version `1.0.0` and no model version ([docs.kie.ai](https://docs.kie.ai/market/infinitalk/from-audio)).
- Upstream: InfiniteTalk released August 19, 2025 ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)). Kie.ai's build is not mapped to a release: unverified.

## 3. Modes

- Kie.ai exposes one mode: image plus audio to video ([docs.kie.ai](https://docs.kie.ai/market/infinitalk/from-audio); [kie.ai/market/infinitetalk](https://kie.ai/market/infinitetalk)).
- Upstream also supports video-to-video, which the repo has no way to pass. Kie.ai does not expose it per sources checked.
- The tool sends only `image_url`, `audio_url`, `prompt`, `resolution`, and `seed` ([kie-cli client](../../../packages/core/src/kie-ai-client.ts), [types](../../../packages/core/src/types.ts)).

## 4. Parameters and limits

| Field | Required | Limit (Kie.ai docs) | Repo schema |
|---|---|---|---|
| `image_url` | yes | JPEG, PNG, WEBP; max 10.0 MB ([docs](https://docs.kie.ai/market/infinitalk/from-audio)) | URL, described as max 10MB |
| `audio_url` | yes | MPEG, WAV, x-WAV, AAC, MP4, OGG; max 10.0 MB ([docs](https://docs.kie.ai/market/infinitalk/from-audio)) | URL, same formats |
| `prompt` | yes | max 5000 characters ([docs](https://docs.kie.ai/market/infinitalk/from-audio)) | min 1, **max 1500** |
| `resolution` | no | `480p` (default) or `720p` ([docs](https://docs.kie.ai/market/infinitalk/from-audio)) | same |
| `seed` | no | 10000 to 1000000 ([docs](https://docs.kie.ai/market/infinitalk/from-audio)) | same |
| `callBackUrl` | no | URI ([docs](https://docs.kie.ai/market/infinitalk/from-audio)) | same, with env fallback |

- Audio duration: max 15 seconds ([kie.ai/infinitalk](https://kie.ai/infinitalk)). The Kie.ai docs page does not state it.
- Output duration: up to 15 seconds per task ([kie.ai/infinitalk](https://kie.ai/infinitalk)). The same page also says "infinite-length" video. The two claims conflict.
- Mismatch: the repo schema caps `prompt` at 1500 characters, the Kie.ai docs allow 5000. Which Kie.ai enforces at runtime: unverified.
- Task status: Kie.ai docs list codes 200, 401, 402, 404, 408, 422, 429, 455, 500, 501, 505. 408 means no result after 10 minutes. 501 means the task failed. Meaning of 402 and 455 is not stated ([docs](https://docs.kie.ai/market/infinitalk/from-audio)).
- Completion callback: code 200 on success, 501 on failure, with `creditsConsumed` ([docs](https://docs.kie.ai/market/infinitalk/from-audio)).

## 5. Pricing

- Kie.ai: 3 credits/s (about $0.015) at 480P, and 12 credits/s (about $0.06) at 720P, up to 15 seconds per generation ([kie.ai/infinitalk](https://kie.ai/infinitalk); [kie.ai/market/infinitetalk](https://kie.ai/market/infinitetalk) lists the same rate). Derived maximum per task: 45 credits at 480P, 180 credits at 720P (15 s x rate).
- Kie.ai top-up note: about $0.014/s at 480P and $0.055/s at 720P with the high-tier bonus ([kie.ai/infinitalk](https://kie.ai/infinitalk)).
- Kie.ai new-user credits: 80 free credits in the playground ([kie.ai/infinitalk](https://kie.ai/infinitalk)). Amount not verified beyond that page.
- Provider (MeiGen-AI): no API price found. Weights are open under Apache-2.0 ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)). Self-hosting cost: unknown.
- The repo tool returns `pricing: "unknown"` by design. The Kie.ai rate above is sourced and could be added to the rate card, if the project's rule for source, fingerprint, and verification date is met ([CLAUDE.md](../../../CLAUDE.md)).

## 6. Strengths and weaknesses

Strengths:

- Per-second price published at both resolutions ([kie.ai/infinitalk](https://kie.ai/infinitalk)). Alternatives' prices were not checked here (see section 8).
- Full-body and expression sync, per the paper's claims ([arXiv](https://arxiv.org/abs/2508.14033)). Claims unverified by independent benchmark.
- Open-source upstream with Apache-2.0 license ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).

Weaknesses:

- Short cap on Kie.ai: 15 s of audio and 15 s of output per task ([kie.ai/infinitalk](https://kie.ai/infinitalk)).
- Stated 40 s default and about 1 minute of good quality upstream, with color shifts after that ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).
- Prompt-length mismatch in the repo schema (see section 4).
- Output resolution capped at 720p.

## 7. Best use cases

- Short talking-head clips up to 15 seconds: a voice line, a short ad or promo cut, a character reaction.
- Cheap 480p drafts before a 720p final.
- Reproducible renders by fixing `seed`.

## 8. Alternatives in this catalog

Both appear in [model-catalog.ts](../../../packages/core/src/model-catalog.ts) with the `lip sync` or `talking avatar` capability:

- `omnihuman_video` (model `omnihuman-1.5`): talking avatar and lip sync. Local Kie.ai notes: [docs/kie/omnihuman_1-5.md](../../kie/omnihuman_1-5.md). Comparison of limits and price: not done in this document.
- `kling_avatar` (model `kling-avatar`): talking avatar and lip sync. No local Kie.ai notes in `docs/kie/`. Limits and price: unknown in this document.

## 9. Open questions

1. Does Kie.ai enforce 1500 or 5000 characters for `prompt`? The repo schema and the Kie.ai docs disagree.
2. Which upstream InfiniteTalk release does Kie.ai run? No model version is published.
3. Is 15 seconds a hard cap or a current limit? The Kie.ai page says both "infinite-length" and "up to 15 seconds."
4. What do status codes 402 and 455 mean?
5. Does Kie.ai bill failed tasks? The docs say `creditsConsumed` is 0 on failure in the callback example. Confirm on a live task.
6. Should the 3 and 12 credits/s rate go into `model-catalog.ts` with a verification date and fingerprint? The current state is `unknown`.
7. Real-face consent and likeness rules for this model. Provider does not state them.
