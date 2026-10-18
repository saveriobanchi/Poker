import { describe, expect, it } from 'vitest';
import {
  act,
  AETHER,
  beginHand,
  BEGINNER_SPELLBOOK,
  castOptions,
  castSpell,
  createSeatMagic,
  createSpellbook,
  getMagicView,
  MagicCommand,
  MagicError,
  MagicTable,
  passWindow,
  replayMagicHand,
  SeatMagic,
  SpellId,
  windowSeat,
  apply,
  RIVAL_SPELLBOOKS,
} from '../src/game/magic';
import { getLegalActions, HandState, nextHandSetup, Rng, startHand } from '../src/game/rules';
import { riggedHand, setup } from './helpers';

const IDS = ['P0', 'P1', 'P2', 'P3'];

function seatMagic(n: number, seed = 1): SeatMagic[] {
  return Array.from({ length: n }, (_, i) => createSeatMagic(createSpellbook(IDS[i], BEGINNER_SPELLBOOK, seed * 10 + i)));
}

/** Test-only: puts the given spells into a seat's drawn hand, moving real instances so totals stay at 8. */
function giveSpells(t: MagicTable, seat: number, spells: SpellId[], aether?: number): MagicTable {
  const x = structuredClone(t);
  const pool = [...x.seats[seat].book.draw, ...x.seats[seat].book.discard, ...x.magic.hands[seat]];
  const hand = spells.map((spell) => {
    const i = pool.findIndex((c) => c.spell === spell);
    if (i < 0) throw new Error(`no ${spell} instance`);
    return pool.splice(i, 1)[0];
  });
  x.magic.hands[seat] = hand;
  x.seats[seat].book.draw = pool;
  x.seats[seat].book.discard = [];
  if (aether !== undefined) x.seats[seat].aether = aether;
  return x;
}

function uidOf(t: MagicTable, seat: number, spell: SpellId): string {
  return t.magic.hands[seat].find((c) => c.spell === spell)!.uid;
}

/** Starts a hand where only the listed seats hold spells (others hold none), with the window recomputed. */
function table(hand: HandState, spells: Partial<Record<number, SpellId[]>>, aether: Partial<Record<number, number>> = {}): MagicTable {
  let t = beginHand(hand, seatMagic(hand.seats.length), 99);
  for (let seat = 0; seat < hand.seats.length; seat++) t = giveSpells(t, seat, spells[seat] ?? [], aether[seat]);
  // Recompute the opening window for the rigged spell hands.
  t.magic.openedStreets = [];
  t.magic.window = null;
  return beginHandWindowAgain(t);
}

function beginHandWindowAgain(t: MagicTable): MagicTable {
  // Passing an empty command list through replay would redraw; instead reuse the window logic via a no-op cast check.
  const x = structuredClone(t);
  const n = x.hand.seats.length;
  const order = Array.from({ length: n }, (_, i) => ((x.hand.toAct ?? 0) + i) % n);
  const queue = order.filter((seat) => {
    const p = x.hand.seats[seat];
    if (!p.inHand || p.folded || p.allIn) return false;
    return x.magic.hands[seat].some((c) =>
      c.spell === 'briar_lock' ? x.seats[seat].aether >= 1 : c.spell === 'fate_exchange' && x.hand.street === 'preflop' && x.seats[seat].aether >= 2,
    );
  });
  x.magic.openedStreets = [x.hand.street];
  x.magic.window = queue.length ? { street: x.hand.street, queue } : null;
  return x;
}

