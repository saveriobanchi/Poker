import { describe, expect, it } from 'vitest';
import { getMagicView } from '../src/game/magic/table';
import { bootstrapMean, pairsAt } from '../src/game/run/spellEv';
import { createRun } from '../src/game/run/run';
import { humanSeat, sessionStatus } from '../src/game/table/session';
import { until } from './runHelpers';

describe('counterfactual spell EV (design v0.9)', () => {
  it('pairs cast and skip from the same cloned state without touching it, deterministically', () => {
    const run = until(
      createRun(5),
      (r) => !!r.table && ['humanWindow', 'humanToAct'].includes(sessionStatus(r.table)) && getMagicView(r.table.table, humanSeat(r.table)).options.length > 0,
      'skilled',
      5,
    );
    const t = run.table!;
    const before = JSON.stringify(t);
    const a = pairsAt(t, ['skilled', 'tight'], 99);
    expect(JSON.stringify(t)).toBe(before);
    expect(a.pairs.length).toBeGreaterThan(0);
    expect(a.incompatible).toBe(0);
    expect(pairsAt(t, ['skilled', 'tight'], 99)).toEqual(a);
    for (const p of a.pairs) expect(p.diff).toBe(p.castNet - p.skipNet);
  });

  it('bootstrap intervals bracket the mean', () => {
    const b = bootstrapMean([1, 2, 3, 4, 5, -2, 0, 7], 3);
    expect(b.mean).toBeCloseTo(2.5);
    expect(b.ci95[0]).toBeLessThanOrEqual(b.mean);
    expect(b.ci95[1]).toBeGreaterThanOrEqual(b.mean);
  });
});
