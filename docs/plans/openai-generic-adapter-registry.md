# OpenAI Generic Adapter Registry Plan

## Status

- Repository: `kie-cli-mcp`
- Baseline reviewed: `main` at `e14ae99`
- Affected package: `@felores/kie-ai-openai-server`
- Baseline OpenAI package version: `0.2.0`
- Implemented feature version: `0.3.0`
- Baseline OpenAI contract version: `2`
- Implemented contract version: `3`
- Implementation status: completed 2026-08-24

## Objective

Replace the OpenAI transport's standalone four-model catalog with a generic adapter registry that joins explicit OpenAI mappings to the canonical Kie core catalog and tool registry.

`GET /v1/models` must be derived at runtime from that resolved registry. It must expose every active Kie image or video model that has a complete, tested OpenAI mapping and exclude every model that lacks one.

This removes independent discovery hardcoding without pretending that arbitrary Kie schemas can be translated automatically.

## Required outcome

```text
MODEL_CATALOG + TOOL_REGISTRY + OPENAI_ADAPTER_REGISTRY
                         |
                         v
               resolved OpenAI models
                         |
             +-----------+------------+
             |                        |
       GET /v1/models           request dispatch
                                  image/video
```

Adding or changing a Kie model follows one source-backed path:

1. The core catalog identifies the active Kie tool and model family.
2. The core tool owns its Zod request schema and Kie client submission method.
3. An OpenAI adapter declares the supported OpenAI operations and translation.
4. The resolved registry automatically adds the public model to discovery and dispatch.

There is no separately maintained model list in `http-server.ts`, image adapters, video adapters, or documentation.

## Non-goals

- Exposing every catalog entry regardless of compatibility.
- Inferring parameter semantics from Zod field names alone.
- Replacing the Kie core tool registry.
- Running MCP tool handlers inside HTTP requests.
- Publishing audio models through image or video routes.
- Treating image utilities, lip-sync tools, avatar tools, or video editors as standard generation models without an explicit route mapping.
- Adding mask or transparent-background support unless an adapter has a real provider implementation.
- Breaking the four public model IDs released in OpenAI transport `0.2.0`.

## Why explicit adapters remain necessary

The core catalog is metadata. It deliberately leaves request validation and endpoint routing with the registered tools.

Kie media models differ in:

- Provider endpoint.
- Provider model name.
- Text, image, video, and audio reference fields.
- Generation versus editing mode detection.
- Aspect-ratio and size vocabulary.
- Quality and resolution vocabulary.
- Output format.
- Maximum reference count and byte limits.
- Callback behavior.
- Task-status endpoint and state shape.
- Result URL extraction.

The system can automate discovery and dispatch only after an explicit adapter defines those semantics. A model is "available" to the OpenAI transport when the core entry is active and its adapter passes registry validation.

## Pre-implementation feasibility test

The baseline repository already contains substantially more compatible media tools than the four public OpenAI model IDs.

### Catalog and registry join

A read-only join of `MODEL_CATALOG` and `TOOL_REGISTRY` produced:

```text
Active registered image/video tools: 24
Tool families behind current OpenAI IDs: 3
Additional active image/video tools: 21
```

The current four public IDs use three tool families because `kie-bytedance-video` and `kie-bytedance-fast-video` are aliases for one Seedance tool.

### Strong additional candidates

The following ten tools are active in `MODEL_CATALOG`, present in `TOOL_REGISTRY`, categorized as image or video, backed by Zod schemas, submit asynchronous Kie tasks, and have status-routing support or an explicit special status route.

