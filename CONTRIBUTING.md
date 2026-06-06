# Contributing

Thanks for your interest in improving this project.

## Open an issue before a large PR

This is a **monorepo** (npm workspaces). One shared `core` feeds two published
surfaces:

```text
packages/core   @felores/kie-ai-core   (private, bundled into both — never published)
packages/mcp    @felores/kie-ai-mcp-server
packages/cli    @felores/kie-cli
```

A tool is **one `ToolDef`** under `packages/core/src/tools/<tool>.ts` (single
source of truth). Both the MCP server and the CLI derive their interface from the
registry automatically — there is **no** monolithic `src/index.ts` handler file,
and `dist/` is build output (gitignored, do not commit it).

So before opening a sizable PR, **file an issue first** describing the bug or
change. It's a two-minute filter that avoids work against the wrong place —
many "handler" fixes from the old single-file layout are already handled
uniformly across the per-tool registry.

## Adding a model

See [`CLAUDE.md`](./CLAUDE.md) → "Adding New Tools" and
[`docs/ENDPOINTS.md`](./docs/ENDPOINTS.md). In short: one tool file +
one client method, registered in `packages/core/src/tools/index.ts`.

## Dev

```bash
npm run build       # build all packages
npm test            # core jest
npm run typecheck   # tsc --noEmit
```

Keep changes surgical and match the surrounding style.
