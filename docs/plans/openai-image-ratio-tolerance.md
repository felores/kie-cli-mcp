# OpenAI Image Dimension-to-Ratio Compatibility Plan

## Status

- Repository: `kie-cli-mcp`
- Baseline reviewed: `main` at `fc775b3`
- Affected package: `@felores/kie-ai-openai-server`
- Baseline package version: `0.6.0`
- Planned package version: `0.6.1`
- OpenAI contract version: keep `3`
- Implementation status: completed in OpenAI transport 0.6.1

## Objective

Allow OpenAI image clients such as Infinite Canvas to send ordinary pixel dimensions that are close to a model-supported aspect ratio without being rejected because of harmless pixel-grid rounding.

The transport must map a dimension string such as `1824x1024` to GPT Image 2's supported `16:9` ratio while continuing to reject dimensions that are materially different from every ratio supported by the selected adapter.

Implement this entirely in `kie-cli-mcp`. Infinite Canvas remains provider-agnostic and unchanged.

## Current failure

Infinite Canvas stores image choices as ratios, then converts them to concrete dimensions aligned to a 16-pixel grid before making an OpenAI request.

For standard 16:9 generation it sends:

```json
{
  "model": "kie-gpt-image-2",
  "prompt": "16:9 proof",
  "n": 1,
  "quality": "low",
  "size": "1824x1024",
  "output_format": "png"
}
```

`1824x1024` is visually 16:9, but its exact reduced fraction is `57:32`.

The current implementation in `packages/openai/src/image-adapters.ts`:

1. Reduces every dimension pair with greatest common divisor.
2. Produces `57:32`.
3. Requires exact membership in the adapter's `aspectRatios` list.
4. Rejects the request before provider submission.

A runtime reproduction against transport `0.6.0` returned:

```json
{
  "status": 422,
  "code": "unsupported_setting",
  "param": "size",
  "message": "The size ratio 57:32 is not supported for kie-gpt-image-2."
}
```

GPT Image 2 already supports `16:9` in the core schema and adapter descriptor. Existing contract tests prove that an exact `size: "16:9"` maps to provider `aspect_ratio: "16:9"`. The defect is only local dimension normalization.

## Non-goals

- Adding new aspect ratios to any provider model.
- Changing Infinite Canvas dimension calculation.
- Cropping, padding, resizing, or transforming generated image bytes.
- Accepting arbitrary unsupported dimensions.
- Relaxing explicit ratio strings such as `57:32`.
- Changing quality-to-resolution mapping.
- Changing output formats, masks, backgrounds, references, or cardinality.
- Changing video size normalization.

## Feasibility proof

A read-only prototype compared dimension ratios to GPT Image 2's supported ratios using symmetric logarithmic ratio distance:

```ts
error = Math.abs(Math.log(actualRatio / supportedRatio));
```

With a maximum error of `0.03`:

| Input dimensions | Nearest supported ratio | Log error | Decision |
|---|---:|---:|---|
| `1824x1024` | `16:9` | 0.195% | accept |
| `2720x1536` | `16:9` | 0.391% | accept |
| `3840x2160` | `16:9` | 0.000% | accept |
| `1024x1824` | `9:16` | 0.195% | accept |
| `1792x1024` | `16:9` | 1.575% | accept |
| `1024x1792` | `9:16` | 1.575% | accept |
| `1400x1024` | `4:3` | 2.507% | accept |
| `1280x720` | `16:9` | 0.000% | accept |
| `1408x1024` | `4:3` | 3.077% | reject |
| `1536x1024` | `4:3` | 11.778% | reject for GPT Image 2 |

This demonstrates a useful gap between Infinite Canvas rounding error and materially unsupported dimensions. No paid provider task is required to validate the mapping algorithm.

The closest pair of ratios in the current image adapter registry is Nano Banana's `4:3` and `5:4`. Their logarithmic distance is 6.454%, leaving a 3.227% midpoint from either ratio. A 3% tolerance therefore does not create overlapping acceptance bands between any currently registered image ratios.

## Design

### 1. Keep explicit ratio strings strict

