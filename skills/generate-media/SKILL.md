---
name: generate-media
description: >-
  Plan, price, and generate images, video, music, speech, sound effects, avatars,
  lip-sync clips, and media edits through Kie.ai. Use for media creation or editing,
  model selection, generation price questions, and pricing audits. Always prepare and
  present a plan before any paid generation, then wait for explicit user approval.
---

# Generate media

Use the server's approval-bound workflow for every paid media request. MCP does not
expose or allow direct image, video, or audio tool calls unless its operator sets
`KIE_AI_ALLOW_DIRECT_GENERATION=true`, which deliberately bypasses approval
safeguards. Do not request that bypass for a user-requested generation.

## Workflow

1. If the requested model is ambiguous, call `list_models` with a capability or text
   filter. For example, `filter: "lip sync"` finds talking-avatar options. Catalog
   capabilities are guidance. Follow each `evidenceUrl` for provider facts.
2. Call `prepare_media_generation` with one to six independent `{ tool, args }`
   items. It validates every target schema, applies only missing safe policy defaults,
   resolves model and mode, quotes only verified credit formulas, and stores a plan.
   It does not create provider tasks.
3. Present the complete returned plan. For each item, show the tool, model, mode,
   user settings, applied defaults, effective settings, output count where applicable,
   reference inputs, and price state. Do not present USD unless the user configured an
   account-specific conversion outside this skill.
4. For MCP, the server asks the host to confirm the resolved plan in a form. The MCP
   client must advertise the `elicitation.form` capability and handle the request. Only
   an accepted form with `confirm: true` changes the persisted plan to `approved`. Do
   not interpret an earlier request to generate as approval of an unseen plan. If the
   host declines, cancels, does not confirm, or lacks form elicitation, do not submit
   the prepared plan.
5. After host approval only, call `submit_media_generation` with the returned `planId`.
   Do not supply replacement request arguments or caller-controlled approval fields.
   A plan expires, its hash detects accidental mutation only, and it can be submitted
    only once. An MCP plan is bound to the server context that prepared and approved
    it, so another HTTP session cannot submit it. Submission creates at most four
    provider tasks concurrently.
6. Use `wait_for_task` or `get_task_status` for each returned task ID. Keep actual
   `creditsConsumed`, when Kie returns it, separate from the preflight quote.

CLI uses the same tools. For example:

```bash
# Prepare only. This creates no provider tasks.
kie-cli prepare_media_generation \
  --items '[{"tool":"nano_banana_image","args":{"prompt":"A red panda coding"}}]' \
  --json

# This explicit matching value atomically records CLI approval before submission.
kie-cli submit_media_generation --planId <plan-id> --approve <plan-id> --json
```

## Safe policy defaults

- Nano Banana: Lite model and 1K where the request did not select a model or resolution.
- Seedance 2.5: 720p, 5 seconds, audio disabled.
- Kling 3.0: `std`, 5 seconds, audio disabled.
- Veo: `veo3_fast`.
- MiniMax H3: 5 seconds, and 16:9 for text-to-video.

Every applied default must appear in the prepared plan. An explicit user value always
wins over policy.

## Pricing operations

`/generate-media price <generation request>`: prepare the request, show its credit
state, and wait for approval before submission.

`/generate-media pricing audit`: run `npm run pricing:audit`. This reports catalog
coverage, unknown tools, and stale verified evidence. It does not fetch or write data.

`/generate-media pricing refresh`: run `npm run pricing:refresh` for a read-only report
of source freshness and current formula evidence. It does not fetch, scrape, or mutate
anything.

`/generate-media pricing refresh --apply`: run `npm run pricing:refresh -- --apply`.
Without a validated proposal file this is an explicit no-op. With `--proposals <file>`,
it can write only `packages/core/src/pricing/evidence-manifest.json`, never rate-card
TypeScript. Each exact-credit proposal must include its scope, HTTPS source URL,
fingerprint, verification date, and existing test-file references. Code-review and a
separate tested edit remain required before copying a proposal into `rate-card.ts`. Do
not scrape pages to invent rates, add estimates, or add a fixed USD conversion.

Current exact formulas are intentionally limited to Nano Banana 2 Lite at four credits
per image and MiniMax H3 reference-to-video at 768p, at 16 credits per second. Every
other request is `unknown` until verified.
