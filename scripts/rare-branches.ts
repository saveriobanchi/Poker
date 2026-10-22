/**
 * Usage: npm run rare-branches [-- batches runsPerBatch label]
 * Rare-branch study (design v1.1 §05, docs/research/p9-rare-branch-study.json).
 * Source runs are skilled runs that legally evolve Briar Lock → Quiet Briars,
 * Unmask → Ravenous Eye and Fate Exchange → Second Reflection / Marked Fate
 * (alternating by run) at ordinary evolution opportunities, and cast those
 * families' base spells more often to earn Resonance (never the branches themselves). Only legally reached decisions are
 * sampled: the first decision per spell per hand, cast vs skip, to table end.
 * The base parents are sampled in the same runs as a separate reference — not a
 * matched comparison, since the branch and its parent are never castable in the
 * same state. Writes docs/reports/rare-branches-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { getMagicView } from '../src/game/magic/table';
import { Rng } from '../src/game/rules/rng';
import { humanSeat, sessionStatus } from '../src/game/table/session';
import type { PolicyName } from '../src/game/run/driver';
import { createRun, playerBook, type RunState } from '../src/game/run/run';
import { allCards } from '../src/game/magic';
import { leaningStep } from '../src/game/run/sourcePolicy';
import { clusterBootstrap, type TablePair, tablePairsAt } from '../src/game/run/tableEv';

const DOWNSTREAM: PolicyName[] = ['skilled', 'mixed_aggressive', 'tight'];
const BRANCHES = ['quiet_briars', 'ravenous_eye', 'second_reflection', 'marked_fate'];
const PARENTS: Record<string, string> = { quiet_briars: 'briar_lock', ravenous_eye: 'unmask', second_reflection: 'fate_exchange', marked_fate: 'fate_exchange' };
const SAMPLED = new Set([...BRANCHES, ...Object.values(PARENTS)]);

interface BatchResult {
  pairs: TablePair[];
  incompatible: number;
  sourceRuns: number;
  /** Source runs that ever owned each branch (legally evolved). */
  owned: Record<string, number>;
  /** Times the source policy itself cast each branch (use frequency under this sampling policy). */
  used: Record<string, number>;
  /** Decision states where each branch was castable (offered). */
  offered: Record<string, number>;
}

