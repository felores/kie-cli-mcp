# @felores/kie-ai-openai-server

OpenAI-compatible HTTP transport for selected Kie.ai image and video models.

## Embedded router

The embedded router owns provider request validation and response normalization. Its host application must authenticate callers before mounting it.

```ts
import { createKieOpenAiRouter } from "@felores/kie-ai-openai-server";

app.use(
  "/kie",
  existingAuthentication,
  createKieOpenAiRouter({
    apiKey: process.env.KIE_AI_API_KEY,
    dataDir: process.env.KIE_OPENAI_DATA_DIR,
  }),
);
```

`GET /kie/health` returns only readiness, contract version, and package version. The router never reads a local bearer token and never exposes the KIE API key.

`GET /kie/v1/models` returns the local OpenAI-shaped model catalog. It remains
available without a Kie API key because discovery does not contact the provider.

## Standalone server

```bash
KIE_AI_API_KEY=<KIE_API_KEY> \
KIE_OPENAI_TOKEN=<LOCAL_BEARER_TOKEN> \
kie-ai-openai-server
```

The standalone server binds to `127.0.0.1:51311` by default and refuses non-loopback hosts. Configure it with:

- `KIE_OPENAI_HOST`: `127.0.0.1`, `localhost`, or `::1`
- `KIE_OPENAI_PORT`: listening port
- `KIE_OPENAI_TOKEN`: required local bearer token
- `KIE_OPENAI_ALLOWED_ORIGINS`: optional comma-separated additional origins
- `KIE_OPENAI_DATA_DIR`: transport-owned task data
- `KIE_AI_API_KEY`: server-side Kie.ai credential
- `KIE_AI_BASE_URL`: optional Kie.ai API base URL

Every non-preflight request requires `Authorization: Bearer <LOCAL_BEARER_TOKEN>`. Provider credentials, callback URLs, and remote output URLs are rejected in client request bodies.

## Client compatibility

| Model | Image format or video preset |
|---|---|
| `kie-nano-banana-image` | `output_format=png`, `jpg`, or `jpeg` (`jpeg` normalizes to `jpg`) |
| `kie-z-image` | generation only; PNG output and standard ratios |
| `kie-seedream-5-pro-image` | Generation/editing; PNG or JPEG; 1K/2K; up to 10 references |
| `kie-qwen-image` | Generation/editing; PNG or JPEG; one reference |
| `kie-flux-2-pro-image` | Generation/editing; fixed PNG; 1K/2K; up to 8 references |
| `kie-flux-kontext-pro-image` | Generation/editing; PNG or JPEG; one reference |
| `kie-gpt-image-2` | Fixed PNG; omit `output_format` or use `png` |
| `kie-bytedance-video` | Omit `preset` or use `preset=normal` |
| `kie-bytedance-fast-video` | Same fixed Seedance 2.5 route and preset behavior |
| `kie-kling-3-video` | Text/image-to-video; `preset=std` or `pro`; native audio via `generate_audio` |
| `kie-minimax-h3-video` | Text/image/reference-to-video; use the matching `preset` for ambiguous image references |
| `kie-veo3-video` | Text/image-to-video; `preset=veo3` or `veo3_fast`; fixed provider duration |
| `kie-wan-2-7-video` | Text/image/reference-to-video; video editing is not exposed |
| `kie-happyhorse-1-0-video` | Text/image/reference-to-video; video editing is not exposed |

Explicit image formats are verified against the result MIME type and file
signature. Masks and `background=transparent` are unsupported and fail before
provider work.

For Infinite Canvas, use `http://127.0.0.1:51311` as the base URL and the value
of `KIE_OPENAI_TOKEN` as the API key. Do not append `/v1`.
