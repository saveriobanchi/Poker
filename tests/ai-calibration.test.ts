import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/game/ai';
import { measureStyles } from '../src/game/ai/calibration';
import opponents from '../src/game/run/data/p4-opponents.json';
import act2 from '../src/game/run/data/p5-act2-route.json';

const TARGETS: Record<string, { vpip: number; pfr: number }> = Object.fromEntries([
  ...opponents.opponents.map((o) => [o.id, { vpip: o.vpip_target, pfr: o.pfr_target }]),
  ...act2.adversaries.map((a) => [a.id, { vpip: a.target_vpip, pfr: a.target_pfr }]),
]);

/** A disciplined stand-in for the player's seat. */
const player = { ...PROFILES.corvin, id: 'player', looseness: 0.35, aggression: 0.6 };
const TABLES = [
  { ids: ['mara_quill', 'eldric_vale'], stacks: [100, 110, 95], bb: 2 },
  { ids: ['bailiff_sable', 'sister_rill'], stacks: [100, 145, 115], bb: 4 },
  { ids: ['isolde_morn', 'ravel_croft', 'vesa_kael'], stacks: [100, 140, 125, 135], bb: 4 },
  { ids: ['witness_arden', 'livia_shade'], stacks: [100, 160, 145], bb: 4 },
  { ids: ['margrave_noct', 'aurelia_ash'], stacks: [100, 190, 155], bb: 6 },
];

describe('rival styles (design v0.6 §07, v0.7 §09)', () => {
  it('measured VPIP/PFR over >=10,000 opportunities land within 3 points of the targets', () => {
    const report: string[] = [];
    for (const t of TABLES) {
      const m = measureStyles([player, ...t.ids.map((id) => PROFILES[id])], t.stacks, t.bb, 12_000, 11);
      for (const id of t.ids) {
        const target = TARGETS[id];
        const got = m[id];
        expect(got.opportunities).toBeGreaterThanOrEqual(10_000);
        report.push(`${id} vpip ${got.vpip.toFixed(3)} (${target.vpip}) pfr ${got.pfr.toFixed(3)} (${target.pfr})`);
        expect(Math.abs(got.vpip - target.vpip)).toBeLessThan(0.03);
        expect(Math.abs(got.pfr - target.pfr)).toBeLessThan(0.03);
      }
    }
    console.log(report.join('\n'));
  }, 120_000);
});
