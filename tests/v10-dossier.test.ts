import { describe, expect, it } from 'vitest';
import { classifyPreflop, dossierFigures, publicDossier } from '../src/game/ai/calibration';
import { PROFILES, recordReads } from '../src/game/ai';
import { applyAction, startHand } from '../src/game/rules';
import { setup } from './helpers';

/** Seat 0 acts as given preflop; everyone else folds. */
function hand(stacks: number[], first: Parameters<typeof applyAction>[2], button = 2) {
  let s = startHand(setup(stacks, { seed: 3, button }));
  while (s.phase === 'betting' && s.street === 'preflop') {
    const seat = s.toAct!;
    s = applyAction(s, seat, seat === 0 ? first : { type: 'fold' });
  }
  return s;
}

describe('one large-shove definition (design v1.0 §06)', () => {
  it('the dossier and the AI read model classify the same hand history identically', () => {
    const cases = [
      { stacks: [100, 100, 100], act: { type: 'allIn' as const } }, // large shove
      { stacks: [100, 100, 100], act: { type: 'raise' as const, to: 50 } }, // exactly half: large
      { stacks: [100, 100, 100], act: { type: 'raise' as const, to: 49 } }, // just under: not
      { stacks: [6, 100, 100], act: { type: 'allIn' as const } }, // short all-in: all-in, and large vs its own stack
      { stacks: [100, 100, 100], act: { type: 'call' as const } },
    ];
    for (const c of cases) {
      const h = hand(c.stacks, c.act);
      const d = classifyPreflop(h, 0);
      const reads = recordReads({}, h).P0 ?? [];
      expect(d.largeShove).toBe(reads.some(Boolean));
    }
  });

  it('keeps raw types: an all-in is labelled all-in; a big raise that is not all-in is a raise', () => {
    expect(classifyPreflop(hand([100, 100, 100], { type: 'allIn' }), 0).actions).toEqual(['all_in_raise']);
    const raise = classifyPreflop(hand([100, 100, 100], { type: 'raise', to: 60 }), 0);
    expect(raise.actions).toEqual(['raise']);
    expect(raise.largeShove).toBe(true);
  });

  it('a P7 saved dossier keeps its exact figures; new dossiers recompute from the shared predicate', () => {
    const p7 = [
      { hand: 1, actions: ['raise' as const] },
      { hand: 2, actions: ['shove' as const] },
      { hand: 3, actions: ['fold' as const] },
    ];
    expect(dossierFigures(p7)).toEqual({ hands: 3, vpip: 2, pfr: 2, shoves: 1 });
    const d = publicDossier(PROFILES.livia_shade, [PROFILES.witness_arden, PROFILES.isolde_morn], 12, 77);
    expect(d.rule).toBe(2);
    expect(dossierFigures(d.records)).toEqual({ hands: d.hands, vpip: d.vpip, pfr: d.pfr, shoves: d.shoves });
    expect(d.records.every((r) => typeof r.largeShove === 'boolean')).toBe(true);
  });
});
