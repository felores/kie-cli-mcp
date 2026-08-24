# OpenAI-Compatible Transport

`@felores/kie-ai-openai-server` exposes selected Kie.ai image and video models through OpenAI-shaped HTTP routes. It is designed to be mounted behind an existing loopback security boundary (such as Infini's Canvas Agent) or run as a standalone loopback binary.

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
| GET | `/v1/models` | Deterministic OpenAI-shaped discovery for the four implemented public models. |
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
| `kie-bytedance-video` | Seedance 2.5 | video | Omitted `preset` or `preset=normal`; both select the same fixed provider route |
| `kie-bytedance-fast-video` | Seedance 2.5 | video | Legacy alias with the same `normal` preset normalization; it does not select a fast mode |

Video model IDs intentionally omit `seedance` so consumers use the generic video route, not an Ark-specific branch.

`output_format` is optional. An explicit format is checked against the downloaded
result MIME type and file signature. Kie's GPT Image 2 request schema exposes no
format selector, so the transport accepts only its fixed PNG contract and does not
invent JPEG or WebP conversion. A real 1K smoke task through each GPT Image 2
route on 2026-08-24 returned `image/png` with a valid PNG signature.

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
