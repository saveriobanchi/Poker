/**
 * Seeded batch simulation of whole P4 runs (design v0.6 acceptance: 1,000 runs
 * across contrasting player policies). Every step re-checks the global Lifechip
 * invariant; the report aggregates route, claim, contract and magic outcomes.
 */
import { RELICS } from '../magic/relics';
import { SPELLS } from '../magic/spells';
import { Rng } from '../rules/rng';
import { humanSeat } from '../table/session';
import { type PolicyName, POLICIES, step } from './driver';
import { assertRunInvariants, createRun, type RunState } from './run';

export interface PolicyReport {
  runs: number;
  /** Final ending of the whole run (Act II, Undercircuit or death). */
  endings: Record<string, number>;
  /** How Act I ended: its chapter end, or death before one. */
  act1: Record<string, number>;
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
  /** Phase-conditional cohorts (design v0.8 balance plan): entrants, deaths in that phase, clears. */
  cohorts: Record<Cohort, { n: number; died: number; cleared: number }>;
  /** Where deaths happened. */
  deathsByPhase: Record<string, number>;
  /** Runs where the player evolved at least one spell. */
  evolvedAny: number;
  /** Relics gained, by `${source}:${rarity}`. */
  relics: Record<string, number>;
  whisper: { offered: number; accepted: number };
  /** Player Lifechips repaid on debts, and NPC voluntary payments (all policies' runs). */
  repaid: { player: number; npcVoluntary: number };
}

export type Cohort = 'all' | 'act2_entrants' | 'act2_survivors' | 'fallen_entrants' | 'under_entrants' | 'act3_entrants';

const PHASE: Record<string, string> = {
  contract_1: 'act1',
  contract_2: 'act1',
  boss_ledger: 'act1',
  masked_salon: 'act2',
  velvet_arena: 'act2',
  crown_inquest: 'act2',
  coronet_table: 'act3',
  seals_table: 'act3',
  crown_table: 'act3',
  fallen_low_table: 'fallen',
  cinder_low_table: 'fallen',
  underlamp_table: 'under',
};

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
  /** AI calls of a large preflop shove: how often, how often won, and the AIs' total net. */
  shoveCalls: { n: number; won: number; net: number };
  /** Last Claim outcomes by deciding character and outcome. */
  claimsByCharacter: Record<string, Record<string, number>>;
  /** Runs whose perimeter expansions repeated a key (must stay 0). */
  ingressViolations: number;
}

