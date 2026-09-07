import { parseCSVStatement, parseOFX, planActions, generateRequests } from "@qb-toolkit/bank-recon";
import { matchInvoices, matchBills, matchTransactions } from "@qb-toolkit/core";
import type { BankStatement, ReconAction, Transaction, InvoiceMatch, BillMatch } from "@qb-toolkit/core";
import type { ActionPlan } from "@qb-toolkit/bank-recon";
import { mockProvider, suggestGLAccount, getGLAccounts } from "./mock-provider.js";
import { findAccountByNumber } from "./qb-provider.js";
import type { QBDataProvider } from "./qb-provider.js";
import { bridgeProvider, isBridgeAvailable } from "./bridge-provider.js";

const BANK_NAMES: Record<string, string> = {
  fnb: "First National Bank",
  "standard-bank": "Standard Bank",
  nedbank: "Nedbank",
  absa: "ABSA",
  capitec: "Capitec",
};

// State
let currentStatement: BankStatement | null = null;
let currentPlan: ActionPlan | null = null;
let activeFilter = "all";
let currentStep: "upload" | "review" | "categorise" | "confirm" | "done" = "upload";

// Auto-detect: use real QB bridge if available, otherwise mock data
let provider: QBDataProvider = mockProvider;

isBridgeAvailable().then((available) => {
  if (available) {
    provider = bridgeProvider;
    const banner = document.getElementById("connection-status");
    if (banner) banner.textContent = "Connected to QuickBooks Desktop";
  }
});

// ── Navigation ──

document.querySelectorAll<HTMLButtonElement>(".nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll<HTMLElement>("[id^='page-']").forEach((p) => p.classList.remove("active"));
    document.getElementById(`page-${btn.dataset.page}`)?.classList.add("active");
  });
});

// ── File handling ──

const dropZone = document.getElementById("drop-zone")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("dragover"); });
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

document.getElementById("btn-sample")?.addEventListener("click", async () => {
  const resp = await fetch("/samples/fnb-sample.csv");
  await processCSV(await resp.text(), false);
});