| Core tool | Catalog model | Category | OpenAI-shaped operations already represented by its schema | Polling family |
|---|---|---|---|---|
| `bytedance_seedream_image` | `seedream-5-lite` | image | generation, editing, references, aspect ratio, quality, output format | jobs |
| `qwen_image` | `qwen-image` | image | generation, single-image editing, size, output format, count | jobs |
| `flux2_image` | `flux-2-pro` | image | generation, multi-reference editing, aspect ratio, resolution | jobs |
| `z_image` | `z-image` | image | generation, aspect ratio | jobs |
| `flux_kontext_image` | `flux-kontext-pro` | image | generation, single-image editing, aspect ratio, output format | Flux Kontext special route |
| `veo3_generate_video` | `veo3` | video | text-to-video, image-to-video, aspect ratio | Veo special route |
| `kling_video` | `kling-3.0` | video | text-to-video, image-to-video, duration, aspect ratio, audio | jobs |
| `hailuo_video` | `minimax-h3` | video | text, image, end-frame, and multimodal reference-to-video | jobs |
| `wan_video` | `wan-2.7` | video | text, image, reference, and editing modes | jobs |
| `happyhorse_video` | `happyhorse-1.0` | video | text, image, reference, and editing modes | jobs |

The test inspected generated JSON-schema fields, not only catalog descriptions. Examples:

- Seedream exposes `prompt`, `image_urls`, `aspect_ratio`, `quality`, and `output_format`.
- Qwen exposes `prompt`, `image_url`, `image_size`, `output_format`, and `num_images`.
- Flux 2 exposes `prompt`, `input_urls`, `aspect_ratio`, and `resolution`.
- Kling exposes `prompt`, `image_urls`, `duration`, `aspect_ratio`, and `sound`.
- Hailuo exposes `prompt`, first/end images, multimodal references, duration, ratio, and resolution.

This proves that a generic registry has useful expansion targets. It does not prove that all 21 additional tools belong on standard OpenAI routes.

### Specialized entries requiring explicit exclusion or later adapters

Every active media catalog entry must be classified. Initial likely exclusions include:

| Tool family | Reason it must not appear automatically |
|---|---|
| Topaz upscale | Transformation requiring an existing image, not generation/edit semantics |
| Ideogram reframe | Reframe transformation with its own required input contract |
| Recraft remove background | Background-removal utility, explicitly outside current compatibility scope |
| Runway Aleph | Video-to-video editing, not generic create-video input |
| Wan Animate | Character animation/replacement with specialized media inputs |
| InfiniTalk, Kling Avatar, OmniHuman | Avatar/lip-sync workflows requiring image and audio contracts |
| Gemini Omni | Mixed character, voice, and video operations |
| Midjourney | Mixed image/video modes and special submission/status routes |
| Grok Imagine | One tool owns image, video, and upscale modes; requires multiple explicit public descriptors |

An exclusion is data with a reason, not an omitted code comment. Registry tests must require every active core image/video entry to be either adapted or explicitly excluded.

## Architecture

### 1. Preserve the core sources of truth

Keep these responsibilities:

- `packages/core/src/model-catalog.ts`: source-backed model-family metadata and active/paused state.
- `packages/core/src/tools/index.ts`: executable tool registry.
- Tool Zod schemas: provider request validation.
- `KieAiClient`: provider submission and status requests.

Do not call `ToolDef.run()` from the OpenAI transport. Tool handlers create MCP/CLI database records and return MCP content envelopes. The OpenAI transport owns a separate request journal and HTTP response contract.

### 2. Add an OpenAI adapter registry

Replace `packages/openai/src/model-catalog.ts` with focused modules such as:

```text
packages/openai/src/registry/types.ts
packages/openai/src/registry/resolve.ts
packages/openai/src/registry/image-adapters.ts
packages/openai/src/registry/video-adapters.ts
packages/openai/src/registry/exclusions.ts
```

The exact file split may remain smaller if that reduces code. The invariant matters: discovery and dispatch use the same resolved registry.

### 3. Define discriminated adapter descriptors

Use separate image and video descriptors. A representative shape is:

