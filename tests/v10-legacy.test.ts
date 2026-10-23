import { describe, expect, it } from 'vitest';
import { allCards } from '../src/game/magic';
import { step } from '../src/game/run/driver';
import { type Legacy, recordEnding } from '../src/game/run/legacy';
import { type BackgroundId, backStates, choosePresentation, unlockedBackgrounds, unlockedVariants } from '../src/game/run/presentation';
import { createRun, type RunState } from '../src/game/run/run';
import { Rng } from '../src/game/rules';

/** A testament that has unlocked every background and every variant. */
function fullTestament(): Legacy {
  const mk = (seed: number, node: string, fate: string, fell = false): RunState => {
    const r = createRun(seed);
    r.node = node as RunState['node'];
    r.flags.push(`fate:${fate}`);
    if (fell) r.results.push({ node: 'contract_1', outcome: 'fallen', standings: [], net: 0, hands: 3, repayment: 0 });
    return r;
  };
  let l: Legacy = { version: 1, entries: [] };
  for (const r of [mk(1, 'the_unchosen_road', 'retire'), mk(2, 'under_living_end', 'honor_contract', true), mk(3, 'the_ledger_unbound', 'reform')]) l = recordEnding(l, r);
  return l;
}

/** The full trajectory of a scripted run: every state, hashed by its JSON. */
function trajectory(seed: number): string[] {
  let run = createRun(seed);
  const rng = new Rng(seed);
  const out = [JSON.stringify(run)];
  for (let i = 0; i < 3000; i++) {
    const next = step(run, 'skilled', rng);
    if (!next) break;
    run = next;
    out.push(JSON.stringify(run));
  }
  return out;
}

describe('World Testament fairness (design v1.0 §04, §09)', () => {
  it('unlocks all four backgrounds and both variants from the testament, never anything else', () => {
    const l = fullTestament();
    expect(unlockedBackgrounds(l)).toEqual(['unmarked', 'exiled_heir', 'cinder_bound', 'ledger_witness']);
    expect(unlockedVariants(l)).toEqual(['arrival_echo', 'cinder_gossip']);
    expect(unlockedBackgrounds({ version: 1, entries: [] })).toEqual(['unmarked']);
    // Cosmetic backs unlock but stay unusable until their art exists.
    expect(backStates(l).map((b) => [b.id, b.unlocked, b.artReady])).toEqual([
      ['standard', true, true],
      ['cinder_etch', true, false],
      ['crown_filigree', true, false],
    ]);
    expect(choosePresentation(5, l, 'unmarked', 'crown_filigree').back).toBe('standard');
  });

  it('every background starts from the identical run: 100 Lifechips, the 2/2/2/2 book, the same RNG', () => {
    const l = fullTestament();
    const base = JSON.stringify(createRun(4242));
    for (const bg of unlockedBackgrounds(l)) {
      const p = choosePresentation(4242, l, bg as BackgroundId);
      expect(p.background).toBe(bg);
      const run = createRun(4242);
      expect(JSON.stringify(run)).toBe(base);
      expect(run.accounts.you).toBe(100);
      const counts: Record<string, number> = {};
      for (const c of allCards(run.player.magic.book)) counts[c.spell] = (counts[c.spell] ?? 0) + 1;
      expect(counts).toEqual({ cinder_challenge: 2, unmask: 2, briar_lock: 2, fate_exchange: 2 });
    }
  });

  it('a scripted run is byte-identical state by state whatever the background, back or testament', () => {
    const plain = trajectory(99);
    const l = fullTestament();
    for (const bg of unlockedBackgrounds(l)) {
      choosePresentation(99, l, bg as BackgroundId, 'standard');
      expect(trajectory(99)).toEqual(plain);
    }
    expect(plain.length).toBeGreaterThan(50);
  }, 240_000);

  it('the archive is append-once per character; a repeated commit adds nothing and the fate is set once', () => {
    const r = createRun(8);
    r.node = 'the_unchosen_road';
    let l = recordEnding({ version: 1, entries: [] }, r);
    l = recordEnding(l, r);
    expect(l.entries).toHaveLength(1);
    expect(l.entries[0].id).toBe('wagerer-8');
    r.flags.push('fate:retire');
    l = recordEnding(l, r);
    expect(l.entries[0].fate).toBe('retire');
    const changed = structuredClone(r);
    changed.flags = changed.flags.filter((f) => f !== 'fate:retire').concat('fate:keep_wagering_in_future_content');
    expect(recordEnding(l, changed).entries[0].fate).toBe('retire');
    // An old run's ending never alters a new run with the same seed.
    expect(JSON.stringify(createRun(8))).toBe(JSON.stringify(createRun(8)));
  });
});

describe('World Testament isolation (structural)', () => {
  it('no rules, AI, magic, table or run module imports the testament or presentation layer', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const allowed = new Set(['src/game/run/legacy.ts', 'src/game/run/presentation.ts']);
    const offenders = walk('src/game')
      .filter((f) => f.endsWith('.ts') && !allowed.has(f))
      .filter((f) => /from '\.\/(legacy|presentation)'|from '\.\.\/run\/(legacy|presentation)'/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('cosmetic card backs (design v1.1 §07, visual direction v1.2)', () => {
  it('a back is choosable only when unlocked by the testament and packed by the art gate', () => {
    const l = fullTestament();
    expect(backStates(l, ['cinder_etch']).map((b) => [b.id, b.unlocked, b.artReady])).toEqual([
      ['standard', true, true],
      ['cinder_etch', true, true],
      ['crown_filigree', true, false],
    ]);
    expect(choosePresentation(5, l, 'unmarked', 'cinder_etch', ['cinder_etch']).back).toBe('cinder_etch');
    expect(choosePresentation(5, l, 'unmarked', 'crown_filigree', ['cinder_etch']).back).toBe('standard');
    // Not unlocked: an empty testament cannot use a packed back.
    expect(choosePresentation(5, { version: 1, entries: [] }, 'unmarked', 'cinder_etch', ['cinder_etch']).back).toBe('standard');
  });

  it('the chosen back never reaches the run: a run plays byte-identically whatever back is chosen', () => {
    const l = fullTestament();
    const plain = trajectory(31);
    for (const back of ['cinder_etch', 'crown_filigree'] as const) {
      choosePresentation(31, l, 'unmarked', back, ['cinder_etch', 'crown_filigree']);
      expect(trajectory(31)).toEqual(plain);
    }
  }, 240_000);
});
