# OpenAI Transport Client Compatibility Plan

## Status

- Repository: `kie-cli-mcp`
- Baseline reviewed: `main` at `6c44ec4`
- Affected package: `@felores/kie-ai-openai-server` `0.1.1`
- Planned package version: `0.2.0`
- Implementation status: implemented for `0.2.0`

## Objective

Make `@felores/kie-ai-openai-server` work with Infinite Canvas's native OpenAI image and video requests while preserving compatibility with other OpenAI-shaped clients and every format or mode that the implemented Kie models actually support.

All implementation is in `kie-cli-mcp`. Infinite Canvas does not need source changes or custom request scripts.

## Non-goals

- Mask editing. `mask` and `mask[]` remain explicitly unsupported.
- Transparent image backgrounds. `background=transparent` remains explicitly unsupported.
- Simulating unsupported capabilities with extra paid tasks or post-processing.
- Changing Infinite Canvas.
- Changing the public Kie MCP or CLI contracts unless a shared core defect is found.
- Advertising models that the OpenAI transport does not implement.

## Compatibility rules

1. Infinite Canvas is one supported client, not the definition of the entire transport contract.
2. Existing clients that omit the new optional fields must continue to behave exactly as before.
3. Image formats and video presets are model-specific capabilities, not global restrictions.
4. A requested value may be normalized only when the normalized value is semantically equivalent.
5. Unsupported values fail before reference upload, journal reservation, or paid provider submission.
6. Settings that change provider behavior or output participate in the idempotency fingerprint.
7. The server does not silently ignore settings that would change the requested result.
8. Masks and transparent backgrounds continue returning an OpenAI-shaped `422 unsupported_setting` error.

## Existing transport

The OpenAI transport is implemented in:

- `packages/openai/src/http-server.ts`
- `packages/openai/src/image-adapters.ts`
- `packages/openai/src/video-adapters.ts`
- `packages/openai/src/standalone.ts`
- `packages/openai/src/uploads.ts`
- `packages/openai/src/request-journal.ts`

Existing tests are in:

- `packages/openai/tests/http-security.test.ts`
- `packages/openai/tests/image-contract.test.ts`
- `packages/openai/tests/video-contract.test.ts`
- `packages/openai/tests/package-contract.test.ts`

Existing public model IDs:

| Public model ID | Media type | Kie mapping |
|---|---|---|
| `kie-nano-banana-image` | image generation and editing | Nano Banana 2 |
| `kie-gpt-image-2` | image generation and editing | GPT Image 2 text-to-image or image-to-image |
| `kie-bytedance-video` | video | ByteDance Seedance 2.5 |
| `kie-bytedance-fast-video` | video | Legacy alias for the same Seedance 2.5 route |

Existing routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Readiness and version metadata |
| `POST` | `/v1/images/generations` | Text-to-image generation |
| `POST` | `/v1/images/edits` | Multipart image editing |
| `POST` | `/v1/videos` | Video task creation |
| `GET` | `/v1/videos/:id` | Video status polling |
| `GET` | `/v1/videos/:id/content` | Completed video download |
| `POST` | `/v1/videos/:id/callback` | Provider callback reconciliation |

## Verified current model behavior

The repository's current Zod schemas and client mappings establish:

### Nano Banana 2

- `NanoBananaImageSchema` accepts `output_format: "png" | "jpg"`.
- Its default is `png`.
- `KieAiClient.generateNanoBananaImage()` forwards `output_format` to Kie.
- Therefore the OpenAI transport can support:
  - `png` mapped to Kie `png`.
  - `jpg` mapped to Kie `jpg`.
  - `jpeg` normalized to Kie `jpg`, because JPEG and JPG are equivalent names for the same encoded format.
- `webp` must not be accepted for this model unless current authoritative Kie documentation and the core schema are updated first.

### GPT Image 2

- `GptImage2Schema` has no output-format field.
- `KieAiClient.generateGptImage2()` has no output-format mapping.
- The transport must not invent configurable JPEG or WebP support.
- Before implementation, confirm the documented/native result format for both GPT Image 2 routes:
  - `gpt-image-2-text-to-image`
  - `gpt-image-2-image-to-image`
- If both routes guarantee PNG, accept omitted format and explicit `png`.
- If Kie documents another fixed format, represent that fixed format accurately and do not claim PNG compatibility without a real conversion path.
- Do not add an image-conversion dependency merely to satisfy this plan. The package currently has no native dependencies.

Provider verification completed on 2026-08-24 with one real 1K task through
each Kie route. Both `gpt-image-2-text-to-image` and
`gpt-image-2-image-to-image` returned `Content-Type: image/png`, and both
downloaded files had valid PNG signatures. No credentials, signed URLs, or task
identifiers are retained in this plan.

### Result validation

`packages/openai/src/uploads.ts` already signature-validates PNG, JPEG, and WebP results. Extend the adapter to compare the detected result type with an explicitly requested format, while retaining general validation when the request omitted `output_format`.

### Seedance video

