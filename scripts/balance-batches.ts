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

const POLICIES = ['skilled', 'passive', 'maniac', 'tight', 'mixed_aggressive'];

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
  const finals = ['the_ledger_unbound', 'the_unchosen_road', 'under_living_end', 'death'];
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
    // Phase-conditional cohorts (design v0.8 balance plan): denominators are the cohort's entrants.
    const cohorts: Record<string, unknown> = {};
    for (const c of Object.keys(results[0].policies[p].cohorts)) {
      const n2 = results.reduce((a, r) => a + r.policies[p].cohorts[c as keyof (typeof r.policies)[string]['cohorts']].n, 0);
      const died = results.reduce((a, r) => a + r.policies[p].cohorts[c as keyof (typeof r.policies)[string]['cohorts']].died, 0);
      const cleared = results.reduce((a, r) => a + r.policies[p].cohorts[c as keyof (typeof r.policies)[string]['cohorts']].cleared, 0);
      cohorts[c] = {
        n: n2,
        diedHere: n2 ? { rate: +(died / n2).toFixed(4), ci95: wilson(died, n2) } : null,
        cleared: n2 ? { rate: +(cleared / n2).toFixed(4), ci95: wilson(cleared, n2) } : null,
      };
    }
    row.cohorts = cohorts;
    const sum = (f: (r: SimulationReport) => Record<string, number>) =>
      results.reduce((a, r) => {
        for (const [k, v] of Object.entries(f(r))) a[k] = (a[k] ?? 0) + v;
        return a;
      }, {} as Record<string, number>);
    row.deathsByPhase = sum((r) => r.policies[p].deathsByPhase);
    row.relics = sum((r) => r.policies[p].relics);
    row.evolvedAny = +(results.reduce((a, r) => a + r.policies[p].evolvedAny, 0) / n).toFixed(4);
    row.evolutionBranches = sum((r) => r.policies[p].evolutionBranches);
    row.castsPerRun = Object.fromEntries(Object.entries(sum((r) => r.policies[p].casts)).map(([k, v]) => [k, +(v / n).toFixed(2)]));
    row.whisper = sum((r) => r.policies[p].whisper);
    row.repaid = sum((r) => r.policies[p].repaid);
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
    ingressViolations: results.reduce((a, r) => a + r.ingressViolations, 0),
    shoveCalls: results.reduce((a, r) => ({ n: a.n + r.shoveCalls.n, won: a.won + r.shoveCalls.won, net: a.net + r.shoveCalls.net }), { n: 0, won: 0, net: 0 }),
    claimsByCharacter: results.reduce(
      (a, r) => {
        for (const [who, o] of Object.entries(r.claimsByCharacter)) for (const [k, v] of Object.entries(o)) (a[who] ??= {})[k] = (a[who][k] ?? 0) + v;
        return a;
      },
      {} as Record<string, Record<string, number>>,
    ),
    playerCasts: results.reduce((a, r) => {
      for (const [k, v] of Object.entries(r.playerCasts)) a[k] = (a[k] ?? 0) + v;
      return a;
    }, {} as Record<string, number>),
    aiCastsPer100Hands: +(results.reduce((a, r) => a + r.aiCastsPer100Hands, 0) / batches).toFixed(1),
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
  };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/balance-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(out.summary).map(([p, r]) => [p, (r as { cohorts: unknown }).cohorts])), (k, v) => (k === 'ci95' ? `${v[0]}–${v[1]}` : v)));
  console.log(`${batches * perPolicy * POLICIES.length} runs in ${out.seconds}s`);
}
