/**
 * Full-table counterfactual spell value (design v1.0 §01,
 * p8-counterfactual-table-ev.json). From one legally reached, persistable
 * pre-cast run state, arm A casts a legal spell and arm B declines it (a pass in
 * a window; the same raise without enchantment for Cinder; the poker decision
 * alone otherwise). Both arms then play the rest of the current table with the
 * same downstream policy and the same policy randomness; rivals and Last Claims
 * proceed exactly as in play. Nothing after the table is credited to a spell.
 * Offline analysis only.
 */
import { decide } from '../ai/agent';
import { knownCards } from '../ai/magic';
import type { CastOption, CastParams } from '../magic/table';
import { getMagicView } from '../magic/table';
import { SPELLS } from '../magic/spells';
import { rankOf } from '../rules/cards';
import { getLegalActions, getPublicView, type PlayerAction } from '../rules/engine';
import { Rng } from '../rules/rng';
import { type HumanCommand, humanSeat, sessionStatus } from '../table/session';
import { humanDecision, MIXED, type PolicyName, publicShoveRates, SKILLED, step } from './driver';
import { PLAYER_ID, runHuman, type RunState } from './run';

export interface TablePair {
  spell: string;
  policy: PolicyName;
  /** Cluster: the source run (pairs from one run are correlated). */
  cluster: number;
  /** End-of-table player net Lifechips, cast minus skip. */
  diff: number;
  /** End-of-hand difference in the same arms (context only; not additive). */
  handDiff: number;
  castDied: boolean;
  skipDied: boolean;
  castWon: boolean;
  skipWon: boolean;
  castAether: number;
  skipAether: number;
  /** Player casts after the decision (the decision's own cast excluded). */
  castLaterSpells: number;
  skipLaterSpells: number;
  /** Sum of |hand net| after the decision. */
  castTurnover: number;
  skipTurnover: number;
  divergent: boolean;
}

function paramsFor(run: RunState, o: CastOption, raiseTo: number | null): CastParams | null {
  const t = run.table!;
  const me = humanSeat(t);
  const view = getPublicView(t.table.hand, me);
  const family = SPELLS[o.spell].family;
  if (family === 'briar_lock') return { spell: o.spell as 'briar_lock' };
  if (family === 'fate_exchange') {
    const hole = view.seats[me].hole!;
    return { spell: o.spell as 'fate_exchange', holeIndex: rankOf(hole[0]) <= rankOf(hole[1]) ? 0 : 1 };
  }
  if (family === 'unmask') {
    const targets = o.targets ?? [];
    if (!targets.length) return null;
    const aggressor = [...view.log].reverse().find((e) => e.action.type === 'bet' || e.action.type === 'raise')?.seat;
    const first = targets.includes(aggressor ?? -1) ? aggressor! : targets[0];
    if (o.spell === 'twin_oracle') return { spell: 'twin_oracle', targets: targets.length > 1 ? [first, targets.find((x) => x !== first)!] : [first] };
    return { spell: o.spell as 'unmask', target: first };
  }
  return raiseTo === null ? null : { spell: o.spell as 'cinder_challenge', raiseTo };
}

function pokerOnly(run: RunState, policy: PolicyName, rng: Rng): PlayerAction {
  const t = run.table!;
  if (policy === 'skilled' || policy === 'mixed_aggressive') {
    const me = humanSeat(t);
    const view = getPublicView(t.table.hand, me);
    return decide(view, policy === 'skilled' ? SKILLED : MIXED, rng, knownCards(view, getMagicView(t.table, me)), publicShoveRates(t));
  }
  const cmd = humanDecision(t, policy, rng);
  return cmd.kind === 'act' ? cmd.action : getLegalActions(t.table.hand)!.canCheck ? { type: 'check' } : { type: 'fold' };
}

interface ArmResult {
  net: number;
  handNet: number;
  died: boolean;
  won: boolean;
  aether: number;
  later: number;
  turnover: number;
  trace: string;
}

