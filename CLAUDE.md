# Agent Guidelines for kie-ai-mcp-server

## Project Goal
**Seamless integration with Kie.ai API** - Kie.ai provides access to the best AI models (Veo 3, Runway, Nano Banana, Suno, etc.) through one affordable, developer-friendly API. Our MCP server bridges these powerful AI capabilities to Claude Desktop and other MCP clients.

## Immediate Goals
- **Simplify tool interfaces** - Reduce cognitive load for users
- **Consolidate related tools** - Example: merge `generate_nano_banana`, `edit_nano_banana`, and `upscale_nano_banana` into a single unified `nano_banana` tool that auto-detects mode based on parameters (presence of `image_urls` = edit mode, presence of `scale` = upscale mode, etc.)
- **Maintain backwards compatibility** when possible
- **Improve user experience** through intuitive parameter design

## Build/Test Commands
- Build: `npm run build` (TypeScript → dist/)
- Test: `npm test` (Jest)
- Dev: `npm run dev` (tsx auto-reload)
- Type check: `npx tsc --noEmit`

## Available CLI Tools
- **Git**: Full git access for version control
- **GitHub CLI** (`gh`): Create releases, manage PRs, issues, etc.
- **NPM**: Package management and publishing

## Code Style
- **Module system**: ES modules (`.js` extensions in imports)
- **TypeScript**: Strict mode, explicit types, no `any` except for request handlers
- **Imports**: MCP SDK imports use `.js` extension, local imports use `.js` extension
- **Validation**: Use Zod schemas for all request validation (see types.ts)
- **Error handling**: Wrap errors in `McpError` with appropriate `ErrorCode`
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Database**: SQLite with TaskDatabase class, always update task status
- **API client**: Use KieAiClient class methods, never construct raw fetch calls
- **Response format**: Return MCP tool responses with JSON.stringify and `null, 2`
- **Async/await**: Use async/await, avoid promises directly

## Environment
- Required: `KIE_AI_API_KEY`
- Optional: `KIE_AI_BASE_URL`, `KIE_AI_TIMEOUT`, `KIE_AI_DB_PATH`, `KIE_AI_CALLBACK_URL`

## Architecture (monorepo, npm workspaces)

One shared `core` feeds two independently installable surfaces:

```text
packages/core   @felores/kie-ai-core  (PRIVATE, never published; bundled into both)
  src/tools/         tool registry, ONE ToolDef per model (single source of truth)
  src/kie-ai-client.ts  KieAiClient → Kie.ai API
  src/database.ts       TaskDatabase (SQLite task persistence)
  src/types.ts          Zod schemas
packages/mcp    @felores/kie-ai-mcp-server  (bin: kie-ai-mcp-server)
  src/index.ts          MCP adapter: listTools + dispatch derived from TOOL_REGISTRY
packages/cli    @felores/kie-cli            (bin: kie-cli)
  src/index.ts          CLI adapter: yargs commands derived from TOOL_REGISTRY
```

- A tool is one `ToolDef { name, description, category, schema, run(args, ctx) }`.
- `run()` returns the MCP content envelope; the MCP server returns it verbatim,
  the CLI unwraps `content[0].text`. `ctx` provides `client`, `db`,
  `getCallbackUrl`, `formatError`.
- MCP `inputSchema` and CLI flags are both derived from the tool's Zod schema via
  `toInputJsonSchema` (zod-to-json-schema). Zod is the only schema definition.
- esbuild bundles `core` into each publishable package (`sqlite3` external);
  `core` is never published, so MCP and CLI install with zero shared runtime dep.
- Build: `npm run build` (all), `npm run bundle` (publish bundles),
  `npm test` (core jest), `npm run typecheck`.

## Adding New Tools

Adding a model is **one tool file + one client method**. Both the MCP server and
the CLI pick it up automatically from the registry.

1. **Check endpoint status**: See `docs/ENDPOINTS.md`
2. **Research first**: Scrape the Kie.ai playground page and API docs
3. **Save documentation**: Store endpoint docs in `docs/kie/{provider}_{model}.md`

