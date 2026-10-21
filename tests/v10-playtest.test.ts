import { describe, expect, it } from 'vitest';
import { loadPlaytestLog, Playtest, PLAYTEST_FLAG_KEY, playtestEnabled, summarizePlaytest } from '../src/ui/playtest';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('playtest instrumentation (design v1.0 §11)', () => {
  it('is off by default, opted in by ?playtest=1 and out by ?playtest=0', () => {
    const s = memory();
    expect(playtestEnabled('', s)).toBe(false);
    expect(playtestEnabled('?playtest=1', s)).toBe(true);
    expect(playtestEnabled('', s)).toBe(true);
    expect(playtestEnabled('?playtest=0', s)).toBe(false);
    expect(s.getItem(PLAYTEST_FLAG_KEY)).toBeNull();
  });

  it('measures first legal action, decisions, reloads and feedback checkpoints once each', () => {
    const s = memory();
    let now = 0;
    const p = new Playtest(s, () => now, '390x844@3', false, '2026-01-01T00:00:00Z');
    now = 1000;
    p.turnShown();
    now = 5200;
    p.acted('call');
    p.turnShown();
    now = 6200;
    p.acted('fold');
    p.record('allin_confirm_shown', { kind: 'raise' });
    p.record('allin_confirm_cancelled', { kind: 'raise' });
    expect(p.dueFeedback()).toBeNull();
    now = 15 * 60_000;
    expect(p.dueFeedback()).toBe(15);
    expect(p.dueFeedback()).toBeNull();
    now = 46 * 60_000;
    expect(p.dueFeedback()).toBe(45);
    new Playtest(s, () => 0, '320x568@2', true, '2026-01-01T01:00:00Z');
    const sum = summarizePlaytest(loadPlaytestLog(s));
    expect(sum.pageLoads).toBe(2);
    expect(sum.reloads).toBe(1);
    expect(sum.firstLegalActionMs).toEqual([4200, null]);
    expect(sum.decisions).toBe(2);
    expect(sum.allInConfirmsCancelled).toBe(1);
  });

  it('never records card or spell identities', () => {
    const s = memory();
    const p = new Playtest(s, () => 0, '390x844@3', false, 'x');
    p.turnShown();
    p.acted('raise');
    expect(s.m.get('lastWager.playtest.log.v1')).not.toMatch(/hole|board|spell_id|card/);
  });
});
