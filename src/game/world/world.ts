/**
 * Persistent world state around the table: characters, reputations,
 * relationships, covenants and an append-only journal of Lifechip transfers.
 *
 * Global accounting invariant: chips at the table + chips characters hold away
 * from it + the Ledger relief treasury never change. Transfers only move chips
 * between named holders.
 */
import { LEDGER_TREASURY_INITIAL, type Pact, type RuleKey } from './rules';

export interface Reputation {
  honor: number;
  dread: number;
  favor: number;
  notoriety: number;
}

/** What one character remembers about another. */
export interface Relation {
  friendly?: boolean;
  hostile?: boolean;
  /** They spared me at a Last Claim. */
  sparedMe?: boolean;
  /** I spared them. */
  iSpared?: boolean;
  betrayedMe?: boolean;
}

export type SeatStatus = 'seated' | 'exited' | 'dead';

export interface Character {
  id: string;
  name: string;
  kind: 'human' | 'ai';
  ruleKey: RuleKey;
  status: SeatStatus;
  alive: boolean;
  /** UNBOUND_FALLEN: a Fallen character whose covenant is discharged (design v0.7 §10). */
  socialRank: 'UNRANKED' | 'FALLEN' | 'UNBOUND_FALLEN';
  district: 'LANTERN_MARKET' | 'CINDER_WARRENS';
  /** Lifechips held away from this table (after a funded survival). */
  offTable: number;
  survivalCovenantsUsed: number;
  reputation: Reputation;
  relations: Record<string, Relation>;
  pendingNode: 'FALLEN_RECOVERY' | null;
}

export type ContractStatus = 'active' | 'overdue' | 'cleared';

export interface Contract {
  id: string;
  claimId: string;
  pact: Pact;
  debtor: string;
  /** Character id, or 'ledger' for the neutral adjudicator. */
  creditor: string;
  principal: number;
  /** Total Lifechips owed (debt only; 0 otherwise). */
  obligation: number;
  repaid: number;
  servicesOwed: number;
  servicesDone: number;
  tablesCompleted: number;
  status: ContractStatus;
  /** Act boundaries at which this NPC debtor already offered a voluntary payment (design v0.7 §07). */
  voluntaryActs?: string[];
}

export interface Transfer {
  id: number;
  /** Character id or 'ledger'. */
  from: string;
  to: string;
  amount: number;
  reason: string;
}

export interface WorldState {
  characters: Character[];
  treasury: number;
  contracts: Contract[];
  journal: Transfer[];
  /** Sum of every Lifechip in the world at creation (table + off-table + treasury). */
  totalLifechips: number;
}

export function createCharacter(
  id: string,
  name: string,
  kind: Character['kind'],
  ruleKey: RuleKey,
): Character {
  return {
    id,
    name,
    kind,
    ruleKey,
    status: 'seated',
    alive: true,
    socialRank: 'UNRANKED',
    district: 'LANTERN_MARKET',
    offTable: 0,
    survivalCovenantsUsed: 0,
    reputation: { honor: 0, dread: 0, favor: 0, notoriety: 0 },
    relations: {},
    pendingNode: null,
  };
}

export function createWorld(characters: Character[], tableChips: number, treasury = LEDGER_TREASURY_INITIAL): WorldState {
  return { characters, treasury, contracts: [], journal: [], totalLifechips: tableChips + treasury };
}

export function relation(world: WorldState, from: string, to: string): Relation {
  const c = world.characters.find((x) => x.id === from)!;
  return (c.relations[to] ??= {});
}

/** Throws unless table stacks + off-table balances + treasury equal the world total. */
export function assertWorldInvariants(world: WorldState, tableStacks: number[]): void {
  const offTable = world.characters.reduce((s, c) => s + c.offTable, 0);
  const sum = tableStacks.reduce((s, x) => s + x, 0) + offTable + world.treasury;
  if (sum !== world.totalLifechips) throw new Error(`World invariant: ${sum} Lifechips, expected ${world.totalLifechips}`);
  if (world.treasury < 0 || world.characters.some((c) => c.offTable < 0)) throw new Error('World invariant: negative balance');
  if (tableStacks.some((s) => !Number.isInteger(s) || s < 0)) throw new Error('World invariant: invalid table stack');
  for (const k of world.contracts) {
    if (k.repaid < 0 || k.repaid > k.obligation) throw new Error(`World invariant: contract ${k.id} repayment out of range`);
  }
}
