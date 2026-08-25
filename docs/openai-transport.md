# OpenAI-Compatible Transport

`@felores/kie-ai-openai-server` exposes selected Kie.ai image and video models through OpenAI-shaped HTTP routes. Its model discovery is derived from explicit OpenAI adapters resolved against the core catalog and tool registry. Active media tools without a compatible adapter are explicitly excluded. It is designed to be mounted behind an existing loopback security boundary (such as Infini's Canvas Agent) or run as a standalone loopback binary.

The transport reuses the private `@felores/kie-ai-core` at build time and bundles it into the published package. The core package is never published and never appears in the public dependency list.

## Install

```bash
npm install @felores/kie-ai-openai-server
```

The package has no native dependencies and no install scripts.

## Two usage modes

### Embedded router (mounted behind your own auth)

```ts
import { createKieOpenAiRouter } from "@felores/kie-ai-openai-server";

const router = createKieOpenAiRouter({
  apiKey: process.env.KIE_AI_API_KEY,
  dataDir: process.env.KIE_OPENAI_DATA_DIR,
});

app.use("/kie", yourAuthMiddleware, router);
```

The embedded router assumes the caller has already authenticated the request. It does not read or validate any token.

### Standalone binary (self-contained loopback server)

```bash
KIE_AI_API_KEY=your-key \
KIE_OPENAI_TOKEN=your-local-bearer \
npx kie-ai-openai-server
```

The standalone binary binds to `127.0.0.1:51311` by default, enforces bearer-token authentication, loopback-only Host headers, and optional Origin enrollment.

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `KIE_AI_API_KEY` | (none) | Kie.ai provider credential. If absent, health reports unconfigured. |
| `KIE_AI_BASE_URL` | `https://api.kie.ai/api/v1` | Kie.ai API base URL. |
| `KIE_OPENAI_TOKEN` | (required standalone) | Bearer token for standalone HTTP auth. |
| `KIE_OPENAI_HOST` | `127.0.0.1` | Bind host (must be loopback). |
| `KIE_OPENAI_PORT` | `51311` | Bind port. |
| `KIE_OPENAI_DATA_DIR` | (none) | Directory for the request journal. If absent, journal is in-memory only. |
| `KIE_OPENAI_ALLOWED_ORIGINS` | (none) | Comma-separated allowed Origin URLs beyond loopback. |

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Readiness, contract version, and package version. No secrets. |
| GET | `/v1/models` | Deterministic OpenAI-shaped discovery for the resolved public models. |
| POST | `/v1/images/generations` | Text-to-image generation. |
| POST | `/v1/images/edits` | Image editing with server-side reference uploads (multipart). |
| POST | `/v1/videos` | Create a video generation task. |
| GET | `/v1/videos/:id` | Poll video task status. |
| GET | `/v1/videos/:id/content` | Stream completed video bytes. |
| POST | `/v1/videos/:id/callback` | Authenticated callback reconciliation (no duplicate task). |

`GET /v1/models` uses the local transport catalog, so it remains available when
`KIE_AI_API_KEY` is absent. Standalone Host, Origin, and bearer-token checks still
apply. Embedded deployments continue using the host application's authentication.

## Model matrix

| Public model ID | KIE mapping | Type | Transport compatibility |
|---|---|---|---|
| `kie-nano-banana-image` | Nano Banana 2 | image gen/edit | `output_format=png`, `jpg`, or `jpeg`; `jpeg` maps to Kie `jpg`; up to 14 image references |
| `kie-gpt-image-2` | GPT Image 2 text-to-image or image-to-image | image gen/edit | Fixed PNG output; omitted or explicit `output_format=png`; up to 16 image references |
| `kie-z-image` | Z-Image | image generation | Standard image ratios; one task per requested `n`; accepts `quality=auto`, `low`, or `standard`; fixed PNG output accepts `output_format=png` |
| `kie-seedream-5-pro-image` | Seedream 5 Pro | image gen/edit | PNG or JPEG; 1K/2K; up to 10 references |
| `kie-qwen-image` | Qwen Image | image gen/edit | PNG or JPEG; standard-compatible quality; one reference |
| `kie-flux-2-pro-image` | Flux 2 Pro | image gen/edit | Fixed PNG; 1K/2K; up to 8 references |
| `kie-flux-kontext-pro-image` | Flux Kontext Pro | image gen/edit | PNG or JPEG; standard-compatible quality; one reference; Flux Kontext status route |
| `kie-bytedance-video` | Seedance 2.5 | video | Omitted `preset` or `preset=normal`; both select the same fixed provider route |
| `kie-bytedance-fast-video` | Seedance 2.5 | video | Legacy alias with the same `normal` preset normalization; it does not select a fast mode |
| `kie-kling-3-video` | Kling 3.0 | video | Text/image-to-video; `std` or `pro`; image references and native audio |
| `kie-minimax-h3-video` | MiniMax H3 | video | Text, image, or reference-to-video; `text-to-video`, `image-to-video`, and `reference-to-video` presets |
| `kie-veo3-video` | Veo 3 | video | Text/image-to-video; `veo3` or `veo3_fast`; Veo status polling |
| `kie-wan-3-0-video` | Wan 3.0 | video | Text, keyframe, or multimodal reference-to-video; `kie-wan-2-7-video` is an alias |
| `kie-happyhorse-1-0-video` | HappyHorse 1.0 | video | Text, image, or reference-to-video; editing modes are excluded |
| `kie-midjourney-video` | Midjourney | video | Image-to-video only; one uploaded image; Midjourney status normalization |
| `kie-grok-video` | Grok Imagine | video | Text/image-to-video; `preset=normal`; one uploaded image for image mode |

Video model IDs intentionally omit `seedance` so consumers use the generic video route, not an Ark-specific branch.

`output_format` is optional. An explicit format is checked against the downloaded
result MIME type and file signature. Kie's GPT Image 2 request schema exposes no
format selector, so the transport accepts only its fixed PNG contract and does not
invent JPEG or WebP conversion. A real 1K smoke task through each GPT Image 2
route on 2026-08-24 returned `image/png` with a valid PNG signature.

Image `size` accepts explicit ratios and pixel dimensions. Explicit ratio
strings are reduced and must exactly match a ratio declared by the selected
adapter. Pixel dimensions within a 3% symmetric logarithmic ratio tolerance map
to that adapter's nearest declared ratio, so values such as `1824x1024` map to
`16:9`. Dimensions outside the bounded tolerance are rejected before uploads,
journal reservation, or provider submission. The transport does not resize or
crop returned images, and `quality` continues to select provider resolution
independently from aspect ratio.

`preset=normal` is a client compatibility value. It is not forwarded to Kie because
the current Seedance 2.5 mapping has no provider preset field. Omitted and `normal`
requests have equivalent idempotency semantics.

Masks and `background=transparent` are rejected with `422 unsupported_setting`
before reference upload, journal reservation, or paid provider submission.

## Infinite Canvas setup

Configure Infinite Canvas with:

```text
Base URL: http://127.0.0.1:51311
API key:  the value of KIE_OPENAI_TOKEN
```

Do not append `/v1`; Infinite Canvas appends it.

## Error contract

Every error uses the OpenAI-shaped `{ error: { message, type, param, code } }` envelope.

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `invalid_local_token` | Standalone auth rejected the bearer token. |
| 403 | `origin_not_allowed` | Standalone auth rejected the browser Origin. |
| 409 | `ambiguous_submission` | Request reserved but provider acceptance unknown; do not auto-retry. |
| 409 | `task_not_ready` | Video content requested before completion. |
| 422 | `unsupported_model` / `unsupported_setting` / `unsupported_reference` | Validation rejected the request before submission. |
| 402 | `insufficient_credits` | Kie.ai reported insufficient credits. |
| 429 | `kie_rate_limited` | Kie.ai rate or concurrency limit. |
| 422 | `kie_request_rejected` | Kie.ai returned a definite 4xx rejection. |
| 502 | `kie_upstream_auth` | Kie.ai rejected the server-side credential. |
| 502 | `kie_upstream_error` | Kie.ai failed or returned an invalid response. |
| 503 | `kie_unconfigured` | No server-side KIE key configured. |
| 504 | `kie_timeout` | Local timeout while the provider task remains resumable. |

## Request journal

When `KIE_OPENAI_DATA_DIR` is set, the transport stores one JSON record per hashed request ID. This provides idempotent submission: a stable request ID claims at most one Kie.ai task. A retry of a `reserved` (not yet accepted) request returns `409 ambiguous_submission` and never resubmits. A `submitted` request resumes the existing provider task.

Legal journal states: `reserved -> submitted -> succeeded | failed`. Terminal states never transition backward.

## Container deployment

The standalone binary works in a container. Mount a volume for `KIE_OPENAI_DATA_DIR` if you need durable request journaling across restarts:

```yaml
services:
  kie-openai:
    image: node:20-slim
    command: npx @felores/kie-ai-openai-server
    environment:
      KIE_AI_API_KEY: ${KIE_AI_API_KEY}
      KIE_OPENAI_TOKEN: ${KIE_OPENAI_TOKEN}
      KIE_OPENAI_DATA_DIR: /data
    volumes:
      - kie-data:/data
    ports:
      - "127.0.0.1:51311:51311"
```

Bind to loopback only. Do not expose the transport to remote clients; it is designed as a local-sidecar for a browser application.

## Adapter registry and host trust

Discovery and dispatch use the same resolved adapter registry. An adapter joins one active core catalog entry to its registered tool, core Zod parsing, Kie client submission method, status strategy, exact result-host policy, and paid-task cardinality. An active core image or video tool is either represented by an adapter or listed in the explicit exclusion map with a non-empty reason. This prevents unsupported utilities, avatar workflows, and mixed-media tools from appearing as standard OpenAI models.

| Public model ID | Core tool | Operations | Cardinality |
|---|---|---|---|
| `kie-nano-banana-image` | `nano_banana_image` | generation, edit | one Kie task and exactly one image result per requested `n` item |
| `kie-gpt-image-2` | `gpt_image_2` | generation, edit | one Kie task and exactly one image result per requested `n` item |
| `kie-z-image` | `z_image` | generation | one task and one PNG result per requested `n`; standard-compatible quality values and `output_format=png` are accepted without forwarding unsupported provider fields |
| `kie-seedream-5-pro-image` | `bytedance_seedream_image` | generation, edit | one Seedream 5 Pro task and one PNG/JPEG result per requested `n`; 10 references |
| `kie-qwen-image` | `qwen_image` | generation, edit | one Qwen task and one PNG/JPEG result per requested `n`; one reference |
| `kie-flux-2-pro-image` | `flux2_image` | generation, edit | one Flux 2 Pro task and one fixed PNG result per requested `n`; 8 references |
| `kie-flux-kontext-pro-image` | `flux_kontext_image` | generation, edit | one Flux Kontext Pro task and one PNG/JPEG result per requested `n`; one reference and special status parsing |
| `kie-bytedance-video` | `bytedance_seedance_video` | create video | one task and exactly one video result |
| `kie-bytedance-fast-video` | `bytedance_seedance_video` | create video | legacy alias of `kie-bytedance-video` |
| `kie-kling-3-video` | `kling_video` | text/image-to-video | one task and exactly one video result |
| `kie-minimax-h3-video` | `hailuo_video` | text/image/reference-to-video | one task and exactly one video result |
| `kie-veo3-video` | `veo3_generate_video` | text/image-to-video | one task and exactly one video result; Veo status route |
| `kie-wan-3-0-video` | `wan_video` | text/keyframe/multimodal reference-to-video | one task and exactly one video result |
| `kie-happyhorse-1-0-video` | `happyhorse_video` | text/image/reference-to-video | one task and exactly one video result; edit mode excluded |
| `kie-midjourney-video` | `midjourney_generate` | image-to-video | one task and exactly one video result; image modes remain operation exclusions |
| `kie-grok-video` | `grok_imagine` | text/image-to-video | one task and exactly one video result; image and upscale modes remain operation exclusions |

Reference counts follow each provider/core contract. Multipart uploads also
apply a transport safety ceiling: Seedream 5 Pro and Flux 2 document 30 MiB per
provider reference but this HTTP transport accepts at most 25 MiB per file and
25 MiB total; Qwen's provider and transport limit is 10 MiB; Flux Kontext's
provider documentation does not state a byte limit, so the transport's 25 MiB
ceiling applies without claiming a provider maximum.

Midjourney and Grok video adapters accept at most one image reference and no
video, audio, or frame files. Grok reference files are capped at 20 MiB by the
transport. Both adapters accept only the `normal` compatibility preset, which
is normalized into the provider request and omitted from the provider payload
when it has no provider meaning. Midjourney uses its dedicated `/mj/record-info`
status route and normalizes `successFlag` plus `resultInfoJson.resultUrls` into
the common video polling shape.

The mixed core tools remain executable through their native MCP and CLI routes.
The OpenAI registry records unsupported operations explicitly: Midjourney image,
style-reference, and omni-reference modes, and Grok image-generation, image
editing, and upscale modes are not advertised through standard OpenAI routes.

To add a model, add a source-backed core catalog and tool entry first, then an explicit adapter with model-specific normalization, core schema parsing, Kie client submission, status strategy, cardinality, operations, and evidence-backed exact result hosts. Add deterministic request, polling, result, idempotency, and pre-submission rejection tests. Do not add a separate model list.

`allowedResultHostsByModel` replaces result hosts for one canonical public model and all of its aliases. Alias keys are rejected so trust cannot diverge within one adapter. Unknown IDs and non-public, wildcard, path, credential, loopback, private, link-local, or reserved hosts are rejected during router creation. The legacy `allowedResultHosts` option remains a compatibility replacement only for the four contract-2 public IDs and cannot authorize a newer adapter such as Z-Image.
