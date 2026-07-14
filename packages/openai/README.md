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
