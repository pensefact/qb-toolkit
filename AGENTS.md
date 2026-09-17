# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Project notes

- **Commands**: `npm test` (root) runs the whole cross-package suite via `vitest.config.ts`, which discovers `packages/*/src/**/*.test.ts` and aliases `@qb-toolkit/core` to source, so tests need no prior build. `npm run build` (root) builds in dependency order: core → bank-recon → stubs → ui. Per-package `test` scripts delegate to the root config with a path filter.
- **Build order**: `bank-recon`'s `tsc` needs `packages/core/dist` to exist; always build `core` first (root `npm run build` handles this).
- **Sharp edge**: deleting `packages/*/dist` without also deleting `packages/*/tsconfig.tsbuildinfo` makes core's incremental `tsc` skip emit (exit 0, no output), and bank-recon then fails with TS2307. Clean both, or `git clean`.
- **Windows-only components**: the C# bridge (`packages/qb-bridge-http/src`, .NET Framework 4.5) and WinForms connector (`app/`) cannot be built, run, or validated on Linux/macOS — they need Windows + QuickBooks Desktop + QB SDK. Never mock them to make them look verified; document as unvalidated instead. Canonical lists: README "Validation status" and `docs/roadmap.md` §4.
- **Not typechecked**: `packages/qb-bridge-http/client.ts` and `provider.ts` are outside every tsconfig and the vitest glob; they have never been compiled.
- **Stubs**: `eft-generator` and `sars-integration` are empty scaffolds (`export {}`), not capabilities. They intentionally have no `test` script.
- **State & plans**: `docs/roadmap.md` records what is done/tested, partial, and missing, with open decisions per item.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
