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

/** A public dossier: counts over a small number of recorded public preflop hands. */
export interface Dossier {
  rival: string;
  hands: number;
  vpip: number;
  pfr: number;
  shoves: number;
}

/**
 * Records `hands` seeded public hands (preflop actions only, the part every
 * spectator sees) of `rival` at a table with `others`. No hole card is recorded.
 */
export function publicDossier(rival: AiProfile, others: AiProfile[], hands: number, seed: number, bigBlind = 4): Dossier {
  const seats = [rival, ...others];
  const rng = new Rng(seed);
  const d: Dossier = { rival: rival.id, hands: 0, vpip: 0, pfr: 0, shoves: 0 };
  for (let h = 0; h < hands; h++) {
    let s = startHand({
      seed: seed * 1_000_003 + h,
      players: seats.map((_, i) => ({ id: `S${i}`, stack: 100 })),
      button: h % seats.length,
      smallBlind: bigBlind / 2,
      bigBlind,
    });
    let v = false;
    let p = false;
    let sh = false;
    while (s.phase === 'betting' && s.street === 'preflop') {
      const seat = s.toAct!;
      const a = decide(getPublicView(s, seat), seats[seat], rng);
      if (seat === 0) {
        if (a.type !== 'fold' && a.type !== 'check') v = true;
        if (a.type === 'raise' || a.type === 'bet' || a.type === 'allIn') p = true;
        if (a.type === 'allIn' || ((a.type === 'raise' || a.type === 'bet') && a.to >= 50)) sh = true;
      }
      s = applyAction(s, seat, a);
    }
    d.hands++;
    if (v) d.vpip++;
    if (p) d.pfr++;
    if (sh) d.shoves++;
  }
  return d;
}
