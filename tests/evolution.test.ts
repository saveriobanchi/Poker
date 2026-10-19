import { describe, expect, it } from 'vitest';
import {
  act,
  beginHand,
  castOptions,
  castSpell,
  chooseCandidate,
  createSeatMagic,
  getMagicView,
  MagicError,
  type MagicTable,
  replayMagicHand,
  resetForTable,
  type SeatMagic,
  type SpellId,
  windowSeat,
  passWindow,
  apply,
} from '../src/game/magic';
import type { RelicId } from '../src/game/magic/relics';
import { getLegalActions, type HandState, parseCard, rankOf, startHand } from '../src/game/rules';
import { riggedHand, setup } from './helpers';

const FILLER: SpellId = 'cinder_challenge';

/** A seat whose next draws are exactly `spells` (then fillers), padded to 8 instances. */
function seat(owner: string, spells: SpellId[] = [], extras: Partial<SeatMagic> = {}): SeatMagic {
  const all = [...spells, ...Array(8).fill(FILLER)].slice(0, 8) as SpellId[];
  return createSeatMagic({ owner, draw: all.map((spell, i) => ({ uid: `${owner}:${i}`, spell })), discard: [], rngState: 1 }, extras);
}

function table(hand: HandState, seats: SeatMagic[], seed = 5): MagicTable {
  return beginHand(hand, seats, seed);
}

function uid(t: MagicTable, s: number, spell: SpellId): string {
  return t.magic.hands[s].find((c) => c.spell === spell)!.uid;
}

/** Passes every open window, then checks/calls until the hand ends. */
function finish(t: MagicTable): MagicTable {
  for (let guard = 0; guard < 100 && t.hand.phase === 'betting'; guard++) {
    const w = windowSeat(t);
    if (w !== null) t = passWindow(t, w);
    else t = act(t, t.hand.toAct!, getLegalActions(t.hand)!.canCheck ? { type: 'check' } : { type: 'call' });
  }
  return t;
}

const four = () => [seat('P0'), seat('P1'), seat('P2'), seat('P3')];

describe('Veil evolutions', () => {
  it('Twin Oracle reveals one card from each of two opponents, privately, for 3 Aether', () => {
    const seats = four();
    seats[3] = seat('P3', ['twin_oracle'], { aether: 3 });
    let t = table(startHand(setup([100, 100, 100, 100], { seed: 2 })), seats);
    expect(() => castSpell(t, 3, uid(t, 3, 'twin_oracle'), { spell: 'twin_oracle', targets: [1] })).toThrow(/two/);
    t = castSpell(t, 3, uid(t, 3, 'twin_oracle'), { spell: 'twin_oracle', targets: [0, 1] });
    const known = getMagicView(t, 3).known;
    expect(known.map((k) => k.seat)).toEqual([0, 1]);
    expect(t.hand.seats[0].hole).toContain(known[0].card);
    expect(t.hand.seats[1].hole).toContain(known[1].card);
    expect(getMagicView(t, 0).known).toEqual([]);
    expect(t.seats[3].aether).toBe(0);
    expect(t.magic.events[0].targets).toEqual([0, 1]);
  });

  it('Ravenous Eye reveals both cards and exhausts until the next table', () => {
    const seats = four();
    seats[3] = seat('P3', ['ravenous_eye'], { aether: 3 });
    let t = table(startHand(setup([100, 100, 100, 100], { seed: 3 })), seats);
    const id = uid(t, 3, 'ravenous_eye');
    t = castSpell(t, 3, id, { spell: 'ravenous_eye', target: 2 });
    expect(getMagicView(t, 3).known.map((k) => k.card).sort()).toEqual([...t.hand.seats[2].hole].sort());
    t = finish(t);
    const book = t.seats[3].book;
    expect(book.exhausted!.map((c) => c.uid)).toEqual([id]);
    expect([...book.draw, ...book.discard].some((c) => c.uid === id)).toBe(false);
    const fresh = resetForTable(book);
    expect(fresh.draw.some((c) => c.uid === id)).toBe(true);
    expect(fresh.draw).toHaveLength(8);
  });
});

