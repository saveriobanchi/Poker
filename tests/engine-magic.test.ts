import { describe, expect, it } from 'vitest';
import {
  applyAction,
  exchangeHoleCard,
  getLegalActions,
  isStreetOpening,
  replayHand,
  setStreetLimit,
  startHand,
} from '../src/game/rules';
import { act, bet, call, check, raise, setup } from './helpers';

describe('pot-limit street (Briar Lock primitive)', () => {
  it('caps raises at the pot preflop, counting blinds and the call', () => {
    let s = setStreetLimit(startHand(setup([100, 100, 100, 100])), 'pot-limit');
    // UTG: call 2 into a pot of 3, then raise by 5 -> max 7.
    expect(getLegalActions(s)!.raise).toEqual({ minTo: 4, maxTo: 7, isBet: false });
    s = applyAction(s, 3, raise(7));
    // Next: pot 10, call 7 -> raise to at most 7 + 10 + 7 = 24.
    expect(getLegalActions(s)!.raise!.maxTo).toBe(24);
    expect(() => applyAction(s, 0, raise(25))).toThrow();
    // allIn resolves to the pot-limit maximum, not the whole stack.
    expect(applyAction(s, 0, { type: 'allIn' }).seats[0].streetCommitted).toBe(24);
  });

  it('returns to no-limit on the next street and keeps committed chips', () => {
    let s = startHand(setup([100, 100, 100]));
    s = setStreetLimit(s, 'pot-limit');
    expect(s.seats.map((p) => p.totalCommitted)).toEqual([0, 1, 2]);
    s = act(s, [0, call], [1, call], [2, check]);
    expect(s.street).toBe('flop');
    expect(s.streetLimit).toBe('no-limit');
    expect(getLegalActions(s)!.raise!.maxTo).toBe(98);
  });

  it('can only be set at street opening and never twice', () => {
    let s = startHand(setup([100, 100, 100]));
    expect(isStreetOpening(s)).toBe(true);
    const locked = setStreetLimit(s, 'pot-limit');
    expect(() => setStreetLimit(locked, 'pot-limit')).toThrow();
    s = applyAction(s, 0, call);
    expect(() => setStreetLimit(s, 'pot-limit')).toThrow();
    s = act(s, [1, call], [2, check]);
    expect(() => setStreetLimit(s, 'pot-limit')).not.toThrow();
    s = applyAction(setStreetLimit(s, 'pot-limit'), 1, bet(6));
    expect(getLegalActions(s)!.raise!.maxTo).toBe(6 + 12 + 6);
  });
});

describe('hole card exchange (Fate Exchange primitive)', () => {
  it('swaps in an undealt card, keeps 52 unique cards, and touches nothing else', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = startHand(setup([100, 100, 100, 100], { seed }));
      const x = exchangeHoleCard(s, 2, 1);
      expect(x.seats[2].hole[0]).toBe(s.seats[2].hole[0]);
      expect(x.seats[2].hole[1]).not.toBe(s.seats[2].hole[1]);
      expect(s.deck).toContain(x.seats[2].hole[1]);
      expect(x.deck).toContain(s.seats[2].hole[1]);
      expect(x.deck).toHaveLength(s.deck.length);
      for (const i of [0, 1, 3]) expect(x.seats[i].hole).toEqual(s.seats[i].hole);
      expect(x.seats.map((p) => p.stack)).toEqual(s.seats.map((p) => p.stack));
    }
  });

  it('is rejected after the first voluntary action or after preflop', () => {
    let s = applyAction(startHand(setup([100, 100, 100])), 0, call);
    expect(() => exchangeHoleCard(s, 1, 0)).toThrow();
    s = act(s, [1, call], [2, check]);
    expect(() => exchangeHoleCard(s, 1, 0)).toThrow();
  });

  it('replays exactly, including effects', () => {
    let s = startHand(setup([100, 100, 100, 100], { seed: 8 }));
    s = exchangeHoleCard(s, 3, 0);
    s = setStreetLimit(s, 'pot-limit');
    s = act(s, [3, raise(7)], [0, call], [1, call], [2, call]);
    s = setStreetLimit(s, 'pot-limit');
    s = act(s, [1, bet(10)], [2, call], [3, call], [0, call]);
    expect(replayHand(s.setup, s.log, s.effects)).toEqual(s);
  });
});
