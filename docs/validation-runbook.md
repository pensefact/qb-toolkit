# Windows + QuickBooks validation runbook

## Purpose

This runbook lets a session on a Windows machine with QuickBooks Desktop validate
the parts of qb-toolkit that cannot be built, run, or exercised on Linux/macOS.
It is a procedure plus an evidence template, not a validation result. Running it
end to end and filling in the evidence template is what closes the gap: the only
record of the last real validation session (2026-09-07) is a single commit
message, with no requests, responses, or company file kept. See
[`docs/roadmap.md`](roadmap.md) §4 for the full list of what depends on this and
why it cannot be re-derived from the code alone.

## Scope: what this runbook covers

- **The C# bridge** (`packages/qb-bridge-http/src`, `QBBridge.csproj`) — does it
  build under an MSBuild that targets .NET Framework 4.5 / C# 5, does it start,
  and does it bind to `localhost` only.
- **The WinForms connector** (`app/QBDesktop.csproj`) — does it build, does it
  open QuickBooks, does the system-browser handoff work.
- **QuickBooks SDK round-trips** — does each qbXML request the bridge forwards
  get a response QuickBooks accepts, including the ones already believed correct
  from the 2026-09-07 session (`DepositAdd` via `ORDepositLineAdd`,
  `JournalEntryAdd`, `EditSequence` on Mod operations, `BillPaymentCheck`
  element ordering).
- **The end-to-end flow** — statement → match → plan → confirm → executor
  qbXML → bridge → QuickBooks → cleared register, run as one pass, not as
  isolated builder unit tests.
- **Anything that depends on real company data** — account/customer/vendor
  ListIDs, EditSequence values used by `ClearExisting`, and the VAT summary
  against a real SA VAT setup.

This runbook does not cover, and does not attempt: `eft-generator` or
`sars-integration` (empty scaffolds, out of scope until a product decision is
made — see `docs/roadmap.md` §3), CI, or packaging. Do not build, run, or
compile the C# sources anywhere except the Windows session this runbook
describes.

## Prerequisites

- Windows (10 or 11, or Windows Server equivalent).
- QuickBooks Desktop installed, plus the QuickBooks SDK (QBFC/qbXML SDK)
  matching the installed QuickBooks version.
- A sample or test company file open in QuickBooks Desktop before the bridge
  connects (the bridge cannot create or select one).
- MSBuild capable of C# 5 / .NET Framework 4.5 — Visual Studio 2015 or later
  with the .NET Framework 4.5 targeting pack, or the standalone Build Tools
  equivalent.
- Node.js and `npm` for the TypeScript side (`packages/core`,
  `packages/bank-recon`), matching the root `package.json` engine requirement.
- A copy of this repo, on the branch/commit being validated, with the commit
  hash recorded in the evidence log.

## Procedure

Fill in the evidence template (below) as you go — per step, not at the end.

