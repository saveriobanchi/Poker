import { describe, expect, it } from 'vitest';
import { allCards, createSpellbook, RELIC_IDS, type RelicId, RIVAL_SPELLBOOKS } from '../src/game/magic';
import {
  actBoundaryRepayments,
  assertRunInvariants,
  attuneOptions,
  createRun,
  evolutionOffers,
  judge,
  rewardOffers,
  runCommand,
  type RunState,
  type Standing,
} from '../src/game/run/run';

const row = (id: string, stack: number, rank: number): Standing => ({ id, name: id, stack, status: 'seated', rank });

describe('Bailiff boss objective (design v0.7 §02)', () => {
  it('wins on a tie for first, or top two with net profit >= max(12, 20% of entry)', () => {
    const tie = [row('you', 150, 1), row('bailiff_sable', 150, 1), row('sister_rill', 60, 3)];
    expect(judge('boss_ledger', tie, 10, 140)).toBe('win');
    const second = [row('bailiff_sable', 200, 1), row('you', 120, 2), row('sister_rill', 40, 3)];
    expect(judge('boss_ledger', second, 20, 100)).toBe('win'); // max(12, 20) = 20
    expect(judge('boss_ledger', second, 19, 100)).toBe('alive_failure');
    expect(judge('boss_ledger', second, 12, 40)).toBe('win'); // max(12, 8) = 12
    expect(judge('boss_ledger', second, 11, 40)).toBe('alive_failure');
    const third = [row('bailiff_sable', 200, 1), row('sister_rill', 100, 2), row('you', 1, 3)];
    expect(judge('boss_ledger', third, 50, 10)).toBe('alive_failure'); // alive with one chip: exile, never death
  });

  it('the entry snapshot is part of the saved run, so a reload cannot move it', () => {
    const run = runCommand(createRun(4), { kind: 'advance' });
    const reloaded = JSON.parse(JSON.stringify(run)) as RunState;
    expect(reloaded.entryStack).toBe(run.entryStack);
  });
});

describe('evolution tokens (design v0.7 §04)', () => {
  function withToken(resonance: number): RunState {
    const run = createRun(5);
    run.player.evolutionTokens = 1;
    allCards(run.player.magic.book).forEach((c, i) => (c.resonance = i === 0 ? resonance : 0));
    return run;
  }

  it('at 0 Resonance everywhere, the token attunes one spell (+1) instead of evolving', () => {
    const run = withToken(0);
    expect(evolutionOffers(run)).toEqual([]);
    const card = attuneOptions(run)[0];
    const after = runCommand(run, { kind: 'attune', uid: card.uid });
    expect(after.player.evolutionTokens).toBe(0);
    expect(allCards(after.player.magic.book).find((c) => c.uid === card.uid)!.resonance).toBe(1);
    expect(() => runCommand(after, { kind: 'attune', uid: card.uid })).toThrow();
  });

  it('at 1 Resonance the token evolves; at 2 evolution needs no token; attuning is then refused', () => {
    const one = withToken(1);
    expect(attuneOptions(one)).toEqual([]);
    const offer = evolutionOffers(one).find((o) => o.needsToken)!;
    const evolved = runCommand(one, { kind: 'evolve', uid: offer.card.uid, branch: offer.branches[0], useToken: true });
    expect(evolved.player.evolutionTokens).toBe(0);
    const two = withToken(2);
    expect(evolutionOffers(two).some((o) => !o.needsToken)).toBe(true);
    expect(attuneOptions(two)).toEqual([]);
  });
});

describe('Circuit rewards (design v0.7 §05)', () => {
  it('with five relics the player replaces one (no refund); with every relic owned only the token is offered', () => {
    const run = createRun(6);
    run.player.magic.relics = RELIC_IDS.slice(0, 5) as RelicId[];
    const offers = rewardOffers(run, 'contract_2');
    expect(offers.map((o) => o.kind)).toEqual(['relic', 'evolution_token']);
    run.node = 'reward';
    run.reward = offers;
    run.next = 'lantern_shop';
    expect(() => runCommand(run, { kind: 'reward', index: 0 })).toThrow(/full/);
    const chips = run.accounts.you;
    const after = runCommand(run, { kind: 'reward', index: 0, replace: 'ashen_signet' });
    expect(after.player.magic.relics).toHaveLength(5);
    expect(after.player.magic.relics).not.toContain('ashen_signet');
    expect(after.accounts.you).toBe(chips);
    const all = createRun(6);
    all.player.magic.relics = RELIC_IDS.slice(0, 5) as RelicId[];
    all.player.magic.relics.push(RELIC_IDS[5]); // out-of-band: every relic owned
    expect(rewardOffers(all, 'contract_2')).toEqual([{ kind: 'evolution_token' }]);
  });

  it('rarity is weighted 60/35 among present tiers and seeded', () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 400; seed++) {
      const r = rewardOffers(createRun(seed), 'contract_2')[0];
      if (r.kind === 'relic') counts[r.relic] = (counts[r.relic] ?? 0) + 1;
    }
    const uncommon = (counts.veiled_monocle ?? 0) + (counts.mirror_prism ?? 0);
    expect(uncommon / 400).toBeGreaterThan(0.3);
    expect(uncommon / 400).toBeLessThan(0.45);
    expect(rewardOffers(createRun(9), 'contract_2')).toEqual(rewardOffers(createRun(9), 'contract_2'));
  });
});

describe('NPC debt continuation (design v0.7 §07)', () => {
  it('pays 15% of the wallet above one chip, once per act boundary, as a journal entry', () => {
    const run = createRun(7);
    run.contracts.push({ id: 'k1', claimId: 'c', pact: 'debt', debtor: 'vesper', creditor: 'you', principal: 20, obligation: 30, repaid: 0, servicesOwed: 0, servicesDone: 0, tablesCompleted: 0, status: 'active' });
    const you = run.accounts.you;
    actBoundaryRepayments(run, 'act1');
    expect(run.accounts.you - you).toBe(Math.floor(0.15 * 119)); // Vesper holds 120
    expect(run.journal.at(-1)!.reason).toContain('voluntary debt payment');
    const again = run.accounts.you;
    actBoundaryRepayments(run, 'act1');
    expect(run.accounts.you).toBe(again);
    assertRunInvariants(run);
    const poor = structuredClone(run);
    poor.accounts.oracle += poor.accounts.vesper - 1;
    poor.accounts.vesper = 1;
    actBoundaryRepayments(poor, 'act2');
    expect(poor.accounts.vesper).toBe(1); // never the last chip
    assertRunInvariants(poor);
  });
});

describe('rival magic (design v0.7 §08)', () => {
  it('Bailiff Sable carries one Quiet Briars in an eight-card book', () => {
    const book = RIVAL_SPELLBOOKS.bailiff_sable;
    expect(book.quiet_briars).toBe(1);
    expect(book.briar_lock).toBe(2);
    expect(allCards(createSpellbook('bailiff_sable', book, 1))).toHaveLength(8);
  });
});
