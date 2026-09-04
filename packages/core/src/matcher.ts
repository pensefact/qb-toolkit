import type {
  Transaction,
  QBTransaction,
  QBInvoice,
  QBBill,
  MatchResult,
  InvoiceMatch,
  BillMatch,
} from "./types.js";

const AMOUNT_TOLERANCE = 0.01;
const DATE_TOLERANCE_DAYS = 5;
const HIGH_CONFIDENCE = 0.9;
const MEDIUM_CONFIDENCE = 0.6;
const LOW_CONFIDENCE = 0.3;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(
    (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function extractReference(s: string): string | null {
  const match = s.match(/\b[A-Z]{2,4}[-/]?\d{4,}\b/i) ?? s.match(/\b\d{6,}\b/);
  return match ? match[0].replace(/[-/]/g, "").toLowerCase() : null;
}

function referenceMatch(a: string, b: string): number {
  const refA = extractReference(a);
  const refB = extractReference(b);
  if (!refA || !refB) return 0;
  if (refA === refB) return 1;
  if (refA.includes(refB) || refB.includes(refA)) return 0.8;
  return 0;
}

function textSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

// ── Invoice matching (bank credits → unpaid invoices) ──

function scoreInvoiceMatch(bankTxn: Transaction, invoice: QBInvoice): number {
  const amountMatch =
    Math.abs(bankTxn.amount - invoice.balanceRemaining) <= AMOUNT_TOLERANCE;
  if (!amountMatch) return 0;

  let score = 0.5;

  const dateDiff = daysBetween(bankTxn.date, invoice.txnDate);
  if (dateDiff <= DATE_TOLERANCE_DAYS) {
    score += 0.1 * (1 - dateDiff / DATE_TOLERANCE_DAYS);
  }

  const refScore = Math.max(
    invoice.refNumber
      ? referenceMatch(bankTxn.reference, invoice.refNumber)
      : 0,
    invoice.refNumber
      ? referenceMatch(bankTxn.description, invoice.refNumber)
      : 0
  );
  if (refScore > 0) {
    score += refScore * 0.4;
  }

  const nameScore = textSimilarity(
    bankTxn.description,
    invoice.customerRef.name
  );
  if (nameScore > 0.3) {
    score += nameScore * 0.1;
  }

  return Math.min(score, 1);
}

export function matchInvoices(
  credits: Transaction[],
  invoices: QBInvoice[]
): Map<Transaction, InvoiceMatch | null> {
  const result = new Map<Transaction, InvoiceMatch | null>();
  const usedInvoices = new Set<string>();

  const candidates = credits.map((txn) => {
    const scored = invoices
      .map((inv) => ({ invoice: inv, score: scoreInvoiceMatch(txn, inv) }))
      .filter((c) => c.score > LOW_CONFIDENCE)
      .sort((a, b) => b.score - a.score);
    return { txn, scored };
  });

  candidates.sort(
    (a, b) => (b.scored[0]?.score ?? 0) - (a.scored[0]?.score ?? 0)
  );

  for (const { txn, scored } of candidates) {
    const best = scored.find((c) => !usedInvoices.has(c.invoice.txnId));
    if (!best || best.score < LOW_CONFIDENCE) {
      result.set(txn, null);
      continue;
    }
    usedInvoices.add(best.invoice.txnId);
    result.set(txn, { invoice: best.invoice, score: best.score });
  }

  return result;
}

// ── Bill matching (bank debits → unpaid bills) ──

function scoreBillMatch(bankTxn: Transaction, bill: QBBill): number {
  const amountMatch =
    Math.abs(bankTxn.amount - bill.amountDue) <= AMOUNT_TOLERANCE;
  if (!amountMatch) return 0;

  let score = 0.5;

  const dateDiff = daysBetween(bankTxn.date, bill.txnDate);
  if (dateDiff <= DATE_TOLERANCE_DAYS) {
    score += 0.1 * (1 - dateDiff / DATE_TOLERANCE_DAYS);
  }

  const refScore = Math.max(
    bill.refNumber ? referenceMatch(bankTxn.reference, bill.refNumber) : 0,
    bill.refNumber ? referenceMatch(bankTxn.description, bill.refNumber) : 0
  );
  if (refScore > 0) {
    score += refScore * 0.4;
  }

  const nameScore = textSimilarity(
    bankTxn.description,
    bill.vendorRef.name
  );
  if (nameScore > 0.3) {
    score += nameScore * 0.1;
  }

  return Math.min(score, 1);
}

export function matchBills(
  debits: Transaction[],
  bills: QBBill[]
): Map<Transaction, BillMatch | null> {
  const result = new Map<Transaction, BillMatch | null>();
  const usedBills = new Set<string>();

  const candidates = debits.map((txn) => {
    const scored = bills
      .map((bill) => ({ bill, score: scoreBillMatch(txn, bill) }))
      .filter((c) => c.score > LOW_CONFIDENCE)
      .sort((a, b) => b.score - a.score);
    return { txn, scored };
  });

  candidates.sort(
    (a, b) => (b.scored[0]?.score ?? 0) - (a.scored[0]?.score ?? 0)
  );

  for (const { txn, scored } of candidates) {
    const best = scored.find((c) => !usedBills.has(c.bill.txnId));
    if (!best || best.score < LOW_CONFIDENCE) {
      result.set(txn, null);
      continue;
    }
    usedBills.add(best.bill.txnId);
    result.set(txn, { bill: best.bill, score: best.score });
  }

  return result;
}

// ── Legacy flat transaction matching (for already-in-QB txns) ──

function scoreMatch(bankTxn: Transaction, qbTxn: QBTransaction): number {
  const amountMatch =
    Math.abs(bankTxn.amount - qbTxn.amount) <= AMOUNT_TOLERANCE;
  if (!amountMatch) return 0;

  const dateDiff = daysBetween(bankTxn.date, qbTxn.date);
  if (dateDiff > DATE_TOLERANCE_DAYS) return 0;

  let score = 0.5;
  score += 0.2 * (1 - dateDiff / DATE_TOLERANCE_DAYS);

  const refScore = Math.max(
    qbTxn.refNumber && bankTxn.reference
      ? referenceMatch(bankTxn.reference, qbTxn.refNumber)
      : 0,
    qbTxn.memo
      ? referenceMatch(bankTxn.description, qbTxn.memo)
      : 0
  );
  score += refScore * 0.2;

  const descSim = Math.max(
    qbTxn.memo ? textSimilarity(bankTxn.description, qbTxn.memo) : 0,
    qbTxn.refNumber && bankTxn.reference
      ? textSimilarity(bankTxn.reference, qbTxn.refNumber)
      : 0
  );
  score += descSim * 0.1;

  return Math.min(score, 1);
}

export function matchTransactions(
  bankTxns: Transaction[],
  qbTxns: QBTransaction[]
): MatchResult[] {
  const usedQB = new Set<string>();
  const results: MatchResult[] = [];

  const candidates = bankTxns.map((bankTxn) => {
    const scored = qbTxns
      .map((qbTxn) => ({ qbTxn, score: scoreMatch(bankTxn, qbTxn) }))
      .filter((c) => c.score > LOW_CONFIDENCE)
      .sort((a, b) => b.score - a.score);
    return { bankTxn, scored };
  });

  candidates.sort(
    (a, b) => (b.scored[0]?.score ?? 0) - (a.scored[0]?.score ?? 0)
  );

  for (const { bankTxn, scored } of candidates) {
    const best = scored.find((c) => !usedQB.has(c.qbTxn.txnId));
    if (!best) {
      results.push({ bankTxn, confidence: 0, status: "unmatched" });
      continue;
    }

    const secondBest = scored.find(
      (c) =>
        !usedQB.has(c.qbTxn.txnId) && c.qbTxn.txnId !== best.qbTxn.txnId
    );
    const ambiguous = secondBest && best.score - secondBest.score < 0.1;

    usedQB.add(best.qbTxn.txnId);
    results.push({
      bankTxn,
      qbTxn: best.qbTxn,
      confidence: best.score,
      status: ambiguous
        ? "ambiguous"
        : best.score >= MEDIUM_CONFIDENCE
          ? "matched"
          : "unmatched",
    });
  }

  return results;
}
