/**
 * Last Claim and covenant numbers from design decisions v0.5 (§05, §06).
 * All values are P3 prototypes, to be measured in P4.
 */
export type Pact = 'mercy' | 'debt' | 'service';
export const PACTS: Pact[] = ['mercy', 'debt', 'service'];

/** Key used for per-character tables: rival profile id, 'player', 'adjudicator' or 'other'. */
export type RuleKey = 'vesper' | 'oracle' | 'corvin' | 'player' | 'adjudicator' | 'other';

/** Revival endowment each claimant funds (from their own post-pot stack, or the Ledger relief treasury). */
export const ENDOWMENT: Record<RuleKey, number> = {
  vesper: 10,
  oracle: 12,
  corvin: 8,
  player: 10,
  adjudicator: 10,
  other: 10,
};

/** Claimant's base willingness to consider an otherwise valid survival bargain. */
export const CLAIMANT_BASE: Record<RuleKey, number> = {
  vesper: 0.25,
  oracle: 0.5,
  corvin: 0.7,
  player: 0.4,
  adjudicator: 0.4,
  other: 0.4,
};

export const CLAIMANT_PACT_PREFERENCE: Record<RuleKey, Partial<Record<Pact, number>>> = {
  vesper: { service: 0.15, debt: 0.05, mercy: -0.15 },
  oracle: { debt: 0.15, service: -0.1, mercy: -0.05 },
  corvin: { mercy: 0.1, debt: 0.05, service: -0.2 },
  player: {},
  adjudicator: {},
  other: {},
};

/** NPC debtor's base acceptance when the player, as claimant, offers survival terms. */
export const DEBTOR_BASE: Record<RuleKey, number> = {
  vesper: 0.4,
  oracle: 0.8,
  corvin: 0.7,
  player: 0.5,
  adjudicator: 0.5,
  other: 0.5,
};

export const DEBTOR_PACT_MODIFIER: Record<Pact, number> = { mercy: 0.15, debt: 0, service: -0.2 };

export const CLAIMANT_MODIFIERS = {
  friendly: 0.1,
  previouslySparedByDebtor: 0.15,
  hostile: -0.15,
  betrayedByDebtor: -0.25,
  debtorHonorAtLeast2: 0.1,
  debtorDreadAtLeast2VsCorvin: -0.1,
  retainsAtLeast30: 0.05,
  retainsUnder10: -0.1,
};

export const DEBTOR_MODIFIERS = { friendly: 0.1, betrayed: -0.2 };

export const WILLINGNESS_CLAMP = [0.05, 0.9] as const;

export type Outlook = 'LOW' | 'FAIR' | 'HIGH';
export const OUTLOOK_TEXT: Record<Outlook, string> = {
  LOW: 'They see little reason to spare you.',
  FAIR: 'They may consider a serious bargain.',
  HIGH: 'They seem inclined to negotiate. Nothing is guaranteed.',
};

export function outlook(p: number): Outlook {
  return p < 0.35 ? 'LOW' : p < 0.65 ? 'FAIR' : 'HIGH';
}

export const DEBT = { multiplier: 1.5, repayShare: 0.3, overdueAfterTables: 4, preservedStack: 1 };
export const SERVICE_TASKS = 3;
export const MAX_PLAYER_SURVIVAL_COVENANTS = 1;

/**
 * PROTOTYPE (not specified in v0.5): starting balance of the Ledger relief
 * treasury that funds neutral mercy petitions. Flagged for design review.
 */
export const LEDGER_TREASURY_INITIAL = 20;
