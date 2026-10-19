import { describe, expect, it } from 'vitest';
import { playRun, POLICIES, step } from '../src/game/run/driver';
import {
  activeDuty,
  assertRunInvariants,
  CANNOT_BUY,
  createRun,
  ENDINGS,
  evolutionOffers,
  fallenFromSave,
  importFallenSession,
  loadRun,
  saveRun,
  OPEN_BOOK_FEE,
  playerBook,
  runCommand,
  type RunState,
  SOLD_OUT,
} from '../src/game/run/run';
import { Rng } from '../src/game/rules';
import { blindsFor, createDefaultSession, sessionStatus, type TableSession } from '../src/game/table/session';
import { allCards, isBaseSpell, replaceInstance } from '../src/game/magic';
import { applyClaim, applyHumanCommand, startNextHand, stepAi } from '../src/game/table/session';
import { currentClaim, pactOptions } from '../src/game/world';

/** Advances a run with `policy` until `pred` holds (or the run ends). */
function until(run: RunState, pred: (r: RunState) => boolean, policy: 'skilled' | 'passive' | 'maniac' | 'tight' = 'skilled', seed = 1): RunState {
  const rng = new Rng(seed);
  for (let i = 0; i < 50_000 && !pred(run); i++) {
    const next = step(run, policy, rng);
    if (!next) break;
    run = next;
  }
  return run;
}

const roundtrip = (r: RunState) => JSON.parse(JSON.stringify(r)) as RunState;

describe('run creation and accounting', () => {
  it('funds every wallet from named accounts and the treasury', () => {
    const run = createRun(1);
    expect(run.accounts).toMatchObject({ you: 100, vesper: 120, oracle: 100, corvin: 90, mara_quill: 110, eldric_vale: 95, bailiff_sable: 145, sister_rill: 115, night_clerk: 16, dock_runner: 18, selene: 80, patron_witness_escrow: 0 });
    expect(run.treasury).toBe(20);
    expect(run.totalLifechips).toBe(1009);
    assertRunInvariants(run);
  });

  it('entering a table moves real wallets to the table; the boss raises blinds at hand 7', () => {
    const run = runCommand(createRun(2), { kind: 'advance' });
    expect(run.node).toBe('contract_1');
    expect(run.accounts.vesper).toBe(0);
    expect(run.table!.table.hand.seats.map((p) => p.stack + p.totalCommitted)).toEqual([100, 120, 100, 90]);
    expect(run.table!.config.maxHands).toBe(8);
    const bossCfg = { label: 'b', maxHands: 12, blinds: [{ fromHand: 1, smallBlind: 2, bigBlind: 4 }, { fromHand: 7, smallBlind: 3, bigBlind: 6 }] };
    expect(blindsFor(bossCfg, 6).bigBlind).toBe(4);
    expect(blindsFor(bossCfg, 7).bigBlind).toBe(6);
  });
});

describe('the route', () => {
  it('every policy reaches an ending, never replays a table, and never loses or mints a Lifechip', () => {
    const endings: Record<string, number> = {};
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= 12; seed++) {
        let run = createRun(seed * 31 + policy.length);
        const rng = new Rng(seed);
        for (let i = 0; i < 50_000; i++) {
          const next = step(run, policy, rng);
          if (!next) break;
          run = next;
          assertRunInvariants(run);
        }
        expect(ENDINGS).toContain(run.node);
        const tables = run.results.map((r) => r.node);
        expect(new Set(tables).size).toBe(tables.length);
        endings[run.node] = (endings[run.node] ?? 0) + 1;
      }
    }
    expect(Object.keys(endings).length).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('is deterministic, and reloading at any point continues identically', () => {
    const a = playRun(createRun(77), 'skilled', 5);
    let run = createRun(77);
    const rng = new Rng(5);
    for (let i = 0; ; i++) {
      if (i % 37 === 0) run = roundtrip(run);
      const next = step(run, 'skilled', rng);
      if (!next) break;
      run = next;
    }
    expect(run).toEqual(a);
  }, 60_000);

  it('a living failure goes to one Keeper’s Audit, then forward', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const run = until(createRun(seed), (r) => r.node === 'setback_audience', 'tight', seed);
      if (run.node !== 'setback_audience') continue;
      found = true;
      const favor = run.characters.you.reputation.favor;
      const after = runCommand(run, { kind: 'setback', choice: 'public_record' });
      expect(after.characters.you.reputation).toMatchObject({ favor: favor - 1, notoriety: 1 });
      expect(['lantern_shop', 'contract_2', 'boss_ledger']).toContain(after.node);
      expect(() => runCommand(after, { kind: 'setback', choice: 'public_record' })).toThrow();
    }
    expect(found).toBe(true);
  }, 60_000);
});