function runBatch(batch: number, runs: number): BatchResult {
  const out: BatchResult = { pairs: [], incompatible: 0, sourceRuns: 0, owned: {}, used: {}, offered: {} };
  for (let k = 0; k < runs; k++) {
    const seed = (6000 + batch) * 100_003 + k;
    let run: RunState = createRun(seed);
    const rng = new Rng(seed ^ 0x99);
    const fate = (k + batch) % 2 === 0 ? 'second_reflection' : 'marked_fate';
    const lean = { cast: ['briar_lock' as const, 'unmask' as const, 'fate_exchange' as const], castRate: 0.6, baseOnly: true, evolve: { briar_lock: 'quiet_briars' as const, unmask: 'ravenous_eye' as const, fate_exchange: fate as 'second_reflection' } };
    const sampled = new Set<string>();
    const owned = new Set<string>();
    out.sourceRuns++;
    for (let guard = 0; guard < 80_000; guard++) {
      const t = run.table;
      if (t) {
        const st = sessionStatus(t);
        if (st === 'humanWindow' || st === 'humanToAct') {
          const me = humanSeat(t);
          const offers = [...new Set(getMagicView(t.table, me).options.map((o) => o.spell))];
          for (const s of offers) if (BRANCHES.includes(s)) out.offered[s] = (out.offered[s] ?? 0) + 1;
          const fresh = new Set(offers.filter((s) => SAMPLED.has(s) && !sampled.has(`${run.tableNode}|${t.handNumber}|${s}`)));
          if (fresh.size) {
            for (const s of fresh) sampled.add(`${run.tableNode}|${t.handNumber}|${s}`);
            const r = tablePairsAt(run, DOWNSTREAM, seed * 31 + guard, seed, fresh);
            out.pairs.push(...r.pairs);
            out.incompatible += r.incompatible;
          }
        }
      }
      const before = run.table ? run.table.table.magic.events.length : 0;
      const hand = run.table?.handNumber;
      const node = run.tableNode;
      const next = leaningStep(run, rng, lean);
      if (!next) break;
      if (next.table && next.tableNode === node && next.table.handNumber === hand) {
        const me = humanSeat(next.table);
        for (const e of next.table.table.magic.events.slice(before)) if (e.seat === me && BRANCHES.includes(e.spell)) out.used[e.spell] = (out.used[e.spell] ?? 0) + 1;
      }
      run = next;
      for (const c of allCards(playerBook(run))) if (BRANCHES.includes(c.spell)) owned.add(c.spell);
    }
    for (const s of owned) out.owned[s] = (out.owned[s] ?? 0) + 1;
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
  const pairs = results.flatMap((r) => r.pairs);
  const sum = (f: (r: BatchResult) => Record<string, number>) =>
    results.reduce((a, r) => {
      for (const [k, v] of Object.entries(f(r))) a[k] = (a[k] ?? 0) + v;
      return a;
    }, {} as Record<string, number>);
  const r3 = (x: number) => +x.toFixed(3);
  const ci = (list: TablePair[], f: (p: TablePair) => number, seed: number) => {
    const s = clusterBootstrap(list.map((p) => ({ cluster: p.cluster, v: f(p) })), seed);
    return { mean: r3(s.mean), ci95: [r3(s.ci95[0]), r3(s.ci95[1])] };
  };
  const bySpellPolicy: Record<string, unknown> = {};
  for (const spell of [...BRANCHES, 'briar_lock', 'unmask', 'fate_exchange']) {
    for (const policy of DOWNSTREAM) {
      const list = pairs.filter((p) => p.spell === spell && p.policy === policy);
      if (!list.length) continue;
      const clusters = new Set(list.map((p) => p.cluster)).size;
      const byTable: Record<string, { n: number; netDiff: number; winDiff: number }> = {};
      for (const node of [...new Set(list.map((p) => p.node))]) {
        const l = list.filter((p) => p.node === node);
        byTable[node] = { n: l.length, netDiff: r3(l.reduce((a, p) => a + p.diff, 0) / l.length), winDiff: r3(l.reduce((a, p) => a + +p.castWon - +p.skipWon, 0) / l.length) };
      }
      const isBranch = BRANCHES.includes(spell);
      bySpellPolicy[`${spell}|${policy}`] = {
        role: isBranch ? 'branch' : 'parent reference (not matched)',
        n: list.length,
        sourceRuns: clusters,
        undersampled: isBranch ? list.length < 2000 || clusters < 100 : undefined,
        tableNetDiff: ci(list, (p) => p.diff, 1),
        deathDiff: ci(list, (p) => +p.castDied - +p.skipDied, 2),
        winDiff: ci(list, (p) => +p.castWon - +p.skipWon, 3),
        aetherDiff: ci(list, (p) => p.castAether - p.skipAether, 4),
        laterCastsDiff: ci(list, (p) => p.castLaterSpells - p.skipLaterSpells, 5),
        byTable,
      };
    }
  }
  const out = {
    label,
    batches,
    sourceRunsPerBatch: runs,
    sourceRuns: results.reduce((a, r) => a + r.sourceRuns, 0),
    selectionBias:
      'Source runs deliberately evolve into these branches and cast their families more often (60% when legal) to earn Resonance; decisions therefore over-represent runs and tables where the branch was reachable. Branch-vs-parent rows are not matched: a branch replaces its parent instance, so the two are never castable in the same state. Chip net to run end was not measured (one continuation per arm to table end only).',
    ownedBySourceRuns: sum((r) => r.owned),
    offeredDecisions: sum((r) => r.offered),
    castBySourcePolicy: sum((r) => r.used),
    pairs: pairs.length,
    incompatible: results.reduce((a, r) => a + r.incompatible, 0),
    bySpellPolicy,
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
  };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/rare-branches-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  for (const [k, v] of Object.entries(bySpellPolicy) as [string, { n: number; sourceRuns: number; tableNetDiff: { mean: number; ci95: number[] } }][]) console.log(`${k.padEnd(36)} n=${v.n} runs=${v.sourceRuns} net=${v.tableNetDiff.mean} [${v.tableNetDiff.ci95}]`);
  console.log(JSON.stringify({ owned: out.ownedBySourceRuns, offered: out.offeredDecisions, used: out.castBySourcePolicy }));
  console.log(`${out.pairs} pairs, ${out.incompatible} incompatible, ${out.seconds}s`);
}
