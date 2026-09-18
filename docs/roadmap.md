# qb-toolkit roadmap

Derived from the actual state of the code on 2026-09-17 (resurrection pass after dormancy since 2026-09-09). This is an honest inventory, not an aspiration list: each item says what exists, what is tested, and what decision is still open.

## 1. Done and tested (green on a Linux dev machine)

Everything in this section is covered by `npm test` (14 files / 121 tests) and `npm run build`.

- **OFX parsing** (`bank-recon/ofx-parser.ts`) — SGML-style OFX 1.x and XML-style OFX 2.x, bank-agnostic. 8 tests.
- **CSV statement parsers** for FNB, Nedbank, ABSA, Capitec, Standard Bank — all five have direct coverage (format detection, date parsing, amount/sign handling, reference extraction, malformed-input behaviour), plus auto-detection tests.
- **PDF statement parsers** for all five banks — 14 tests, but against synthetic extracted-text fixtures (`PdfText`), not real PDF files.
- **PDF ingestion** (`bank-recon/pdf-extract.ts: extractPdfText, detectBankFromPdf`) — `extractPdfText` tested against a mocked `pdf-parse`; `detectBankFromPdf` tested against synthetic `PdfText`, not real PDF files.
- **Bank auto-detection (CSV)** (`detectBank`) — tested for all five banks plus the unknown-format case.
- **Transaction matching** (`core/matcher.ts: matchTransactions, matchInvoices, matchBills`) — amount/date/description scoring, ambiguity detection, no-double-spend. Covers the absolute-value amount comparison in `matchBills` fixed 2026-09-07.
- **Reconciliation** (`bank-recon/reconciler.ts`) — match summarisation (matched/ambiguous/unmatched counts and amounts). 5 tests.
- **Action planning** (`bank-recon/action-planner.ts`) — ReceivePayment / BillPayment / CreateExpense / CreateDeposit / ClearExisting actions, confidence gating (`HIGH_CONFIDENCE = 0.8`), review flags. 6 tests.
- **qbXML generation** (`core/qbxml.ts`) — queries, ReceivePaymentAdd, BillPaymentAdd, CheckAdd, DepositAdd, JournalEntryAdd, SalesReceiptAdd, setClearedStatus/batch, VAT summary. 15 tests, and validated against a live **QuickBooks Enterprise 24 on 2026-09-07** (commit `dad6d86`).
- **Action executor** (`bank-recon/action-executor.ts`) — turns confirmed actions into qbXML request strings. 4 tests. Note: it *generates* requests; actually sending them goes through the bridge, which is not verifiable here.
- **UI build** (`ui/`) — Vite production build green; workflow wired to a provider abstraction with mock and bridge implementations.

## 2. Partially done

- **UI (`ui/`)** — builds, and the reconciliation workflow runs against `mock-provider`. The bridge path (`bridge-provider.ts`, auto-detection of a running bridge) was wired on 2026-09-07 but has never been exercised end-to-end against live QuickBooks in a way anyone has recorded. No UI tests at all. Open decisions: is the mock provider a permanent demo mode or scaffolding to remove? Do we want component tests (e.g. Playwright/vitest-browser) before further UI work?
- **Bridge TypeScript client (`qb-bridge-http/client.ts`, `provider.ts`)** — written, but sits outside every tsconfig, every build, and the vitest include glob. It has never been type-checked. `provider.ts` imports `QBData` from `@qb-toolkit/bank-recon` and qbxml helpers; whether those imports still line up is unknown. Open decisions: move it into a proper workspace package (e.g. `packages/qb-bridge-client/src`) and add it to the build? Keep the HTTP contract versioned alongside `Program.cs`?
- **PDF ingestion against real statements** — `extractPdfText` and `detectBankFromPdf` now have direct tests (mocked `pdf-parse`, synthetic `PdfText`), but no fixture is a real bank PDF. Real statements were only exercised manually in the 2026-09-07 session (`e428a77`). Open decision: can we commit redacted real statements (or rendered equivalents) as fixtures, given they contain customer data? Same open decision for the CSV parsers' fixtures — still unresolved, still synthetic-only.

## 3. Missing entirely

