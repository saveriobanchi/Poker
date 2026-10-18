import { describe, expect, it } from 'vitest';
import {
  applyAction,
  deserializeHand,
  getLegalActions,
  getPublicView,
  nextHandSetup,
  replayHand,
  serializeHand,
  startHand,
} from '../src/game/rules';
import { act, allIn, bet, call, check, fold, raise, riggedHand, setup, stacks } from './helpers';

describe('dealing', () => {
  it('deals eight distinct hole cards at a 4-seat table and never duplicates the board', () => {
    for (let seed = 0; seed < 500; seed++) {
      let s = startHand(setup([100, 100, 100, 100], { seed }));
      const holes = s.seats.flatMap((p) => p.hole);
      expect(new Set(holes).size).toBe(8);
      // Check down to the river.
      while (s.phase === 'betting') {
        const legal = getLegalActions(s)!;
        s = applyAction(s, s.toAct!, legal.canCheck ? check : call);
      }
      expect(s.board).toHaveLength(5);
      expect(new Set([...holes, ...s.board, ...s.burns]).size).toBe(16);
    }
  });

  it('is deterministic for a seed', () => {
    expect(startHand(setup([100, 100, 100], { seed: 42 }))).toEqual(startHand(setup([100, 100, 100], { seed: 42 })));
    expect(startHand(setup([100, 100, 100], { seed: 42 })).deck).not.toEqual(
      startHand(setup([100, 100, 100], { seed: 43 })).deck,
    );
  });

  it('skips seats with no chips', () => {
    const s = startHand(setup([100, 0, 100, 100]));
    expect(s.seats[1].inHand).toBe(false);
    expect(s.seats[1].hole).toEqual([]);
    expect(s.smallBlindSeat).toBe(2);
    expect(s.bigBlindSeat).toBe(3);
    expect(s.toAct).toBe(0);
  });
});

describe('button, blinds and action order', () => {
  it('3+ seats: SB left of button, BB next, UTG acts first; post-flop starts left of button', () => {
    let s = startHand(setup([100, 100, 100, 100], { button: 1 }));
    expect([s.smallBlindSeat, s.bigBlindSeat, s.toAct]).toEqual([2, 3, 0]);
    expect(stacks(s)).toEqual([100, 100, 99, 98]);
    s = act(s, [0, call], [1, call], [2, call], [3, check]);
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(2);
  });

  it('heads-up: button posts SB, acts first preflop and last post-flop', () => {
    let s = startHand(setup([100, 100], { button: 0 }));
    expect([s.smallBlindSeat, s.bigBlindSeat, s.toAct]).toEqual([0, 1, 0]);
    s = act(s, [0, call], [1, check]);
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1);
  });

  it('gives the big blind its option when the pot is limped', () => {
    const s = act(startHand(setup([100, 100, 100])), [0, call], [1, call]);
    expect(s.toAct).toBe(2);
    expect(getLegalActions(s)).toMatchObject({ canCheck: true, raise: { minTo: 4 } });
  });

  it('rotates the button to the next seat with chips', () => {
    let s = startHand(setup([100, 100, 100], { button: 2 }));
    s = act(s, [2, fold], [0, fold]);
    expect(nextHandSetup(s, 7).button).toBe(0);
  });

  it('a short stack posts an all-in blind; callers still owe the full big blind', () => {
    const s = startHand(setup([100, 100, 1], { button: 0 }));
    expect(s.seats[2].allIn).toBe(true);
    expect(s.seats[2].totalCommitted).toBe(1);
    expect(getLegalActions(s)).toMatchObject({ seat: 0, callAmount: 2 });
  });

  it('runs the board out immediately when every blind is all-in', () => {
    const s = startHand(setup([1, 2], { button: 0 }));
    expect(s.phase).toBe('complete');
    expect(s.board).toHaveLength(5);
    expect(s.result!.uncalledReturn).toEqual({ seat: 1, amount: 1 });
    expect(stacks(s).reduce((a, b) => a + b)).toBe(3);
  });
});

