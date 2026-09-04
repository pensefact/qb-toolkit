import { parseStatement, parseOFX } from "@qb-toolkit/bank-recon";
import { matchTransactions } from "@qb-toolkit/core";
import type { BankStatement, MatchResult, ReconAction } from "@qb-toolkit/core";
import {
  MOCK_BANK_ACCOUNTS,
  MOCK_GL_ACCOUNTS,
  findAccountByNumber,
  getTransactionsForAccount,
  suggestGLAccount,
} from "./mock-qb.js";

const BANK_NAMES: Record<string, string> = {
  fnb: "First National Bank",
  "standard-bank": "Standard Bank",
  nedbank: "Nedbank",
  absa: "ABSA",
  capitec: "Capitec",
};

let currentResults: MatchResult[] = [];
let currentStatement: BankStatement | null = null;
let reconActions: ReconAction[] = [];
let activeFilter = "all";
let currentStep: "upload" | "review" | "categorise" | "confirm" | "done" = "upload";

// Navigation
document.querySelectorAll<HTMLButtonElement>(".nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll<HTMLElement>("[id^='page-']").forEach((p) => p.classList.remove("active"));
    document.getElementById(`page-${btn.dataset.page}`)?.classList.add("active");
  });
});

// Drop zone
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
  processContent(await resp.text(), false);
});

function handleFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const isOFX = /\.(ofx|qfx)$/i.test(file.name);
    processContent(reader.result as string, isOFX);
  };
  reader.readAsText(file);
}

function processContent(content: string, isOFX: boolean) {
  try {
    currentStatement = isOFX ? parseOFX(content) : parseStatement(content);
    const account = findAccountByNumber(currentStatement.accountNumber);
    const qbTxns = account ? getTransactionsForAccount(account.listId) : [];
    currentResults = matchTransactions(currentStatement.transactions, qbTxns);
    buildReconActions();
    showStep("review");
  } catch (err) {
    alert(`Error parsing file: ${(err as Error).message}`);
  }
}

function buildReconActions() {
  reconActions = currentResults.map((r) => {
    if (r.status === "matched" && r.qbTxn) {
      return {
        type: "clear" as const,
        bankTxn: r.bankTxn,
        qbTxn: r.qbTxn,
        confirmed: true,
      };
    }
    const suggestedId = suggestGLAccount(r.bankTxn.description);
    const suggested = suggestedId
      ? MOCK_GL_ACCOUNTS.find((a) => a.listId === suggestedId)
      : null;
    return {
      type: "create-and-clear" as const,
      bankTxn: r.bankTxn,
      qbTxn: r.qbTxn,
      glAccountListId: suggested?.listId,
      glAccountName: suggested?.name,
      confirmed: false,
    };
  });
}

const STEPS: Array<typeof currentStep> = ["upload", "review", "categorise", "confirm", "done"];

function showStep(step: typeof currentStep) {
  currentStep = step;
  const cards = ["upload", "review", "categorise", "confirm", "done"] as const;
  for (const c of cards) {
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

function renderReview() {
  if (!currentStatement) return;

  const bankName = BANK_NAMES[currentStatement.bank] ?? currentStatement.bank;
  const account = findAccountByNumber(currentStatement.accountNumber);

  document.getElementById("review-bank")!.textContent =
    `${bankName} — ${account ? account.name : currentStatement.accountNumber}`;

  const matched = reconActions.filter((a) => a.type === "clear");
  const unmatched = reconActions.filter((a) => a.type === "create-and-clear");

  document.getElementById("review-summary")!.innerHTML = `
    <div class="stat matched"><div class="value">${matched.length}</div><div class="label">Matched — will mark cleared</div></div>
    <div class="stat unmatched"><div class="value">${unmatched.length}</div><div class="label">New — need GL account</div></div>
    <div class="stat"><div class="value">${reconActions.length}</div><div class="label">Total</div></div>
  `;

  renderReviewTable();
}

function renderReviewTable() {
  const filtered = activeFilter === "all"
    ? reconActions
    : reconActions.filter((a) =>
        activeFilter === "matched" ? a.type === "clear" : a.type === "create-and-clear"
      );

  document.getElementById("review-body")!.innerHTML = filtered
    .map((a, idx) => {
      const t = a.bankTxn;
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>${a.type === "clear"
          ? `<span class="badge matched">Match → Clear</span>`
          : `<span class="badge unmatched">New → Create & Clear</span>`
        }</td>
        <td>${a.qbTxn ? escapeHtml(a.qbTxn.memo ?? "") : "—"}</td>
      </tr>`;
    })
    .join("");
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
  const unmatched = reconActions.filter((a) => a.type === "create-and-clear");
  if (unmatched.length === 0) {
    showStep("confirm");
  } else {
    showStep("categorise");
  }
});

// ── Step 2: Categorise unmatched ──

function renderCategorise() {
  const unmatched = reconActions.filter((a) => a.type === "create-and-clear");

  const glOptions = MOCK_GL_ACCOUNTS
    .map((a) => `<option value="${a.listId}">${escapeHtml(a.name)} (${a.accountType})</option>`)
    .join("");

  document.getElementById("categorise-body")!.innerHTML = unmatched
    .map((a) => {
      const t = a.bankTxn;
      const globalIdx = reconActions.indexOf(a);
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
        <td>${a.glAccountName
          ? `<span style="color: var(--text-muted); font-size: 12px;">Suggested: ${escapeHtml(a.glAccountName)}</span>`
          : ""
        }</td>
      </tr>`;
    })
    .join("");

  // Pre-select suggested accounts
  document.querySelectorAll<HTMLSelectElement>(".gl-select").forEach((sel) => {
    const idx = parseInt(sel.dataset.idx!);
    const action = reconActions[idx];
    if (action.glAccountListId) {
      sel.value = action.glAccountListId;
    }
  });

  // Listen for changes
  document.querySelectorAll<HTMLSelectElement>(".gl-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = parseInt(sel.dataset.idx!);
      const account = MOCK_GL_ACCOUNTS.find((a) => a.listId === sel.value);
      reconActions[idx].glAccountListId = account?.listId;
      reconActions[idx].glAccountName = account?.name;
      reconActions[idx].confirmed = !!account;
      updateNextButton();
    });
  });

  updateNextButton();
}