1. **Record the environment.** QuickBooks Desktop version and edition, company
   file name/location (or that it's a fresh sample file), Windows version, .NET
   Framework version, date, operator. This goes in the evidence log header.

2. **Build the TypeScript side first**, from repo root:
   ```
   npm install
   npm run build
   ```
   This builds `core` → `bank-recon` → stubs → `ui` in dependency order (see
   `AGENTS.md`). It does not touch the C# projects. Confirm it's green before
   proceeding — a TypeScript build failure here means the executor's qbXML
   output can't be trusted regardless of what the bridge does.

3. **Build the C# bridge.**
   ```
   msbuild packages\qb-bridge-http\src\QBBridge.csproj
   ```
   Record whether this succeeds, and the exact MSBuild/Visual Studio version
   used. If it fails, stop and log the error in full — do not patch around it
   as part of this runbook (C# behaviour changes are out of scope here).

4. **Build the WinForms connector.**
   ```
   msbuild app\QBDesktop.csproj
   ```
   Same recording requirements as step 3.

5. **Start the bridge** (the built `QBBridge.exe`). Confirm in the console
   output that it reports listening on `http://localhost:2707/` (port defined
   in `Program.cs`). Confirm it does **not** bind to `0.0.0.0` or any
   non-loopback address — check with `netstat -ano | findstr 2707` and verify
   only a loopback listener is present. This is the "localhost only" hardening
   check the spec calls for; record the `netstat` output in the evidence log.

6. **Confirm the endpoint surface.** With the bridge running, `GET
   http://localhost:2707/status` should return a JSON body with `connected`
   and `port`. Record the raw response.

7. **Open the WinForms connector** (`QBDesktop.exe`) and let it connect to
   QuickBooks. QuickBooks Desktop will prompt for an application connection
   permission the first time — grant it, and record what QuickBooks presented
   (app name, permission level) since this has never been recorded before.
   Confirm `/status` now reports `connected: true`.

8. **Run the full loop**, using a real or realistic bank statement file against
   the same company file open in QuickBooks:
   1. **Parse** a statement (OFX, CSV, or PDF — for one of the five supported
      banks) with `packages/bank-recon`.
   2. **Match** the parsed transactions against QuickBooks data
      (`core/matcher.ts: matchTransactions`, and `matchInvoices`/`matchBills`
      if invoices or bills are involved).
   3. **Plan** actions (`bank-recon/action-planner.ts`) and confirm that all
      five action types get exercised across the statement: `ReceivePayment`,
      `BillPayment`, `CreateExpense`, `CreateDeposit`, `ClearExisting`. If the
      sample statement doesn't naturally produce all five, construct
      additional transactions/company-file state so it does — the pass
      criteria below require all five.
   4. **Confirm** the planned actions (whatever confirmation step the UI or a
      manual driver script performs).
   5. **Generate qbXML** through the executor (`bank-recon/action-executor.ts`).
      Capture the exact request string for every action before it's sent.
   6. **Send through the bridge** — either via the UI's `bridge-provider.ts`
      path or by POSTing the executor's qbXML directly to
      `http://localhost:2707/qbxml`. Record the raw response for every
      request.
   7. **Verify inside QuickBooks** — open the register/transaction list in
      QuickBooks Desktop itself (not just via a second bridge query) and
      confirm each action landed correctly: the right transaction type, the
      right amounts, and for `ClearExisting`, the cleared flag actually
      flipped in the register.

9. **Check for duplicates.** After the full run, re-query QuickBooks for the
   transactions touched and confirm no action was posted twice (this matters
   especially for `ReceivePayment` — see the idempotency gap noted in
   `docs/roadmap.md` §3).

10. **Pull the VAT summary** (`core/qbxml.ts: queryVATSummary`) for the period
    covered by the statement and compare it line-by-line against QuickBooks'
    own VAT/Sales Tax report for the same period and company file.

11. **Close the bridge session** — `POST /close` — and confirm the WinForms
    connector reflects the disconnect.

12. **Fill in the pass/fail verdict** (see Pass criteria) and commit the
    evidence log alongside the commit or PR that references this session, so
    it doesn't end up as a commit-message-only record like 2026-09-07.

## Pass criteria

State these results separately from the raw observations recorded per step
above — the evidence log should show the data, and this section states
whether it passes.

A session **passes** only if all of the following hold:

- [ ] All five action types were applied and confirmed in QuickBooks:
      `ReceivePayment`, `BillPayment`, `CreateExpense`, `CreateDeposit`,
      `ClearExisting`.
- [ ] Cleared flags flip correctly in the register for every `ClearExisting`
      action and for any other action that should leave a transaction marked
      cleared.
- [ ] No duplicate payments or transactions were created by the run (step 9).
- [ ] The VAT summary from `queryVATSummary` agrees with QuickBooks' own VAT
      report for the same period (step 10).

Any unchecked box is a fail for that item; record it as such rather than
omitting it. A partial pass (e.g. four of five action types) is not a pass —
say explicitly which criterion failed and why.

## Evidence template

Copy this block per validation session into a dated file (e.g.
`docs/validation-sessions/2026-09-07-example.md`, adjusted for the actual
date) or append it to this runbook under a session heading. Fill in every
field — an empty field is the same gap this runbook exists to close.

```markdown
### Validation session: <date>

**Environment**
- QuickBooks Desktop version/edition:
- QuickBooks SDK version:
- Company file (name and whether sample/test or real):
- Windows version:
- .NET Framework / MSBuild version used:
- Repo commit hash / branch:
- Operator:

**Step 3 — bridge build**
- Result (pass/fail):
- MSBuild output (or link to saved log):

**Step 4 — WinForms build**
- Result (pass/fail):
- MSBuild output (or link to saved log):

**Step 5 — bridge listen check**
- Console output on start:
- `netstat` output confirming localhost-only bind:

**Step 6 — /status check**
- Raw response:

**Step 7 — connector → QuickBooks connection**
- QuickBooks permission prompt content:
- `/status` response after connecting:

**Step 8 — full loop (repeat this block per action)**
- Action type:
- Source statement transaction (redact account numbers if real data):
- Matched QuickBooks entity (ListID or description, not full PII):
- Planned action + confidence:
- qbXML request sent:
- qbXML response received:
- What confirmed the result inside QuickBooks (screenshot description, register
  entry, report line — be specific):

**Step 9 — duplicate check**
- Query used:
- Result:

**Step 10 — VAT summary comparison**
- `queryVATSummary` output:
- QuickBooks VAT/Sales Tax report for the same period:
- Agreement (yes/no, with any discrepancy noted):

**Step 11 — session close**
- `/close` response:
- Connector state after close:

**Verdict**
- Pass criteria met (list each of the four, pass/fail):
- Overall: pass / fail / partial (explain)
- New findings (structural fixes needed, e.g. the 2026-09-07 findings about
  `ORDepositLineAdd`, `EditSequence`, `BillPaymentCheck` ordering):
```

## After the session

Update `README.md`'s "Validation status" section and `docs/roadmap.md` with
what was actually validated, citing this session's evidence log entry instead
of a bare commit note. Do not mark anything as validated based on this
runbook's existence alone — only a completed session with a filled-in evidence
template and a passing verdict justifies that.