For values matching `W:H`:

1. Parse positive integers.
2. Reduce by greatest common divisor.
3. Require exact membership in `descriptor.aspectRatios`.
4. Return the exact supported ratio.

Examples:

- `16:9` returns `16:9`.
- `32:18` reduces and returns `16:9`.
- `57:32` remains unsupported and returns `422`.

Explicit ratio syntax represents user intent and must not be approximated.

### 2. Normalize dimension strings to the nearest supported ratio

For values matching `WxH`:

1. Parse positive integer width and height.
2. Compute `actualRatio = width / height`.
3. Parse every ratio in `descriptor.aspectRatios`.
4. Calculate symmetric logarithmic distance:

   ```ts
   Math.abs(Math.log(actualRatio / candidateRatio))
   ```

5. Select the candidate with the smallest distance.
6. Accept it only when distance is at most `0.03`.
7. Return the canonical candidate string from the descriptor.
8. Otherwise return the existing OpenAI-shaped `422 unsupported_setting` error with `param: "size"`.

Use a named constant:

```ts
const MAX_DIMENSION_RATIO_LOG_ERROR = 0.03;
```

Logarithmic distance is symmetric for landscape and portrait reciprocals. Avoid absolute width/height ratio differences, which assign different effective tolerances to portrait and landscape values.

### 3. Prefer exact matches

If reduced dimensions already equal a supported ratio, return that exact ratio before calculating nearest candidates.

This preserves existing behavior for:

- `1280x720` to `16:9`.
- `2048x1152` to `16:9`.
- `3840x2160` to `16:9`.
- `1024x1024` to `1:1`.

### 4. Keep mapping adapter-specific

Candidate ratios come only from the selected image adapter's `aspectRatios`.

Examples:

- GPT Image 2 accepts rounded dimensions near `16:9` but still rejects `3:2`, which its descriptor does not support.
- Nano Banana may map dimensions near `3:2` because its descriptor supports `3:2`.
- A model supporting only square output maps only dimensions sufficiently close to `1:1`.

Do not introduce a global ratio list.

### 5. Normalize before fingerprinting

The normalized canonical ratio remains the value stored in `NormalizedImageRequest.aspectRatio` and used by the request fingerprint.

Semantically equivalent requests must share a fingerprint:

```text
size=16:9
size=1824x1024
size=2048x1152
```

This allows a retry with the same idempotency key to use an equivalent size representation without causing duplicate provider work or an idempotency conflict.

## Implementation scope

Update only the image-size parsing seam and its tests unless a small extraction improves testability:

- `packages/openai/src/image-adapters.ts`
- `packages/openai/tests/image-contract.test.ts`
- `docs/openai-transport.md`
- `packages/openai/README.md`
- `CHANGELOG.md`
- Version files for `0.6.1`

An optional focused helper may be extracted in the OpenAI package, but avoid a generic geometry abstraction larger than the behavior being fixed.

## Validation order

Preserve the existing paid-work boundary:

1. Parse the request body or multipart form.
2. Resolve the image adapter.
3. Validate model operations and fields.
4. Normalize dimensions to a supported ratio.
5. Validate through the adapter's core Zod schema.
6. Calculate the semantic fingerprint.
7. Upload references when applicable.
8. Reserve the journal record.
9. Submit the provider task.

Dimensions outside tolerance must fail before uploads, journal reservation, or provider submission.

## Tests

### Exact Infinite Canvas generation contract

Add a successful GPT Image 2 test with the complete payload:

```json
{
  "model": "kie-gpt-image-2",
  "prompt": "A cinematic landscape",
  "n": 1,
  "quality": "low",
  "size": "1824x1024",
  "output_format": "png"
}
```

Verify:

- HTTP `200`.
- Exactly one provider task.
- Provider request contains `aspect_ratio: "16:9"`.
- Provider request retains `resolution: "1K"`.
- PNG result validation remains unchanged.

### Rounded dimensions

Use table-driven tests:

