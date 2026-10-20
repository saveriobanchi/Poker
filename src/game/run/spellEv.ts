/**
 * Offline counterfactual spell value (design v0.9, p7-counterfactual-ev-plan.json).
 *
 * From one legally reached decision, arm A casts a specific legal spell and arm B
 * does not (a pass in an opening window, the same raise without enchantment for
 * Cinder, the poker decision alone otherwise). Both arms then play the hand out
 * with the same downstream policy and the same policy randomness (common random
 * numbers); the deck is the same because the state is cloned. Rivals decide from
 * their own views as always. This is an analysis tool only — never an in-game
 * oracle — and every branch keeps every engine invariant.
 */
import { decide } from '../ai/agent';
import { knownCards } from '../ai/magic';
import type { CastOption, CastParams } from '../magic/table';
import { castCost, getMagicView } from '../magic/table';
import { SPELLS } from '../magic/spells';
import { rankOf } from '../rules/cards';
import { getLegalActions, getPublicView, type PlayerAction } from '../rules/engine';
import { Rng } from '../rules/rng';
import { applyHumanCommand, deriveSeed, humanSeat, sessionStatus, stepAi, type TableSession } from '../table/session';
import { humanDecision, type PolicyName, publicShoveRates, SKILLED } from './driver';

export interface PairOutcome {
  spell: string;
  street: string;
  /** Effective stack depth in big blinds at the decision: shallow < 15 ≤ mid < 40 ≤ deep. */
  depth: 'shallow' | 'mid' | 'deep';
  policy: PolicyName;
  /** End-of-hand player net, cast arm minus skip arm. */
  diff: number;
  castNet: number;
  skipNet: number;
  castBust: boolean;
  skipBust: boolean;
  castShowdown: boolean;
  skipShowdown: boolean;
  aether: number;
  /** The two arms' later action sequences differ (expected; recorded, never forced equal). */
  divergent: boolean;
}

/** Parameters a reasonable caster would use for this option, from its own view only. */
function paramsFor(t: TableSession, o: CastOption, raiseTo: number | null): CastParams | null {
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
  if (raiseTo === null) return null;
  return { spell: o.spell as 'cinder_challenge', raiseTo };
}

/** Plays the current hand to completion with `policy` for the player; returns the final session. */
function playOut(t: TableSession, policy: PolicyName, rng: Rng, trace: string[]): TableSession {
  for (let guard = 0; guard < 400 && t.table.hand.phase === 'betting'; guard++) {
    const status = sessionStatus(t);
    if (status === 'aiToAct') t = stepAi(t);
    else {
      const cmd = humanDecision(t, policy, rng);
      trace.push(JSON.stringify(cmd));
      t = applyHumanCommand(t, cmd);
    }
  }
  return t;
}

function outcome(t: TableSession): { net: number; bust: boolean; showdown: boolean } {
  const me = humanSeat(t);
  const r = t.table.hand.result!;
  return { net: r.netChange[me], bust: t.table.hand.seats[me].stack === 0, showdown: r.showdown.some((e) => e.seat === me) };
}

/** The skip arm's immediate poker action at a decision (no spell). */
function pokerOnly(t: TableSession, policy: PolicyName, rng: Rng): PlayerAction {
  if (policy === 'skilled') {
    const me = humanSeat(t);
    const view = getPublicView(t.table.hand, me);
    return decide(view, SKILLED, rng, knownCards(view, getMagicView(t.table, me)), publicShoveRates(t));
  }
  const cmd = humanDecision(t, policy, rng);
  return cmd.kind === 'act' ? cmd.action : getLegalActions(t.table.hand)!.canCheck ? { type: 'check' } : { type: 'fold' };
}

/**
 * Every paired comparison available at the player's current decision: one per
 * castable spell instance (deduplicated by spell) and downstream policy.
 * Returns [] when the player has no castable spell or it is not their decision.
 */
export function pairsAt(t: TableSession, policies: PolicyName[], seed: number): { pairs: PairOutcome[]; incompatible: number } {
  const status = sessionStatus(t);
  if (status !== 'humanWindow' && status !== 'humanToAct') return { pairs: [], incompatible: 0 };
  const me = humanSeat(t);
  const magic = getMagicView(t.table, me);
  const seen = new Set<string>();
  const options = magic.options.filter((o) => (seen.has(o.spell) ? false : (seen.add(o.spell), true)));
  const hand = t.table.hand;
  const p = hand.seats[me];
  const bb = hand.setup.bigBlind;
  const depthBB = (p.stack + p.streetCommitted) / bb;
  const depth = depthBB < 15 ? 'shallow' : depthBB < 40 ? 'mid' : 'deep';
  const pairs: PairOutcome[] = [];
  let incompatible = 0;
  for (const o of options) {
    for (const policy of policies) {
      const pairSeed = deriveSeed(seed, o.spell.length, policies.indexOf(policy), hand.log.length);
      try {
        // Skip arm first: its poker decision also fixes the Cinder raise size for both arms.
        const rngB = new Rng(pairSeed);
        let skip: TableSession;
        let raiseTo: number | null = null;
        if (status === 'humanWindow') skip = applyHumanCommand(t, { kind: 'pass' });
        else {
          let action = pokerOnly(t, policy, rngB);
          const legal = getLegalActions(hand)!;
          if (SPELLS[o.spell].family === 'cinder_challenge') {
            raiseTo = action.type === 'bet' || action.type === 'raise' ? action.to : legal.raise ? legal.raise.minTo : null;
            if (raiseTo !== null) action = { type: legal.raise!.isBet ? 'bet' : 'raise', to: raiseTo };
          }
          skip = applyHumanCommand(t, { kind: 'act', action });
        }
        const params = paramsFor(t, o, raiseTo);
        if (!params) continue;
        const traceB: string[] = [];
        skip = playOut(skip, policy, new Rng(pairSeed ^ 0x5bd1), traceB);
        const traceA: string[] = [];
        let cast = applyHumanCommand(t, { kind: 'cast', uid: o.uid, params });
        cast = playOut(cast, policy, new Rng(pairSeed ^ 0x5bd1), traceA);
        if (cast.table.hand.phase !== 'complete' || skip.table.hand.phase !== 'complete') {
          incompatible++;
          continue;
        }
        const a = outcome(cast);
        const b = outcome(skip);
        pairs.push({
          spell: o.spell,
          street: hand.street,
          depth,
          policy,
          diff: a.net - b.net,
          castNet: a.net,
          skipNet: b.net,
          castBust: a.bust,
          skipBust: b.bust,
          castShowdown: a.showdown,
          skipShowdown: b.showdown,
          aether: castCost(t.table.seats[me], o.spell).cost,
          divergent: traceA.join('|') !== traceB.join('|'),
        });
      } catch {
        incompatible++;
      }
    }
  }
  return { pairs, incompatible };
}

/** Paired mean with a seeded bootstrap 95% interval. */
export function bootstrapMean(diffs: number[], seed: number, resamples = 1000): { n: number; mean: number; ci95: [number, number]; sd: number } {
  const n = diffs.length;
  if (!n) return { n: 0, mean: 0, ci95: [0, 0], sd: 0 };
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const rng = new Rng(seed);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += diffs[rng.nextInt(n)];
    means.push(sum / n);
  }
  means.sort((x, y) => x - y);
  return { n, mean, ci95: [means[Math.floor(0.025 * resamples)], means[Math.floor(0.975 * resamples)]], sd };
}
