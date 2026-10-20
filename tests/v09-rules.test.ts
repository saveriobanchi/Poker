import { describe, expect, it } from 'vitest';
import { dossierFigures } from '../src/game/ai/calibration';
import { allCards, beginHand, createSeatMagic, createSpellbook, RIVAL_SPELLBOOKS, type SeatMagic, sigilSeat, type SpellId, useSigil } from '../src/game/magic';
import type { RelicId } from '../src/game/magic/relics';
import { startHand } from '../src/game/rules';
import {
  canRecover,
  CINDER_PASS_REDEEMED,
  createRun,
  CROWN_LEDGER,
  EPILOGUE_FATES,
  rewardOffers,
  runCommand,
  type RunState,
} from '../src/game/run/run';
import { DEBTOR_TEMPERAMENT } from '../src/game/world';
import act3 from '../src/game/run/data/p7-act3-temperaments.json';
import { setup } from './helpers';
import { until } from './runHelpers';

function reach(pred: (r: RunState) => boolean, policy: 'tight' | 'skilled' = 'tight'): RunState {
  for (let seed = 1; seed < 150; seed++) {
    const r = until(createRun(seed), (x) => pred(x) || x.node === 'death', policy, seed);
    if (pred(r)) return r;
  }
  throw new Error('state not reached');
}

describe("Fateweaver's Sigil keep (design v0.9 §01)", () => {
  it('keeping consumes the table’s Sigil, draws nothing and consumes no draw randomness', () => {
    const owner = 'P0';
    const spells: SpellId[] = ['unmask', 'briar_lock', 'fate_exchange', 'cinder_challenge', 'unmask', 'briar_lock', 'fate_exchange', 'cinder_challenge'];
    const seats: SeatMagic[] = [
      createSeatMagic({ owner, draw: spells.map((spell, i) => ({ uid: `${owner}:${i}`, spell })), discard: [], rngState: 77 }, { relics: ['fateweavers_sigil'] as RelicId[] }),
      createSeatMagic(createSpellbook('P1', { unmask: 2, briar_lock: 2, fate_exchange: 2, cinder_challenge: 2 }, 1)),
      createSeatMagic(createSpellbook('P2', { unmask: 2, briar_lock: 2, fate_exchange: 2, cinder_challenge: 2 }, 2)),
    ];
    const t = beginHand(startHand(setup([100, 100, 100], { seed: 3 })), seats, 5);
    const kept = useSigil(t, 0, null);
    expect(kept.magic.hands[0]).toEqual(t.magic.hands[0]);
    expect(kept.seats[0].book).toEqual(t.seats[0].book); // no draw, no RNG step
    expect(sigilSeat(kept)).toBeNull();
    expect(() => useSigil(kept, 0, null)).toThrow();
    // A reload of the kept state cannot reopen it.
    expect(sigilSeat(JSON.parse(JSON.stringify(kept)))).toBeNull();
  });
});

describe('archival dossiers (design v0.9 §02)', () => {
  it('fixes the archive seed on arrival and every figure recomputes from the stored public records', () => {
    const ex = reach((x) => x.node === 'velvet_exchange');
    const court = runCommand(ex, { kind: 'leaveShop', to: 'mirror_audience' });
    expect(Object.keys(court.dossierSeeds ?? {}).sort()).toEqual(['livia_shade', 'witness_arden']);
    const seen = runCommand(court, { kind: 'event', take: true, rival: 'witness_arden' });
    const d = seen.dossier!;
    expect(d.seed).toBe(court.dossierSeeds!.witness_arden);
    expect(d.records).toHaveLength(12);
    expect(dossierFigures(d.records)).toEqual({ hands: d.hands, vpip: d.vpip, pfr: d.pfr, shoves: d.shoves });
    for (const r of d.records) for (const a of r.actions) expect(['fold', 'check', 'call', 'raise', 'shove']).toContain(a);
    expect(JSON.stringify(d.records)).not.toMatch(/hole|board|card/i);
  }, 240_000);
});