describe('betting legality', () => {
  it('enforces minimum bets and raises', () => {
    let s = startHand(setup([100, 100, 100, 100]));
    expect(getLegalActions(s)!.raise).toEqual({ minTo: 4, maxTo: 100, isBet: false });
    expect(() => applyAction(s, 3, raise(3))).toThrow();
    s = applyAction(s, 3, raise(6));
    expect(getLegalActions(s)!.raise!.minTo).toBe(10);
  });

  it('rejects out-of-turn and mislabeled actions', () => {
    const s = startHand(setup([100, 100, 100, 100]));
    expect(() => applyAction(s, 1, call)).toThrow(/turn/);
    expect(() => applyAction(s, 3, check)).toThrow();
    expect(() => applyAction(s, 3, bet(10))).toThrow(/raise instead/);
  });

  it('does not mutate the input state', () => {
    const s = startHand(setup([100, 100, 100]));
    const before = serializeHand(s);
    applyAction(s, 0, raise(10));
    expect(serializeHand(s)).toBe(before);
  });

  it('a short all-in raise does not reopen betting (TDA illustration, 200/400)', () => {
    let s = startHand(setup([10000, 10000, 10000, 1199], { smallBlind: 200, bigBlind: 400, button: 0 }));
    s = act(s, [3, call], [0, call], [1, call], [2, check]);
    expect(s.street).toBe('flop');
    // A opens 400, B calls, C all-in for 799 (short of a full raise to 800).
    s = act(s, [1, bet(400)], [2, call], [3, allIn]);
    expect(s.currentBet).toBe(799);
    expect(s.lastRaiseSize).toBe(400);
    // D has not acted: may raise, minimum to 1199.
    expect(getLegalActions(s)!.raise!.minTo).toBe(1199);
    const smoothCall = applyAction(s, 0, call);
    // A faces only 399 more: call or fold only.
    expect(getLegalActions(smoothCall)).toMatchObject({ seat: 1, canCall: true, raise: null });
    expect(() => applyAction(smoothCall, 1, raise(2000))).toThrow();
    // If D instead makes a full raise, A may act freely.
    const reRaised = applyAction(s, 0, raise(1199));
    expect(getLegalActions(reRaised)!.raise).not.toBeNull();
  });

  it('cumulative short all-ins that add up to a full raise do reopen betting', () => {
    let s = startHand(setup([1000, 1000, 250, 310], { smallBlind: 50, bigBlind: 100, button: 0 }));
    s = act(s, [3, call], [0, call], [1, call], [2, check]);
    s = act(s, [1, bet(100)], [2, allIn], [3, allIn], [0, call]);
    expect(s.currentBet).toBe(210);
    expect(getLegalActions(s)).toMatchObject({ seat: 1, raise: { minTo: 310 } });
  });

  it('a player who checked keeps the option to raise a short all-in bet', () => {
    let s = startHand(setup([1000, 1000, 120, 1000], { smallBlind: 50, bigBlind: 100, button: 0 }));
    s = act(s, [3, call], [0, call], [1, call], [2, check]);
    s = act(s, [1, check], [2, allIn], [3, call], [0, call]);
    expect(getLegalActions(s)).toMatchObject({ seat: 1, raise: { minTo: 120 } });
  });

  it('offers no raise when nobody could respond', () => {
    let s = startHand(setup([100, 50, 100]));
    s = act(s, [0, call], [1, allIn], [2, fold]);
    expect(getLegalActions(s)).toMatchObject({ seat: 0, canCall: true, raise: null });
  });
});