```ts
interface OpenAiAdapterBase {
  toolName: string;
  publicModelId: string;
  aliases?: string[];
  ownedBy: "kie.ai";
  apiType: string;
  capabilities: string[];
  statusStrategy: StatusStrategy;
  allowedResultHosts: string[];
  resultHostEvidenceUrl: string;
}

interface OpenAiImageAdapter extends OpenAiAdapterBase {
  mediaType: "image";
  operations: Array<"generation" | "edit">;
  limits: {
    maxReferences: number;
    maxReferenceBytes: number;
  };
  outputFormats: Record<string, ImageFormatMapping>;
  defaultOutputFormat?: ImageFormatMapping;
  cardinality: ImageCardinalityStrategy;
  normalizeGeneration(input: OpenAiImageInput): NormalizedSubmission;
  normalizeEdit(input: OpenAiImageInput): NormalizedSubmission;
  submit(client: KieAiClient, request: unknown): Promise<TaskResponse>;
}

interface OpenAiVideoAdapter extends OpenAiAdapterBase {
  mediaType: "video";
  operations: Array<"text-to-video" | "image-to-video" | "reference-to-video">;
  referenceFields: ReferenceFieldMapping;
  presets: Record<string, PresetMapping>;
  cardinality: VideoCardinalityStrategy;
  normalizeCreate(input: OpenAiVideoInput): NormalizedSubmission;
  submit(client: KieAiClient, request: unknown): Promise<TaskResponse>;
}
```

These names are illustrative. The implementation should keep the minimum fields needed by real adapters.

### 4. Define paid-task and result cardinality

Every adapter must state how OpenAI `n` maps to provider submissions and results. Never infer this from fields such as `max_images` or `num_images`.

An image descriptor declares one strategy:

```ts
type ImageCardinalityStrategy =
  | {
      submission: "one-task-per-image";
      providerCount: "one";
      expectedResultsPerTask: 1;
    }
  | {
      submission: "provider-batch";
      providerCountField: string;
      maxProviderCount: number;
      expectedResults: "exact-request-count";
    };
```

The common executor applies exactly one mechanism:

- `one-task-per-image`: submit `n` tasks and force the provider count to one.
- `provider-batch`: submit one task and set the declared provider count field to `n`.

It must never fan out `n` tasks while also requesting `n` results per task. Validate final result count against the descriptor before downloading. A mismatch is an invalid provider result, not a reason to submit more paid work.

Video descriptors declare whether one task may return one or multiple result URLs. The existing `/v1/videos` contract represents one logical video task, so initial adapters require exactly one result unless a separately documented policy safely exposes multiple outputs without duplicate submissions.

Cardinality tests are mandatory for Seedream `max_images`, Qwen `num_images`, current image fan-out, and every provider that can return multiple URLs.

### 5. Join adapters to the core catalog and tools

At module initialization, resolve each descriptor against both core registries:

1. `getCatalogEntry(adapter.toolName)` must exist.
2. The catalog entry must be `active`.
3. `getTool(adapter.toolName)` must exist.
4. Tool category must match adapter media type, except an explicitly reviewed mixed-media adapter.
5. The adapter must reference the same core Zod schema used by the tool or call that schema's parser.
6. Public model IDs and aliases must be unique.
7. `apiType` must have a registered status strategy.
8. Every adapter operation must have a normalization and submission path.
9. Cardinality strategy must be complete and compatible with the provider schema.
10. Result hosts must be evidence-backed exact hostnames without wildcards, credentials, paths, or private-network targets.

Resolution failure must fail tests and development startup. Production should never advertise a partially resolved descriptor.

### 6. Make discovery fully derived

`openAiModelList()` must map the resolved adapters, not a standalone array.

```text
GET /v1/models
  -> resolve active valid adapters
  -> expand public IDs and aliases
  -> deterministic sort
  -> OpenAI model objects
```

The endpoint remains local and deterministic. It does not query Kie on each request. "Automatic" means it follows the current bundled core catalog and adapter registry without a second list.

When a package update adds a new catalog entry and adapter, Infinite Canvas sees it on its next model-list refresh.

Infinite Canvas currently reads only `data[].id` and guesses media capability from model-name keywords. New public IDs must contain an unambiguous `image` or `video` marker, for example:

```text
kie-z-image
kie-flux-2-pro-image
kie-minimax-h3-video
kie-veo3-video
```

Do not assume provider names such as `minimax-h3` will be classified as video. Add a compatibility fixture that applies Infinite Canvas's current classification rule to every discovered public ID and verifies the expected category. This naming requirement may be relaxed only after Infinite Canvas consumes explicit model metadata and a cross-repository test proves it.

