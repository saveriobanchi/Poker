import { describe, expect, it } from 'vitest';
import { act, allCards, apply, beginHand, createSeatMagic, getMagicView, replayMagicHand, type SeatMagic, sigilSeat, type SpellId, useSigil, windowSeat } from '../src/game/magic';
import type { RelicId } from '../src/game/magic/relics';
import { startHand } from '../src/game/rules';
import {
  actBoundaryRepayments,
  assertRunInvariants,
  createRun,
  DOSSIER_HANDS,
  mirrorCandidates,
  playerChips,
  resonanceTargets,
  rewardOffers,
  runCommand,
  type RunState,
} from '../src/game/run/run';
import { setup } from './helpers';
import { until } from './runHelpers';

function seat(owner: string, spells: SpellId[], extras: Partial<SeatMagic> = {}): SeatMagic {
  const all = [...spells, ...Array(8).fill('cinder_challenge')].slice(0, 8) as SpellId[];
  return createSeatMagic({ owner, draw: all.map((spell, i) => ({ uid: `${owner}:${i}`, spell })), discard: [], rngState: 1 }, extras);
}

describe("Fateweaver's Sigil (design v0.8 §05)", () => {
  const sigil = { relics: ['fateweavers_sigil'] as RelicId[] };

  it('pauses before any window, swaps one drawn spell for the top card, once per table, publicly told', () => {
    const seats = [seat('P0', ['unmask', 'unmask', 'briar_lock', 'fate_exchange'], sigil), seat('P1', []), seat('P2', [])];
    const hand = startHand(setup([100, 100, 100], { seed: 4 }));
    let t = beginHand(hand, seats, 9);
    expect(sigilSeat(t)).toBe(0);
    expect(windowSeat(t)).toBeNull();
    expect(getMagicView(t, 0).sigil).toBe(true);
    expect(getMagicView(t, 1).sigil).toBe(false);
    expect(() => act(t, t.hand.toAct!, { type: 'fold' })).toThrow(/Sigil/);
    const before = t.magic.hands[0].map((c) => c.spell);
    expect(before).toEqual(['unmask', 'unmask', 'briar_lock']);
    t = useSigil(t, 0, 'P0:1');
    expect(t.magic.hands[0].map((c) => c.spell)).toEqual(['unmask', 'fate_exchange', 'briar_lock']);
    expect(t.seats[0].book.draw.at(-1)!.uid).toBe('P0:1');
    expect([...allCards(t.seats[0].book), ...t.magic.hands[0]]).toHaveLength(8);
    expect(t.magic.notices.at(-1)!.text).toMatch(/Sigil/);
    expect(t.hand.seats.map((p) => p.hole)).toEqual(hand.seats.map((p) => p.hole)); // no poker card touched
    // Replay reproduces the same state; the next hand at this table offers no Sigil.
    expect(replayMagicHand(hand, seats, 9, t.magic.commands)).toEqual(t);
    const used = seats.map((x, i) => (i === 0 ? { ...x, tableFlags: t.seats[0].tableFlags } : x));
    const next = beginHand(startHand(setup([100, 100, 100], { seed: 5, button: 1 })), used, 10);
    expect(sigilSeat(next)).toBeNull();
  });

  it('keeping the draw is allowed and still uses the table’s Sigil', () => {
    const seats = [seat('P0', ['unmask'], sigil), seat('P1', []), seat('P2', [])];
    let t = beginHand(startHand(setup([100, 100, 100], { seed: 4 })), seats, 9);
    t = apply(t, { kind: 'sigil', seat: 0, uid: null });
    expect(sigilSeat(t)).toBeNull();
    expect(t.seats[0].tableFlags).toContain('sigil');
  });
});

function atVelvet(): RunState {
  for (let seed = 1; seed < 100; seed++) {
    const r = until(createRun(seed), (x) => x.node === 'velvet_exchange' || x.node === 'death', 'tight', seed);
    if (r.node === 'velvet_exchange') return r;
  }
  throw new Error('no Velvet Exchange');
}

