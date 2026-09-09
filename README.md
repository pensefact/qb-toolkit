# qb-toolkit

A TypeScript monorepo with a C# bridge for integrating with QuickBooks Desktop, built for South African businesses.

Handles bank statement reconciliation (OFX and PDF parsing for the five major SA banks), EFT file generation, SARS integration, and direct communication with QuickBooks Desktop via a local HTTP bridge.

## Packages

| Package | What it does |
|---|---|
| `bank-recon` | Parses OFX files and PDF bank statements (FNB, Nedbank, ABSA, Capitec, Standard Bank), matches transactions against QuickBooks records, and plans/executes reconciliation actions. |
| `core` | QBXML request/response builder and a general-purpose transaction matcher. |
| `eft-generator` | Generates EFT payment files from QuickBooks data. |
| `sars-integration` | SARS tax integration utilities. |
| `qb-bridge-http` | C# HTTP server that wraps the QuickBooks Desktop SDK, exposing it as a local REST API that the TypeScript packages call. |

## Other directories

- `app/` — C# Windows Forms connector for QuickBooks Desktop (QBConnection, MainForm).
- `ui/` — Vite-based frontend for the reconciliation workflow.

## Setup

```bash
npm install        # install TypeScript dependencies
npm test           # run tests across all packages
```

The C# bridge (`packages/qb-bridge-http` and `app/`) requires .NET and a local QuickBooks Desktop installation on Windows.

## Bank statement parsing

The `bank-recon` package handles both OFX (standard electronic format) and PDF statements. PDF parsers extract transactions from the specific layout each bank uses. Supported:

- FNB (OFX + PDF)
- Nedbank (OFX + PDF)
- ABSA (OFX + PDF)
- Capitec (PDF)
- Standard Bank (OFX + PDF)

Auto-detection picks the right parser based on file content.

## Architecture

```
TypeScript packages ←→ qb-bridge-http (C# REST server) ←→ QuickBooks Desktop SDK
```

The bridge runs locally on the same machine as QuickBooks. TypeScript packages call it over HTTP to query and write QuickBooks data. This avoids needing the QB SDK in every consuming application.

## Tests

```bash
npx vitest
```

Tests cover OFX/PDF parsing, transaction matching, reconciliation logic, and QBXML generation.
