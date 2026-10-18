import { describe, expect, it } from 'vitest';
import { decide, estimateEquity, PROFILES, preflopPercentile } from '../src/game/ai';
import {
  applyAction,
  freshDeck,
  getPublicView,
  HandState,
  nextHandSetup,
  parseCards,
  Rng,
  startHand,
} from '../src/game/rules';
import { setup } from './helpers';

const SEAT_PROFILES = [PROFILES.vesper, PROFILES.oracle, PROFILES.corvin, PROFILES.vesper];

describe('AI building blocks', () => {
  it('ranks preflop hands sensibly', () => {
    const [aa, kk, sevenTwo, jts] = ['As Ah', 'Ks Kh', '7c 2d', 'Js Ts'].map((t) => parseCards(t));
    expect(preflopPercentile(aa[0], aa[1])).toBeGreaterThan(0.99);
    expect(preflopPercentile(aa[0], aa[1])).toBeGreaterThan(preflopPercentile(kk[0], kk[1]));
    expect(preflopPercentile(jts[0], jts[1])).toBeGreaterThan(0.7);
    expect(preflopPercentile(sevenTwo[0], sevenTwo[1])).toBeLessThan(0.1);
  });

  it('estimates equity close to known values', () => {
    const rng = new Rng(1);
    // Aces vs one random hand preflop: ~85%.
    expect(estimateEquity(parseCards('As Ah'), [], [0], 4000, rng)).toBeCloseTo(0.85, 1);
    // The nuts on the river always win.
    expect(estimateEquity(parseCards('As Ks'), parseCards('Qs Js Ts 2c 3d'), [0, 0], 200, rng)).toBe(1);
  });
});

describe('AI fairness', () => {
  it('decisions cannot depend on hidden information', () => {
    for (let seed = 0; seed < 40; seed++) {
      let s = startHand(setup([100, 100, 100, 100], { seed }));
      s = applyAction(s, s.toAct!, { type: 'call' });
      const seat = s.toAct!;
      // Scramble every card the seat cannot legally see.
      const hidden = structuredClone(s) as HandState;
      const visible = new Set([...s.seats[seat].hole, ...s.board]);
      const rng = new Rng(seed + 1000);
      const pool = rng.shuffle(freshDeck().filter((c) => !visible.has(c)));
      hidden.seats.forEach((p, i) => {
        if (i !== seat && p.inHand) p.hole = [pool.pop()!, pool.pop()!];
      });
      hidden.burns = [];
      hidden.deck = pool;
      expect(hidden.seats[(seat + 1) % 4].hole).not.toEqual(s.seats[(seat + 1) % 4].hole);
      const viewA = getPublicView(s, seat);
      const viewB = getPublicView(hidden, seat);
      expect(viewB).toEqual(viewA);
      const profile = SEAT_PROFILES[seat];
      expect(decide(viewB, profile, new Rng(7))).toEqual(decide(viewA, profile, new Rng(7)));
    }
  });
});

describe('AI-only tables', () => {
  it('play legal hands to elimination, conserve chips, and show distinct styles', () => {
    const vpip = new Map<string, { played: number; dealt: number }>();
    const rng = new Rng(5);
    let totalHands = 0;
    for (let table = 0; table < 25; table++) {
      let hs = setup([100, 120, 100, 90], { seed: table * 7919, button: table % 4 });
      for (let hand = 0; hand < 150; hand++) {
        let s = startHand(hs);
        const voluntary = new Set<number>();
        while (s.phase === 'betting') {
          const seat = s.toAct!;
          const action = decide(getPublicView(s, seat), SEAT_PROFILES[seat], rng);
          if (s.street === 'preflop' && ['call', 'raise', 'bet', 'allIn'].includes(action.type)) voluntary.add(seat);
          s = applyAction(s, seat, action); // throws on any illegal action
        }
        totalHands++;
        expect(s.seats.reduce((a, p) => a + p.stack, 0)).toBe(410);
        s.seats.forEach((p, seat) => {
          if (!p.inHand || seat === 3) return;
          const id = SEAT_PROFILES[seat].id;
          const v = vpip.get(id) ?? { played: 0, dealt: 0 };
          v.dealt++;
          if (voluntary.has(seat)) v.played++;
          vpip.set(id, v);
        });
        if (s.seats.filter((p) => p.stack > 0).length < 2) break;
        hs = nextHandSetup(s, table * 7919 + hand + 1);
      }
    }
    const rate = (id: string) => vpip.get(id)!.played / vpip.get(id)!.dealt;
    expect(totalHands).toBeGreaterThan(200);
    expect(rate('vesper')).toBeGreaterThan(rate('corvin'));
    expect(rate('corvin')).toBeGreaterThan(0.08);
    expect(rate('vesper')).toBeLessThan(0.75);
  }, 60_000);
});
