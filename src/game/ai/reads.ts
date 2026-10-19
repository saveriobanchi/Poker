/**
 * Public shove reads (design v0.7 §01). Every seat — AI or player — is observed
 * only through the public action log: for each of its last 24 preflop
 * decisions, whether it was a large shove. The estimate is smoothed towards a
 * personality prior so a few hands never swing it wildly. No hidden card ever
 * enters this model, and AI-vs-AI actions count like any other.
 */
import type { HandState } from '../rules/engine';
import type { AiProfile } from './profiles';

export const READ_WINDOW = 24;
export const READ_PRIOR_WEIGHT = 12;
/** A preflop bet/raise committing at least this share of the actor's starting stack counts as a shove. */
export const SHOVE_SHARE = 0.5;
/** Prior for a seat with no profile (the player). */
export const UNKNOWN_SHOVE_PRIOR = 0.06;

/** Per character id: the last READ_WINDOW preflop decisions, true for a large shove. */
export type PublicReads = Record<string, boolean[]>;

/** Adds the completed hand's public preflop decisions to the reads. */
export function recordReads(reads: PublicReads, hand: HandState): PublicReads {
  const next: PublicReads = { ...reads };
  for (const e of hand.log) {
    if (e.street !== 'preflop') continue;
    const id = hand.seats[e.seat].id;
    const start = hand.setup.players[e.seat].stack;
    const a = e.action;
    const shove = (a.type === 'raise' || a.type === 'bet') && a.to >= start * SHOVE_SHARE;
    next[id] = [...(next[id] ?? []), shove].slice(-READ_WINDOW);
  }
  return next;
}

/** Archetype prior: aggressive bluffers are assumed to shove more often. */
export function shovePrior(profile: AiProfile | undefined): number {
  if (!profile) return UNKNOWN_SHOVE_PRIOR;
  return 0.02 + 0.08 * profile.aggression + 0.1 * profile.bluff;
}

/** Smoothed shove frequency: (shoves + w·prior) / (n + w). */
export function shoveRate(observed: boolean[] | undefined, prior: number): number {
  const obs = observed ?? [];
  const shoves = obs.filter(Boolean).length;
  return (shoves + READ_PRIOR_WEIGHT * prior) / (obs.length + READ_PRIOR_WEIGHT);
}

/** Public, table-observed preflop tendencies of one character. */
export interface PublicTally {
  hands: number;
  vpip: number;
  pfr: number;
  shoves: number;
}

/** Adds one completed hand's public preflop behavior to each dealt-in character's tally. */
export function recordTallies(tallies: Record<string, PublicTally>, hand: HandState): Record<string, PublicTally> {
  const next = { ...tallies };
  hand.seats.forEach((p, seat) => {
    if (!p.inHand) return;
    const mine = hand.log.filter((e) => e.seat === seat && e.street === 'preflop');
    const t = { ...(next[p.id] ?? { hands: 0, vpip: 0, pfr: 0, shoves: 0 }) };
    t.hands++;
    if (mine.some((e) => e.action.type !== 'fold' && e.action.type !== 'check')) t.vpip++;
    if (mine.some((e) => e.action.type === 'raise' || e.action.type === 'bet')) t.pfr++;
    const start = hand.setup.players[seat].stack;
    if (mine.some((e) => (e.action.type === 'raise' || e.action.type === 'bet') && e.action.to >= start * SHOVE_SHARE)) t.shoves++;
    next[p.id] = t;
  });
  return next;
}