describe('Ember evolutions', () => {
  it('Ember Echo: a matched sole showdown win grants +2 Aether and one extra draw next hand', () => {
    const seats = [seat('P0', ['ember_echo']), seat('P1'), seat('P2')];
    seats[0].aether = 1;
    const hand = riggedHand(setup([100, 100, 100]), ['Ah Ad', '7c 2d', '8c 3h'], 'Kc Qd 9h 4s 5c');
    let t = table(hand, seats);
    t = castSpell(t, 0, uid(t, 0, 'ember_echo'), { spell: 'ember_echo', raiseTo: 6 });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'fold' });
    t = finish(t);
    expect(t.magic.gains.filter((g) => g.seat === 0).map((g) => g.reason)).toEqual(['showdown', 'cinder_called']);
    expect(t.seats[0].extraDraw).toBe(1);
    const next = beginHand(startHand(setup([100, 100, 100], { seed: 9, button: 1 })), t.seats, 6);
    expect(next.magic.hands[0]).toHaveLength(4);
    expect(next.seats[0].extraDraw).toBe(0);
  });

  it('Red Oath costs 0, publicly reveals a caster card, and a matched win grants only +1', () => {
    const seats = [seat('P0', ['red_oath']), seat('P1'), seat('P2')];
    seats[0].aether = 0;
    const hand = riggedHand(setup([100, 100, 100]), ['Ah Ad', '7c 2d', '8c 3h'], 'Kc Qd 9h 4s 5c');
    let t = table(hand, seats);
    t = castSpell(t, 0, uid(t, 0, 'red_oath'), { spell: 'red_oath', raiseTo: 6 });
    for (const viewer of [1, 2]) {
      const pub = getMagicView(t, viewer).publicKnown;
      expect(pub).toHaveLength(1);
      expect(['Ah', 'Ad'].map(parseCard)).toContain(pub[0].card);
    }
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'fold' });
    t = finish(t);
    const cinder = t.magic.gains.find((g) => g.reason === 'cinder_called')!;
    expect(cinder.amount).toBe(1);
  });
});

describe('Thorn evolutions', () => {
  it('Thorn Lattice locks this street and the next one automatically', () => {
    const seats = [seat('P0'), seat('P1', ['thorn_lattice']), seat('P2')];
    let t = table(startHand(setup([100, 100, 100])), seats);
    // Preflop window: seat 1 (SB) is the only one with an opening spell.
    t = castSpell(t, 1, uid(t, 1, 'thorn_lattice'), { spell: 'thorn_lattice' });
    expect(t.hand.streetLimit).toBe('pot-limit');
    t = act(t, 0, { type: 'call' });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'check' });
    expect(t.hand.street).toBe('flop');
    expect(t.hand.streetLimit).toBe('pot-limit');
    t = act(t, 1, { type: 'check' });
    t = act(t, 2, { type: 'check' });
    t = act(t, 0, { type: 'check' });
    expect(t.hand.street).toBe('turn');
    expect(t.hand.streetLimit).toBe('no-limit');
  });

  it('Quiet Briars refunds 1 Aether only if nobody bets or raises on the locked street', () => {
    const quiet = () => {
      const seats = [seat('P0'), seat('P1', ['quiet_briars']), seat('P2')];
      seats[1].aether = 2;
      return table(startHand(setup([100, 100, 100])), seats);
    };
    let t = castSpell(quiet(), 1, uid(quiet(), 1, 'quiet_briars'), { spell: 'quiet_briars' });
    expect(t.seats[1].aether).toBe(1);
    t = act(t, 0, { type: 'call' });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'check' });
    expect(t.magic.gains).toContainEqual({ seat: 1, amount: 1, reason: 'quiet_briars' });
    let loud = castSpell(quiet(), 1, uid(quiet(), 1, 'quiet_briars'), { spell: 'quiet_briars' });
    loud = act(loud, 0, { type: 'raise', to: 6 });
    loud = act(loud, 1, { type: 'call' });
    loud = act(loud, 2, { type: 'call' });
    expect(loud.magic.gains.some((g) => g.reason === 'quiet_briars')).toBe(false);
  });
});