### 7. Make request dispatch registry-driven

Replace image and video model switches with registry lookup:

```text
public model ID
  -> resolved adapter
  -> common OpenAI validation
  -> adapter normalization
  -> core Zod validation
  -> reference upload
  -> journal reservation
  -> adapter submission
  -> descriptor status strategy
  -> safe result download
  -> OpenAI response
```

Common execution retains:

- Bearer/Origin/Host security.
- Body limits.
- Reference signature validation.
- Upload allowlists.
- Idempotency journal.
- Descriptor-controlled image fan-out or provider batching.
- Polling timeouts.
- Adapter-specific result-host allowlists.
- Result byte limits and media signatures.
- OpenAI-shaped errors.

Adapters own only model-specific translation and declared capabilities.

### 8. Centralize status strategies

Create named strategies for the status families already present in core:

- `jobs`: `/jobs/recordInfo`, `state`, `resultJson.resultUrls`.
- `veo`: `/veo/record-info` and Veo result extraction.
- `flux-kontext`: `/flux/kontext/record-info` and `successFlag` extraction.
- `midjourney`: `/mj/record-info`, only when a later adapter is approved.
- `runway-aleph`: specialized status and result parsing, only when a later adapter is approved.

Each strategy declares pending, success, failure, result extraction, and content type. Adapters reference a strategy instead of duplicating polling code.

Status strategies remain behind `KieAiClient`. They call `client.getTaskStatus(taskId, apiType)` or a focused client method, then parse the returned envelope. The OpenAI package must not construct raw provider status URLs or call `fetch` for Kie API requests.

### 9. Own result-host trust per adapter

Every adapter declares exact CDN hosts for result downloads and cites Kie documentation or verified provider evidence for those hosts.

The common downloader receives the resolved adapter's host set and validates every redirect. Preserve current hosts for existing IDs. A new adapter must not broaden one global allowlist for unrelated models.

Registry validation rejects wildcards, URL paths, embedded credentials, loopback hosts, and private, link-local, or reserved addresses. Tests cover expected hosts, foreign public hosts, redirects, and private targets.

Preserve the existing embedded-router option without turning it into global trust for future adapters:

```ts
interface KieOpenAiRouterOptions {
  /** Legacy replacement host set for the four public IDs from contract 2. */
  allowedResultHosts?: string[];
  /** Exact replacement host set keyed by canonical public model ID. */
  allowedResultHostsByModel?: Record<string, string[]>;
}
```

Composition rules:

1. `allowedResultHostsByModel[modelId]` replaces that descriptor's default set for only that canonical model and its aliases.
2. Legacy `allowedResultHosts` retains its current replacement semantics for the four IDs released in contract 2.
3. Legacy `allowedResultHosts` does not authorize hosts for new adapters.
4. Without either option, use the descriptor's evidence-backed defaults.
5. Reject unknown model keys and invalid host values during router creation.
6. Document the legacy option as compatibility-only and keep it until a future major release.

Tests prove that existing embedded callers retain custom-CDN behavior and that a host authorized for one model is rejected for every unrelated model.

### 10. Represent exclusions explicitly

Add an exhaustive exclusion map keyed by core `toolName`:

```ts
const openAiExclusions = {
  topaz_upscale_image: "utility operation is not mapped to standard image routes",
  recraft_remove_background: "transparent-background workflow is outside contract",
  // ...
} satisfies Record<string, string>;
```

Do not add utility/audio tools to this map. Completeness targets active core entries whose registered category is image or video.

The completeness test requires every such entry to resolve to one or more adapters or one explicit exclusion.

## Migration of existing models

Migrate without changing behavior:

| Existing public ID | Core tool | Required preservation |
|---|---|---|
| `kie-nano-banana-image` | `nano_banana_image` | generation/edit, PNG/JPG/JPEG mapping, limits, ratios, quality mapping |
| `kie-gpt-image-2` | `gpt_image_2` | generation/edit, verified PNG behavior, limits, ratios |
| `kie-bytedance-video` | `bytedance_seedance_video` | current create, references, polling, content route |
| `kie-bytedance-fast-video` | `bytedance_seedance_video` | retained alias with the same fixed Seedance behavior |

