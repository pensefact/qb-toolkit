# qb-toolkit

A TypeScript monorepo with a C# bridge for integrating with QuickBooks Desktop, built for South African businesses.

The working core is bank statement reconciliation: OFX, CSV, and PDF statement parsing for the five major SA banks, transaction matching against QuickBooks data, and an action planner/executor that turns reconciliation decisions into qbXML requests. EFT file generation and SARS integration are **planned but not implemented** — those two packages are empty scaffolds (see below).

See [`docs/roadmap.md`](docs/roadmap.md) for what is done, partially done, and missing, and for what cannot be verified without a Windows machine running QuickBooks Desktop.

## Packages

| Package | Status | What it does |
|---|---|---|
| `bank-recon` | Implemented, unit-tested | Parses OFX files and CSV/PDF bank statements (FNB, Nedbank, ABSA, Capitec, Standard Bank), reconciles them against QuickBooks transactions, plans reconciliation actions, and generates the qbXML requests for confirmed actions. |
| `core` | Implemented, unit-tested | qbXML request builders (queries, ReceivePayment, BillPayment, Check/Deposit/JournalEntry/SalesReceipt adds, cleared-status edits), shared types, and a general-purpose transaction matcher. The qbXML builders were validated against a live QuickBooks Enterprise 24 on 2026-09-07. |
| `qb-bridge-http` | C# server + TS client; **cannot be built or validated on Linux/macOS** | C# HTTP server (`src/`) that wraps the QuickBooks Desktop SDK, exposing it as a local REST API. The TypeScript side (`client.ts`, `provider.ts`) is not part of any tsconfig or test run and is never type-checked. Requires Windows + QuickBooks Desktop to build or run. |
| `eft-generator` | **Empty scaffold — no implementation, no tests** | Placeholder for generating EFT payment files from QuickBooks payables (`src/index.ts` is a comment and `export {}`). Nothing works; do not present it as a capability. |
| `sars-integration` | **Empty scaffold — no implementation, no tests** | Placeholder for SARS e-Filing integration (VAT201, EMP201, IRP5). `src/index.ts` is a comment and `export {}`. Nothing works. |

## Other directories

- `app/` — C# WinForms connector for QuickBooks Desktop (QBConnection, MainForm; opens the UI in the system browser). Windows-only; not built or validated here.
- `ui/` — Vite-based frontend for the reconciliation workflow. Builds green; has no automated tests. Its wiring to the bridge (`bridge-provider.ts`) has not been verified end-to-end against a live QuickBooks.

## Setup

```bash
npm install        # install TypeScript dependencies
npm test           # run the cross-package vitest suite (repo root config discovers packages/*/src/**/*.test.ts)
npm run build      # build all TS packages in dependency order (core → bank-recon → stubs), then the UI
```

Per package:

```bash
npm run test  -w @qb-toolkit/bank-recon   # run one package's tests (delegates to the root vitest config with a path filter)
npm run build -w @qb-toolkit/core         # build one package (bank-recon's build requires core's dist to exist first)
```

`eft-generator` and `sars-integration` deliberately have no `test` script: they contain no tests.

The C# components (`packages/qb-bridge-http/src` and `app/`) require Windows, .NET Framework MSBuild, the QuickBooks Desktop SDK, and a local QuickBooks Desktop installation. They cannot be built or run on this repo's Linux dev machine and are excluded from `npm test` / `npm run build`.

## Bank statement parsing

The `bank-recon` package handles three input formats:

- **OFX** — one generic parser (`ofx-parser.ts`) covering SGML-style OFX 1.x and XML-style OFX 2.x. Bank-agnostic: whichever bank exports OFX works through this parser.
- **CSV** — one parser per bank, tuned to each bank's export layout.
- **PDF** — one parser per bank, operating on text extracted with `pdf-parse`, tuned to each bank's statement layout.

| Bank | CSV | PDF | Direct parser tests |
|---|---|---|---|
| FNB | yes | yes | CSV + PDF |
| Nedbank | yes | yes | CSV + PDF |
| ABSA | yes | yes | CSV + PDF |
| Capitec | yes | yes | CSV + PDF |
| Standard Bank | yes | yes | CSV + PDF |

Auto-detection picks the right parser from file content: `detectBank` (CSV) is tested for all five banks; `detectBankFromPdf` is tested against synthetic `PdfText` fixtures. PDF parser tests, and the extraction step itself (`extractPdfText`, tested against a mocked `pdf-parse`), all run against synthetic fixtures, not real bank PDFs — real statements can still expose layout regressions.

## Architecture

```
TypeScript packages ←→ qb-bridge-http (C# REST server) ←→ QuickBooks Desktop SDK
```

The bridge runs locally on the same machine as QuickBooks. TypeScript packages call it over HTTP to query and write QuickBooks data. This avoids needing the QB SDK in every consuming application.

## Validation status (as of 2026-09, Linux dev machine)

Validated here:

- Cross-package vitest suite green: **14 test files, 121 tests** — OFX/CSV/PDF parsing, bank detection, PDF text extraction, transaction/invoice/bill matching, reconciliation, action planning, qbXML generation, executor request building.
- `npm run build` green for all four TS packages and the Vite UI.
- qbXML builders validated against a live **QuickBooks Enterprise 24 on 2026-09-07** (last session with QuickBooks access).

Not validated:

- The C# bridge and WinForms connector: never built or run in this environment (need Windows + QuickBooks Desktop + QB SDK).
- End-to-end flow UI → bridge → QuickBooks: wired on 2026-09-07 but **not re-verified against live QuickBooks since**.
- `qb-bridge-http/client.ts` and `provider.ts`: not covered by any build, typecheck, or test.
- Parsers vs. real statements: tests use sample/synthetic fixtures; only the 2026-09-07 session exercised real SA bank formats, and PDF fixtures are hand-built. Whether redacted real statements can be committed as fixtures is still an open decision (see `docs/roadmap.md`).

See [`docs/validation-runbook.md`](docs/validation-runbook.md) for the procedure and evidence template to close the "Not validated" items above on a Windows + QuickBooks Desktop machine.

## Tests

```bash
npm test                             # cross-package run from the repo root
npm run test -w @qb-toolkit/core     # core only
npx vitest                           # same as npm test, directly
```