describe('Mirror evolutions', () => {
  it('Second Reflection: two private candidates, the chosen one replaces the card, the table waits', () => {
    const seats = [seat('P0'), seat('P1'), seat('P2', ['second_reflection'], { aether: 3 })];
    const hand = startHand(setup([100, 100, 100], { seed: 4 }));
    let t = table(hand, seats);
    // Preflop order: seat 0 first, but only seat 2 has an opening spell.
    expect(windowSeat(t)).toBe(2);
    const old = t.hand.seats[2].hole[1];
    t = castSpell(t, 2, uid(t, 2, 'second_reflection'), { spell: 'second_reflection', holeIndex: 1 });
    const choice = getMagicView(t, 2).choice!;
    expect(choice.candidates[0]).not.toBe(choice.candidates[1]);
    expect(getMagicView(t, 0).choice).toBeNull();
    expect(() => act(t, 0, { type: 'call' })).toThrow(MagicError);
    expect(() => chooseCandidate(t, 0, 0)).toThrow(MagicError);
    t = chooseCandidate(t, 2, 1);
    expect(t.hand.seats[2].hole[1]).toBe(choice.candidates[1]);
    expect(t.hand.deck).toContain(choice.candidates[0]);
    expect(t.hand.deck).toContain(old);
    expect(replayMagicHand(hand, seats, 5, t.magic.commands)).toEqual(t);
  });

  it('Marked Fate publicly announces the rank of the discarded card', () => {
    const seats = [seat('P0'), seat('P1'), seat('P2', ['marked_fate'])];
    let t = table(startHand(setup([100, 100, 100], { seed: 8 })), seats);
    const old = t.hand.seats[2].hole[0];
    t = castSpell(t, 2, uid(t, 2, 'marked_fate'), { spell: 'marked_fate', holeIndex: 0 });
    expect(t.magic.events[0].markedRank).toBe(rankOf(old));
    expect(t.hand.seats[2].hole[0]).not.toBe(old);
  });
});

describe('relics and the Open Book', () => {
  it('Thorn Anchor makes only the first Briar-family cast of the table 1 cheaper', () => {
    const seats = [seat('P0'), seat('P1', ['briar_lock', 'briar_lock'], { relics: ['thorn_anchor'] as RelicId[] }), seat('P2')];
    seats[1].aether = 1;
    let t = table(startHand(setup([100, 100, 100])), seats);
    expect(castOptions(t, 1)[0].cost).toBe(0);
    t = castSpell(t, 1, uid(t, 1, 'briar_lock'), { spell: 'briar_lock' });
    expect(t.seats[1].aether).toBe(1);
    expect(t.seats[1].tableFlags).toEqual(['discount:thorn_anchor']);
    t = finish(t);
    const next = beginHand(startHand(setup([100, 100, 100], { seed: 3, button: 1 })), t.seats, 7);
    const opt = castOptions(next, 1).find((o) => o.spell === 'briar_lock');
    if (opt) expect(opt.cost).toBe(1);
  });

  it("Gambler's Knot grants +1 Aether once per table for a legal fold facing a wager", () => {
    const seats = [seat('P0', [], { relics: ['gambler_knot'] as RelicId[] }), seat('P1'), seat('P2')];
    seats[0].aether = 1;
    let t = table(startHand(setup([100, 100, 100])), seats);
    t = act(t, 0, { type: 'fold' });
    expect(t.seats[0].aether).toBe(2);
    t = finish(t);
    // Next hand at the same table: folding facing the big blind again earns nothing.
    let n = beginHand(startHand(setup([100, 100, 100], { seed: 2, button: 2 })), t.seats, 8);
    while (n.hand.toAct !== 0) n = act(n, n.hand.toAct!, { type: 'call' });
    const before = n.seats[0].aether;
    expect(getLegalActions(n.hand)!.callAmount).toBeGreaterThan(0);
    n = act(n, 0, { type: 'fold' });
    expect(n.seats[0].aether).toBe(before);
    expect(n.magic.gains.some((g) => g.reason === 'gambler_knot')).toBe(false);
  });

  it('Ashen Signet: once per table after a sole contested win following the owner’s preflop raise', () => {
    const seats = [seat('P0', [], { relics: ['ashen_signet'] as RelicId[] }), seat('P1'), seat('P2')];
    seats[0].aether = 1;
    const hand = riggedHand(setup([100, 100, 100]), ['Ah Ad', '7c 2d', '8c 3h'], 'Kc Qd 9h 4s 5c');
    let t = table(hand, seats);
    t = act(t, 0, { type: 'raise', to: 6 });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'fold' });
    t = finish(t);
    expect(t.magic.gains.filter((g) => g.seat === 0).map((g) => g.reason)).toEqual(['showdown', 'ashen_signet']);
    expect(t.seats[0].aether).toBe(3);
  });

  it('Open Book: +1 Aether each hand and a public card whose identity follows a Fate Exchange', () => {
    const seats = [seat('P0'), seat('P1'), seat('P2', ['fate_exchange'], { covenants: ['covenant_open_book'], aether: 1 })];
    let t = table(startHand(setup([100, 100, 100], { seed: 11 })), seats);
    expect(t.seats[2].aether).toBe(2);
    expect(t.magic.gains).toContainEqual({ seat: 2, amount: 1, reason: 'open_book' });
    const shown = t.magic.publicReveals[0];
    expect(getMagicView(t, 0).publicKnown[0].card).toBe(t.hand.seats[2].hole[shown.holeIndex]);
    t = castSpell(t, 2, uid(t, 2, 'fate_exchange'), { spell: 'fate_exchange', holeIndex: shown.holeIndex });
    expect(getMagicView(t, 1).publicKnown[0].card).toBe(t.hand.seats[2].hole[shown.holeIndex]);
  });
});