describe('Act II events (design v0.8 §01–§02)', () => {
  it('the Court offers a dossier on Arden or Livia only, from at most 12 public hands, shown at the Arena and then gone', () => {
    const run = atVelvet();
    expect(mirrorCandidates(run)).toEqual(['witness_arden', 'livia_shade']);
    const court = runCommand(run, { kind: 'leaveShop', to: 'mirror_audience' });
    expect(() => runCommand(court, { kind: 'event', take: true, rival: 'vesa_kael' })).toThrow();
    const studied = runCommand(court, { kind: 'event', take: true, rival: 'livia_shade' });
    expect(studied.dossier).toMatchObject({ rival: 'livia_shade', hands: DOSSIER_HANDS });
    expect(studied.dossier!.vpip).toBeLessThanOrEqual(DOSSIER_HANDS);
    expect(JSON.stringify(studied.dossier)).not.toMatch(/hole|card/i);
    expect(runCommand(court, { kind: 'event', take: true, rival: 'livia_shade' }).dossier).toEqual(studied.dossier); // seeded
    const arena = runCommand(studied, { kind: 'advance' });
    expect(arena.node).toBe('velvet_arena');
    expect(arena.dossier!.rival).toBe('livia_shade');
    const after = until(arena, (x) => x.node !== 'velvet_arena', 'tight', 2);
    expect(after.dossier ?? null).toBeNull();
  }, 120_000);

  it('the Whispered Contract gives +1 Resonance once, names one drawn spell publicly, and never a poker card', () => {
    const run = atVelvet();
    const bargain = runCommand(run, { kind: 'leaveShop', to: 'secret_bargain' });
    const target = resonanceTargets(bargain)[0];
    expect(() => runCommand(bargain, { kind: 'event', take: true })).toThrow();
    const taken = runCommand(bargain, { kind: 'event', take: true, uid: target.uid });
    const card = allCards(taken.table!.table.seats[0].book).concat(taken.table!.table.magic.hands[0]).find((c) => c.uid === target.uid)!;
    expect(card.resonance).toBe((target.resonance ?? 0) + 1);
    expect(taken.characters.you.reputation.notoriety).toBe(run.characters.you.reputation.notoriety + 1);
    const notice = taken.table!.table.magic.notices.find((n) => n.text.startsWith('A whisper names'))!;
    expect(notice).toBeTruthy();
    expect(taken.table!.table.magic.hands[0].some((c) => notice.text.includes(c.spell.split('_')[0].replace(/^./, (m) => m.toUpperCase())))).toBe(true);
    // Reloading the saved state does not grant it again.
    const reloaded = JSON.parse(JSON.stringify(taken)) as RunState;
    expect(() => runCommand(reloaded, { kind: 'event', take: true, uid: target.uid })).toThrow();
  }, 120_000);

  it('with no eligible spell the Whisper gives +1 Aether at the next table instead (capped at 3)', () => {
    const run = atVelvet();
    const bargain = runCommand(run, { kind: 'leaveShop', to: 'secret_bargain' });
    for (const c of allCards(bargain.player.magic.book)) c.resonance = 2;
    expect(resonanceTargets(bargain)).toEqual([]);
    const taken = runCommand(bargain, { kind: 'event', take: true });
    expect(taken.table!.table.seats[0].aether).toBeGreaterThanOrEqual(Math.min(3, run.player.magic.aether + 0));
    expect(taken.flags).not.toContain('whisper_aether');
    expect(playerChips(taken)).toBe(run.accounts.you);
  }, 120_000);
});

describe('Act II rewards (design v0.8 §05)', () => {
  it('the Salon offers a relic or +1 Resonance; the Arena a relic or a token; never chips', () => {
    const run = createRun(3);
    expect(rewardOffers(run, 'masked_salon').map((o) => o.kind)).toEqual(['relic', 'resonance']);
    expect(rewardOffers(run, 'velvet_arena').map((o) => o.kind)).toEqual(['relic', 'evolution_token']);
    run.node = 'reward';
    run.reward = rewardOffers(run, 'masked_salon');
    run.next = 'gilded_gate';
    const uid = resonanceTargets(run)[0].uid;
    const after = runCommand(run, { kind: 'reward', index: 1, uid });
    expect(allCards(after.player.magic.book).find((c) => c.uid === uid)!.resonance).toBe(1);
    expect(after.accounts.you).toBe(run.accounts.you);
  });
});

describe('NPC debt boundaries (design v0.8 §06)', () => {
  it('a dead creditor is paid into a named estate, once per boundary', () => {
    const run = createRun(7);
    run.contracts.push({ id: 'k9', claimId: 'c', pact: 'debt', debtor: 'oracle', creditor: 'vesper', principal: 20, obligation: 30, repaid: 0, servicesOwed: 0, servicesDone: 0, tablesCompleted: 0, status: 'active' });
    run.characters.vesper.alive = false;
    actBoundaryRepayments(run, 'act2');
    expect(run.accounts['estate:vesper']).toBe(Math.floor(0.15 * 99));
    actBoundaryRepayments(run, 'act2');
    expect(run.accounts['estate:vesper']).toBe(Math.floor(0.15 * 99));
    actBoundaryRepayments(run, 'cinder_hearing');
    expect(run.accounts['estate:vesper']).toBeGreaterThan(Math.floor(0.15 * 99));
    assertRunInvariants(run);
  });
});