Existing journal records remain valid. Public IDs, fingerprints, status IDs, routes, and errors must remain stable.

## Initial expansion sequence

### Phase 1: registry foundation

1. Introduce descriptor types and registry resolution.
2. Migrate the four current public IDs.
3. Derive `/v1/models` and request lookup from the resolved registry.
4. Add exhaustive adapter-or-exclusion coverage for all active media tools.
5. Verify zero behavior change for OpenAI `0.2.0` clients.

Completion criterion: current contract tests pass unchanged apart from registry-specific assertions, and no model list exists outside the resolved registry.

### Phase 2: straightforward image adapters

Implement and verify, in this order:

1. `z_image`, generation only.
2. `flux2_image`, generation and editing.
3. `qwen_image`, generation and editing.
4. `bytedance_seedream_image`, with public IDs or profiles that make version-specific format behavior honest.
5. `flux_kontext_image`, after its special polling strategy is covered.

Do not collapse provider variants when they have materially different formats, limits, quality fields, or reference behavior. One core tool may expose multiple public model IDs.

Completion criterion: every advertised image operation has exact generation/edit contract tests, invalid settings fail before upload/reservation, and returned bytes match declared formats.

### Phase 3: straightforward video adapters

Implement and verify:

1. `kling_video`.
2. `hailuo_video`.
3. `veo3_generate_video` with the Veo status strategy.
4. `wan_video` modes that can be represented by the existing create-video multipart contract.
5. `happyhorse_video` modes that can be represented safely.

Expose only operations representable by current HTTP routes. Keep video editing or specialized reference modes excluded until the route contract supports their inputs without ambiguity.

Completion criterion: each advertised video model passes create, poll, content-download, reference-upload, idempotency, and early-rejection tests.

### Phase 4: mixed and specialized tools

Evaluate Midjourney, Grok Imagine, video editors, animation, and avatar tools individually. A core tool may produce multiple public model IDs with different media types and operations.

No specialized entry moves from exclusion to discovery without an explicit descriptor and contract tests.

## Public model ID rules

- Keep every existing ID.
- New IDs use stable Kie transport names, not temporary provider route strings.
- New IDs include an unambiguous `image` or `video` marker while Infinite Canvas classifies fetched models by name.
- Provider versions with different capabilities receive different public IDs or explicit profiles.
- Aliases resolve through the same descriptor and semantic fingerprint.
- Removed or paused core entries disappear only in a breaking or documented deprecation release.
- `/v1/models` order is deterministic, preferably media type then public ID.

## Validation order

For every request:

1. Parse body or multipart within size limits.
2. Resolve public model ID.
3. Confirm route operation is supported by that descriptor.
4. Reject unsupported OpenAI fields and values.
5. Validate reference count, MIME, signature, and total bytes.
6. Normalize model-specific fields.
7. Parse with the core Zod schema.
8. Calculate the semantic fingerprint.
9. Upload references.
10. Reserve the journal record.
11. Submit the paid provider task.

Model validation must happen before uploads and journal reservation. A failed adapter translation must never incur provider work.

## Idempotency requirements

The common fingerprint includes:

- Resolved canonical public model ID.
- Operation.
- Prompt.
- Normalized count, size, quality, duration, ratio, resolution, and format.
- Semantic preset or profile when it changes behavior.
- Hashes and normalized roles of every reference file.

Equivalent aliases produce equal fingerprints. Different provider variants or materially different defaults produce different fingerprints.

Registry migration must preserve fingerprints for the existing four IDs.

## Tests

### Registry tests

Add focused tests that prove:

- Every adapter references an active core catalog entry.
- Every adapter references a registered core tool.
- Tool category and adapter media type agree.
- Public IDs and aliases are unique.
- Every adapter has a valid status strategy.
- Every adapter has a valid paid-task/result cardinality strategy.
- Every downloadable adapter has an evidence-backed result-host policy.
- Every active registered image/video tool is adapted or explicitly excluded.
- Paused, missing, invalid, or excluded tools never appear in `/v1/models`.
- `/v1/models` equals the deterministic resolved adapter list.
- Every discovered ID is classified by the captured Infinite Canvas rule as the descriptor's media type.
- No second hand-maintained discovery list exists.

