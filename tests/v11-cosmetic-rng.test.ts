import { afterEach, describe, expect, it, vi } from 'vitest';
import { step } from '../src/game/run/driver';
import { type Legacy } from '../src/game/run/legacy';
import { backgroundIntro, cinderGossip, choosePresentation, unlockedBackgrounds } from '../src/game/run/presentation';
import { createRun } from '../src/game/run/run';
import { Rng } from '../src/game/rules/rng';

const testament: Legacy = {
  version: 1,
  entries: [
    { id: 'wagerer-1', seed: 1, ending: 'the_unchosen_road', fate: 'retire', chapters: [], lifechips: 50, tablesPlayed: 5, debtsOutstanding: 0 },
    { id: 'wagerer-2', seed: 2, fell: true, ending: 'under_living_end', fate: 'honor_contract', chapters: [], lifechips: 20, tablesPlayed: 6, debtsOutstanding: 1 },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('cosmetic seed reads never advance game randomness (design v1.1 approvals)', () => {
  it('choosing the presentation and its prose draws nothing from any Rng', () => {
    const ints = vi.spyOn(Rng.prototype, 'nextInt');
    const floats = vi.spyOn(Rng.prototype, 'nextFloat');
    for (let seed = 0; seed < 200; seed++) {
      for (const bg of unlockedBackgrounds(testament)) {
        const p = choosePresentation(seed, testament, bg);
        backgroundIntro(p);
        cinderGossip(p, testament);
      }
    }
    expect(ints).not.toHaveBeenCalled();
    expect(floats).not.toHaveBeenCalled();
  });

  it('the variant depends only on seed parity, and the run plays identically before and after reading it', () => {
    const a = choosePresentation(10, testament).variant;
    const b = choosePresentation(12, testament).variant;
    const c = choosePresentation(11, testament).variant;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    const play = (read: boolean) => {
      let run = createRun(77);
      const rng = new Rng(77);
      const states: string[] = [];
      for (let i = 0; i < 400; i++) {
        if (read) choosePresentation(run.seed, testament);
        const next = step(run, 'skilled', rng);
        if (!next) break;
        run = next;
        states.push(JSON.stringify(run));
      }
      return states;
    };
    expect(play(true)).toEqual(play(false));
  });
});
