/**
 * Usage: npm run table-ev [-- batches runsPerBatch label]
 * Offline full-table paired spell value (design v1.0 §01,
 * p8-counterfactual-table-ev.json). Source runs are seeded skilled runs that
 * favour the Cinder family (they cast Cinder when they raise half the time and
 * evolve it into rotating branches) so Ember Echo and Red Oath are reached. At
 * the first decision per spell per source hand, the spell is compared cast vs
 * skip, each arm continuing to the end of the current table under the same
 * downstream policy. Writes docs/reports/table-ev-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { decide } from '../src/game/ai/agent';
import { knownCards } from '../src/game/ai/magic';
import { getMagicView } from '../src/game/magic/table';
import { EVOLUTIONS, SPELLS } from '../src/game/magic/spells';
import { getLegalActions, getPublicView } from '../src/game/rules/engine';
import { Rng } from '../src/game/rules/rng';
import { humanSeat, sessionStatus } from '../src/game/table/session';
import { publicShoveRates, SKILLED, step, type PolicyName } from '../src/game/run/driver';
import { createRun, evolutionOffers, runCommand, runHuman, type RunState } from '../src/game/run/run';
import { clusterBootstrap, type TablePair, tablePairsAt } from '../src/game/run/tableEv';

const DOWNSTREAM: PolicyName[] = ['skilled', 'tight', 'mixed_aggressive'];
const CINDER = new Set(['cinder_challenge', ...EVOLUTIONS.cinder_challenge.branches]);

interface BatchResult {
  pairs: TablePair[];
  incompatible: number;
  sourceRuns: number;
}

/** Source policy: skilled, but leans into the Cinder family (offline sampling only). */
function sourceStep(run: RunState, rng: Rng, k: number): RunState | null {
  const t = run.table;
  if (t && sessionStatus(t) === 'humanToAct') {
    const me = humanSeat(t);
    const magic = getMagicView(t.table, me);
    const o = magic.options.find((x) => CINDER.has(x.spell));
    const legal = getLegalActions(t.table.hand)!;
    if (o && legal.raise && rng.nextFloat() < 0.5) {
      const view = getPublicView(t.table.hand, me);
      const a = decide(view, SKILLED, rng, knownCards(view, magic), publicShoveRates(t));
      const raiseTo = a.type === 'bet' || a.type === 'raise' ? a.to : legal.raise.minTo;
      try {
        return runHuman(run, { kind: 'cast', uid: o.uid, params: { spell: o.spell as 'cinder_challenge', raiseTo } });
      } catch {
        /* fall through to the skilled step */
      }
    }
  }
  const atTable = !!t && t.table.hand.phase !== 'betting';
  const evo = evolutionOffers(run).find((e) => e.card.spell === 'cinder_challenge' && (!e.needsToken || !t));
  if (evo && (atTable ? sessionStatus(t!) === 'handComplete' : true)) {
    try {
      return runCommand(run, { kind: 'evolve', uid: evo.card.uid, branch: evo.branches[k % 2], useToken: evo.needsToken });
    } catch {
      /* not allowed at this node */
    }
  }
  return step(run, 'skilled', rng);
}

