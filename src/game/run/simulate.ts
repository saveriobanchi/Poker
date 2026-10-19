/**
 * Seeded batch simulation of whole P4 runs (design v0.6 acceptance: 1,000 runs
 * across contrasting player policies). Every step re-checks the global Lifechip
 * invariant; the report aggregates route, claim, contract and magic outcomes.
 */
import { SPELLS } from '../magic/spells';
import { Rng } from '../rules/rng';
import { humanSeat } from '../table/session';
import { type PolicyName, POLICIES, step } from './driver';
import { assertRunInvariants, createRun, type RunState } from './run';

export interface PolicyReport {
  runs: number;
  endings: Record<string, number>;
  /** Share of runs that ended with the player alive (any ending but death). */
  survival: number;
  /** Runs that reached / completed each table node. */
  tableReached: Record<string, number>;
  tableOutcomes: Record<string, Record<string, number>>;
  /** Player reached zero at least once (a Last Claim against the player). */
  bankruptcies: number;
  avgHands: number;
  avgFinalChips: number;
  avgMs: number;
}

export interface ClaimStats {
  total: number;
  /** Claims with the player as debtor / claimant / neither. */
  byRole: Record<'playerDebtor' | 'playerClaimant' | 'npcOnly', number>;
  outcomes: Record<string, number>;
  firstOfferAccepted: number;
  firstOfferAnswered: number;
  counters: number;
  countersAccepted: number;
}

export interface SimulationReport {
  runs: number;
  seed: number;
  policies: Record<string, PolicyReport>;
  claims: ClaimStats;
  contracts: Record<string, Record<string, number>>;
  /** Casts by AI seats, per spell, and per 100 AI hands. */
  aiCasts: Record<string, number>;
  aiCastsPer100Hands: number;
  playerCasts: Record<string, number>;
  evolutions: Record<string, number>;
  invariantChecks: number;
}

const inc = (o: Record<string, number>, k: string, n = 1) => {
  o[k] = (o[k] ?? 0) + n;
};

export function simulateRuns(runs: number, seed = 1, maxSteps = 60_000): SimulationReport {
  const report: SimulationReport = {
    runs,
    seed,
    policies: {},
    claims: { total: 0, byRole: { playerDebtor: 0, playerClaimant: 0, npcOnly: 0 }, outcomes: {}, firstOfferAccepted: 0, firstOfferAnswered: 0, counters: 0, countersAccepted: 0 },
    contracts: {},
    aiCasts: {},
    aiCastsPer100Hands: 0,
    playerCasts: {},
    evolutions: {},
    invariantChecks: 0,
  };
  let aiHands = 0;
  let aiCastTotal = 0;
  for (let i = 0; i < runs; i++) {
    const policy: PolicyName = POLICIES[i % POLICIES.length];
    const pr = (report.policies[policy] ??= { runs: 0, endings: {}, survival: 0, tableReached: {}, tableOutcomes: {}, bankruptcies: 0, avgHands: 0, avgFinalChips: 0, avgMs: 0 });
    const t0 = performance.now();
    let run: RunState = createRun(seed * 100_003 + i);
    const rng = new Rng(seed * 7_919 + i);
    const seenClaims = new Set<string>();
    const seenCasts = new Set<string>();
    let bankrupt = false;
    let steps = 0;
    for (;;) {
      const next = step(run, policy, rng);
      if (!next) break;
      run = next;
      assertRunInvariants(run);
      report.invariantChecks++;
      if (++steps > maxSteps) throw new Error(`run ${i} (${policy}) stuck at ${run.node}`);
      const t = run.table;
      if (!t) continue;
      const me = humanSeat(t);
      const tag = `${run.tableNode}:${t.handNumber}`;
      t.table.magic.events.forEach((e, k) => {
        const key = `${tag}:${k}`;
        if (seenCasts.has(key)) return;
        seenCasts.add(key);
        if (e.seat === me) inc(report.playerCasts, SPELLS[e.spell].id);
        else {
          inc(report.aiCasts, SPELLS[e.spell].id);
          aiCastTotal++;
        }
      });
      for (const c of t.claims?.claims ?? []) {
        const key = `${run.tableNode}:${t.claims!.handNumber}:${c.id}`;
        if (!c.outcome || seenClaims.has(key)) continue;
        seenClaims.add(key);
        const s = report.claims;
        s.total++;
        const claimantSeat = c.claimant.kind === 'seat' ? c.claimant.seat : -1;
        if (c.debtor === me) {
          s.byRole.playerDebtor++;
          bankrupt = true;
        } else if (claimantSeat === me) s.byRole.playerClaimant++;
        else s.byRole.npcOnly++;
        inc(s.outcomes, c.outcome.kind === 'death' ? `death:${c.outcome.reason}` : `survival:${c.outcome.pact}`);
        if (c.accepted !== null) {
          s.firstOfferAnswered++;
          if (c.accepted) s.firstOfferAccepted++;
        }
        if (c.counter) {
          s.counters++;
          if (c.outcome.kind === 'survival' && c.outcome.pact === c.counter.pact) s.countersAccepted++;
        }
      }
    }
    // Per-hand AI opportunities: every non-player seat dealt into each hand played.
    for (const r of run.results) aiHands += r.hands * (r.standings.length - 1);
    for (const line of run.log) if (line.includes(' evolves into ')) inc(report.evolutions, line.replace(/\.$/, ''));
    for (const k of run.contracts) inc((report.contracts[k.pact] ??= {}), k.status);
    pr.runs++;
    inc(pr.endings, run.node);
    if (run.node !== 'death') pr.survival++;
    if (bankrupt) pr.bankruptcies++;
    for (const r of run.results) {
      inc(pr.tableReached, r.node);
      inc((pr.tableOutcomes[r.node] ??= {}), r.outcome);
    }
    pr.avgHands += run.results.reduce((a, r) => a + r.hands, 0);
    pr.avgFinalChips += run.accounts.you;
    pr.avgMs += performance.now() - t0;
  }
  for (const pr of Object.values(report.policies)) {
    pr.survival = +(pr.survival / pr.runs).toFixed(3);
    pr.avgHands = +(pr.avgHands / pr.runs).toFixed(1);
    pr.avgFinalChips = +(pr.avgFinalChips / pr.runs).toFixed(1);
    pr.avgMs = +(pr.avgMs / pr.runs).toFixed(1);
  }
  report.aiCastsPer100Hands = +((100 * aiCastTotal) / Math.max(1, aiHands)).toFixed(1);
  return report;
}
