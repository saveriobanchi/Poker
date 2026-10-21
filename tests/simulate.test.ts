import { describe, expect, it } from 'vitest';
import { simulateRuns } from '../src/game/run/simulate';

describe('batch run simulation', () => {
  it('plays seeded runs for every policy to an ending with the invariant checked at every step', () => {
    const r = simulateRuns(25, 3);
    expect(Object.values(r.policies).map((p) => p.runs)).toEqual([5, 5, 5, 5, 5]);
    expect(r.invariantChecks).toBeGreaterThan(1000);
    expect(r.claims.total).toBeGreaterThan(0);
    expect(r.aiCastsPer100Hands).toBeGreaterThan(0);
    const strip = (x: ReturnType<typeof simulateRuns>) => JSON.stringify(x, (k, v) => (k === 'avgMs' ? 0 : v));
    expect(strip(simulateRuns(10, 3))).toBe(strip(simulateRuns(10, 3)));
  }, 120_000);
});
