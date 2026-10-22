/**
 * Usage: npm run aether-ab [-- batches runsPerBatch label]
 * Offline, research-only Aether A/B (design v1.1 §04, docs/research/p9-aether-ab-spec.json).
 * Source runs: skilled, leaning into the Cinder family (cast on half of legal
 * raises; evolve into alternating branches) — legal states only.
 *
 * Study A (rule variant): at the start of every table, the identical run state is
 *   played to the end of that table three times — baseline (exact P8 rules, cap
 *   waste counted), ember_overflow_reserve, ember_next_hand_discount — each alone,
 *   for every seat, with the same downstream policy and policy randomness.
 * Study B (enchantment value within each rule): at the first Cinder-family
 *   decision of each hand, cast vs the same raise unenchanted, to table end,
 *   under each rule.
 * Intervals are cluster bootstraps over source runs. Writes docs/reports/aether-ab-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { getMagicView, type AetherVariant } from '../src/game/magic/table';
import { EVOLUTIONS } from '../src/game/magic/spells';
import { Rng } from '../src/game/rules/rng';
import { humanSeat, sessionStatus } from '../src/game/table/session';
import type { PolicyName } from '../src/game/run/driver';
import { createRun, type RunState } from '../src/game/run/run';
import { leaningStep } from '../src/game/run/sourcePolicy';
import { type ArmResult, clusterBootstrap, playTable, type TablePair, tablePairsAt, withVariant } from '../src/game/run/tableEv';

const DOWNSTREAM: PolicyName[] = ['skilled', 'mixed_aggressive', 'tight'];
const VARIANTS: AetherVariant[] = ['baseline', 'ember_overflow_reserve', 'ember_reserve_on_spend', 'ember_next_hand_discount'];
const CINDER = new Set(['cinder_challenge', ...EVOLUTIONS.cinder_challenge.branches]);

interface TableArms {
  cluster: number;
  policy: PolicyName;
  node: string;
  /** The player's book holds a Cinder-family spell at the table start. */
  cinderOwner: boolean;
  arms: Record<AetherVariant, Omit<ArmResult, 'trace'>>;
}

interface BatchResult {
  tables: TableArms[];
  pairs: (TablePair & { variant: AetherVariant })[];
  incompatible: number;
  sourceRuns: number;
}

function runBatch(batch: number, runs: number): BatchResult {
  const out: BatchResult = { tables: [], pairs: [], incompatible: 0, sourceRuns: 0 };
  for (let k = 0; k < runs; k++) {
    const seed = (5000 + batch) * 100_003 + k;
    let run: RunState = createRun(seed);
    const rng = new Rng(seed ^ 0x77);
    const lean = { cast: ['cinder_challenge' as const], castRate: 0.5, evolve: { cinder_challenge: EVOLUTIONS.cinder_challenge.branches[(k + batch) % 2] } };
    const seenTables = new Set<string>();
    const sampled = new Set<string>();
    out.sourceRuns++;
    for (let guard = 0; guard < 80_000; guard++) {
      const t = run.table;
      if (t && run.tableNode && !seenTables.has(run.tableNode)) {
        seenTables.add(run.tableNode);
        const me = humanSeat(t);
        const book = t.table.seats[me].book;
        const cinderOwner = [...book.draw, ...book.discard, ...(book.exhausted ?? []), ...t.table.magic.hands[me]].some((c) => CINDER.has(c.spell));
        for (const policy of DOWNSTREAM) {
          const armSeed = (seed * 37 + guard * 3 + DOWNSTREAM.indexOf(policy)) >>> 0;
          try {
            const arms = Object.fromEntries(
              VARIANTS.map((v) => {
                const { trace: _trace, ...r } = playTable(withVariant(run, v), policy, new Rng(armSeed), t.handNumber);
                return [v, r];
              }),
            ) as TableArms['arms'];
            out.tables.push({ cluster: seed, policy, node: run.tableNode, cinderOwner, arms });
          } catch {
            out.incompatible++;
          }
        }
      }
      if (t) {
        const st = sessionStatus(t);
        const key = `${run.tableNode}|${t.handNumber}`;
        if ((st === 'humanWindow' || st === 'humanToAct') && !sampled.has(key)) {
          const me = humanSeat(t);
          const fresh = new Set(getMagicView(t.table, me).options.map((o) => o.spell).filter((s) => CINDER.has(s)));
          if (fresh.size) {
            sampled.add(key);
            for (const v of VARIANTS) {
              const r = tablePairsAt(run, DOWNSTREAM, seed * 31 + guard, seed, fresh, v);
              out.pairs.push(...r.pairs.map((p) => ({ ...p, variant: v })));
              out.incompatible += r.incompatible;
            }
          }
        }
      }
      const next = leaningStep(run, rng, lean);
      if (!next) break;
      run = next;
    }
  }
  return out;
}