function handleFile(file: File) {
  const isPDF = /\.pdf$/i.test(file.name);
  const isOFX = /\.(ofx|qfx)$/i.test(file.name);

  if (isPDF) {
    const reader = new FileReader();
    reader.onload = () => processPDF(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = () => processCSV(reader.result as string, isOFX);
    reader.readAsText(file);
  }
}

async function processCSV(content: string, isOFX: boolean) {
  try {
    const statement = isOFX ? parseOFX(content) : parseCSVStatement(content);
    await processStatement(statement);
  } catch (err) {
    alert(`Error parsing file: ${(err as Error).message}`);
  }
}

async function processPDF(_buffer: ArrayBuffer) {
  // PDF parsing requires Node.js Buffer — in browser we'd need a different approach
  // For now, show a message directing users to use CSV/OFX or the desktop app
  alert(
    "PDF parsing is available in the desktop version.\n" +
    "For the web UI, please export your statement as CSV or OFX from your bank's online portal."
  );
}

async function processStatement(statement: BankStatement) {
  currentStatement = statement;
  const accounts = await provider.getAccounts();
  const bankAccount = findAccountByNumber(accounts, statement.accountNumber);
  const bankAccountListId = bankAccount?.listId ?? "";

  const qbData = await provider.getAllData(bankAccountListId);

  // Split bank transactions by type
  const credits = statement.transactions.filter((t) => t.type === "credit");
  const debits = statement.transactions.filter((t) => t.type === "debit");

  // Match credits → invoices, debits → bills
  const invoiceMap = matchInvoices(credits, qbData.invoices);
  const billMap = matchBills(debits, qbData.bills);

  // Also match against existing QB transactions for clearing
  const existingMatches = matchTransactions(statement.transactions, qbData.transactions);

  currentPlan = planActions(
    statement.transactions,
    qbData,
    invoiceMap,
    billMap,
    existingMatches,
    {
      bankAccountListId,
      defaultExpenseAccountListId: "GL-315",
      defaultIncomeAccountListId: "GL-103",
    }
  );

  // Apply keyword-based GL suggestions to unconfirmed actions
  for (const action of currentPlan.actions) {
    if (!action.confirmed && (action.type === "create-expense" || action.type === "create-deposit")) {
      const suggested = suggestGLAccount(action.bankTxn.description);
      if (suggested) {
        action.glAccountListId = suggested;
        const glAccounts = getGLAccounts();
        action.glAccountName = glAccounts.find((a) => a.listId === suggested)?.name;
      }
    }
  }

  showStep("review");
}

// ── Step navigation ──

const STEPS: Array<typeof currentStep> = ["upload", "review", "categorise", "confirm", "done"];

function showStep(step: typeof currentStep) {
  currentStep = step;
  for (const c of STEPS) {
    document.getElementById(`${c}-card`)!.style.display = c === step ? "block" : "none";
  }

  const stepIdx = STEPS.indexOf(step);
  document.querySelectorAll<HTMLElement>(".step").forEach((el) => {
    const s = el.dataset.step!;
    const idx = STEPS.indexOf(s as typeof currentStep);
    el.classList.toggle("active", s === step);
    el.classList.toggle("completed", idx < stepIdx);
  });

  if (step === "review") renderReview();
  if (step === "categorise") renderCategorise();
  if (step === "confirm") renderConfirm();
  if (step === "done") renderDone();
}

// ── Step 1: Review matches ──

function actionLabel(a: ReconAction): string {
  switch (a.type) {
    case "receive-payment": return "Invoice Payment";
    case "bill-payment": return "Bill Payment";
    case "clear-existing": return "Clear Existing";
    case "create-expense": return "New Expense";
    case "create-deposit": return "New Deposit";
    case "create-journal-entry": return "Journal Entry";
  }
}

function isAutoAction(a: ReconAction): boolean {
  return a.type === "receive-payment" || a.type === "bill-payment" || a.type === "clear-existing";
}

function renderReview() {
  if (!currentStatement || !currentPlan) return;

  const bankName = BANK_NAMES[currentStatement.bank] ?? currentStatement.bank;
  document.getElementById("review-bank")!.textContent =
    `${bankName} — ${currentStatement.accountNumber}`;

  const auto = currentPlan.actions.filter((a) => isAutoAction(a));
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));

  document.getElementById("review-summary")!.innerHTML = `
    <div class="stat matched"><div class="value">${auto.length}</div><div class="label">Auto-matched</div></div>
    <div class="stat unmatched"><div class="value">${manual.length}</div><div class="label">Need categorisation</div></div>
    <div class="stat"><div class="value">${currentPlan.actions.length}</div><div class="label">Total</div></div>
  `;

  renderReviewTable();
}

