/**
 * Usage: npm run paired-policies [-- batches perBatch label [seedBase]]
 * Matched-seed policy comparison (design v1.0 required report): every policy
 * plays exactly the worlds `npm run balance` plays (createRun(seed·100003 + k),
 * policy Rng(seed·7919 + k)), and each policy is compared with skilled world by
 * world: discordant pairs, the paired difference and a bootstrap 95% interval
 * over worlds. Writes docs/reports/paired-policies-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { bootstrapMean } from '../src/game/run/spellEv';
import { playRun, POLICIES, type PolicyName } from '../src/game/run/driver';
import { createRun, playerChips } from '../src/game/run/run';

interface WorldOutcome {
  world: string;
  policy: PolicyName;
  ending: string;
  clear: boolean;
  died: boolean;
  act3: boolean;
  chips: number;
}

function runBatch(seed: number, perBatch: number): WorldOutcome[] {
  const out: WorldOutcome[] = [];
  for (let k = 0; k < perBatch; k++) {
    for (const policy of POLICIES) {
      const end = playRun(createRun(seed * 100_003 + k), policy, seed * 7_919 + k, 60_000);
      out.push({
        world: `${seed}:${k}`,
        policy,
        ending: end.node,
        clear: end.node === 'the_ledger_unbound',
        died: end.node === 'death',
        act3: end.flags.includes('act3_entered'),
        chips: end.node === 'death' ? 0 : playerChips(end),
      });
    }
  }
  return out;
}

if (!isMainThread) {
  const { seed, perBatch } = workerData as { seed: number; perBatch: number };
  parentPort!.postMessage(runBatch(seed, perBatch));
} else {
  const batches = Number(process.argv[2] ?? 10);
  const perBatch = Number(process.argv[3] ?? 200);
  const label = process.argv[4] ?? 'p8';
  const seedBase = Number(process.argv[5] ?? 1000);
  const t0 = performance.now();
  const queue = Array.from({ length: batches }, (_, b) => b);
  const results: WorldOutcome[][] = [];
  const self = new URL(import.meta.url);
  await Promise.all(
    Array.from({ length: Math.min(batches, availableParallelism()) }, async () => {
      for (let b = queue.shift(); b !== undefined; b = queue.shift()) {
        results[b] = await new Promise<WorldOutcome[]>((resolve, reject) => {
          const w = new Worker(self, { workerData: { seed: seedBase + b, perBatch } });
          w.once('message', resolve);
          w.once('error', reject);
        });
        console.error(`batch ${b} done`);
      }
    }),
  );
  const all = results.flat();
  const by = new Map<string, Map<PolicyName, WorldOutcome>>();
  for (const o of all) (by.get(o.world) ?? by.set(o.world, new Map()).get(o.world)!).set(o.policy, o);
  const worlds = [...by.values()];
  const comparisons: Record<string, unknown> = {};
  for (const p of POLICIES.filter((x) => x !== 'skilled')) {
    const row: Record<string, unknown> = { worlds: worlds.length };
    for (const [metric, f] of [
      ['clear', (o: WorldOutcome) => +o.clear],
      ['death', (o: WorldOutcome) => +o.died],
      ['act3Entry', (o: WorldOutcome) => +o.act3],
      ['finalLifechips', (o: WorldOutcome) => o.chips],
    ] as const) {
      const diffs = worlds.map((w) => f(w.get(p)!) - f(w.get('skilled')!));
      const s = bootstrapMean(diffs, metric.length + p.length);
      const entry: Record<string, unknown> = { meanDiffVsSkilled: +s.mean.toFixed(4), ci95: [+s.ci95[0].toFixed(4), +s.ci95[1].toFixed(4)] };
      if (metric !== 'finalLifechips') {
        entry.onlyThis = diffs.filter((d) => d > 0).length;
        entry.onlySkilled = diffs.filter((d) => d < 0).length;
      }
      row[metric] = entry;
    }
    comparisons[p] = row;
  }
  const rates = Object.fromEntries(
    POLICIES.map((p) => {
      const os = worlds.map((w) => w.get(p)!);
      return [p, { clear: +(os.filter((o) => o.clear).length / os.length).toFixed(4), death: +(os.filter((o) => o.died).length / os.length).toFixed(4), act3Entry: +(os.filter((o) => o.act3).length / os.length).toFixed(4) }];
    }),
  );
  const out = { label, batches, perBatch, seeds: `createRun(seed·100003 + k), Rng(seed·7919 + k), seed = ${seedBase} + batch`, rates, vsSkilled: comparisons, seconds: +((performance.now() - t0) / 1000).toFixed(1) };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/paired-policies-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
