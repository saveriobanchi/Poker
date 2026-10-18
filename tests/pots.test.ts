import { describe, expect, it } from 'vitest';
import { awardPots, buildPots } from '../src/game/rules';

describe('pots', () => {
  it('builds main and multiple side pots from unequal all-ins', () => {
    const pots = buildPots([50, 100, 200, 200], [false, false, false, false]);
    expect(pots).toEqual([
      { amount: 200, eligible: [0, 1, 2, 3] },
      { amount: 150, eligible: [1, 2, 3] },
      { amount: 200, eligible: [2, 3] },
    ]);
  });

  it('keeps folded chips in the pot but never makes the folder eligible', () => {
    const pots = buildPots([30, 100, 100], [true, false, false]);
    expect(pots).toEqual([{ amount: 230, eligible: [1, 2] }]);
  });

  it('pays each pot to its best eligible hand', () => {
    const pots = buildPots([50, 100, 100], [false, false, false]);
    const awards = awardPots(pots, [900, 500, 100], 0);
    expect(awards[0].shares).toEqual({ 0: 150 });
    expect(awards[1].shares).toEqual({ 1: 100 });
  });

  it('splits ties and gives odd chips clockwise from left of the button', () => {
    const awards = awardPots([{ amount: 5, eligible: [0, 1, 2] }], [7, 7, 1], 1);
    // Order from left of button (seat 1): 2, 0, 1 -> winners 0, 1; seat 0 gets the odd chip.
    expect(awards[0].winners).toEqual([0, 1]);
    expect(awards[0].shares).toEqual({ 0: 3, 1: 2 });
  });
});