function renderReviewTable() {
  if (!currentPlan) return;

  const filtered = activeFilter === "all"
    ? currentPlan.actions
    : currentPlan.actions.filter((a) =>
        activeFilter === "matched" ? isAutoAction(a) : !isAutoAction(a)
      );

  document.getElementById("review-body")!.innerHTML = filtered
    .map((a) => {
      const t = a.bankTxn;
      const badge = isAutoAction(a)
        ? `<span class="badge matched">${actionLabel(a)}</span>`
        : `<span class="badge unmatched">${actionLabel(a)}</span>`;
      const target = getActionTarget(a);
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>${badge}</td>
        <td>${escapeHtml(target)}</td>
      </tr>`;
    })
    .join("");
}

function getActionTarget(a: ReconAction): string {
  switch (a.type) {
    case "receive-payment": return `Invoice ${a.invoice.refNumber ?? a.invoice.txnId} → ${a.customer.name}`;
    case "bill-payment": return `Bill → ${a.vendor.name}`;
    case "clear-existing": return a.qbTxn.memo ?? "";
    case "create-expense": return a.glAccountName ?? "Needs account";
    case "create-deposit": return a.glAccountName ?? "Needs account";
    case "create-journal-entry": return a.memo ?? "";
  }
}

document.querySelectorAll<HTMLButtonElement>("#review-filter button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#review-filter button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter ?? "all";
    renderReviewTable();
  });
});

document.getElementById("btn-to-categorise")?.addEventListener("click", () => {
  if (!currentPlan) return;
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));
  showStep(manual.length === 0 ? "confirm" : "categorise");
});

// ── Step 2: Categorise unmatched ──

function renderCategorise() {
  if (!currentPlan) return;
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));
  const glAccounts = getGLAccounts();

  const glOptions = glAccounts
    .map((a) => `<option value="${a.listId}">${escapeHtml(a.name)} (${a.accountType})</option>`)
    .join("");

  document.getElementById("categorise-body")!.innerHTML = manual
    .map((a) => {
      const t = a.bankTxn;
      const globalIdx = currentPlan!.actions.indexOf(a);
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>
          <select class="gl-select" data-idx="${globalIdx}">
            <option value="">— Select account —</option>
            ${glOptions}
          </select>
        </td>
        <td>${a.type === "create-expense" && a.glAccountName
          ? `<span style="color: var(--text-muted); font-size: 12px;">Suggested: ${escapeHtml(a.glAccountName)}</span>`
          : a.type === "create-deposit" && a.glAccountName
            ? `<span style="color: var(--text-muted); font-size: 12px;">Suggested: ${escapeHtml(a.glAccountName)}</span>`
            : ""
        }</td>
      </tr>`;
    })
    .join("");

  // Pre-select suggested accounts
  document.querySelectorAll<HTMLSelectElement>(".gl-select").forEach((sel) => {
    const idx = parseInt(sel.dataset.idx!);
    const action = currentPlan!.actions[idx];
    if (action.type === "create-expense" || action.type === "create-deposit") {
      if (action.glAccountListId) sel.value = action.glAccountListId;
    }
  });

  document.querySelectorAll<HTMLSelectElement>(".gl-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = parseInt(sel.dataset.idx!);
      const action = currentPlan!.actions[idx];
      const glAccounts = getGLAccounts();
      const account = glAccounts.find((a) => a.listId === sel.value);
      if (action.type === "create-expense" || action.type === "create-deposit") {
        action.glAccountListId = account?.listId;
        action.glAccountName = account?.name;
      }
      action.confirmed = !!account;
      updateNextButton();
    });
  });

  updateNextButton();
}

document.getElementById("btn-accept-suggestions")?.addEventListener("click", () => {
  document.querySelectorAll<HTMLSelectElement>(".gl-select").forEach((sel) => {
    const idx = parseInt(sel.dataset.idx!);
    const action = currentPlan!.actions[idx];
    if ((action.type === "create-expense" || action.type === "create-deposit") && action.glAccountListId && !sel.value) {
      sel.value = action.glAccountListId;
      action.confirmed = true;
    }
  });
  updateNextButton();
});

function updateNextButton() {
  if (!currentPlan) return;
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));
  const categorised = manual.filter((a) => a.confirmed);
  const btn = document.getElementById("btn-to-confirm") as HTMLButtonElement;
  btn.disabled = categorised.length < manual.length;
  btn.textContent = categorised.length === manual.length
    ? "Next: Review & Confirm"
    : `${manual.length - categorised.length} still need an account`;
}

document.getElementById("btn-to-confirm")?.addEventListener("click", () => showStep("confirm"));
document.getElementById("btn-back-review")?.addEventListener("click", () => showStep("review"));

// ── Step 3: Confirm & Reconcile ──