- The public video models map to a fixed Seedance 2.5 route.
- There is currently no `preset` field in the Kie request schema or provider mapping.
- Infinite Canvas's `normal` value is a client compatibility value, not a distinct Kie mode.
- Accepting `normal` may normalize to the current fixed route without forwarding a fake provider field.
- No other preset is advertised until it maps to a documented provider capability.

## Captured Infinite Canvas request contract

The following payloads are embedded here so implementation and tests do not depend on access to the Infinite Canvas repository.

### Image generation

Infinite Canvas posts JSON to `/v1/images/generations`:

```json
{
  "model": "kie-nano-banana-image",
  "prompt": "A red kite",
  "n": 1,
  "quality": "standard",
  "size": "1024x1024",
  "response_format": "b64_json",
  "output_format": "png"
}
```

For model IDs containing `gpt-image`, Infinite Canvas omits `response_format` but still sends `output_format: "png"`:

```json
{
  "model": "kie-gpt-image-2",
  "prompt": "A red kite",
  "n": 1,
  "quality": "standard",
  "size": "1024x1024",
  "output_format": "png"
}
```

### Image editing

Infinite Canvas posts `multipart/form-data` to `/v1/images/edits` with:

```text
model=<public image model ID>
prompt=<edit prompt>
n=<1 to 15>
response_format=b64_json  # omitted for gpt-image model IDs
output_format=png
quality=<configured quality, when present>
size=<configured size, when present>
image=<binary reference image>  # repeated when multiple references exist
```

Mask edits additionally include `mask=<binary PNG>`. Those requests remain outside this plan and must continue failing before provider work.

### Expected image response

Infinite Canvas accepts the existing OpenAI-shaped base64 response:

```json
{
  "created": 0,
  "data": [
    {
      "b64_json": "<base64 image bytes>"
    }
  ]
}
```

Do not change this response contract.

### Video creation

Infinite Canvas posts `multipart/form-data` to `/v1/videos`:

```text
model=kie-bytedance-video
prompt=<video prompt>
seconds=<integer>
size=1280x720              # optional; portrait uses 720x1280
resolution_name=<value>
preset=normal
input_reference[]=<image>  # zero or more references
```

### Video polling and download

1. Creation must return an object containing `id` and a pending-compatible `status`.
2. Infinite Canvas polls `GET /v1/videos/:id`.
3. When status becomes `completed`, Infinite Canvas downloads `GET /v1/videos/:id/content` as a blob.

The existing response and polling contracts must remain unchanged.

### Model discovery

Infinite Canvas sends:

```http
GET /v1/models
Authorization: Bearer <KIE_OPENAI_TOKEN>
```

It reads `data[].id` from an OpenAI-shaped response. Additional standard model fields are allowed.

## Implementation plan

### 1. Add a single transport model catalog

Create a transport-owned model catalog, either in `packages/openai/src/model-catalog.ts` or another focused module. It must be the source for model validation and `/v1/models`.

Each entry contains:

- Public model ID.
- Media type.
- OpenAI `owned_by` value.
- Image output-format mapping when applicable.
- Default image format when known.
- Video preset normalization when applicable.

Do not duplicate independent model arrays in image adapters, video adapters, and the model-list route.

### 2. Implement model-aware `output_format`

Update `packages/openai/src/image-adapters.ts`:

1. Add `output_format` to allowed JSON and multipart text fields.
2. Parse it after reading the selected model.
3. Treat the field as optional.
4. For `kie-nano-banana-image`:
   - Accept `png`.
   - Accept `jpg`.
   - Accept `jpeg` and normalize it to `jpg` for Kie.
   - Reject other values.
5. For `kie-gpt-image-2`, use the verified fixed-format decision described above. Do not invent configurable formats.
6. Forward the normalized Kie value for models with a real provider format field.
7. Preserve existing behavior when `output_format` is omitted.
8. Include the normalized semantic format in the request fingerprint when explicitly requested or when it changes provider behavior.
9. If a format was explicitly requested, verify the downloaded signature and MIME type match it.
10. Preserve `response_format=b64_json` behavior and the existing response envelope.

An unsupported model-and-format combination returns:

```json
{
  "error": {
    "message": "<clear model-specific message>",
    "type": "invalid_request_error",
    "param": "output_format",
    "code": "unsupported_setting"
  }
}
```

The rejection must happen before uploads, journal reservation, and Kie submission.

### 3. Implement extensible `preset` normalization

Update `packages/openai/src/video-adapters.ts`:

1. Add `preset` to allowed JSON and multipart text fields.
2. Parse it after selecting the public model.
3. Treat it as optional.
4. Accept `normal` for both current public video IDs.
5. Normalize `normal` to the existing fixed Seedance 2.5 behavior.
6. Do not forward a `preset` property to Kie because no such provider mapping exists.
7. Requests without `preset` remain valid and semantically equivalent.
8. Because omitted and `normal` select identical provider behavior, they must produce equivalent semantic fingerprints.
9. Reject any other value before file upload, journal reservation, or provider submission.

Future presets are added only when the core Kie schema and client mapping expose a real provider capability.