/** Plays the rest of the current table; reads endpoints from the run's own table result. */
function playTable(run: RunState, policy: PolicyName, rng: Rng, firstHand: number): ArmResult {
  const node = run.tableNode!;
  let handNet: number | null = null;
  let later = 0;
  let turnover = 0;
  let aether = 0;
  const seenHands = new Set<number>();
  const trace: string[] = [];
  for (let guard = 0; guard < 20_000 && run.table && run.tableNode === node; guard++) {
    const t = run.table;
    const me = humanSeat(t);
    aether = t.table.seats[me].aether;
    if (t.table.hand.phase === 'complete' && !seenHands.has(t.handNumber)) {
      seenHands.add(t.handNumber);
      const net = t.table.hand.result!.netChange[me];
      if (t.handNumber === firstHand) handNet = net;
      turnover += Math.abs(net);
    }
    const before = t.table.magic.events.filter((e) => e.seat === me).length;
    const handBefore = t.handNumber;
    const next = step(run, policy, rng);
    if (!next) break;
    if (next.table && next.table.handNumber === handBefore) later += next.table.table.magic.events.filter((e) => e.seat === humanSeat(next.table!)).length - before;
    if (sessionStatus(t) !== 'aiToAct') trace.push(String(next.table?.table.hand.log.length ?? -1));
    run = next;
  }
  const r = run.results.at(-1)!;
  return { net: r.net, handNet: handNet ?? 0, died: r.outcome === 'dead', won: r.outcome === 'win', aether, later, turnover, trace: trace.join(',') };
}

/**
 * Paired full-table continuations at the player's current decision, one per
 * castable spell (deduplicated) and downstream policy. `only` limits spells.
 */
export function tablePairsAt(run: RunState, policies: PolicyName[], seed: number, cluster: number, only?: Set<string>): { pairs: TablePair[]; incompatible: number } {
  const t = run.table;
  if (!t) return { pairs: [], incompatible: 0 };
  const status = sessionStatus(t);
  if (status !== 'humanWindow' && status !== 'humanToAct') return { pairs: [], incompatible: 0 };
  const me = humanSeat(t);
  const seen = new Set<string>();
  const options = getMagicView(t.table, me).options.filter((o) => (only && !only.has(o.spell) ? false : seen.has(o.spell) ? false : (seen.add(o.spell), true)));
  const pairs: TablePair[] = [];
  let incompatible = 0;
  for (const o of options) {
    for (const policy of policies) {
      const pairSeed = (seed * 31 + o.spell.length * 7 + policies.indexOf(policy)) >>> 0;
      try {
        let skipCmd: HumanCommand;
        let raiseTo: number | null = null;
        if (status === 'humanWindow') skipCmd = { kind: 'pass' };
        else {
          let action = pokerOnly(run, policy, new Rng(pairSeed));
          const legal = getLegalActions(t.table.hand)!;
          if (SPELLS[o.spell].family === 'cinder_challenge') {
            raiseTo = action.type === 'bet' || action.type === 'raise' ? action.to : legal.raise ? legal.raise.minTo : null;
            if (raiseTo !== null) action = { type: legal.raise!.isBet ? 'bet' : 'raise', to: raiseTo };
          }
          skipCmd = { kind: 'act', action };
        }
        const params = paramsFor(run, o, raiseTo);
        if (!params) continue;
        const hand = t.handNumber;
        const b = playTable(runHuman(run, skipCmd), policy, new Rng(pairSeed ^ 0x5bd1), hand);
        const a = playTable(runHuman(run, { kind: 'cast', uid: o.uid, params }), policy, new Rng(pairSeed ^ 0x5bd1), hand);
        pairs.push({
          spell: o.spell,
          policy,
          cluster,
          diff: a.net - b.net,
          handDiff: a.handNet - b.handNet,
          castDied: a.died,
          skipDied: b.died,
          castWon: a.won,
          skipWon: b.won,
          castAether: a.aether,
          skipAether: b.aether,
          castLaterSpells: a.later,
          skipLaterSpells: b.later,
          castTurnover: a.turnover,
          skipTurnover: b.turnover,
          divergent: a.trace !== b.trace,
        });
      } catch {
        incompatible++;
      }
    }
  }
  return { pairs, incompatible };
}

/** Cluster bootstrap: resample whole source runs, not correlated pairs. */
export function clusterBootstrap(values: { cluster: number; v: number }[], seed: number, resamples = 1000): { n: number; clusters: number; mean: number; ci95: [number, number] } {
  const groups = new Map<number, number[]>();
  for (const x of values) groups.set(x.cluster, [...(groups.get(x.cluster) ?? []), x.v]);
  const g = [...groups.values()];
  const n = values.length;
  if (!n) return { n: 0, clusters: 0, mean: 0, ci95: [0, 0] };
  const mean = values.reduce((a, x) => a + x.v, 0) / n;
  const rng = new Rng(seed);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < g.length; i++) {
      const c = g[rng.nextInt(g.length)];
      for (const v of c) sum += v;
      count += c.length;
    }
    means.push(sum / Math.max(1, count));
  }
  means.sort((x, y) => x - y);
  return { n, clusters: g.length, mean, ci95: [means[Math.floor(0.025 * resamples)], means[Math.floor(0.975 * resamples)]] };
}

export { PLAYER_ID };