describe('shop, event and rewards', () => {
  function atShop(): RunState {
    for (let seed = 1; seed < 80; seed++) {
      const run = until(createRun(seed), (r) => r.node === 'lantern_shop', 'tight', seed);
      if (run.node === 'lantern_shop') return run;
    }
    throw new Error('never reached the shop');
  }

  it('offers three seeded relics that survive a reload, and purchases are real transfers', () => {
    const shop = atShop();
    expect(shop.shop!.offers).toHaveLength(3);
    expect(new Set(shop.shop!.offers.map((o) => o.relic)).size).toBe(3);
    expect(roundtrip(shop).shop).toEqual(shop.shop);
    const offer = shop.shop!.offers[0];
    const rich = structuredClone(shop);
    rich.accounts.you += 100;
    rich.accounts.vesper -= 100; // keep the world total
    const bought = runCommand(rich, { kind: 'buy', offer: 0 });
    expect(bought.accounts.selene).toBe(rich.accounts.selene + offer.price);
    expect(bought.accounts.you).toBe(rich.accounts.you - offer.price);
    expect(bought.player.magic.relics).toContain(offer.relic);
    expect(() => runCommand(bought, { kind: 'buy', offer: 0 })).toThrow(SOLD_OUT);
  });

  it('refuses a purchase that would surrender the final Lifechip', () => {
    const shop = atShop();
    const poor = structuredClone(shop);
    const price = poor.shop!.offers[0].price;
    poor.accounts.vesper += poor.accounts.you - price;
    poor.accounts.you = price;
    expect(() => runCommand(poor, { kind: 'buy', offer: 0 })).toThrow(CANNOT_BUY);
  });

  it('Spell Rethread swaps one base instance for another starter spell, once', () => {
    const shop = atShop();
    const card = allCards(playerBook(shop)).find((c) => isBaseSpell(c.spell))!;
    const other = card.spell === 'briar_lock' ? 'unmask' : 'briar_lock';
    const rich = structuredClone(shop);
    rich.accounts.you += 50;
    rich.accounts.vesper -= 50;
    const r = runCommand(rich, { kind: 'rethread', uid: card.uid, spell: other });
    expect(allCards(r.player.magic.book).find((c) => c.uid === card.uid)!.spell).toBe(other);
    expect(() => runCommand(r, { kind: 'rethread', uid: card.uid, spell: card.spell })).toThrow(SOLD_OUT);
  });

  it('the Open Book fee goes to the Witness escrow and the petition is heard once', () => {
    const shop = atShop();
    const rich = structuredClone(shop);
    rich.accounts.you += 100;
    rich.accounts.vesper -= 100;
    const ev = runCommand(rich, { kind: 'leaveShop', to: 'optional_event' });
    const taken = runCommand(ev, { kind: 'event', take: true });
    expect(taken.accounts.patron_witness_escrow).toBe(OPEN_BOOK_FEE);
    expect(taken.player.magic.covenants).toEqual(['covenant_open_book']);
    expect(taken.node).toBe('contract_2');
    expect(() => runCommand(taken, { kind: 'event', take: true })).toThrow();
  });
});

describe('evolution', () => {
  it('offers the two branches only between hands, once Resonance reaches 2, and replaces 1:1', () => {
    const run = runCommand(createRun(3), { kind: 'advance' });
    const me = 0;
    const book = run.table!.table.seats[me].book;
    const card = book.draw[0];
    card.resonance = 2;
    expect(evolutionOffers(run)).toEqual([]); // a hand is in progress
    const between = until(run, (r) => r.table !== null && sessionStatus(r.table) === 'handComplete');
    if (!between.table) return;
    const offer = evolutionOffers(between).find((o) => o.card.uid === card.uid);
    expect(offer).toBeTruthy();
    const evolved = runCommand(between, { kind: 'evolve', uid: card.uid, branch: offer!.branches[1] });
    const all = [...playerBook(evolved).draw, ...playerBook(evolved).discard, ...(playerBook(evolved).exhausted ?? [])];
    expect(all).toHaveLength(8);
    expect(all.find((c) => c.uid === card.uid)).toMatchObject({ spell: offer!.branches[1], resonance: 0 });
    expect(() => runCommand(evolved, { kind: 'evolve', uid: card.uid, branch: offer!.branches[0] })).toThrow();
  });
});