### 4. Add `GET /v1/models`

Update `packages/openai/src/http-server.ts`.

Return:

```json
{
  "object": "list",
  "data": [
    {
      "id": "kie-nano-banana-image",
      "object": "model",
      "created": 0,
      "owned_by": "kie.ai"
    },
    {
      "id": "kie-gpt-image-2",
      "object": "model",
      "created": 0,
      "owned_by": "kie.ai"
    },
    {
      "id": "kie-bytedance-video",
      "object": "model",
      "created": 0,
      "owned_by": "kie.ai"
    },
    {
      "id": "kie-bytedance-fast-video",
      "object": "model",
      "created": 0,
      "owned_by": "kie.ai"
    }
  ]
}
```

Requirements:

- Deterministic order and fields.
- Available even when `KIE_AI_API_KEY` is absent because the catalog is local.
- Still protected by standalone Host, Origin, and bearer-token middleware.
- Embedded mode continues delegating authentication to the host application.
- No provider credentials, local tokens, internal Kie route names, or mutable task state.

### 5. Add contract and regression tests

#### `packages/openai/tests/image-contract.test.ts`

Add tests for:

- The two captured Infinite Canvas JSON generation payloads.
- Captured multipart editing with `output_format=png`.
- Existing requests with no `output_format`.
- Nano Banana `jpg` forwarding.
- Nano Banana `jpeg` alias normalization to Kie `jpg`.
- Unsupported Nano Banana format rejection before provider work.
- GPT Image 2 fixed-format behavior based on the verified provider contract.
- Requested result-format signature and MIME mismatch rejection.
- Existing `mask` rejection before provider work.
- Existing `background=transparent` rejection before provider work.

#### `packages/openai/tests/video-contract.test.ts`

Add tests for:

- The captured Infinite Canvas multipart creation request with `preset=normal`.
- The same request with repeated `input_reference[]` images.
- A request with no `preset`.
- Proof that `normal` is not forwarded to Kie.
- Semantic equivalence of omitted and `normal` for idempotency.
- Unsupported preset rejection before uploads and provider work.
- Existing creation, polling, and content download behavior.

#### `packages/openai/tests/http-security.test.ts`

Add tests for:

- Authenticated standalone `/v1/models` discovery.
- Missing or invalid bearer rejection.
- Allowed loopback Origin and CORS headers.
- Embedded-router discovery.
- Discovery with no Kie API key.
- Exact public model IDs and deterministic fields.
- No secret leakage.

#### `packages/openai/tests/package-contract.test.ts`

Update the expected OpenAI package version and retain all self-contained bundle and dry-run package assertions.

### 6. Update documentation and versions

Update:

- `docs/openai-transport.md`
- `packages/openai/README.md`
- `CHANGELOG.md`
- `packages/openai/package.json`
- `packages/openai/src/version.ts`
- `packages/openai/tests/package-contract.test.ts`
- `package-lock.json`

Version decisions:

- Bump `@felores/kie-ai-openai-server` from `0.1.1` to `0.2.0` because this adds a route and backward-compatible request capabilities.
- Increment `CONTRACT_VERSION` from `1` to `2`.
- Do not bump MCP or CLI packages unless their published behavior changes.

Document the model-specific format matrix, preset normalization, `/v1/models`, and explicit mask/background exclusions.

Document Infinite Canvas setup:

```text
Base URL: http://127.0.0.1:51311
API key:  the value of KIE_OPENAI_TOKEN
```

Do not append `/v1`; Infinite Canvas appends it.

## Verification commands

Run from the `kie-cli-mcp` root:

```bash
npm run typecheck
npm run build
npm test
npm run check
npm pack -w @felores/kie-ai-openai-server --dry-run
```

No live provider task is required for deterministic contract verification. If a valid `KIE_AI_API_KEY` is available, optionally smoke-test one image generation and one video generation after all automated checks pass.

## Acceptance criteria

1. The captured Infinite Canvas image-generation requests succeed.
2. Captured image edits without masks succeed.
3. Captured video creation with `preset=normal` succeeds.
4. Video polling and content download remain compatible.
5. `/v1/models` returns exactly the four implemented public model IDs.
6. Requests omitting `output_format` or `preset` remain valid.
7. Nano Banana retains PNG and JPEG/JPG support.
8. GPT Image 2 advertises and accepts only its verified real output behavior.
9. Unsupported formats and presets fail before uploads, reservation, or provider work.
10. Masks and transparent backgrounds remain explicitly unsupported.
11. The OpenAI package remains self-contained with no published private-core dependency.
12. All verification commands pass.

## Delivery procedure

1. Update local `main` and create a topic branch.
2. Implement only this plan's scoped OpenAI transport changes.
3. Run all verification commands.
4. Commit and push the topic branch.
5. Open a pull request containing the compatibility matrix and test evidence.
6. Wait for the required `Verify` check.
7. Merge through the pull request.
8. Switch to `main`, pull with `--ff-only`, and confirm a clean tree matching `origin/main`.
9. Tag and publish `0.2.0` only through the repository release process.