### Adapter contract tests

Each public model ID needs fixtures for every advertised operation:

- Exact accepted OpenAI request.
- Exact normalized core request.
- Exact Kie submission payload.
- Reference upload mapping.
- Provider task ID extraction.
- Exact provider submission count and exact expected result count.
- Pending, successful, failed, and malformed status responses.
- Result URL safety and media signature.
- Adapter-specific host acceptance and redirect rejection.
- Unsupported fields and limits rejected before provider work.
- Idempotent retry and conflicting-key behavior.

Table-driven tests should share common contract assertions while keeping model-specific fixtures readable.

### Backward compatibility tests

Keep the complete `0.2.0` image, video, security, journal, and package tests. Add explicit snapshots for the four current public descriptors and fingerprints before deleting the old catalog implementation.

### Package tests

Verify the published bundle:

- Contains the core catalog and registered adapter mappings.
- Does not depend on the private core package at runtime.
- Does not publish source/tests.
- Starts in standalone mode with existing environment variables.
- Returns the same security errors as `0.2.0`.

## Documentation

Update:

- `docs/openai-transport.md`
- `packages/openai/README.md`
- `README.md`
- `README.es.md`
- `CHANGELOG.md`

Generate the documented OpenAI model matrix from the resolved registry when practical. If generation would add unnecessary machinery, add a test that compares documented IDs with registry IDs.

Document:

- Automatic discovery semantics.
- The difference between core availability and OpenAI compatibility.
- Public IDs, operations, formats, limits, and polling families.
- Explicit exclusions and why they are excluded.
- How a contributor adds a new adapter.

## Versioning

Release as `@felores/kie-ai-openai-server@0.3.0` with contract version `3` after the registry foundation and at least one new model adapter are complete.

Update:

- `packages/openai/package.json`
- `package-lock.json`
- `packages/openai/src/version.ts`
- `packages/openai/tests/package-contract.test.ts`
- Changelog and mirrored README references

MCP and CLI versions do not change unless shared core behavior visible to those packages changes.

## Verification commands

Run from the repository root:

```bash
npm run typecheck
npm run build
npm test
npm run check
npm pack -w @felores/kie-ai-openai-server --dry-run
```

Add a focused command or test that prints the resolved registry summary:

```text
active core media tools: N
adapted tool families: N
public OpenAI model IDs: N
explicit exclusions: N
unaccounted active media tools: 0
```

## Acceptance criteria

1. `/v1/models` is derived from active core entries joined to valid adapters.
2. Image and video dispatch use the same resolved registry as discovery.
3. No standalone hardcoded public-model list remains.
4. Every active registered core image/video tool is adapted or explicitly excluded with a reason.
5. At least one additional image or video model is exposed and works end to end.
6. The existing four public IDs retain their exact behavior and security contract.
7. Invalid or unsupported model requests fail before upload, reservation, or paid submission.
8. Every advertised operation has deterministic contract tests.
9. Registry completeness tests report zero unaccounted active media tools.
10. Provider task count and result count follow one declared cardinality strategy without multiplication.
11. Infinite Canvas discovers and correctly classifies new mapped models through its existing model-fetch action without source changes.
12. New adapters cannot broaden result-host trust for unrelated models.
13. Status polling remains behind `KieAiClient`.
14. The package remains self-contained and all verification commands pass.

## Delivery procedure

1. Update local `main` and create a topic branch.
2. Implement Phase 1 and one bounded Phase 2 adapter before broad expansion.
3. Run the registry completeness report and all verification commands.
4. Obtain an independent evaluator review because this changes discovery and dispatch across every OpenAI model.
5. Commit and push the topic branch.
6. Open a pull request with the resolved registry report, compatibility matrix, and test evidence.
7. Wait for the required `Verify` check.
8. Merge through the pull request.
9. Synchronize local `main` with `origin/main` and confirm a clean tree.
10. Tag and publish `0.3.0` through the repository release process.