- **`eft-generator`** — three-line stub (`export {}`). Intended: EFT payment files from QB outstanding payables. Open decisions before any implementation: which bank formats to target first (each SA bank has its own EFT/batch-payment format: FNB, Standard Bank EFT via CSV, Nedbank/Absa/Capitec variants, or a bureau format)? Where do payments come from — QB BillPayment proposal or a UI-selected list? How are release-day/batch controls and bank-account validation handled? This is a product decision, not just code.
- **`sars-integration`** — three-line stub. Intended: VAT201, EMP201, IRP5 extraction and formatting for SARS e-Filing. Open decisions: e-Filing has no public API — do we generate the official CSV/import layouts, or just export data for manual capture? Which return first (VAT201 is the natural fit given `qbxml.queryVATSummary`)? SARS layout versions change annually; who tracks that?
- **CI** — none. No GitHub Actions workflow, no automated gate. Today "green" means someone ran `npm install && npm test` locally. Open decisions: hosted GitHub Actions or local-only pre-push checks? Node version policy (currently developed on Node 24)? Should CI also run `npm run build` and the UI build (they are green today)?
- **Packaging / distribution** — none. Everything is `private: true` workspaces; no publishing, no versioning strategy, no way for an outsider to consume `core` or `bank-recon`. The only "distribution" is the UI bundle plus the Windows-side bridge/app. Open decisions: is this a product to ship (then: how is the bridge installed — MSI? click-once? manual MSBuild?) or an internal tool (then: document the manual deployment steps)?
- **End-to-end validation against QuickBooks** — never completed and not completable on the current dev machine. The qbXML builders were validated piecemeal against QB Enterprise 24 on 2026-09-07, but the full loop (parse statement → match → plan → confirm → executor qbXML → bridge → QuickBooks → cleared transactions) has not been run and verified as a whole, and the bridge/UI wiring landed the same day without a recorded re-verification. Open decisions: who has the Windows + QB machine and when? Do we validate against a sample company file (which one?) or a client's live file? What is the pass criteria (e.g. all five action types applied, correct cleared flags, no duplicate payments)?
- **Error handling & idempotency in the write path** — the executor emits qbXML but nothing tracks which actions were already applied; a re-run could double-post ReceivePayments. Open decision: idempotency keys / an applied-actions ledger before any live use?

## 4. Cannot be verified without Windows + QuickBooks Desktop

Do not rediscover this: the following are **unbuildable and untestable on Linux/macOS**, and no amount of local work changes that. They need a Windows machine with QuickBooks Desktop (and its SDK) installed locally.

1. `packages/qb-bridge-http/src/*.cs` (C# HTTP bridge, `QBBridge.csproj`, .NET Framework 4.5 / C# 5) — compilation, launch, CORS/localhost hardening, `/qbxml` request handling, session `/close` behaviour.
2. `app/*.cs` (`QBDesktop.csproj`, WinForms connector: MainForm, QBConnection, Program) — compilation, form behaviour, the switch from embedded WebBrowser to the system default browser (`c8173f7`).
3. QuickBooks SDK interaction — `QBConnection` COM/session handling, qbXML request/response round-trips, `setClearedStatus` actually flipping cleared flags in the register.
4. The end-to-end bridge flow — UI ↔ `bridge-provider.ts` ↔ bridge ↔ QuickBooks, including auto-detection of a running bridge and behaviour when QuickBooks prompts for connection permission.
5. Anything about real QuickBooks company data — account/customer/vendor ListIDs, EditSequence values used by `clear-existing` actions, VAT summary accuracy against a real SA VAT setup.

Rule for future sessions: never add mocks or stubs that make these look verified; document them as unverified instead (the README's "Validation status" section is the canonical place).

## 5. Suggested order of work

1. ~~**Cheap test debt**~~ — done: direct tests for `matchInvoices`/`matchBills`, `extractPdfText`/`detectBankFromPdf`, and the three previously-untested CSV parsers, all using synthetic fixtures.
2. **CI** (one decision: hosted vs local): a GitHub Actions workflow running `npm install`, `npm test`, `npm run build` on push/PR.
3. **Bridge TS client into the build** (one decision: new package vs tsconfig include): make `client.ts`/`provider.ts` type-check so the bridge contract cannot silently rot.
4. **Windows validation session** (needs the machine + QB + a sample company file): build bridge and WinForms app, run the full loop end-to-end, record results in the README validation section.
5. **Idempotency for the write path** before any real-company use.
6. **Only then** the product decisions: `eft-generator` target formats, `sars-integration` scope, packaging/distribution.
