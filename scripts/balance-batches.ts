/**
 * Usage: npm run balance [-- batches perPolicy label]
 * Plays `batches` independent seed batches (shared seeds across policies) in
 * parallel worker threads and writes docs/reports/balance-<label>.json with
 * per-policy ending rates, Wilson 95% intervals and batch spread (design v0.7 §01).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { simulateRuns, type SimulationReport } from '../src/game/run/simulate';

const POLICIES = ['skilled', 'passive', 'maniac', 'tight'];

function wilson(k: number, n: number): [number, number] {
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [+(c - h).toFixed(4), +(c + h).toFixed(4)];
}

if (!isMainThread) {
  const { batch, perPolicy } = workerData as { batch: number; perPolicy: number };
  parentPort!.postMessage(simulateRuns(perPolicy * POLICIES.length, 1000 + batch));
} else {
  const batches = Number(process.argv[2] ?? 10);
  const perPolicy = Number(process.argv[3] ?? 100);
  const label = process.argv[4] ?? 'current';
  const t0 = performance.now();
  const queue = Array.from({ length: batches }, (_, b) => b);
  const results: SimulationReport[] = [];
  const self = new URL(import.meta.url);
  await Promise.all(
    Array.from({ length: Math.min(batches, availableParallelism()) }, async () => {
      for (let b = queue.shift(); b !== undefined; b = queue.shift()) {
        results[b] = await new Promise<SimulationReport>((resolve, reject) => {
          const w = new Worker(self, { workerData: { batch: b, perPolicy } });
          w.once('message', resolve);
          w.once('error', reject);
        });
        console.error(`batch ${b} done`);
      }
    }),
  );
  const endings = ['slice_victory', 'slice_exile', 'fallen_unlocked', 'death'];
  const finals = ['act2_victory', 'act2_living_exile', 'undercircuit_entry', 'death'];
  const summary: Record<string, unknown> = {};
  for (const p of POLICIES) {
    const n = results.reduce((a, r) => a + r.policies[p].runs, 0);
    const row: Record<string, unknown> = { n };
    for (const e of endings) {
      // Act I outcome (comparable with the P4 baseline, whose runs ended there).
      const act1 = (r: SimulationReport) => r.policies[p].act1?.[e] ?? r.policies[p].endings[e] ?? 0;
      const k = results.reduce((a, r) => a + act1(r), 0);
      const perBatch = results.map((r) => act1(r) / r.policies[p].runs);
      const mean = perBatch.reduce((a, b) => a + b, 0) / perBatch.length;
      const sd = Math.sqrt(perBatch.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, perBatch.length - 1));
      row[e] = { k, rate: +(k / n).toFixed(4), ci95: wilson(k, n), batchSd: +sd.toFixed(4) };
    }
    const fin: Record<string, unknown> = {};
    for (const e of finals) {
      const k = results.reduce((a, r) => a + (r.policies[p].endings[e] ?? 0), 0);
      fin[e] = { k, rate: +(k / n).toFixed(4), ci95: wilson(k, n) };
    }
    row.final = fin;
    summary[p] = row;
  }
  const claims = results.reduce(
    (a, r) => {
      for (const [k, v] of Object.entries(r.claims.outcomes)) a[k] = (a[k] ?? 0) + v;
      return a;
    },
    {} as Record<string, number>,
  );
  const out = {
    label,
    batches,
    perPolicyPerBatch: perPolicy,
    seeds: `simulateRuns(seed = 1000 + batch); world k shared by all policies`,
    summary,
    claims,
    invariantChecks: results.reduce((a, r) => a + r.invariantChecks, 0),
    aiCastsPer100Hands: +(results.reduce((a, r) => a + r.aiCastsPer100Hands, 0) / batches).toFixed(1),
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
  };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/balance-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out.summary, (k, v) => (k === 'ci95' ? `${v[0]}–${v[1]}` : v)));
  console.log(`${batches * perPolicy * POLICIES.length} runs in ${out.seconds}s`);
}