describe('the Fallen route and sworn service', () => {
  /** Drives a P3 free table until the player survives a Last Claim through service (or any covenant). */
  function p3Fallen(): TableSession | null {
    for (let seed = 1; seed < 120; seed++) {
      let s = createDefaultSession(seed);
      for (let guard = 0; guard < 20_000; guard++) {
        const st = sessionStatus(s);
        if (st === 'fallen') return s;
        if (st === 'dead' || st === 'tableWon') break;
        if (st === 'aiToAct') s = stepAi(s);
        else if (st === 'humanWindow') s = applyHumanCommand(s, { kind: 'pass' });
        else if (st === 'humanToAct') s = applyHumanCommand(s, { kind: 'act', action: { type: 'allIn' } });
        else if (st === 'humanClaim') {
          const claim = currentClaim(s.claims!)!;
          if (claim.stage === 'counter') s = applyClaim(s, { kind: 'answerCounter', accept: true });
          else {
            const usable = pactOptions(s.claims!, s.world).filter((o) => !o.blocker);
            if (s.world.characters[claim.debtor].kind !== 'human') s = applyClaim(s, { kind: 'claimLife' });
            else if (!usable.length) break;
            else s = applyClaim(s, { kind: 'propose', pact: usable.find((o) => o.pact === 'service')?.pact ?? usable[0].pact });
          }
        } else if (st === 'claimResolved') s = applyClaim(s, { kind: 'acknowledge' });
        else if (st === 'handComplete') s = startNextHand(s);
        else break;
      }
    }
    return null;
  }

  it('a P3 Fallen save resumes at the Registry with exact balances and finishes the route', () => {
    const p3 = p3Fallen();
    expect(p3).not.toBeNull();
    const run = importFallenSession(p3!, 9);
    expect(run.node).toBe('fallen_registry');
    expect(run.accounts.you).toBe(p3!.world.characters[0].offTable);
    assertRunInvariants(run);
    const end = playRun(run, 'passive', 3);
    expect(['fallen_unlocked', 'death']).toContain(end.node);
    // The rescue was never funded twice.
    expect(end.journal.filter((j) => j.reason.includes('endowment'))).toHaveLength(1);
  }, 120_000);

  it('duties progress in order, at most one per hand, with Favor to the creditor exactly once each', () => {
    const p3 = p3Fallen()!;
    let run = importFallenSession(p3, 4);
    // Force a service covenant to Vesper so the duties are exercised.
    const k = run.contracts.at(-1)!;
    run.contracts = run.contracts.map((c) => (c.id === k.id ? { ...c, pact: 'service', creditor: 'vesper', obligation: 0, servicesOwed: 3, status: 'active' } : c));
    run.duties = { contractId: k.id, giver: 'vesper', completed: [], usedEvents: [] };
    expect(activeDuty(run)!.id).toBe('vesper_raise');
    const favor = run.characters.vesper.reputation.favor;
    run = playRun(run, 'maniac', 2);
    const done = run.duties!.completed;
    expect(done).toEqual(['vesper_raise', 'vesper_showdown', 'vesper_rank'].slice(0, done.length));
    expect(new Set(run.duties!.usedEvents).size).toBe(run.duties!.usedEvents.length);
    expect(run.characters.vesper.reputation.favor).toBe(favor + done.length);
  }, 120_000);

  it('replacing a spell keeps the owned instance count', () => {
    const book = createRun(1).player.magic.book;
    const r = replaceInstance(book, book.draw[0].uid, 'twin_oracle');
    expect(r.draw).toHaveLength(8);
  });

  it('a P3 v3 archive imports only when the player left alive, Fallen; anything else is refused', () => {
    const p3 = p3Fallen()!;
    const v3 = structuredClone(p3) as unknown as Record<string, unknown>;
    v3.version = 3;
    delete v3.config;
    delete v3.humanEvents;
    const run = fallenFromSave(JSON.stringify(v3), 5)!;
    expect(run.node).toBe('fallen_registry');
    expect(run.characters.you.socialRank).toBe('FALLEN');
    expect(fallenFromSave(JSON.stringify(createDefaultSession(3)), 5)).toBeNull();
    expect(fallenFromSave('{not json', 5)).toBeNull();
    expect(fallenFromSave(null, 5)).toBeNull();
  }, 120_000);
});

describe('run persistence', () => {
  it('saves and restores a run exactly, and rejects a tampered one', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const run = until(createRun(8), (r) => r.node === 'lantern_shop' || r.node === 'death', 'tight', 8);
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
    const forged = JSON.parse(mem.get('lastWager.run.v1')!);
    forged.accounts.you += 50;
    mem.set('lastWager.run.v1', JSON.stringify(forged));
    expect(loadRun(store)).toBeNull();
  }, 60_000);
});
