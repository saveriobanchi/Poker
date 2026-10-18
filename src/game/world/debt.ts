/**
 * Debt covenant repayment after each completed future table (design v0.5 §06).
 * Wired into play in P4, when the player can reach another table.
 */
import { DEBT } from './rules';
import type { Contract } from './world';

export interface Repayment {
  contract: Contract;
  /** Lifechips the debtor must transfer to the creditor now (a real transfer). */
  payment: number;
  becameOverdue: boolean;
}

/**
 * @param netTableWinnings debtor's net result at the table just completed
 * @param debtorBalance debtor's Lifechips after that table
 */
export function repayAfterTable(contract: Contract, netTableWinnings: number, debtorBalance: number): Repayment {
  const k = structuredClone(contract);
  if (k.pact !== 'debt' || k.status === 'cleared') return { contract: k, payment: 0, becameOverdue: false };
  const owed = k.obligation - k.repaid;
  const share = Math.floor(DEBT.repayShare * Math.max(0, netTableWinnings));
  const payment = Math.max(0, Math.min(share, owed, debtorBalance - DEBT.preservedStack));
  k.repaid += payment;
  k.tablesCompleted += 1;
  let becameOverdue = false;
  if (k.repaid >= k.obligation) k.status = 'cleared';
  else if (k.tablesCompleted >= DEBT.overdueAfterTables && k.status === 'active') {
    k.status = 'overdue';
    becameOverdue = true;
  }
  return { contract: k, payment, becameOverdue };
}
