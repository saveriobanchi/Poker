import { describe, expect, it } from 'vitest';
import { decide, PROFILES, READ_PRIOR_WEIGHT, READ_WINDOW, recordReads, shovePrior, shoveRate } from '../src/game/ai';
import { applyAction, freshDeck, getPublicView, type HandState, Rng, startHand } from '../src/game/rules';
import { riggedHand, setup } from './helpers';

/** Plays a hand where seat `shover` shoves preflop and everyone else folds. */
function shoveHand(seed: number, shover: number): HandState {
  let s = startHand(setup([100, 100, 100], { seed, button: 0 }));
  while (s.phase === 'betting') {
    const seat = s.toAct!;
    s = applyAction(s, seat, seat === shover ? { type: 'allIn' } : { type: 'fold' });
  }
  return s;
}

describe('public shove reads (design v0.7 §01)', () => {
  it('records only public preflop decisions, keeps the last 24, and smooths towards the prior', () => {
    let reads = {};
    for (let i = 0; i < 30; i++) reads = recordReads(reads, shoveHand(i, 0));
    const p0 = (reads as Record<string, boolean[]>).P0;
    expect(p0).toHaveLength(READ_WINDOW);
    expect(p0.every(Boolean)).toBe(true);
    const prior = shovePrior(PROFILES.corvin);
    expect(shoveRate(undefined, prior)).toBeCloseTo(prior);
    expect(shoveRate(p0, prior)).toBeCloseTo((24 + READ_PRIOR_WEIGHT * prior) / (24 + READ_PRIOR_WEIGHT));
    // Folds are decisions too, and are not shoves.
    expect((reads as Record<string, boolean[]>).P1.some(Boolean)).toBe(false);
  });

  it('calls a known maniac’s shove with a hand it would fold against a nit', () => {
    const hand = riggedHand(setup([100, 100, 100], { button: 0 }), ['Kd 9c', '7h 2s', '5c 5d'], '2c 3d 8h Jc Qs');
    let s = applyAction(hand, 0, { type: 'allIn' });
    s = applyAction(s, 1, { type: 'fold' });
    const view = getPublicView(s, 2);
    const p = PROFILES.corvin;
    const vsManiac = decide(view, p, new Rng(3), [], [0.95, 0.1, 0.1]);
    const vsNit = decide(view, p, new Rng(3), [], [0.03, 0.1, 0.1]);
    expect(vsManiac.type).toBe('call');
    expect(vsNit.type).toBe('fold');
  });

  it('the pressure decision cannot depend on hidden cards', () => {
    for (let seed = 0; seed < 20; seed++) {
      let s = startHand(setup([100, 100, 100], { seed, button: 0 }));
      s = applyAction(s, 0, { type: 'allIn' });
      const seat = s.toAct!;
      const hidden = structuredClone(s) as HandState;
      const visible = new Set([...s.seats[seat].hole, ...s.board]);
      const pool = new Rng(seed + 9).shuffle(freshDeck().filter((c) => !visible.has(c)));
      hidden.seats.forEach((p, i) => {
        if (i !== seat && p.inHand) p.hole = [pool.pop()!, pool.pop()!];
      });
      hidden.burns = [];
      hidden.deck = pool;
      const rates = [0.5, 0.1, 0.1];
      expect(decide(getPublicView(hidden, seat), PROFILES.oracle, new Rng(1), [], rates)).toEqual(
        decide(getPublicView(s, seat), PROFILES.oracle, new Rng(1), [], rates),
      );
    }
  });
});
