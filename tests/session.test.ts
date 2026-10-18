import { describe, expect, it } from 'vitest';
import {
  applyClaim,
  applyHumanCommand,
  createDefaultSession,
  type KeyValueStore,
  loadSession,
  SAVE_KEY,
  saveSession,
  sessionStatus,
  startNextHand,
  stepAi,
  tableStacks,
  type TableSession,
} from '../src/game/table/session';
import { getLegalActions } from '../src/game/rules';
import { assertWorldInvariants, currentClaim, pactOptions, roles } from '../src/game/world';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

type HumanPolicy = 'passive' | 'shove';

/** Advances one step: AI turn, human poker turn by policy, human claim decision, or acknowledgement. */
function step(s: TableSession, policy: HumanPolicy, claimChoice: 'bargain' | 'fate' = 'bargain'): TableSession {
  switch (sessionStatus(s)) {
    case 'aiToAct':
      return stepAi(s);
    case 'humanWindow':
      return applyHumanCommand(s, { kind: 'pass' });
    case 'humanToAct': {
      if (policy === 'shove') return applyHumanCommand(s, { kind: 'act', action: { type: 'allIn' } });
      const legal = getLegalActions(s.table.hand)!;
      return applyHumanCommand(s, { kind: 'act', action: legal.canCheck ? { type: 'check' } : { type: 'call' } });
    }
    case 'humanClaim': {
      const claim = currentClaim(s.claims!)!;
      if (claim.stage === 'counter') return applyClaim(s, { kind: 'answerCounter', accept: true });
      const usable = pactOptions(s.claims!, s.world).filter((o) => !o.blocker);
      const humanIsDebtor = s.world.characters[claim.debtor].kind === 'human';
      if (claimChoice === 'fate' || usable.length === 0) return applyClaim(s, { kind: humanIsDebtor ? 'acceptFate' : 'claimLife' });
      return applyClaim(s, { kind: 'propose', pact: usable[0].pact });
    }
    case 'claimResolved':
      return applyClaim(s, { kind: 'acknowledge' });
    case 'handComplete':
      return startNextHand(s);
    default:
      throw new Error(`terminal: ${sessionStatus(s)}`);
  }
}

const TERMINAL = new Set(['dead', 'fallen', 'tableWon']);

function playOutHand(s: TableSession, policy: HumanPolicy = 'passive'): TableSession {
  const hand = s.handNumber;
  for (let guard = 0; guard < 400; guard++) {
    if (TERMINAL.has(sessionStatus(s)) || (sessionStatus(s) === 'handComplete' && s.handNumber === hand)) return s;
    s = step(s, policy);
  }
  throw new Error('hand did not finish');
}

describe('table session', () => {
  it('plays consecutive hands with a moving button and conserved chips', () => {
    let s = createDefaultSession(123);
    const buttons: number[] = [];
    for (let i = 0; i < 12 && !TERMINAL.has(sessionStatus(s)); i++) {
      buttons.push(s.table.hand.button);
      s = playOutHand(s);
      assertWorldInvariants(s.world, tableStacks(s));
      expect(s.history.at(-1)!.handNumber).toBe(s.handNumber);
      if (sessionStatus(s) === 'handComplete') s = startNextHand(s);
    }
    expect(new Set(buttons).size).toBeGreaterThan(1);
  });

  it('AI turns are deterministic for a given session state', () => {
    const s = createDefaultSession(77);
    let a = s;
    let b = structuredClone(s);
    for (let i = 0; i < 3; i++) {
      if (sessionStatus(a) !== 'aiToAct') break;
      a = stepAi(a);
      b = stepAi(b);
    }
    expect(b).toEqual(a);
  });

  it('a saved mid-hand session restores exactly and continues identically', () => {
    const store = memoryStore();
    let s = createDefaultSession(2026);
    while (sessionStatus(s) === 'aiToAct') s = stepAi(s);
    saveSession(store, s);
    const restored = loadSession(store)!;
    expect(restored).toEqual(s);
    expect(playOutHand(restored)).toEqual(playOutHand(s));
  });

  it('rejects corrupted or tampered saves', () => {
    const store = memoryStore();
    saveSession(store, createDefaultSession(1));
    const data = JSON.parse(store.data.get(SAVE_KEY)!);
    data.table.hand.seats[0].stack += 50;
    store.setItem(SAVE_KEY, JSON.stringify(data));
    expect(loadSession(store)).toBeNull();
    const data2 = JSON.parse(JSON.stringify(createDefaultSession(1)));
    data2.world.treasury += 5;
    store.setItem(SAVE_KEY, JSON.stringify(data2));
    expect(loadSession(store)).toBeNull();
    store.setItem(SAVE_KEY, '{not json');
    expect(loadSession(store)).toBeNull();
  });
});