describe('Resonance (per instance, at most once per hand)', () => {
  it('a matched Cinder Challenge earns its own instance one Resonance', () => {
    const seats = [seat('P0', ['cinder_challenge', 'cinder_challenge']), seat('P1'), seat('P2')];
    const hand = riggedHand(setup([100, 100, 100]), ['Ah Ad', '7c 2d', '8c 3h'], 'Kc Qd 9h 4s 5c');
    let t = table(hand, seats);
    const id = t.magic.hands[0][0].uid;
    t = castSpell(t, 0, id, { spell: 'cinder_challenge', raiseTo: 6 });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'call' });
    t = finish(t);
    const cards = [...t.seats[0].book.draw, ...t.seats[0].book.discard];
    expect(cards.find((c) => c.uid === id)!.resonance).toBe(1);
    expect(cards.filter((c) => c.uid !== id).every((c) => !c.resonance)).toBe(true);
  });

  it('Unmask earns Resonance when its target is still in after the next action', () => {
    const seats = [seat('P0'), seat('P1'), seat('P2'), seat('P3', ['unmask'])];
    let t = table(startHand(setup([100, 100, 100, 100], { seed: 2 })), seats);
    const id = uid(t, 3, 'unmask');
    t = castSpell(t, 3, id, { spell: 'unmask', target: 2 });
    t = act(t, 3, { type: 'call' });
    expect(t.magic.resonated).toEqual([id]);
  });

  it('Briar Lock earns Resonance once a voluntary bet, call or raise happens under it', () => {
    const seats = [seat('P0'), seat('P1', ['briar_lock']), seat('P2')];
    let t = table(startHand(setup([100, 100, 100])), seats);
    const id = uid(t, 1, 'briar_lock');
    t = castSpell(t, 1, id, { spell: 'briar_lock' });
    expect(t.magic.resonated).toEqual([]);
    t = act(t, 0, { type: 'call' });
    expect(t.magic.resonated).toEqual([id]);
  });

  it('Fate Exchange earns Resonance when the caster sees the flop', () => {
    const seats = [seat('P0'), seat('P1'), seat('P2', ['fate_exchange'])];
    let t = table(startHand(setup([100, 100, 100], { seed: 6 })), seats);
    const id = uid(t, 2, 'fate_exchange');
    t = castSpell(t, 2, id, { spell: 'fate_exchange', holeIndex: 0 });
    t = act(t, 0, { type: 'call' });
    t = act(t, 1, { type: 'call' });
    t = act(t, 2, { type: 'check' });
    expect(t.hand.street).toBe('flop');
    expect(t.magic.resonated).toEqual([id]);
  });

  it('evolved hands replay exactly from their commands', () => {
    const seats = [seat('P0', ['ember_echo']), seat('P1', ['thorn_lattice']), seat('P2', ['twin_oracle'], { aether: 3 })];
    const hand = startHand(setup([100, 100, 100], { seed: 21 }));
    let t = table(hand, seats);
    t = castSpell(t, 1, uid(t, 1, 'thorn_lattice'), { spell: 'thorn_lattice' });
    t = castSpell(t, 0, uid(t, 0, 'ember_echo'), { spell: 'ember_echo', raiseTo: 6 });
    t = act(t, 1, { type: 'call' });
    t = castSpell(t, 2, uid(t, 2, 'twin_oracle'), { spell: 'twin_oracle', targets: [0, 1] });
    t = act(t, 2, { type: 'fold' });
    t = finish(t);
    expect(replayMagicHand(hand, seats, 5, t.magic.commands)).toEqual(t);
    expect(apply).toBeTypeOf('function');
  });
});