if (!isMainThread) {
  const { batch, runs } = workerData as { batch: number; runs: number };
  parentPort!.postMessage(runBatch(batch, runs));
} else {
  const batches = Number(process.argv[2] ?? 20);
  const runs = Number(process.argv[3] ?? 25);
  const label = process.argv[4] ?? 'p9';
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
  const tables = results.flatMap((r) => r.tables);
  const pairs = results.flatMap((r) => r.pairs);
  const r3 = (x: number) => +x.toFixed(3);
  const ci = (vals: { cluster: number; v: number }[], seed: number) => {
    const s = clusterBootstrap(vals, seed);
    return { mean: r3(s.mean), ci95: [r3(s.ci95[0]), r3(s.ci95[1])], n: s.n, clusters: s.clusters };
  };
  const sd = (xs: number[]) => {
    const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return r3(Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)));
  };
  // Study A: variant minus baseline, same table start, same policy randomness.
  const studyA: Record<string, unknown> = {};
  for (const stratum of ['all', 'cinderOwner'] as const) {
    for (const policy of DOWNSTREAM) {
      const rows = tables.filter((x) => x.policy === policy && (stratum === 'all' || x.cinderOwner));
      for (const v of VARIANTS.filter((x) => x !== 'baseline')) {
        const d = (f: (a: Omit<ArmResult, 'trace'>) => number, s: number) => ci(rows.map((x) => ({ cluster: x.cluster, v: f(x.arms[v]) - f(x.arms.baseline) })), s);
        const byStage: Record<string, unknown> = {};
        for (const node of [...new Set(rows.map((x) => x.node))]) {
          const rs = rows.filter((x) => x.node === node);
          byStage[node] = { n: rs.length, netDiff: r3(rs.reduce((a, x) => a + x.arms[v].net - x.arms.baseline.net, 0) / rs.length) };
        }
        studyA[`${stratum}|${policy}|${v}`] = {
          tables: rows.length,
          changedTables: rows.filter((x) => JSON.stringify(x.arms[v]) !== JSON.stringify(x.arms.baseline)).length,
          netDiff: d((a) => a.net, 1),
          deathDiff: d((a) => +a.died, 2),
          winDiff: d((a) => +a.won, 3),
          castsDiff: d((a) => a.later, 4),
          capWasteDiff: d((a) => a.capWaste, 5),
          aetherEndDiff: d((a) => a.aether, 6),
          risk: { netSdBaseline: sd(rows.map((x) => x.arms.baseline.net)), netSdVariant: sd(rows.map((x) => x.arms[v].net)), deathRateBaseline: r3(rows.filter((x) => x.arms.baseline.died).length / Math.max(1, rows.length)), deathRateVariant: r3(rows.filter((x) => x.arms[v].died).length / Math.max(1, rows.length)) },
          baselineCapWastePerTable: r3(rows.reduce((a, x) => a + x.arms.baseline.capWaste, 0) / Math.max(1, rows.length)),
          byStage,
        };
      }
    }
  }
  // Study B: Cinder-family enchantment value under each rule.
  const studyB: Record<string, unknown> = {};
  for (const v of VARIANTS) {
    for (const policy of DOWNSTREAM) {
      for (const spell of [...CINDER]) {
        const list = pairs.filter((p) => p.variant === v && p.policy === policy && p.spell === spell);
        if (!list.length) continue;
        studyB[`${v}|${policy}|${spell}`] = {
          n: list.length,
          tableNetDiff: ci(list.map((p) => ({ cluster: p.cluster, v: p.diff })), 11),
          deathDiff: ci(list.map((p) => ({ cluster: p.cluster, v: +p.castDied - +p.skipDied })), 12),
          aetherDiff: ci(list.map((p) => ({ cluster: p.cluster, v: p.castAether - p.skipAether })), 13),
          laterCastsDiff: ci(list.map((p) => ({ cluster: p.cluster, v: p.castLaterSpells - p.skipLaterSpells })), 14),
        };
      }
    }
  }
  const out = {
    label,
    batches,
    sourceRunsPerBatch: runs,
    sourceRuns: results.reduce((a, r) => a + r.sourceRuns, 0),
    note: 'offline research only; variants are never enabled in play. Study A: variant minus exact-P8 baseline from the identical table-start state, every seat under the same rule. Study B: Cinder-family cast minus the same unenchanted raise, to table end, within each rule. Cluster bootstrap over source runs.',
    tableStarts: tables.length,
    pairs: pairs.length,
    incompatible: results.reduce((a, r) => a + r.incompatible, 0),
    studyA,
    studyB,
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
  };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/aether-ab-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  for (const [k, x] of Object.entries(studyA) as [string, { tables: number; changedTables: number; netDiff: { mean: number; ci95: number[] }; deathDiff: { mean: number }; capWasteDiff: { mean: number } }][])
    console.log(`A ${k.padEnd(52)} n=${x.tables} changed=${x.changedTables} net=${x.netDiff.mean} [${x.netDiff.ci95}] death=${x.deathDiff.mean} waste=${x.capWasteDiff.mean}`);
  for (const [k, x] of Object.entries(studyB) as [string, { n: number; tableNetDiff: { mean: number; ci95: number[] } }][]) console.log(`B ${k.padEnd(58)} n=${x.n} net=${x.tableNetDiff.mean} [${x.tableNetDiff.ci95}]`);
  console.log(`${out.tableStarts} table starts, ${out.pairs} pairs, ${out.incompatible} incompatible, ${out.seconds}s`);
}
