import { describe, expect, it } from 'vitest';
import { getMagicView } from '../src/game/magic/table';
import { MIXED, playRun, POLICIES } from '../src/game/run/driver';
import { createRun } from '../src/game/run/run';
import { clusterBootstrap, tablePairsAt } from '../src/game/run/tableEv';
import { humanSeat, sessionStatus } from '../src/game/table/session';
import { until } from './runHelpers';

describe('full-table counterfactual spell value (design v1.0 §01)', () => {
  it('continues both arms to table end from the untouched run state, deterministically', () => {
    const run = until(
      createRun(5),
      (r) => !!r.table && ['humanWindow', 'humanToAct'].includes(sessionStatus(r.table)) && getMagicView(r.table.table, humanSeat(r.table)).options.length > 0,
      'skilled',
      5,
    );
    const before = JSON.stringify(run);
    const a = tablePairsAt(run, ['skilled', 'mixed_aggressive'], 99, 1);
    expect(JSON.stringify(run)).toBe(before);
    expect(a.pairs.length).toBeGreaterThan(0);
    expect(a.incompatible).toBe(0);
    expect(tablePairsAt(run, ['skilled', 'mixed_aggressive'], 99, 1)).toEqual(a);
  });

  it('cluster bootstrap counts clusters and brackets the mean', () => {
    const s = clusterBootstrap([1, 2, 3, 4, -1, 0, 6, 2].map((v, i) => ({ cluster: i % 3, v })), 7);
    expect(s.clusters).toBe(3);
    expect(s.n).toBe(8);
    expect(s.ci95[0]).toBeLessThanOrEqual(s.mean);
    expect(s.ci95[1]).toBeGreaterThanOrEqual(s.mean);
  });

  it('the mixed-aggressive policy is a distinct, finite policy', () => {
    expect(POLICIES).toContain('mixed_aggressive');
    expect(MIXED.aggression).toBeGreaterThan(0.8);
    const end = playRun(createRun(11), 'mixed_aggressive', 11);
    expect(end.table).toBeNull();
  });
});
