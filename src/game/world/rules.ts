/**
 * Last Claim and covenant numbers from design decisions v0.5 (§05, §06) and
 * v0.6 (§01, §02). Values are prototypes, to be measured.
 */
import opponents from '../run/data/p4-opponents.json';
import worldRules from '../run/data/p4-world-rules.json';
import act2Temperaments from '../run/data/p6-last-claim-temperaments.json';

export type Pact = 'mercy' | 'debt' | 'service';
export const PACTS: Pact[] = ['mercy', 'debt', 'service'];

/**
 * Key used for per-character tables: a rival/profile id, 'player', 'adjudicator'
 * or 'other'. Characters without their own entry fall back to 'other'.
 */
export type RuleKey = string;

/** Looks up a per-character table entry, falling back to 'other'. */
export function byKey<T>(table: Record<string, T>, key: RuleKey): T {
  return table[key] ?? table.other;
}

/** Revival endowment each claimant funds (from their own post-pot stack, or the Ledger relief treasury). */
export const ENDOWMENT: Record<string, number> = {
  vesper: 10,
  oracle: 12,
  corvin: 8,
  player: 10,
  adjudicator: 10,
  other: 10,
};

/** Claimant's base willingness to consider an otherwise valid survival bargain. */
export const CLAIMANT_BASE: Record<string, number> = {
  vesper: 0.25,
  oracle: 0.5,
  corvin: 0.7,
  player: 0.4,
  adjudicator: 0.4,
  other: 0.4,
};

export const CLAIMANT_PACT_PREFERENCE: Record<string, Partial<Record<Pact, number>>> = {
  vesper: { service: 0.15, debt: 0.05, mercy: -0.15 },
  oracle: { debt: 0.15, service: -0.1, mercy: -0.05 },
  corvin: { mercy: 0.1, debt: 0.05, service: -0.2 },
  player: {},
  adjudicator: {},
  other: {},
};

/**
 * NPC debtor acceptance per pact (design v0.6 §02): thresholds before relationship
 * modifiers and the clamp; a vetoed pact is a hard zero that the clamp never lifts.
 * `priority` is the order in which the NPC proposes or counters.
 */
export interface DebtorTemperament {
  acceptance: Record<Pact, number>;
  veto: Pact[];
  priority: Pact[];
}

type CaseJson = { mercy: number; debt: number; service: number; service_veto?: boolean; counter_priority: string[] };

export const DEBTOR_TEMPERAMENT: Record<string, DebtorTemperament> = (() => {
  const out: Record<string, DebtorTemperament> = {};
  for (const [key, c] of Object.entries(worldRules.debtor_acceptance.cases as Record<string, CaseJson>)) {
    const veto: Pact[] = c.service_veto ? ['service'] : [];
    const listed = c.counter_priority as Pact[];
    // A vetoed pact is never proposed; unlisted acceptable pacts follow the listed ones.
    const priority = [...listed, ...PACTS.filter((p) => !listed.includes(p))].filter((p) => !veto.includes(p));
    out[key] = { acceptance: { mercy: c.mercy, debt: c.debt, service: c.service }, veto, priority };
  }
  const otherPriority = out.other.priority;
  for (const o of opponents.opponents) {
    out[o.id] = {
      acceptance: { mercy: o.debtor_mercy, debt: o.debtor_debt, service: o.debtor_service },
      veto: [],
      priority: otherPriority,
    };
  }
  return out;
})();

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

export const DEBTOR_MODIFIERS = worldRules.debtor_acceptance.modifiers;

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
 * Act II rivals (design v0.8 §07): claimant base and pact preference, debtor
 * acceptance, priority and hard vetoes, endowment from their own wallet.
 */
for (const p of act2Temperaments.profiles) {
  ENDOWMENT[p.id] = p.endowment;
  CLAIMANT_BASE[p.id] = p.claimant_base;
  CLAIMANT_PACT_PREFERENCE[p.id] = p.pact_preference as Partial<Record<Pact, number>>;
  const veto = p.hard_veto as Pact[];
  const listed = p.debtor_priority as Pact[];
  DEBTOR_TEMPERAMENT[p.id] = {
    acceptance: p.debtor_acceptance as Record<Pact, number>,
    veto,
    priority: [...listed, ...PACTS.filter((x) => !listed.includes(x))].filter((x) => !veto.includes(x)),
  };
}

/** Ledger relief treasury at run start (accepted in design v0.6 §01). */
export const LEDGER_TREASURY_INITIAL = worldRules.treasury_start;