describe('settlement', () => {
  it('forms main and side pots and pays only eligible winners', () => {
    const hs = setup([50, 100, 200, 300], { button: 3 });
    let s = riggedHand(hs, ['Ah Ad', 'Kh Kd', 'Qh Qd', '7d 9s'], '2c 5d 8h Js 3c');
    s = act(s, [2, allIn], [3, call], [0, allIn], [1, allIn]);
    expect(s.phase).toBe('complete');
    const r = s.result!;
    expect(r.pots.map((p) => [p.amount, p.eligible, p.winners])).toEqual([
      [200, [0, 1, 2, 3], [0]],
      [150, [1, 2, 3], [1]],
      [200, [2, 3], [2]],
    ]);
    expect(stacks(s)).toEqual([200, 150, 200, 100]);
    expect(r.zeroChipSeats).toEqual([]);
  });

  it('a folded player cannot win, and an uncalled bet is returned', () => {
    let s = riggedHand(setup([100, 100, 100]), ['7c 2d', '8c 3d', 'Ah Ad'], 'Kc Qd 9h 4s 5c');
    s = act(s, [0, raise(6)], [1, call], [2, fold]);
    s = act(s, [1, bet(10)], [0, raise(30)], [1, fold]);
    const r = s.result!;
    expect(r.uncalledReturn).toEqual({ seat: 0, amount: 20 });
    expect(r.showdown).toEqual([]);
    expect(r.pots.every((p) => !p.eligible.includes(2))).toBe(true);
    // Pot 34 = 6 + 6 + 2 (folded BB) + 10 + 10.
    expect(stacks(s)).toEqual([118, 84, 98]);
  });

  it('a folded best hand cannot win at showdown', () => {
    let s = riggedHand(setup([100, 100, 100]), ['7c 2d', '8c 3d', 'Ah Ad'], 'Kc Qd 9h 4s 5c');
    s = act(s, [0, raise(6)], [1, call], [2, fold]);
    for (let i = 0; i < 3; i++) s = act(s, [1, check], [0, check]);
    expect(s.result!.showdown.map((e) => e.seat).sort()).toEqual([0, 1]);
    expect(s.result!.pots[0].winners).toEqual([1]);
    expect(stacks(s)).toEqual([94, 108, 98]);
  });

  it('conserves chips and a spell-free hand cannot create chips', () => {
    let s = startHand(setup([37, 120, 85, 64], { seed: 9 }));
    while (s.phase === 'betting') s = applyAction(s, s.toAct!, allIn);
    expect(stacks(s).reduce((a, b) => a + b)).toBe(37 + 120 + 85 + 64);
    expect(s.result!.netChange.reduce((a, b) => a + b)).toBe(0);
  });

  it('reports a zero-chip seat with its claimant, even when the bust is AI-vs-AI', () => {
    let s = riggedHand(setup([10, 100, 100]), ['7c 2d', 'Ah Ad', '8c 3d'], 'Kc Qd 9h 4s 5c');
    s = act(s, [0, allIn], [1, call], [2, call]);
    for (let i = 0; i < 3; i++) s = act(s, [1, check], [2, check]);
    expect(s.result!.zeroChipSeats).toEqual([{ seat: 0, id: 'P0', claimPotIndex: 0, claimants: [1] }]);
    expect(nextHandSetup(s, 2).players[0].stack).toBe(0);
  });

  it('a split pot claim lists every co-winner (neutral adjudicator case)', () => {
    let s = riggedHand(setup([10, 100, 100]), ['7c 8d', 'Jh Td', 'Js Tc'], 'Ah Kd Qc 2s 3h');
    s = act(s, [0, allIn], [1, call], [2, call]);
    for (let i = 0; i < 3; i++) s = act(s, [1, check], [2, check]);
    expect(s.result!.zeroChipSeats[0].claimants).toEqual([1, 2]);
    expect(stacks(s)).toEqual([0, 105, 105]);
  });
});

describe('save, resume, replay, fairness', () => {
  it('a saved in-progress hand restores and continues identically', () => {
    let s = startHand(setup([100, 100, 100, 100], { seed: 5 }));
    s = act(s, [3, raise(6)], [0, call], [1, fold], [2, call], [2, check]);
    const restored = deserializeHand(serializeHand(s));
    expect(restored).toEqual(s);
    const finish = (h: typeof s) => act(h, [3, bet(10)], [0, call], [2, fold]);
    expect(finish(restored)).toEqual(finish(s));
  });

  it('rejects a tampered save', () => {
    const s = startHand(setup([100, 100, 100]));
    const bad = JSON.parse(serializeHand(s));
    bad.seats[0].stack += 1;
    expect(() => deserializeHand(JSON.stringify(bad))).toThrow(/Invariant/);
    bad.seats[0].stack -= 1;
    bad.board = [bad.seats[1].hole[0]];
    expect(() => deserializeHand(JSON.stringify(bad))).toThrow(/Invariant/);
  });

  it('replays a hand exactly from setup and action log', () => {
    let s = startHand(setup([100, 100, 100, 100], { seed: 11 }));
    s = act(s, [3, raise(8)], [0, fold], [1, call], [2, raise(20)], [3, call], [1, fold]);
    s = act(s, [2, bet(30)], [3, allIn], [2, call]);
    expect(replayHand(s.setup, s.log)).toEqual(s);
  });

  it('the public view never exposes the deck or unshown opponent cards', () => {
    const s = startHand(setup([100, 100, 100, 100], { seed: 3 }));
    const view = getPublicView(s, 3);
    expect(view.seats[3].hole).toEqual(s.seats[3].hole);
    for (const i of [0, 1, 2]) expect(view.seats[i].hole).toBeNull();
    const text = JSON.stringify(view);
    expect(text).not.toMatch(/"deck"|"burns"|"rngState"|"seed"/);
    expect(view.legal).not.toBeNull();
    expect(getPublicView(s, 0).legal).toBeNull();
  });
});