describe('spellbooks', () => {
  it('each live seat draws three spells; every book keeps exactly 8 instances across many hands', () => {
    let seats = seatMagic(4);
    let hs = setup([100, 100, 100, 100]);
    for (let h = 0; h < 30; h++) {
      let t = beginHand(startHand({ ...hs, seed: h }), seats, h);
      expect(t.magic.hands.map((x) => x.length)).toEqual([3, 3, 3, 3]);
      while (t.magic.window) t = passWindow(t, windowSeat(t)!);
      while (t.hand.phase === 'betting') {
        if (t.magic.window) t = passWindow(t, windowSeat(t)!);
        else t = act(t, t.hand.toAct!, { type: 'fold' });
      }
      for (const s of t.seats) {
        const all = [...s.book.draw, ...s.book.discard];
        expect(all).toHaveLength(8);
        expect(new Set(all.map((c) => c.uid)).size).toBe(8);
      }
      seats = t.seats;
      hs = nextHandSetup(t.hand, h + 1);
    }
  });

  it('rival books match the design hand-off', () => {
    const vesper = createSpellbook('vesper', RIVAL_SPELLBOOKS.vesper, 1).draw;
    expect(vesper.filter((c) => c.spell === 'cinder_challenge')).toHaveLength(3);
    expect(vesper).toHaveLength(8);
  });

  it('a seat without chips draws nothing', () => {
    const t = beginHand(startHand(setup([100, 0, 100])), seatMagic(3), 1);
    expect(t.magic.hands[1]).toEqual([]);
  });
});

describe('street-opening window', () => {
  it('runs in action order and blocks poker actions until it closes', () => {
    const t = table(startHand(setup([100, 100, 100, 100])), { 1: ['briar_lock'], 3: ['fate_exchange'] });
    expect(t.magic.window!.queue).toEqual([3, 1]); // UTG (seat 3) acts first preflop
    expect(() => act(t, 3, { type: 'call' })).toThrow(MagicError);
    expect(() => passWindow(t, 1)).toThrow(/window/);
    const t2 = passWindow(passWindow(t, 3), 1);
    expect(t2.magic.window).toBeNull();
    expect(() => act(t2, 3, { type: 'call' })).not.toThrow();
  });

  it('Briar Lock makes the street pot-limit, costs 1 Aether and removes other Briar casters', () => {
    const t = table(startHand(setup([100, 100, 100, 100])), { 3: ['briar_lock'], 1: ['briar_lock'] });
    const t2 = castSpell(t, 3, uidOf(t, 3, 'briar_lock'), { spell: 'briar_lock' });
    expect(t2.hand.streetLimit).toBe('pot-limit');
    expect(t2.seats[3].aether).toBe(AETHER.initial - 1);
    expect(t2.magic.window).toBeNull(); // seat 1 cannot lock an already locked street
    expect(t2.magic.events[0]).toMatchObject({ seat: 3, spell: 'briar_lock', tell: expect.stringContaining('Pot-limit') });
    expect(getLegalActions(t2.hand)!.raise!.maxTo).toBe(7);
    expect(t2.hand.seats.map((p) => p.totalCommitted)).toEqual([0, 1, 2, 0]);
  });

  it('opens again on the flop, and Briar Lock expires after its street', () => {
    let t = table(startHand(setup([100, 100, 100])), { 1: ['briar_lock'] });
    t = castSpell(t, 1, uidOf(t, 1, 'briar_lock'), { spell: 'briar_lock' });
    t = act(t, 0, { type: 'call' });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'check' });
    expect(t.hand.street).toBe('flop');
    expect(t.hand.streetLimit).toBe('no-limit');
  });

  it('Fate Exchange replaces one hole card, privately, preflop only', () => {
    const t = table(startHand(setup([100, 100, 100, 100], { seed: 4 })), { 3: ['fate_exchange'] });
    const before = t.hand.seats[3].hole;
    const t2 = castSpell(t, 3, uidOf(t, 3, 'fate_exchange'), { spell: 'fate_exchange', holeIndex: 0 });
    expect(t2.hand.seats[3].hole[1]).toBe(before[1]);
    expect(t2.hand.seats[3].hole[0]).not.toBe(before[0]);
    expect(t2.seats[3].aether).toBe(0);
    // The public record carries no card identities.
    expect(Object.keys(t2.magic.events[0]).sort()).toEqual(['seat', 'spell', 'street', 'tell']);
    expect(getMagicView(t2, 0).known).toEqual([]);
  });

  it('rejects an unaffordable cast without changing anything', () => {
    const t = table(startHand(setup([100, 100, 100, 100])), { 3: ['fate_exchange', 'briar_lock'] }, { 3: 1 });
    const snapshot = JSON.stringify(t);
    expect(() => castSpell(t, 3, uidOf(t, 3, 'fate_exchange'), { spell: 'fate_exchange', holeIndex: 0 })).toThrow(MagicError);
    expect(JSON.stringify(t)).toBe(snapshot);
  });
});

