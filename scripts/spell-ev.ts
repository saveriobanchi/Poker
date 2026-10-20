/**
 * Usage: npm run spell-ev [-- batches runsPerBatch label]
 * Offline paired spell-value study (design v0.9). Each batch plays seeded skilled
 * runs as the source of legally reached states; at every player decision with a
 * castable spell, every spell is compared cast-vs-skip under three downstream
 * policies. Writes docs/reports/spell-ev-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { getMagicView } from '../src/game/magic/table';
import { step, type PolicyName } from '../src/game/run/driver';
import { createRun, type RunState } from '../src/game/run/run';
import { bootstrapMean, type PairOutcome, pairsAt } from '../src/game/run/spellEv';
import { Rng } from '../src/game/rules/rng';
import { humanSeat, sessionStatus } from '../src/game/table/session';

const DOWNSTREAM: PolicyName[] = ['skilled', 'tight', 'maniac'];

interface BatchResult {
  pairs: PairOutcome[];
  incompatible: number;
  offered: Record<string, number>;
  chosen: Record<string, number>;
}

function runBatch(batch: number, runs: number): BatchResult {
  const out: BatchResult = { pairs: [], incompatible: 0, offered: {}, chosen: {} };
  for (let k = 0; k < runs; k++) {
    const seed = (2000 + batch) * 100_003 + k;
    let run: RunState = createRun(seed);
    const rng = new Rng(seed ^ 0x77);
    for (let guard = 0; guard < 80_000; guard++) {
      const t = run.table;
      let offeredHere: string[] = [];
      if (t) {
        const st = sessionStatus(t);
        if (st === 'humanWindow' || st === 'humanToAct') {
          const me = humanSeat(t);
          offeredHere = [...new Set(getMagicView(t.table, me).options.map((o) => o.spell))];
          if (offeredHere.length) {
            const r = pairsAt(t, DOWNSTREAM, seed * 31 + guard);
            out.pairs.push(...r.pairs);
            out.incompatible += r.incompatible;
          }
        }
      }
      const before = run.table?.table.magic.events.length ?? 0;
      const next = step(run, 'skilled', rng);
      if (!next) break;
      for (const s of offeredHere) out.offered[s] = (out.offered[s] ?? 0) + 1;
      if (t && next.table && next.tableNode === run.tableNode && next.table.handNumber === t.handNumber) {
        const me = humanSeat(next.table);
        for (const e of next.table.table.magic.events.slice(before)) if (e.seat === me) out.chosen[e.spell] = (out.chosen[e.spell] ?? 0) + 1;
      }
      run = next;
    }
  }
  return out;
}

if (!isMainThread) {
  const { batch, runs } = workerData as { batch: number; runs: number };
  parentPort!.postMessage(runBatch(batch, runs));
} else {
  const batches = Number(process.argv[2] ?? 10);
  const runs = Number(process.argv[3] ?? 40);
  const label = process.argv[4] ?? 'p7';
  const t0 = performance.now();
  const queue = Array.from({ length: batches }, (_, b) => b);
  const results: BatchResult[] = [];
  const self = new URL(import.meta.url);
  await Promise.all(
    Array.from({ length: Math.min(batches, availableParallelism()) }, async () => {
      for (let b = queue.shift(); b !== undefined; b = queue.shift()) {
        results[b] = await new Promise<BatchResult>((resolve, reject) => {
          const w = new Worker(self, { workerData: { batch: b, runs } });
          w.once('message', resolve);
          w.once('error', reject);
        });
        console.error(`batch ${b} done`);
      }
    }),
  );
  const pairs = results.flatMap((r) => r.pairs);
  const group = <K extends string>(key: (p: PairOutcome) => K) => {
    const m = new Map<K, PairOutcome[]>();
    for (const p of pairs) m.set(key(p), [...(m.get(key(p)) ?? []), p]);
    return m;
  };
  const summarize = (list: PairOutcome[], seed: number) => {
    const s = bootstrapMean(list.map((p) => p.diff), seed);
    const rate = (f: (p: PairOutcome) => boolean) => +(list.filter(f).length / Math.max(1, list.length)).toFixed(4);
    return {
      n: s.n,
      meanDiff: +s.mean.toFixed(3),
      ci95: [+s.ci95[0].toFixed(3), +s.ci95[1].toFixed(3)],
      sd: +s.sd.toFixed(2),
      outliers: list.filter((p) => Math.abs(p.diff - s.mean) > 4 * s.sd).length,
      bustCast: rate((p) => p.castBust),
      bustSkip: rate((p) => p.skipBust),
      showdownCast: rate((p) => p.castShowdown),
      showdownSkip: rate((p) => p.skipShowdown),
      meanAether: +(list.reduce((a, p) => a + p.aether, 0) / Math.max(1, list.length)).toFixed(2),
      divergentTrees: list.filter((p) => p.divergent).length,
    };
  };
  const bySpellPolicy: Record<string, unknown> = {};
  for (const [k, list] of group((p) => `${p.spell}|${p.policy}`)) bySpellPolicy[k] = summarize(list, k.length);
  const byStreet: Record<string, unknown> = {};
  for (const [k, list] of group((p) => `${p.spell}|${p.street}`)) byStreet[k] = summarize(list, k.length + 1);
  const byDepth: Record<string, unknown> = {};
  for (const [k, list] of group((p) => `${p.spell}|${p.depth}`)) byDepth[k] = summarize(list, k.length + 2);
  const sum = (f: (r: BatchResult) => Record<string, number>) =>
    results.reduce((a, r) => {
      for (const [k, v] of Object.entries(f(r))) a[k] = (a[k] ?? 0) + v;
      return a;
    }, {} as Record<string, number>);
  const offered = sum((r) => r.offered);
  const chosen = sum((r) => r.chosen);
  const out = {
    label,
    batches,
    sourceRunsPerBatch: runs,
    downstreamPolicies: DOWNSTREAM,
    note: 'end-of-hand player net, cast minus skip, paired from the same cloned legal state with common policy randomness; offline only',
    pairs: pairs.length,
    incompatible: results.reduce((a, r) => a + r.incompatible, 0),
    bySpellPolicy,
    byStreet,
    byDepth,
    skilledChoiceFrequency: Object.fromEntries(Object.keys(offered).map((k) => [k, { offered: offered[k], cast: chosen[k] ?? 0, rate: +((chosen[k] ?? 0) / offered[k]).toFixed(4) }])),
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
  };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/spell-ev-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(bySpellPolicy).map(([k, v]) => [k, `${(v as { n: number }).n} ${(v as { meanDiff: number }).meanDiff} ${JSON.stringify((v as { ci95: number[] }).ci95)}`])), null, 1));
  console.log(`${out.pairs} pairs, ${out.incompatible} incompatible, ${out.seconds}s`);
}