describe('Cinder Pass and the Writ (design v0.9 §04, §05, §08)', () => {
  it('waives the petition fee once and is not reusable', () => {
    const e = reach((x) => x.node === 'act2_living_exile');
    e.flags.push('cinder_pass');
    const writ = runCommand(e, { kind: 'advance' });
    expect(writ.characters.you.reputation.favor).toBe(e.characters.you.reputation.favor);
    expect(writ.flags).toContain(CINDER_PASS_REDEEMED);
    expect(writ.accounts.you).toBe(e.accounts.you);
    expect(JSON.parse(JSON.stringify(writ)).flags.filter((f: string) => f === CINDER_PASS_REDEEMED)).toHaveLength(1);
  }, 240_000);

  it('does not bypass a bound player’s Underlamp qualification', () => {
    const run = createRun(9);
    run.node = 'under_hearing';
    run.flags.push('cinder_pass', 'under_entered');
    run.contracts.push({ id: 'kb', claimId: 'c', pact: 'debt', debtor: 'you', creditor: 'vesper', principal: 10, obligation: 15, repaid: 0, servicesOwed: 0, servicesDone: 0, tablesCompleted: 0, status: 'active' });
    expect(runCommand(run, { kind: 'advance' }).node).toBe('under_living_end');
  });

  it('offers the Undercircuit at 23 Lifechips, not at 24, and never twice', () => {
    const w = reach((x) => x.node === 'crown_writ');
    const at = (n: number) => {
      const r = structuredClone(w);
      const d = r.accounts.you - n;
      r.accounts.you -= d;
      r.accounts[CROWN_LEDGER] += d;
      return r;
    };
    expect(canRecover(at(23))).toBe(true);
    expect(canRecover(at(24))).toBe(false);
    const used = at(23);
    used.flags.push('under_entered');
    expect(canRecover(used)).toBe(false);
  }, 240_000);
});

describe('Act III personalities and the Regent (design v0.9 §09, §10)', () => {
  it('all seven Act III rivals have their own temperaments and vetoes', () => {
    for (const p of act3.profiles) {
      expect(DEBTOR_TEMPERAMENT[p.id].acceptance).toEqual(p.debtor_acceptance);
      expect(DEBTOR_TEMPERAMENT[p.id].veto).toEqual(p.hard_veto);
    }
    expect(DEBTOR_TEMPERAMENT.ledger_regent.veto).toEqual(['service']);
  });

  it('the Ledger Regent carries exactly one Second Reflection in eight cards', () => {
    const book = createSpellbook('ledger_regent', RIVAL_SPELLBOOKS.ledger_regent, 3);
    const cards = allCards(book);
    expect(cards).toHaveLength(8);
    expect(cards.filter((c) => c.spell === 'second_reflection')).toHaveLength(1);
    expect(cards.filter((c) => c.spell === 'fate_exchange')).toHaveLength(2);
  });
});

describe('rewards, shops and epilogues (design v0.9 §11, §12)', () => {
  it('the Table of Seals reports no valid target when every spell is evolved', () => {
    const run = createRun(4);
    expect(rewardOffers(run, 'seals_table')).toEqual([{ kind: 'evolution_token' }]);
    for (const c of allCards(run.player.magic.book)) c.spell = 'twin_oracle';
    expect(rewardOffers(run, 'seals_table')).toEqual([]);
  });

  it('a saved shop keeps its exact stock across reloads', () => {
    const shop = reach((x) => x.node === 'lantern_shop');
    expect(JSON.stringify((JSON.parse(JSON.stringify(shop)) as RunState).shop)).toBe(JSON.stringify(shop.shop));
  }, 240_000);

  it('living endings record one epilogue fate', () => {
    const run = createRun(5);
    run.node = 'the_unchosen_road';
    expect(EPILOGUE_FATES.the_unchosen_road).toEqual(['retire', 'keep_wagering_in_future_content']);
    const after = runCommand(run, { kind: 'fate', choice: 'retire' });
    expect(after.flags).toContain('fate:retire');
    expect(() => runCommand(after, { kind: 'fate', choice: 'retire' })).toThrow();
    expect(() => runCommand(run, { kind: 'fate', choice: 'claim' })).toThrow();
  });
});