### Quick Workflow
```bash
1. Scrape https://kie.ai/{endpoint} for parameters and pricing
2. npm run add-tool -- <tool_name> [image|video|audio|utility]   # scaffolds + registers
3. Move the Zod schema into packages/core/src/types.ts (use mode detection pattern)
4. Add the client method in packages/core/src/kie-ai-client.ts
5. Fill in description + run() body + db api_type in packages/core/src/tools/<tool_name>.ts
6. Update EXPECTED_TOOL_NAMES in packages/core/src/__tests__/registry.test.ts
7. npm run build && npm test, then bump versions, update docs, publish
```

### Key Files
| What | Where |
|------|-------|
| Endpoint tracking | `docs/ENDPOINTS.md` |
| Scaffold a tool | `npm run add-tool -- <name> <category>` |
| Tool registry | `packages/core/src/tools/index.ts` |
| One tool per file | `packages/core/src/tools/<tool_name>.ts` |
| Zod schemas | `packages/core/src/types.ts` |
| API client | `packages/core/src/kie-ai-client.ts` |
| MCP adapter | `packages/mcp/src/index.ts` |
| CLI adapter | `packages/cli/src/index.ts` |
| Registry tests | `packages/core/src/__tests__/registry.test.ts` |
| Tool documentation | `docs/TOOLS.md` |

## Publishing to NPM

### Package Information
- **Published packages** (two, versioned independently):
  - `@felores/kie-ai-mcp-server` → `packages/mcp` (bin `kie-ai-mcp-server`)
  - `@felores/kie-cli` → `packages/cli` (bin `kie-cli`)
  - `@felores/kie-ai-core` is **private** and never published (bundled into both).
- **NPM account**: `felores`
- **Registry**: https://registry.npmjs.org/
- **2FA**: Enabled (requires OTP for publishing)
- **Build before publishing**: each package's `prepublishOnly` runs `npm run bundle`
  (builds core, then esbuild-bundles it in). Publish from the package dir or with
  `npm publish -w @felores/<pkg>`. Bundled dist is self-contained.

### Version Management (CRITICAL)
**ALWAYS check and update versions when making user-facing changes:**

1. **When to bump version**:
   - **Patch (x.x.X)**: Bug fixes, documentation, internal improvements
   - **Minor (x.X.0)**: New features, new tools, new parameters (backwards compatible)
   - **Major (X.0.0)**: Breaking changes, API endpoint changes, removed features

2. **Files to update** when bumping the MCP server:
   - `packages/mcp/package.json` → `"version": "X.Y.Z"`
   - `packages/mcp/src/index.ts` → `version: "X.Y.Z"` (in Server constructor)
   - `CHANGELOG.md` → Add new version section with changes
   - `README.md` → Update changelog section
   (CLI bumps: `packages/cli/package.json` only.)

3. **Pre-publish checklist**:
   ```bash
   npm run build                    # Must succeed
   npx tsc --noEmit                 # Must have no errors
   npm publish --dry-run            # Preview what will be published
   ```

4. **Publishing workflow**:
   ```bash
   # Check login status
   npm whoami                       # Should return: felores
   
   # Publish (requires 2FA code)
   npm publish --otp=XXXXXX         # Replace XXXXXX with 6-digit code
   
   # Verify publication
   npm view @felores/kie-ai-mcp-server version
   ```

5. **Git workflow** (after successful publish):
   ```bash
   git add .
   git commit -m "Release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

6. **Creating GitHub releases** (optional but recommended):
   ```bash
   # Agent has access to gh CLI for creating releases
   gh release create vX.Y.Z \
     --title "Release vX.Y.Z" \
     --notes "See CHANGELOG.md for details"
   ```

### Important Notes
- **Never publish without updating CHANGELOG.md** - users need to know what changed
- **Never skip version bump** - even for small fixes
- **Test build before publishing** - `npm run build` must succeed
- **Check package size** - should be ~10-15KB (shown in dry-run)
- **2FA timeout** - OTP codes expire quickly, have it ready before running publish
- **Package.json files field** - Only dist/, README.md, LICENSE are published (configured)
