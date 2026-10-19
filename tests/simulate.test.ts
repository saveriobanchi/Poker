import { describe, expect, it } from 'vitest';
import { simulateRuns } from '../src/game/run/simulate';

describe('batch run simulation', () => {
  it('plays seeded runs for every policy to an ending with the invariant checked at every step', () => {
    const r = simulateRuns(24, 3);
    expect(Object.values(r.policies).map((p) => p.runs)).toEqual([6, 6, 6, 6]);
    expect(r.invariantChecks).toBeGreaterThan(1000);
    expect(r.claims.total).toBeGreaterThan(0);
    expect(r.aiCastsPer100Hands).toBeGreaterThan(0);
    const strip = (x: ReturnType<typeof simulateRuns>) => JSON.stringify(x, (k, v) => (k === 'avgMs' ? 0 : v));
    expect(strip(simulateRuns(8, 3))).toBe(strip(simulateRuns(8, 3)));
  }, 120_000);
});
