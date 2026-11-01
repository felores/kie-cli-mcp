---
status: draft
date: 2026-10-31
sources:
  - https://github.com/MeiGen-AI
  - https://github.com/MeiGen-AI/InfiniteTalk
  - https://arxiv.org/abs/2508.14033
  - https://kie.ai/infinitalk
  - https://kie.ai/market/infinitetalk
  - https://kie.ai/market/lip-sync
  - https://docs.kie.ai/market/infinitalk/from-audio
---

# MeiGen-AI (InfiniteTalk provider)

Slug: `meigen-infinitalk`. Scope: the maker of InfiniteTalk, as used by the `infinitalk_lip_sync` tool.

## Contents

1. Verification of the maker
2. Who they are
3. Product lineup relevant to media generation
4. Strengths and weaknesses
5. License and usage policy
6. How Kie.ai resells it
7. Gaps

## 1. Verification of the maker

- Verified: the GitHub organization `MeiGen-AI` owns the repository `InfiniteTalk`, described as "Unlimited-length talking video generation" ([GitHub org](https://github.com/MeiGen-AI), [repo](https://github.com/MeiGen-AI/InfiniteTalk)).
- Verified: Kie.ai pages state that InfiniteTalk is "developed by MeiGen-AI" ([kie.ai/infinitalk](https://kie.ai/infinitalk), [kie.ai/market/lip-sync](https://kie.ai/market/lip-sync)).
- Unverified: the arXiv paper author list does not show MeiGen-AI affiliation. The page shows no affiliations, so the link between the paper authors and MeiGen-AI rests on the repository ([arXiv 2508.14033](https://arxiv.org/abs/2508.14033)).
- No official MeiGen-AI website was found. The GitHub org page shows no website link ([GitHub org](https://github.com/MeiGen-AI)).

## 2. Who they are

- Publisher: MeiGen-AI, a GitHub organization. The profile lists location as China ([GitHub org](https://github.com/MeiGen-AI)).
- Legal entity: unknown.
- Public output: research code and model weights for audio-driven video. The organization's profile README lists project descriptions ([GitHub org](https://github.com/MeiGen-AI)).

## 3. Product lineup relevant to media generation

Pinned or listed repositories on the GitHub org page ([GitHub org](https://github.com/MeiGen-AI)):

| Project | Description (from GitHub page) | Relevance |
|---|---|---|
| InfiniteTalk | "Unlimited-length talking video generation," image-to-video and video-to-video | Direct: the `infinitalk_lip_sync` model |
| MultiTalk | Audio-driven multi-person conversational video (NeurIPS 2025, per GitHub page) | Related lip-sync family |
| LongCat-Video-Avatar-1.5 | Separate avatar project, announced May 21, 2026 | Separate project, not an InfiniteTalk update |
| llia | Real-time audio-driven portrait video with diffusion models | Related, unverified in Kie.ai catalog |
| PosterCraft | Poster generation (ICLR 2026, per GitHub page) | Not media video |

In this repository, only `infinitalk_lip_sync` maps to MeiGen-AI in [model-catalog.ts](../../../packages/core/src/model-catalog.ts). Kie.ai sells no other MeiGen-AI model in the pages checked.

## 4. Strengths and weaknesses

Strengths (from the paper abstract and GitHub README):

- Sparse-frame dubbing: the method edits full-body motion, not only the mouth region, and keeps reference frames for identity and gestures ([arXiv 2508.14033](https://arxiv.org/abs/2508.14033)).
- Streaming design for long sequences, using temporal context frames between chunks ([arXiv 2508.14033](https://arxiv.org/abs/2508.14033)).
- Supports 480P and 720P ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).

Weaknesses:

- The README says image-to-video gives good results "for up to 1 minute," and color shifts grow beyond that. The `--max_frame_num` default is 40 seconds ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).
- The paper reports no specific metric values in the abstract. Benchmark numbers: unverified ([arXiv 2508.14033](https://arxiv.org/abs/2508.14033)).
- Self-hosting needs a 14B-parameter base model (Wan2.1-I2V-14B-480P), a wav2vec2 audio encoder, and InfiniteTalk weights ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)). Hardware specs: unverified.
- Camera movement mimicry in video-to-video mode is not identical to the source, per a third-party summary. Treat as unverified.

## 5. License and usage policy

- License: Apache-2.0 for the models in the repository ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).
- Usage policy: the README makes users "fully accountable" for their use. It prohibits content that violates applicable laws, causes harm, spreads misinformation, or targets vulnerable populations ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).
- Base model license (Wan2.1, Wan-AI) and audio encoder license (TencentGameMate): unverified in this document. Check before commercial self-hosting.
- Likeness and consent rules for real people: not stated by the provider. Treat as an open question for any real-face use.

## 6. How Kie.ai resells it

- Kie.ai exposes the model as `infinitalk/from-audio` at `POST /api/v1/jobs/createTask` ([docs.kie.ai](https://docs.kie.ai/market/infinitalk/from-audio)).
- Kie.ai's product page says the API is "developed by MeiGen-AI." The page footer names NEXUSAI SERVICES LLC as the operator of the Kie.ai site, and does not say that company made the model ([kie.ai/infinitalk](https://kie.ai/infinitalk)).
- Kie.ai's price is 3 credits/s (about $0.015) for 480P and 12 credits/s (about $0.06) for 720P, up to 15 seconds per generation ([kie.ai/infinitalk](https://kie.ai/infinitalk)).
- The Kie.ai model page for "InfiniteTalk API" lists the same price ([kie.ai/market/infinitetalk](https://kie.ai/market/infinitetalk)). It gives no price per clip.
- Kie.ai's API docs do not state pricing or audio duration limits. They point to `/common-api/get-account-credits` ([docs.kie.ai](https://docs.kie.ai/market/infinitalk/from-audio)).

## 7. Gaps

- Unverified: the MeiGen-AI legal entity and any official website.
- Unverified: a link between the arXiv authors and MeiGen-AI beyond the repository.
- Unknown: provider-hosted API pricing. The provider sells no API in the sources found. Self-hosting cost: unknown.
- Conflict: Kie.ai's product page says "infinite-length" video, but also "up to 15 seconds per task" ([kie.ai/infinitalk](https://kie.ai/infinitalk)). The GitHub README's practical limit is about 1 minute for image-to-video ([GitHub repo](https://github.com/MeiGen-AI/InfiniteTalk)).
