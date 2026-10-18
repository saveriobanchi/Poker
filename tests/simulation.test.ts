import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getLegalActions,
  HandState,
  nextHandSetup,
  PlayerAction,
  replayHand,
  Rng,
  startHand,
} from '../src/game/rules';
import { setup } from './helpers';

/** Uniformly random legal actor; stresses odd raise sizes, short all-ins and side pots. */
function randomAction(s: HandState, rng: Rng): PlayerAction {
  const legal = getLegalActions(s)!;
  const options: PlayerAction[] = [{ type: 'fold' }];
  if (legal.canCheck) options.push({ type: 'check' }, { type: 'check' });
  if (legal.canCall) options.push({ type: 'call' }, { type: 'call' });
  if (legal.raise) {
    const { minTo, maxTo, isBet } = legal.raise;
    const type = isBet ? 'bet' : 'raise';
    options.push({ type, to: minTo + rng.nextInt(maxTo - minTo + 1) }, { type: 'allIn' });
  }
  return options[rng.nextInt(options.length)];
}

function playHand(s: HandState, rng: Rng): HandState {
  let guard = 0;
  while (s.phase === 'betting') {
    s = applyAction(s, s.toAct!, randomAction(s, rng));
    if (++guard > 200) throw new Error('Hand did not terminate');
  }
  return s;
}

describe('randomized simulation', () => {
  it('10,000 independent hands keep every invariant and replay exactly', () => {
    const rng = new Rng(2026);
    let showdowns = 0;
    let sidePots = 0;
    for (let i = 0; i < 10_000; i++) {
      const seats = 2 + rng.nextInt(3); // 2-4 seats
      const stacks = Array.from({ length: seats }, () => 1 + rng.nextInt(300));
      if (stacks.filter((x) => x > 0).length < 2) continue;
      const start = startHand(setup(stacks, { seed: i, button: rng.nextInt(seats) }));
      const end = playHand(start, rng);
      const r = end.result!;
      expect(end.seats.reduce((sum, p) => sum + p.stack, 0)).toBe(end.chipTotal);
      expect(r.netChange.reduce((a, b) => a + b, 0)).toBe(0);
      for (const pot of r.pots) {
        for (const w of pot.winners) expect(end.seats[w].folded).toBe(false);
        expect(Object.values(pot.shares).reduce((a, b) => a + b, 0)).toBe(pot.amount);
      }
      for (const z of r.zeroChipSeats) expect(end.seats[z.seat].stack).toBe(0);
      if (r.showdown.length) showdowns++;
      if (r.pots.length > 1) sidePots++;
      if (i % 50 === 0) expect(replayHand(end.setup, end.log)).toEqual(end);
    }
    // The fuzzer must actually reach the interesting paths.
    expect(showdowns).toBeGreaterThan(1000);
    expect(sidePots).toBeGreaterThan(100);
  });

  it('multi-hand 4-seat tables play to a single survivor without leaking chips', () => {
    const rng = new Rng(7);
    for (let table = 0; table < 100; table++) {
      let hs = setup([100, 100, 100, 100], { seed: table * 1000, button: table % 4 });
      let hands = 0;
      for (;;) {
        const end = playHand(startHand(hs), rng);
        expect(end.seats.reduce((sum, p) => sum + p.stack, 0)).toBe(400);
        hands++;
        if (end.seats.filter((p) => p.stack > 0).length < 2 || hands > 2000) break;
        hs = nextHandSetup(end, table * 1000 + hands);
      }
      expect(hands).toBeLessThanOrEqual(2000);
    }
  });
});
