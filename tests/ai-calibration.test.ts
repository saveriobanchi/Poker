import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/game/ai';
import { measureStyles } from '../src/game/ai/calibration';
import opponents from '../src/game/run/data/p4-opponents.json';

/** A disciplined stand-in for the player's seat. */
const player = { ...PROFILES.corvin, id: 'player', looseness: 0.35, aggression: 0.6 };
const TABLES = [
  { ids: ['mara_quill', 'eldric_vale'], stacks: [100, 110, 95], bb: 2 },
  { ids: ['bailiff_sable', 'sister_rill'], stacks: [100, 145, 115], bb: 4 },
];

describe('P4 rival styles (design v0.6 §07)', () => {
  it('measured VPIP/PFR over >=10,000 opportunities land within 3 points of the targets', () => {
    const report: string[] = [];
    for (const t of TABLES) {
      const m = measureStyles([player, ...t.ids.map((id) => PROFILES[id])], t.stacks, t.bb, 12_000, 11);
      for (const id of t.ids) {
        const target = opponents.opponents.find((o) => o.id === id)!;
        const got = m[id];
        expect(got.opportunities).toBeGreaterThanOrEqual(10_000);
        report.push(`${id} vpip ${got.vpip.toFixed(3)} (${target.vpip_target}) pfr ${got.pfr.toFixed(3)} (${target.pfr_target})`);
        expect(Math.abs(got.vpip - target.vpip_target)).toBeLessThan(0.03);
        expect(Math.abs(got.pfr - target.pfr_target)).toBeLessThan(0.03);
      }
    }
    console.log(report.join('\n'));
  }, 120_000);
});
