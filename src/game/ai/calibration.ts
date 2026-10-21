/**
 * Preflop style measurement (design v0.6 §07: VPIP/PFR are tendencies measured
 * over at least 10,000 AI opportunities). Each sample deals a fresh hand at the
 * table's starting stacks and plays preflop only, which is all VPIP/PFR count.
 */
import { applyAction, getPublicView, type HandState, replayHand, startHand } from '../rules/engine';
import { Rng } from '../rules/rng';
import { decide } from './agent';
import { isLargeShove } from './reads';
import type { AiProfile } from './profiles';

export interface StyleSample {
  vpip: number;
  pfr: number;
  opportunities: number;
}

export function measureStyles(
  seats: AiProfile[],
  stacks: number[],
  bigBlind: number,
  hands: number,
  seed = 1,
): Record<string, StyleSample> {
  const rng = new Rng(seed);
  const tally = new Map<string, { vpip: number; pfr: number; n: number }>();
  for (let h = 0; h < hands; h++) {
    let s = startHand({
      seed: seed * 1_000_003 + h,
      players: stacks.map((stack, i) => ({ id: `S${i}`, stack })),
      button: h % seats.length,
      smallBlind: bigBlind / 2,
      bigBlind,
    });
    const vpip = new Set<number>();
    const pfr = new Set<number>();
    while (s.phase === 'betting' && s.street === 'preflop') {
      const seat = s.toAct!;
      const a = decide(getPublicView(s, seat), seats[seat], rng);
      if (a.type !== 'fold' && a.type !== 'check') vpip.add(seat);
      if (a.type === 'raise' || a.type === 'bet' || (a.type === 'allIn' && s.seats[seat].stack + s.seats[seat].streetCommitted > s.currentBet)) pfr.add(seat);
      s = applyAction(s, seat, a);
    }
    seats.forEach((p, i) => {
      const t = tally.get(p.id) ?? { vpip: 0, pfr: 0, n: 0 };
      t.n++;
      if (vpip.has(i)) t.vpip++;
      if (pfr.has(i)) t.pfr++;
      tally.set(p.id, t);
    });
  }
  return Object.fromEntries([...tally].map(([id, t]) => [id, { vpip: t.vpip / t.n, pfr: t.pfr / t.n, opportunities: t.n }]));
}

/**
 * Raw public action types (design v1.0 §06). An all-in keeps its kind: a call
 * all-in, or a bet/raise all-in.
 */
export type DossierAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in_call' | 'all_in_raise' | /* P7 saves */ 'shove';

/** One archived public preflop hand of a dossier's subject. */
export interface DossierHand {
  hand: number;
  actions: DossierAction[];
  /** From the shared AI predicate with the start-of-hand stack (absent in P7 saves). */
  largeShove?: boolean;
}

/** A public dossier (design v0.9 §02, v1.0 §06): the archived action log, and figures recomputed from it. */
export interface Dossier {
  rival: string;
  /** The seed fixed before the player chose, so the archive is reproducible. */
  seed: number;
  /** 2 = shared large-shove predicate (v1.0); missing = a P7 record, kept exactly as saved. */
  rule?: 2;
  records: DossierHand[];
  hands: number;
  vpip: number;
  pfr: number;
  shoves: number;
}

const VOLUNTARY: DossierAction[] = ['call', 'bet', 'raise', 'all_in_call', 'all_in_raise', 'shove'];
const AGGRESSIVE: DossierAction[] = ['bet', 'raise', 'all_in_raise', 'shove'];

/** Figures derived only from the stored public records (P7 records keep their saved 'shove' label). */
export function dossierFigures(records: DossierHand[]): { hands: number; vpip: number; pfr: number; shoves: number } {
  return {
    hands: records.length,
    vpip: records.filter((r) => r.actions.some((a) => VOLUNTARY.includes(a))).length,
    pfr: records.filter((r) => r.actions.some((a) => AGGRESSIVE.includes(a))).length,
    shoves: records.filter((r) => r.largeShove ?? r.actions.includes('shove')).length,
  };
}

/**
 * A seat's public preflop record from a hand history: raw action types (an
 * all-in keeps its kind) and the shared large-shove label against the hand's
 * recorded starting stack. Uses only the public log.
 */
export function classifyPreflop(hand: HandState, seat: number): { actions: DossierAction[]; largeShove: boolean } {
  const mine = hand.log.filter((e) => e.seat === seat && e.street === 'preflop');
  const start = hand.setup.players[seat].stack;
  // Replay the public log to see, right after each of the seat's actions, whether it left them all-in.
  const actions: DossierAction[] = [];
  hand.log.forEach((e, i) => {
    if (e.seat !== seat || e.street !== 'preflop') return;
    const a = e.action;
    const after = replayHand(hand.setup, hand.log.slice(0, i + 1), (hand.effects ?? []).filter((x) => x.atLog <= i));
    const allIn = after.seats[seat].stack === 0 && a.type !== 'fold' && a.type !== 'check';
    actions.push(allIn ? (a.type === 'call' ? 'all_in_call' : 'all_in_raise') : (a.type as DossierAction));
  });
  return { actions, largeShove: mine.some((e) => isLargeShove(e.action, start)) };
}

/**
 * Archives `hands` seeded legal public hands (preflop actions only, the part every
 * spectator sees) of `rival` against `others`. No hole card is recorded.
 */
export function publicDossier(rival: AiProfile, others: AiProfile[], hands: number, seed: number, bigBlind = 4): Dossier {
  const seats = [rival, ...others];
  const rng = new Rng(seed);
  const records: DossierHand[] = [];
  for (let h = 0; h < hands; h++) {
    let s = startHand({
      seed: seed * 1_000_003 + h,
      players: seats.map((_, i) => ({ id: `S${i}`, stack: 100 })),
      button: h % seats.length,
      smallBlind: bigBlind / 2,
      bigBlind,
    });
    while (s.phase === 'betting' && s.street === 'preflop') {
      const seat = s.toAct!;
      s = applyAction(s, seat, decide(getPublicView(s, seat), seats[seat], rng));
    }
    records.push({ hand: h + 1, ...classifyPreflop(s, 0) });
  }
  return { rival: rival.id, seed, rule: 2, records, ...dossierFigures(records) };
}
