import { describe, expect, it } from 'vitest';
import { legacyIntro, loadLegacy, recordEnding, saveLegacy } from '../src/game/run/legacy';
import { merchantLine } from '../src/game/run/merchants';
import { createRun } from '../src/game/run/run';

describe('world testament (design v0.9 legacy)', () => {
  it('archives an ending once per character, updates its fate, and never touches a new run', () => {
    const fresh = createRun(42);
    const run = createRun(7);
    run.node = 'the_ledger_unbound';
    run.flags.push('fate:reform');
    let legacy = recordEnding(loadLegacy({ getItem: () => null, setItem: () => undefined }), run);
    legacy = recordEnding(legacy, run);
    expect(legacy.entries).toHaveLength(1);
    expect(legacy.entries[0]).toMatchObject({ ending: 'the_ledger_unbound', fate: 'reform', lifechips: 100 });
    expect(legacyIntro(legacy)).toMatch(/reforms/);
    const mem = new Map<string, string>();
    saveLegacy({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) }, legacy);
    expect(loadLegacy({ getItem: (k) => mem.get(k) ?? null, setItem: () => undefined })).toEqual(legacy);
    // A new character is created exactly as without any legacy.
    expect(createRun(42)).toEqual(fresh);
    // Runs still in progress are not archived.
    expect(recordEnding(legacy, createRun(8)).entries).toHaveLength(1);
  });

  it('merchant dialogue reflects temperament and never moves a chip', () => {
    const run = createRun(3);
    const before = JSON.stringify(run);
    expect(merchantLine(run, 'selene')).toMatch(/You hold 100/);
    expect(merchantLine(run, 'merchant_wisp')).toMatch(/Unbound/);
    expect(JSON.stringify(run)).toBe(before);
  });
});
