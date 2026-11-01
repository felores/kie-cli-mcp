---
status: draft
date: 2026-10-31
sources:
  - https://docs.kie.ai/market/seedream/5-pro-text-to-image.md
  - https://docs.kie.ai/market/seedream/5-flash-text-to-image.md
  - https://docs.kie.ai/market/seedream/5-lite-text-to-image.md
  - https://kie.ai/seedream-5-0-pro
  - https://kie.ai/seedream-5-0-flash
  - https://kie.ai/pricing
  - https://seed.bytedance.com/en/seedream5_0_pro
  - https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing
---

# bytedance_seedream_image - Research

## Contents

1. What it does
2. Model versions
3. Modes
4. Key parameters and limits
5. Public pricing
6. Strengths
7. Weaknesses
8. Best use cases
9. Alternatives in this catalog
10. Open questions

## 1. What it does

Generates images from text, edits up to 10 reference images, or splits one image into layers. One tool covers all three. Mode is picked from the inputs. Sources: `packages/core/src/tools/bytedance_seedream_image.ts`, https://docs.kie.ai/market/seedream/5-pro-text-to-image.md

## 2. Model versions

| Version | MCP value | Kie model IDs | Status |
|---|---|---|---|
| Seedream 5.0 Pro | `5-pro` (default) | `seedream/5-pro-text-to-image`, `-image-to-image`, `-layer-decomposition` | Released. Source: https://docs.kie.ai/market/seedream/5-pro-text-to-image.md |
| Seedream 5.0 Flash | `5-flash` | `seedream/5-flash-*` | Released. Source: https://docs.kie.ai/market/seedream/5-flash-text-to-image.md |
| Seedream 5.0 Lite | not exposed | `seedream/5-lite-text-to-image` | Kie docs show released, the local doc says not selectable. Unresolved. |

## 3. Modes

| Mode | Trigger | Required input |
|---|---|---|
| Text-to-image | no `image_urls` or `image_url` | `prompt` |
| Image editing | `image_urls` (1 to 10 URLs) | `prompt`, `image_urls` |
| Layer decomposition | `image_url` (one URL) or `operation: "layer-decomposition"` | `image_url`; prompt optional |

Mixed inputs are rejected. Layer mode does not accept `aspect_ratio` or `quality`. Source: `docs/kie/seedream_5-pro.md` (local, not re-fetched).

## 4. Key parameters and limits

| Parameter | Local schema | Kie docs (live) |
|---|---|---|
| `prompt` | max 5000; description says 3 to 5000 | 4 to 5000 characters |
| `aspect_ratio` | 8 values, default `1:1` | same 8 values: 1:1, 4:3, 3:4, 16:9, 9:16, 2:3, 3:2, 21:9 |
| `quality` (Pro) | `basic` (1K) or `high` (2K) | same |
| `size` (Flash) | 1K, 1.5K, 2K, default 1K | same |
| `image_urls` | 1 to 10 | 1 to 10 |
| `output_format` | not confirmed in the read schema | `png` or `jpeg`, default `png` |
| `callBackUrl` | optional, env fallback | optional |

Image count per request is not stated on the Kie page. Exact pixel sizes are not stated.

## 5. Public pricing

| Item | Kie.ai | Provider (BytePlus) |
|---|---|---|
| Pro, basic 1K | 7 credits, $0.035 per image | $0.045 per image up to 2.61 MP |
| Pro, high 2K | 14 credits, $0.07 per image | $0.045 up to 2.61 MP; 2K mapping unverified |
| Pro input images | first free, then 0.5 credit ($0.0025) each | first free, then $0.003 each |
| Pro layer decomposition | not stated | $0.0225 (up to 2.61 MP), $0.045 above |
| Flash 1K and 2K | 3.24 credits, $0.0162 | $0.018 |
| Flash 1.5K | not stated | not verified |
| Lite (not exposed) | 5.5 credits, $0.0275 "from" | $0.035 |

Sources: https://kie.ai/seedream-5-0-pro, https://kie.ai/seedream-5-0-flash, https://kie.ai/pricing, https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing

Kie Pro layer decomposition price: unknown.

## 6. Strengths

- Three modes in one tool, with mode detection from inputs.
- Kie's basic 1K Pro price ($0.035) is below BytePlus's list ($0.045).
- Flash is cheap: about $0.016 per image on Kie.
- Layer decomposition is a rare capability in this catalog. Source: https://seed.bytedance.com/en/seedream5_0_pro (provider claims "layer separation").
- Callbacks report credits consumed and no charge on failure. Source: Kie Pro doc.

## 7. Weaknesses

- Kie pricing is in credits and "from" prices. Full tier prices are on each model page.
- Flash has no published price for 1.5K.
- Pro layer decomposition has no Kie price.
- The MCP tool omits Lite, so the 5 Lite catalog option in the brief is not available.
- Prompt minimum differs between the local schema and Kie docs (3 versus 4 characters).
- Provider text rendering and editing claims are not benchmarked here.

## 8. Best use cases

- Quick text-to-image drafts at low cost (Flash).
- Multi-reference edits of a product or scene with up to 10 inputs (Pro).
- Splitting a finished image into layers for compositing (layer mode).
- Posters or images with text, which the provider positions as a strength.

## 9. Alternatives in this catalog

- `qwen_image` (Qwen3 and Qwen3 Pro, text-to-image and editing). Catalog entry: `packages/core/src/model-catalog.ts`.
- The Nano Banana 2 entry (image generation and editing) in the same catalog.

No catalog tool offers layer decomposition as far as this pass checked.

## 10. Open questions

- Kie price for Pro layer decomposition, and for Flash at 1.5K.
- Whether the MCP tool should expose Lite, and whether Lite is still live on Kie.
- Exact output pixel sizes per `aspect_ratio` and `quality` tier.
- Whether the BytePlus 2.61 MP threshold maps to Kie's 1K and 2K tiers.
