import type {
  BankStatement,
  QBTransaction,
  MatchResult,
} from "@qb-toolkit/core";
import { matchTransactions } from "@qb-toolkit/core";

export interface ReconConfig {
  accountListId: string;
  autoImportUnmatched?: boolean;
}

export interface ReconResult {
  statement: BankStatement;
  matches: MatchResult[];
  summary: ReconSummary;
}

export interface ReconSummary {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  matchedAmount: number;
  unmatchedAmount: number;
}

export function reconcile(
  statement: BankStatement,
  qbTransactions: QBTransaction[],
  config: ReconConfig
): ReconResult {
  const matches = matchTransactions(statement.transactions, qbTransactions);

  const summary: ReconSummary = {
    total: matches.length,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    matchedAmount: 0,
    unmatchedAmount: 0,
  };

  for (const m of matches) {
    switch (m.status) {
      case "matched":
        summary.matched++;
        summary.matchedAmount += m.bankTxn.amount;
        break;
      case "ambiguous":
        summary.ambiguous++;
        summary.unmatchedAmount += m.bankTxn.amount;
        break;
      case "unmatched":
        summary.unmatched++;
        summary.unmatchedAmount += m.bankTxn.amount;
        break;
    }
  }

  return { statement, matches, summary };
}

export function getUnmatchedForImport(result: ReconResult): MatchResult[] {
  return result.matches.filter((m) => m.status === "unmatched");
}

export function getAmbiguousForReview(result: ReconResult): MatchResult[] {
  return result.matches.filter((m) => m.status === "ambiguous");
}