function runBatch(batch: number, runs: number): BatchResult {
  const out: BatchResult = { pairs: [], incompatible: 0, sourceRuns: 0 };
  for (let k = 0; k < runs; k++) {
    const seed = (3000 + batch) * 100_003 + k;
    const cluster = seed;
    let run: RunState = createRun(seed);
    const rng = new Rng(seed ^ 0x77);
    const sampled = new Set<string>();
    out.sourceRuns++;
    for (let guard = 0; guard < 80_000; guard++) {
      const t = run.table;
      if (t) {
        const st = sessionStatus(t);
        if (st === 'humanWindow' || st === 'humanToAct') {
          const me = humanSeat(t);
          const fresh = new Set(
            getMagicView(t.table, me)
              .options.map((o) => o.spell)
              .filter((s) => !sampled.has(`${run.tableNode}|${t.handNumber}|${s}`)),
          );
          if (fresh.size) {
            for (const s of fresh) sampled.add(`${run.tableNode}|${t.handNumber}|${s}`);
            const r = tablePairsAt(run, DOWNSTREAM, seed * 31 + guard, cluster, fresh);
            out.pairs.push(...r.pairs);
            out.incompatible += r.incompatible;
          }
        }
      }
      const next = sourceStep(run, rng, k + batch);
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
  const batches = Number(process.argv[2] ?? 10);
  const runs = Number(process.argv[3] ?? 20);
  const label = process.argv[4] ?? 'p8';
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
  const groups = new Map<string, TablePair[]>();
  for (const p of pairs) groups.set(`${p.spell}|${p.policy}`, [...(groups.get(`${p.spell}|${p.policy}`) ?? []), p]);
  const ci = (list: TablePair[], f: (p: TablePair) => number, seed: number) => {
    const s = clusterBootstrap(list.map((p) => ({ cluster: p.cluster, v: f(p) })), seed);
    return { mean: +s.mean.toFixed(3), ci95: [+s.ci95[0].toFixed(3), +s.ci95[1].toFixed(3)] as [number, number], clusters: s.clusters };
  };
  const base = new Set(Object.keys(EVOLUTIONS));
  const bySpellPolicy: Record<string, unknown> = {};
  for (const [k, list] of [...groups].sort()) {
    const spell = k.split('|')[0];
    const target = base.has(spell) ? 5000 : 2000;
    const net = ci(list, (p) => p.diff, k.length);
    bySpellPolicy[k] = {
      n: list.length,
      clusters: net.clusters,
      target,
      undersampled: list.length < target,
      tableNetDiff: net,
      handNetDiff: ci(list, (p) => p.handDiff, k.length + 1),
      deathDiff: ci(list, (p) => +p.castDied - +p.skipDied, k.length + 2),
      winDiff: ci(list, (p) => +p.castWon - +p.skipWon, k.length + 3),
      aetherDiff: ci(list, (p) => p.castAether - p.skipAether, k.length + 4),
      laterSpellsDiff: ci(list, (p) => p.castLaterSpells - p.skipLaterSpells, k.length + 5),
      turnoverDiff: ci(list, (p) => p.castTurnover - p.skipTurnover, k.length + 6),
      deathRateCast: +(list.filter((p) => p.castDied).length / list.length).toFixed(4),
      deathRateSkip: +(list.filter((p) => p.skipDied).length / list.length).toFixed(4),
      divergent: list.filter((p) => p.divergent).length,
      cinderFamily: CINDER.has(spell),
      family: SPELLS[spell as keyof typeof SPELLS].family,
    };
  }
  const out = {
    label,
    batches,
    sourceRunsPerBatch: runs,
    sourceRuns: results.reduce((a, r) => a + r.sourceRuns, 0),
    downstreamPolicies: DOWNSTREAM,
    note: 'end-of-table player net (and death, win, Aether, later casts, turnover), cast minus skip, from the same persisted pre-cast run state with common policy randomness; one decision per spell per source hand; intervals are cluster bootstraps over source runs; offline only',
    pairs: pairs.length,
    incompatible: results.reduce((a, r) => a + r.incompatible, 0),
    bySpellPolicy,
    seconds: +((performance.now() - t0) / 1000).toFixed(1),
  };
  mkdirSync('docs/reports', { recursive: true });
  writeFileSync(`docs/reports/table-ev-${label}.json`, JSON.stringify(out, null, 2) + '\n');
  for (const [k, v] of Object.entries(bySpellPolicy)) {
    const x = v as { n: number; clusters: number; tableNetDiff: { mean: number; ci95: number[] }; deathDiff: { mean: number }; aetherDiff: { mean: number } };
    console.log(`${k.padEnd(34)} n=${x.n} c=${x.clusters} net=${x.tableNetDiff.mean} [${x.tableNetDiff.ci95}] death=${x.deathDiff.mean} aether=${x.aetherDiff.mean}`);
  }
  console.log(`${out.pairs} pairs, ${out.incompatible} incompatible, ${out.seconds}s`);
}
