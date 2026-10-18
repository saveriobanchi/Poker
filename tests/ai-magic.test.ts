import { describe, expect, it } from 'vitest';
import { decideOpening, decideTurn, PROFILES } from '../src/game/ai';
import {
  AETHER,
  apply,
  beginHand,
  createSeatMagic,
  createSpellbook,
  getMagicView,
  MagicCommand,
  MagicTable,
  replayMagicHand,
  RIVAL_SPELLBOOKS,
  SeatMagic,
  SpellId,
  windowSeat,
} from '../src/game/magic';
import { getPublicView, nextHandSetup, Rng, startHand } from '../src/game/rules';
import { setup } from './helpers';

const ROSTER = ['vesper', 'oracle', 'corvin', 'vesper'];

function aiCommand(t: MagicTable, rng: Rng): MagicCommand {
  const ws = windowSeat(t);
  const seat = ws ?? t.hand.toAct!;
  const profile = PROFILES[ROSTER[seat]];
  const view = getPublicView(t.hand, seat);
  const magic = getMagicView(t, seat);
  if (ws !== null) {
    const c = decideOpening(view, magic, profile, rng);
    return c.kind === 'pass' ? { kind: 'pass', seat } : { kind: 'cast', seat, uid: c.uid, params: c.params };
  }
  const c = decideTurn(view, magic, profile, rng);
  return c.kind === 'act' ? { kind: 'act', seat, action: c.action } : { kind: 'cast', seat, uid: c.uid, params: c.params };
}

describe('AI magic', () => {
  it('1,000+ AI hands: only legal spells, Aether within 0..3, chips conserved, deterministic replay', () => {
    const rng = new Rng(11);
    const casts: Record<string, number> = {};
    let hands = 0;
    for (let table = 0; table < 20 && hands < 1200; table++) {
      let hs = setup([100, 120, 100, 90], { seed: table * 101, button: table % 4 });
      let seats: SeatMagic[] = ROSTER.map((id, i) => createSeatMagic(createSpellbook(`${id}${i}`, RIVAL_SPELLBOOKS[id], table * 7 + i)));
      for (let h = 0; h < 120; h++) {
        const hand = startHand(hs);
        const start = structuredClone(seats);
        let t = beginHand(hand, seats, table * 1000 + h);
        while (t.hand.phase === 'betting') t = apply(t, aiCommand(t, rng)); // apply throws on anything illegal
        hands++;
        expect(t.hand.seats.reduce((a, p) => a + p.stack, 0)).toBe(410);
        for (const s of t.seats) expect(s.aether).toBeGreaterThanOrEqual(0), expect(s.aether).toBeLessThanOrEqual(AETHER.max);
        for (const e of t.magic.events) casts[e.spell] = (casts[e.spell] ?? 0) + 1;
        if (h % 40 === 0) expect(replayMagicHand(hand, start, table * 1000 + h, t.magic.commands)).toEqual(t);
        seats = t.seats;
        if (t.hand.seats.filter((p) => p.stack > 0).length < 2) break;
        hs = nextHandSetup(t.hand, table * 101 + h + 1);
      }
    }
    expect(hands).toBeGreaterThanOrEqual(1000);
    for (const spell of ['cinder_challenge', 'unmask', 'briar_lock', 'fate_exchange'] as SpellId[]) {
      expect(casts[spell] ?? 0).toBeGreaterThan(10);
    }
    console.log('AI casts over', hands, 'hands:', casts);
  }, 120_000);
});