const COHORTS: Cohort[] = ['all', 'act2_entrants', 'act2_survivors', 'fallen_entrants', 'under_entrants', 'act3_entrants'];

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
    shoveCalls: { n: 0, won: 0, net: 0 },
    claimsByCharacter: {},
    ingressViolations: 0,
  };
  let aiHands = 0;
  let aiCastTotal = 0;
  for (let i = 0; i < runs; i++) {
    // Shared seeds: every policy plays the same worlds (k-th run of each policy uses world k).
    const policy: PolicyName = POLICIES[i % POLICIES.length];
    const k = Math.floor(i / POLICIES.length);
    const pr = (report.policies[policy] ??= {
      runs: 0,
      endings: {},
      act1: {},
      survival: 0,
      tableReached: {},
      tableOutcomes: {},
      bankruptcies: 0,
      avgHands: 0,
      avgFinalChips: 0,
      avgMs: 0,
      cohorts: Object.fromEntries(COHORTS.map((c) => [c, { n: 0, died: 0, cleared: 0 }])) as PolicyReport['cohorts'],
      deathsByPhase: {},
      evolvedAny: 0,
      relics: {},
      whisper: { offered: 0, accepted: 0 },
      repaid: { player: 0, npcVoluntary: 0 },
    });
    const t0 = performance.now();
    let run: RunState = createRun(seed * 100_003 + k);
    const rng = new Rng(seed * 7_919 + k);
    const seenClaims = new Set<string>();
    const seenCasts = new Set<string>();
    const seenHands = new Set<string>();
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
      if (t.table.hand.phase === 'complete' && !seenHands.has(tag)) {
        seenHands.add(tag);
        const h = t.table.hand;
        const shove = h.log.findIndex(
          (e) => e.street === 'preflop' && (e.action.type === 'raise' || e.action.type === 'bet') && e.action.to >= 0.5 * h.setup.players[e.seat].stack,
        );
        if (shove >= 0) {
          for (const e of h.log.slice(shove + 1)) {
            if (e.street !== 'preflop' || e.action.type !== 'call' || e.seat === me) continue;
            const net = h.result!.netChange[e.seat];
            report.shoveCalls.n++;
            report.shoveCalls.net += net;
            if (net > 0) report.shoveCalls.won++;
          }
        }
      }
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
        const outcome = c.outcome.kind === 'death' ? `death:${c.outcome.reason}` : `survival:${c.outcome.pact}`;
        inc(s.outcomes, outcome);
        // The deciding party: the claimant when the player is the debtor, else the debtor.
        const decider = c.debtor === me ? (claimantSeat >= 0 ? t.seats[claimantSeat].id : 'adjudicator') : t.seats[c.debtor].id;
        inc((report.claimsByCharacter[decider] ??= {}), outcome);
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
    inc(pr.act1, run.chapters[0] ?? run.node);
    if (run.node !== 'death') pr.survival++;
    if (bankrupt) pr.bankruptcies++;
    for (const r of run.results) {
      inc(pr.tableReached, r.node);
      inc((pr.tableOutcomes[r.node] ??= {}), r.outcome);
    }
    // Phase-conditional cohorts.
    const deathPhase = run.node === 'death' ? (PHASE[run.results.at(-1)?.node ?? ''] ?? 'other') : null;
    if (deathPhase) inc(pr.deathsByPhase, deathPhase);
    const fell = run.results.some((r) => r.outcome === 'fallen');
    const cohort = (c: Cohort, entered: boolean, diedHere: boolean, cleared: boolean) => {
      if (!entered) return;
      pr.cohorts[c].n++;
      if (diedHere) pr.cohorts[c].died++;
      if (cleared) pr.cohorts[c].cleared++;
    };
    const act2Left = run.chapters.includes('act2_victory') || run.chapters.includes('act2_living_exile');
    cohort('all', true, run.node === 'death', run.node === 'the_ledger_unbound');
    cohort('act2_entrants', run.flags.includes('act2_entered'), deathPhase === 'act2', run.chapters.includes('act2_victory'));
    cohort('act2_survivors', act2Left, run.node === 'death', run.node === 'the_ledger_unbound');
    cohort('fallen_entrants', fell, deathPhase === 'fallen', run.node !== 'death');
    cohort('under_entrants', run.flags.includes('under_entered'), deathPhase === 'under', run.flags.includes('bound_writ') || (run.flags.includes('under_entered') && run.flags.includes('act3_entered')));
    cohort('act3_entrants', run.flags.includes('act3_entered'), deathPhase === 'act3', run.node === 'the_ledger_unbound');
    if (run.log.some((l) => l.includes(' evolves into '))) pr.evolvedAny++;
    for (const l of run.log) {
      const reward = /^Reward: (.+)\.$/.exec(l)?.[1];
      const bought = /^Bought (.+) for \d+\.$/.exec(l)?.[1];
      const name = reward ?? bought;
      const relic = name && Object.values(RELICS).find((x) => x.name === name);
      if (relic) inc(pr.relics, `${reward ? 'reward' : 'shop'}:${relic.rarity}`);
      if (l === 'You accept the Whispered Contract.') {
        pr.whisper.offered++;
        pr.whisper.accepted++;
      }
      if (l === 'You decline the Whispered Contract.') pr.whisper.offered++;
    }
    for (const j of run.journal) {
      if (j.reason.startsWith('debt repayment')) pr.repaid.player += j.amount;
      if (j.reason.startsWith('voluntary debt payment')) pr.repaid.npcVoluntary += j.amount;
    }
    const keys = run.perimeter.expansions.map((e) => e.key);
    if (new Set(keys).size !== keys.length) report.ingressViolations++;
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