document.getElementById("btn-accept-suggestions")?.addEventListener("click", () => {
  document.querySelectorAll<HTMLSelectElement>(".gl-select").forEach((sel) => {
    const idx = parseInt(sel.dataset.idx!);
    const action = reconActions[idx];
    if (action.glAccountListId && !sel.value) {
      sel.value = action.glAccountListId;
      action.confirmed = true;
    }
  });
  updateNextButton();
});

function updateNextButton() {
  const unmatched = reconActions.filter((a) => a.type === "create-and-clear");
  const categorised = unmatched.filter((a) => a.glAccountListId);
  const btn = document.getElementById("btn-to-confirm") as HTMLButtonElement;
  btn.disabled = categorised.length < unmatched.length;
  btn.textContent = categorised.length === unmatched.length
    ? "Next: Review & Confirm"
    : `${unmatched.length - categorised.length} still need an account`;
}

document.getElementById("btn-to-confirm")?.addEventListener("click", () => {
  showStep("confirm");
});

document.getElementById("btn-back-review")?.addEventListener("click", () => {
  showStep("review");
});

// ── Step 4: Confirm & Reconcile ──

function renderConfirm() {
  const matched = reconActions.filter((a) => a.type === "clear");
  const created = reconActions.filter((a) => a.type === "create-and-clear");
  const totalAmount = reconActions.reduce((s, a) => s + a.bankTxn.amount, 0);

  document.getElementById("confirm-summary")!.innerHTML = `
    <div class="stat matched"><div class="value">${matched.length}</div><div class="label">Mark as cleared</div></div>
    <div class="stat" style="background: #e7f1ff;"><div class="value">${created.length}</div><div class="label">Create & clear</div></div>
    <div class="stat"><div class="value">${reconActions.length}</div><div class="label">Total transactions</div></div>
    <div class="stat"><div class="value">R${formatAmount(totalAmount)}</div><div class="label">Total value</div></div>
  `;

  document.getElementById("confirm-body")!.innerHTML = reconActions
    .map((a) => {
      const t = a.bankTxn;
      const actionLabel = a.type === "clear"
        ? `<span class="badge matched">Clear</span>`
        : `<span class="badge" style="background: #e7f1ff; color: var(--primary);">Create & Clear</span>`;
      const target = a.type === "clear"
        ? escapeHtml(a.qbTxn?.memo ?? "")
        : escapeHtml(a.glAccountName ?? "");
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>${actionLabel}</td>
        <td>${target}</td>
      </tr>`;
    })
    .join("");
}

document.getElementById("btn-reconcile")?.addEventListener("click", () => {
  showStep("done");
});

document.getElementById("btn-back-categorise")?.addEventListener("click", () => {
  const unmatched = reconActions.filter((a) => a.type === "create-and-clear");
  showStep(unmatched.length > 0 ? "categorise" : "review");
});

// ── Step 5: Done ──

function renderDone() {
  const matched = reconActions.filter((a) => a.type === "clear");
  const created = reconActions.filter((a) => a.type === "create-and-clear");

  const clearedAmount = matched.reduce((s, a) => s + a.bankTxn.amount, 0);
  const createdAmount = created.reduce((s, a) => s + a.bankTxn.amount, 0);

  document.getElementById("done-summary")!.innerHTML = `
    <div class="stat matched"><div class="value">${matched.length}</div><div class="label">Existing txns marked cleared</div></div>
    <div class="stat"><div class="value">R${formatAmount(clearedAmount)}</div><div class="label">Cleared value</div></div>
    <div class="stat" style="background: #e7f1ff;"><div class="value">${created.length}</div><div class="label">New txns created & cleared</div></div>
    <div class="stat"><div class="value">R${formatAmount(createdAmount)}</div><div class="label">Created value</div></div>
  `;

  document.getElementById("done-detail")!.innerHTML = created
    .map((a) => {
      const t = a.bankTxn;
      return `<tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td class="amount ${t.type}">${t.type === "debit" ? "-" : ""}R${formatAmount(t.amount)}</td>
        <td>${escapeHtml(a.glAccountName ?? "")}</td>
      </tr>`;
    })
    .join("");
}

// ── Export & Reset ──

document.getElementById("btn-export")?.addEventListener("click", () => {
  if (!reconActions.length) return;
  const header = "Date,Description,Reference,Amount,Type,Action,GL Account,QB Match";
  const rows = reconActions.map((a) => {
    const t = a.bankTxn;
    return [
      formatDate(t.date),
      `"${t.description.replace(/"/g, '""')}"`,
      t.reference,
      t.amount.toFixed(2),
      t.type,
      a.type,
      a.glAccountName ?? "",
      a.qbTxn?.memo ?? "",
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
  currentResults = [];
  currentStatement = null;
  reconActions = [];
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
