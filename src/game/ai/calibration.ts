/**
 * Preflop style measurement (design v0.6 §07: VPIP/PFR are tendencies measured
 * over at least 10,000 AI opportunities). Each sample deals a fresh hand at the
 * table's starting stacks and plays preflop only, which is all VPIP/PFR count.
 */
import { applyAction, getPublicView, startHand } from '../rules/engine';
import { Rng } from '../rules/rng';
import { decide } from './agent';
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

/** One archived public preflop hand of a dossier's subject: the actions it took, in order. */
export interface DossierHand {
  hand: number;
  actions: ('fold' | 'check' | 'call' | 'raise' | 'shove')[];
}

/** A public dossier (design v0.9 §02): the archived action log, and figures recomputed from it. */
export interface Dossier {
  rival: string;
  /** The seed fixed before the player chose, so the archive is reproducible. */
  seed: number;
  records: DossierHand[];
  hands: number;
  vpip: number;
  pfr: number;
  shoves: number;
}

/** Figures derived only from the stored public records. */
export function dossierFigures(records: DossierHand[]): { hands: number; vpip: number; pfr: number; shoves: number } {
  return {
    hands: records.length,
    vpip: records.filter((r) => r.actions.some((a) => a === 'call' || a === 'raise' || a === 'shove')).length,
    pfr: records.filter((r) => r.actions.some((a) => a === 'raise' || a === 'shove')).length,
    shoves: records.filter((r) => r.actions.includes('shove')).length,
  };
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
    const actions: DossierHand['actions'] = [];
    while (s.phase === 'betting' && s.street === 'preflop') {
      const seat = s.toAct!;
      const a = decide(getPublicView(s, seat), seats[seat], rng);
      const before = s.seats[seat].stack + s.seats[seat].streetCommitted;
      s = applyAction(s, seat, a);
      if (seat !== 0) continue;
      // Record what spectators saw: a bet/raise of half the starting stack or more is a shove.
      const logged = s.log.at(-1)!.action;
      if (logged.type === 'fold' || logged.type === 'check' || logged.type === 'call') actions.push(logged.type);
      else actions.push(logged.type === 'allIn' || logged.to >= before * 0.5 ? 'shove' : 'raise');
    }
    records.push({ hand: h + 1, actions });
  }
  return { rival: rival.id, seed, records, ...dossierFigures(records) };
}