describe('Unmask', () => {
  it('reveals one target card to the caster only, on the caster’s own turn', () => {
    let t = table(startHand(setup([100, 100, 100, 100], { seed: 6 })), { 3: ['unmask'] });
    expect(castOptions(t, 3).map((o) => o.spell)).toEqual(['unmask']);
    expect(castOptions(t, 0)).toEqual([]);
    t = castSpell(t, 3, uidOf(t, 3, 'unmask'), { spell: 'unmask', target: 1 });
    const known = getMagicView(t, 3).known;
    expect(known).toHaveLength(1);
    expect(t.hand.seats[1].hole).toContain(known[0].card);
    for (const viewer of [0, 1, 2]) expect(getMagicView(t, viewer).known).toEqual([]);
    expect(t.magic.events[0]).toMatchObject({ seat: 3, spell: 'unmask', target: 1 });
    expect(t.hand.toAct).toBe(3); // still seat 3's poker decision
  });

  it('cannot target a folded seat or oneself, and only one spell per hand', () => {
    let t = table(startHand(setup([100, 100, 100, 100])), { 0: ['unmask', 'cinder_challenge'] }, { 0: 3 });
    t = act(t, 3, { type: 'fold' });
    expect(() => castSpell(t, 0, uidOf(t, 0, 'unmask'), { spell: 'unmask', target: 3 })).toThrow();
    expect(() => castSpell(t, 0, uidOf(t, 0, 'unmask'), { spell: 'unmask', target: 0 })).toThrow();
    t = castSpell(t, 0, uidOf(t, 0, 'unmask'), { spell: 'unmask', target: 1 });
    expect(() => castSpell(t, 0, uidOf(t, 0, 'cinder_challenge'), { spell: 'cinder_challenge', raiseTo: 6 })).toThrow(/one spell/i);
  });
});

describe('Cinder Challenge', () => {
  it('a called enchanted raise that wins at showdown refunds 2 Aether after showdown regen, capped at 3', () => {
    const hand = riggedHand(setup([100, 100, 100]), ['Ah Ad', '7c 2d', '8c 3h'], 'Kc Qd 9h 4s 5c');
    let t = table(hand, { 0: ['cinder_challenge'] });
    t = castSpell(t, 0, uidOf(t, 0, 'cinder_challenge'), { spell: 'cinder_challenge', raiseTo: 6 });
    expect(t.seats[0].aether).toBe(1);
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'fold' });
    for (let i = 0; i < 3; i++) {
      t = act(t, 1, { type: 'check' });
      t = act(t, 0, { type: 'check' });
    }
    expect(t.hand.phase).toBe('complete');
    expect(t.magic.gains).toEqual([
      { seat: 0, amount: 1, reason: 'showdown' },
      { seat: 1, amount: 1, reason: 'showdown' },
      { seat: 0, amount: 1, reason: 'cinder_called' },
    ]);
    expect(t.seats[0].aether).toBe(3);
  });

  it('refunds 1 Aether when everyone folds to the enchanted raise', () => {
    let t = table(startHand(setup([100, 100, 100])), { 0: ['cinder_challenge'] });
    t = castSpell(t, 0, uidOf(t, 0, 'cinder_challenge'), { spell: 'cinder_challenge', raiseTo: 8 });
    t = act(t, 1, { type: 'fold' });
    t = act(t, 2, { type: 'fold' });
    expect(t.magic.gains).toEqual([{ seat: 0, amount: 1, reason: 'cinder_folded' }]);
    expect(t.seats[0].aether).toBe(2);
  });

  it('gives nothing when the caster loses, and rejects an illegal raise size atomically', () => {
    const hand = riggedHand(setup([100, 100, 100]), ['7c 2d', 'Ah Ad', '8c 3h'], 'Kc Qd 9h 4s 5c');
    let t = table(hand, { 0: ['cinder_challenge'] });
    const snapshot = JSON.stringify(t);
    expect(() => castSpell(t, 0, uidOf(t, 0, 'cinder_challenge'), { spell: 'cinder_challenge', raiseTo: 3 })).toThrow(MagicError);
    expect(JSON.stringify(t)).toBe(snapshot);
    t = castSpell(t, 0, uidOf(t, 0, 'cinder_challenge'), { spell: 'cinder_challenge', raiseTo: 6 });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'fold' });
    for (let i = 0; i < 3; i++) {
      t = act(t, 1, { type: 'check' });
      t = act(t, 0, { type: 'check' });
    }
    expect(t.magic.gains.filter((g) => g.reason.startsWith('cinder'))).toEqual([]);
  });
});