function renderConfirm() {
  if (!currentPlan) return;
  const auto = currentPlan.actions.filter((a) => isAutoAction(a));
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));
  const totalAmount = currentPlan.actions.reduce((s, a) => s + a.bankTxn.amount, 0);

  document.getElementById("confirm-summary")!.innerHTML = `
    <div class="stat matched"><div class="value">${auto.length}</div><div class="label">Auto-matched</div></div>
    <div class="stat" style="background: #e7f1ff;"><div class="value">${manual.length}</div><div class="label">Manually categorised</div></div>
    <div class="stat"><div class="value">${currentPlan.actions.length}</div><div class="label">Total transactions</div></div>
    <div class="stat"><div class="value">R${formatAmount(totalAmount)}</div><div class="label">Total value</div></div>
  `;

  document.getElementById("confirm-body")!.innerHTML = currentPlan.actions
    .map((a) => {
      const t = a.bankTxn;
      const badge = isAutoAction(a)
        ? `<span class="badge matched">${actionLabel(a)}</span>`
        : `<span class="badge" style="background: #e7f1ff; color: var(--primary);">${actionLabel(a)}</span>`;
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>${badge}</td>
        <td>${escapeHtml(getActionTarget(a))}</td>
      </tr>`;
    })
    .join("");
}

document.getElementById("btn-reconcile")?.addEventListener("click", () => {
  if (!currentPlan) return;
  // Mark all as confirmed for execution
  for (const a of currentPlan.actions) a.confirmed = true;

  // Generate qbXML requests (would be sent to COM bridge)
  const requests = generateRequests(currentPlan.actions);
  console.log(`Generated ${requests.length} qbXML requests`);

  showStep("done");
});

document.getElementById("btn-back-categorise")?.addEventListener("click", () => {
  if (!currentPlan) return;
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));
  showStep(manual.length > 0 ? "categorise" : "review");
});

// ── Step 4: Done ──

function renderDone() {
  if (!currentPlan) return;
  const auto = currentPlan.actions.filter((a) => isAutoAction(a));
  const manual = currentPlan.actions.filter((a) => !isAutoAction(a));

  const autoAmount = auto.reduce((s, a) => s + a.bankTxn.amount, 0);
  const manualAmount = manual.reduce((s, a) => s + a.bankTxn.amount, 0);

  document.getElementById("done-summary")!.innerHTML = `
    <div class="stat matched"><div class="value">${auto.length}</div><div class="label">Auto-reconciled</div></div>
    <div class="stat"><div class="value">R${formatAmount(autoAmount)}</div><div class="label">Auto value</div></div>
    <div class="stat" style="background: #e7f1ff;"><div class="value">${manual.length}</div><div class="label">Manually categorised</div></div>
    <div class="stat"><div class="value">R${formatAmount(manualAmount)}</div><div class="label">Manual value</div></div>
  `;

  document.getElementById("done-detail")!.innerHTML = manual
    .map((a) => {
      const t = a.bankTxn;
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>${escapeHtml(getActionTarget(a))}</td>
      </tr>`;
    })
    .join("");
}

// ── Export & Reset ──

document.getElementById("btn-export")?.addEventListener("click", () => {
  if (!currentPlan) return;
  const header = "Date,Description,Reference,Amount,Type,Action,Target";
  const rows = currentPlan.actions.map((a) => {
    const t = a.bankTxn;
    return [
      formatDate(t.date),
      `"${t.description.replace(/"/g, '""')}"`,
      t.reference,
      t.amount.toFixed(2),
      t.type,
      actionLabel(a),
      `"${getActionTarget(a).replace(/"/g, '""')}"`,
    ].join(",");
  });
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recon-${currentStatement?.bank ?? "export"}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-reset")?.addEventListener("click", () => reset());
document.getElementById("btn-new")?.addEventListener("click", () => reset());

function reset() {
  currentStatement = null;
  currentPlan = null;
  activeFilter = "all";
  fileInput.value = "";
  showStep("upload");
}

// ── Utilities ──

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "2-digit" });
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