describe('Last Claim in the session', () => {
  /** Shoves every hand until the player busts or the table ends. */
  function untilHumanClaim(seed: number): TableSession | null {
    let s = createDefaultSession(seed);
    for (let guard = 0; guard < 5000; guard++) {
      const st = sessionStatus(s);
      if (st === 'humanClaim' && s.world.characters[currentClaim(s.claims!)!.debtor].kind === 'human') return s;
      if (TERMINAL.has(st)) return null;
      s = step(s, 'shove');
    }
    return null;
  }

  function findHumanBust(): TableSession {
    for (let seed = 1; seed < 60; seed++) {
      const s = untilHumanClaim(seed);
      if (s) return s;
    }
    throw new Error('no human bust found');
  }

  it('interrupts before the next hand; accepting fate ends the run', () => {
    let s = findHumanBust();
    expect(s.table.hand.phase).toBe('complete');
    expect(tableStacks(s)[0]).toBe(0);
    expect(() => startNextHand(s)).toThrow();
    expect(() => applyHumanCommand(s, { kind: 'act', action: { type: 'check' } })).toThrow();
    s = applyClaim(s, { kind: 'acceptFate' });
    expect(sessionStatus(s)).toBe('claimResolved');
    s = applyClaim(s, { kind: 'acknowledge' });
    while (sessionStatus(s) === 'claimResolved') s = applyClaim(s, { kind: 'acknowledge' });
    expect(sessionStatus(s)).toBe('dead');
    expect(s.world.characters[0]).toMatchObject({ alive: false });
  });

  it('a saved pending claim resumes once; reloading cannot change the answer', () => {
    const store = memoryStore();
    const s = findHumanBust();
    saveSession(store, s);
    const usable = pactOptions(s.claims!, s.world).filter((o) => !o.blocker);
    if (usable.length === 0) return; // claimant cannot fund anything: nothing to compare
    const a = applyClaim(s, { kind: 'propose', pact: usable[0].pact });
    const b = applyClaim(loadSession(store)!, { kind: 'propose', pact: usable[0].pact });
    expect(b).toEqual(a);
    saveSession(store, a);
    expect(loadSession(store)).toEqual(a);
  });

  it('a funded survival leaves the table as Fallen, with the funder debited exactly once', () => {
    for (let seed = 1; seed < 80; seed++) {
      let s = untilHumanClaim(seed);
      if (!s) continue;
      const claim = currentClaim(s.claims!)!;
      const usable = pactOptions(s.claims!, s.world).filter((o) => !o.blocker);
      if (!usable.length || claim.claimant.kind !== 'seat') continue;
      const funder = claim.claimant.seat;
      const before = tableStacks(s)[funder];
      for (const o of usable) {
        const tryIt = applyClaim(s, { kind: 'propose', pact: o.pact });
        const c = currentClaim(tryIt.claims!) ?? tryIt.claims!.claims.find((x) => x.id === claim.id)!;
        if (c.outcome?.kind === 'survival' || c.stage === 'counter') {
          s = c.stage === 'counter' ? applyClaim(tryIt, { kind: 'answerCounter', accept: true }) : tryIt;
          break;
        }
      }
      const resolved = s.claims!.claims.find((x) => x.id === claim.id)!;
      if (resolved.outcome?.kind !== 'survival') continue;
      expect(tableStacks(s)[funder]).toBe(before - resolved.outcome.endowment);
      while (sessionStatus(s) === 'claimResolved' || sessionStatus(s) === 'humanClaim') s = step(s, 'passive');
      expect(sessionStatus(s)).toBe('fallen');
      expect(s.world.characters[0]).toMatchObject({ socialRank: 'FALLEN', status: 'exited', pendingNode: 'FALLEN_RECOVERY' });
      expect(() => startNextHand(s)).toThrow();
      assertWorldInvariants(s.world, tableStacks(s));
      return;
    }
    throw new Error('no survivable claim found in the sampled seeds');
  });

  it('whole tables with claims keep the world ledger balanced; departed seats never play again', () => {
    let claimsSeen = 0;
    for (let seed = 100; seed < 130; seed++) {
      let s = createDefaultSession(seed);
      for (let guard = 0; guard < 20_000 && !TERMINAL.has(sessionStatus(s)); guard++) {
        const st = sessionStatus(s);
        if (st === 'humanClaim' || st === 'claimResolved') claimsSeen++;
        if (st === 'handComplete') {
          const next = startNextHand(s);
          next.world.characters.forEach((c, i) => {
            if (c.status !== 'seated') expect(next.table.hand.seats[i].inHand).toBe(false);
          });
          s = next;
          continue;
        }
        s = step(s, seed % 2 ? 'shove' : 'passive', seed % 3 ? 'bargain' : 'fate');
        if (s.table.hand.phase === 'complete') assertWorldInvariants(s.world, tableStacks(s));
      }
      expect(TERMINAL.has(sessionStatus(s))).toBe(true);
    }
    expect(claimsSeen).toBeGreaterThan(30);
  }, 120_000);

  it('only claims the player is party to wait for the player’s decision', () => {
    let s = createDefaultSession(5);
    for (let guard = 0; guard < 20_000 && !TERMINAL.has(sessionStatus(s)); guard++) {
      if (sessionStatus(s) === 'humanClaim') expect(roles(s.world, currentClaim(s.claims!)!).humanInvolved).toBe(true);
      s = step(s, 'shove');
    }
  });
});
