import { describe, expect, it } from 'vitest';
import {
  applyHumanAction,
  createDefaultSession,
  KeyValueStore,
  loadSession,
  SAVE_KEY,
  saveSession,
  sessionStatus,
  startNextHand,
  stepAi,
  TableSession,
} from '../src/game/table/session';
import { getLegalActions } from '../src/game/rules';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Human checks or calls; AIs act; returns when the hand finishes. */
function playOutHand(s: TableSession): TableSession {
  for (let guard = 0; guard < 200; guard++) {
    const status = sessionStatus(s);
    if (status === 'aiToAct') s = stepAi(s);
    else if (status === 'humanToAct') {
      const legal = getLegalActions(s.hand)!;
      s = applyHumanAction(s, legal.canCheck ? { type: 'check' } : { type: 'call' });
    } else return s;
  }
  throw new Error('hand did not finish');
}

describe('table session', () => {
  it('plays consecutive hands with a moving button and conserved chips', () => {
    let s = createDefaultSession(123);
    const buttons: number[] = [];
    for (let i = 0; i < 12 && sessionStatus(s) !== 'humanBusted' && sessionStatus(s) !== 'tableWon'; i++) {
      buttons.push(s.hand.button);
      s = playOutHand(s);
      expect(s.hand.seats.reduce((a, p) => a + p.stack, 0)).toBe(410);
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
    data.hand.seats[0].stack += 50;
    store.setItem(SAVE_KEY, JSON.stringify(data));
    expect(loadSession(store)).toBeNull();
    store.setItem(SAVE_KEY, '{not json');
    expect(loadSession(store)).toBeNull();
  });

  it('reports a busted human before any next hand can start', () => {
    let s = createDefaultSession(5);
    s = structuredClone(s);
    // Force the end state: the human has no chips after a settled hand.
    for (let guard = 0; guard < 20_000 && sessionStatus(s) !== 'humanBusted' && sessionStatus(s) !== 'tableWon'; guard++) {
      const status = sessionStatus(s);
      if (status === 'aiToAct') s = stepAi(s);
      else if (status === 'humanToAct') s = applyHumanAction(s, { type: 'allIn' });
      else s = startNextHand(s);
    }
    expect(['humanBusted', 'tableWon']).toContain(sessionStatus(s));
    if (sessionStatus(s) === 'humanBusted') {
      expect(s.hand.result!.zeroChipSeats.some((z) => z.seat === 0)).toBe(true);
      expect(() => startNextHand(s)).toThrow();
    }
  });
});