describe('determinism, conservation and fairness under random play', () => {
  it('1,000 random hands with random legal casts keep every invariant and replay exactly', () => {
    const rng = new Rng(77);
    let casts = 0;
    for (let h = 0; h < 1000; h++) {
      const n = 3 + rng.nextInt(2);
      const stacks = Array.from({ length: n }, () => 5 + rng.nextInt(200));
      const hand = startHand(setup(stacks, { seed: h, button: rng.nextInt(n) }));
      const seats = seatMagic(n, h).map((s) => ({ ...s, aether: rng.nextInt(4) }));
      let t = beginHand(hand, seats, h);
      const startChips = stacks.reduce((a, b) => a + b, 0);
      let guard = 0;
      while (t.hand.phase === 'betting') {
        if (++guard > 300) throw new Error('stuck');
        const ws = windowSeat(t);
        const seat = ws ?? t.hand.toAct!;
        const options = castOptions(t, seat);
        let cmd: MagicCommand;
        if (options.length && rng.nextFloat() < 0.5) {
          const o = options[rng.nextInt(options.length)];
          const legal = getLegalActions(t.hand);
          const params =
            o.spell === 'briar_lock'
              ? { spell: o.spell }
              : o.spell === 'fate_exchange'
                ? { spell: o.spell, holeIndex: rng.nextInt(2) as 0 | 1 }
                : o.spell === 'unmask'
                  ? { spell: o.spell, target: o.targets![rng.nextInt(o.targets!.length)] }
                  : { spell: o.spell, raiseTo: legal!.raise!.minTo + rng.nextInt(legal!.raise!.maxTo - legal!.raise!.minTo + 1) };
          cmd = { kind: 'cast', seat, uid: o.uid, params } as MagicCommand;
          casts++;
        } else if (ws !== null) {
          cmd = { kind: 'pass', seat };
        } else {
          const legal = getLegalActions(t.hand)!;
          const choices = [{ type: 'fold' } as const, legal.canCheck ? ({ type: 'check' } as const) : ({ type: 'call' } as const)];
          if (legal.raise) choices.push({ type: 'allIn' } as never);
          cmd = { kind: 'act', seat, action: choices[rng.nextInt(choices.length)] };
        }
        t = apply(t, cmd);
      }
      expect(t.hand.seats.reduce((a, p) => a + p.stack, 0)).toBe(startChips);
      for (const s of t.seats) expect(s.aether).toBeLessThanOrEqual(AETHER.max);
      if (h % 25 === 0) expect(replayMagicHand(hand, seats, h, t.magic.commands)).toEqual(t);
    }
    expect(casts).toBeGreaterThan(500);
  });
});