| Input | Expected canonical ratio |
|---|---|
| `1824x1024` | `16:9` |
| `2720x1536` | `16:9` |
| `3840x2160` | `16:9` |
| `1024x1824` | `9:16` |
| `1792x1024` | `16:9` |
| `1024x1792` | `9:16` |
| `1360x1024` | `4:3` |
| `1400x1024` | `4:3` |
| `1024x1360` | `3:4` |

Run applicable cases against adapters that actually support each ratio.

`1792x1024` and `1024x1792` cover the common landscape and portrait dimensions used by other OpenAI-compatible clients. Their inclusion proves this is a transport-level compatibility fix rather than an Infinite Canvas-only exception.

### Strict rejection

Verify:

- Explicit `57:32` remains rejected.
- GPT Image 2 `1536x1024` remains rejected because `3:2` is unsupported.
- GPT Image 2 `1408x1024` remains rejected because it exceeds the nearest-ratio tolerance.
- Zero, negative, malformed, excessive, or non-numeric dimensions retain existing errors.
- Rejections create no journal JSON record and make no provider request.

### Per-adapter behavior

Verify the same dimension can be accepted by one descriptor and rejected by another according to each adapter's `aspectRatios`.

At minimum:

- Nano Banana accepts exact or rounded `3:2` dimensions.
- GPT Image 2 rejects `3:2` dimensions.
- GPT Image 2 accepts rounded Infinite Canvas `16:9` dimensions.

### Idempotency equivalence

Use one idempotency key for equivalent requests represented as:

```text
16:9
1824x1024
2048x1152
```

Verify one provider task is created and all retries return the same completed result.

### Image edits

Add a multipart edit test using an adapter that supports edits and `size=1824x1024`. Verify the same normalization occurs before reference upload and submission.

## Documentation

Document that:

- Explicit ratio strings must match model-supported ratios.
- Pixel dimensions within the bounded tolerance map to the nearest model-supported ratio.
- The transport does not resize or crop returned images.
- Quality continues selecting provider resolution independently from aspect ratio.

Do not promise arbitrary dimensions. The provider still generates one of its declared aspect ratios.

## Versioning

Release as `@felores/kie-ai-openai-server@0.6.1`.

Keep OpenAI transport contract version `3` because routes, fields, and response envelopes do not change. This is a compatibility bug fix in input normalization.

Update:

- `packages/openai/package.json`
- `package-lock.json`
- `packages/openai/src/version.ts`
- `packages/openai/tests/package-contract.test.ts`
- `CHANGELOG.md`

## Verification commands

Run from the repository root:

```bash
npm run typecheck
npm run build
npm test
npm run check
npm pack -w @felores/kie-ai-openai-server --dry-run
```

No paid live generation is required. Existing provider evidence already establishes GPT Image 2 `16:9` support; this change only corrects local request normalization. A live 1K smoke test is optional and requires explicit user authorization.

## Acceptance criteria

1. The exact Infinite Canvas `1824x1024` GPT Image 2 request succeeds and submits provider `aspect_ratio: "16:9"`.
2. Portrait `1024x1824` maps symmetrically to `9:16`.
3. Common OpenAI-compatible dimensions `1792x1024` and `1024x1792` map to `16:9` and `9:16`.
4. Exact supported ratio strings retain current behavior.
5. Explicit unsupported ratio strings remain rejected.
6. Dimensions beyond the bounded tolerance remain rejected before paid work.
7. Mapping uses only the selected adapter's supported ratios.
8. Equivalent exact and dimension representations share idempotency semantics.
9. Generation and edit routes use the same normalization.
10. Existing image format, result-host, cardinality, security, and error contracts remain unchanged.
11. Package version is `0.6.1`, contract version remains `3`, and all verification commands pass.

## Delivery procedure

1. Update local `main` and create one focused bug-fix branch.
2. Implement the dimension-only nearest-ratio normalization.
3. Add every required generation, edit, rejection, and idempotency test.
4. Run all verification commands.
5. Obtain an independent evaluator review of tolerance safety and Infinite Canvas compatibility.
6. Deliver through one verified pull request.
7. Merge, synchronize local `main`, and confirm a clean tree.
8. Publish `0.6.1` once after review.
