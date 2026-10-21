/**
 * Headless run driver: plays a whole P4 slice with a scripted player policy.
 * Used by tests and by scripts/simulate-runs.ts (design v0.6 acceptance:
 * 1,000 seeded runs across contrasting skill policies).
 */
import { postflopEquity } from '../ai/agent';
import { decideChoice, decideOpening, decideTurn, knownCards } from '../ai/magic';
import { preflopPercentile } from '../ai/preflop';
import { shovePrior, shoveRate } from '../ai/reads';
import { type AiProfile, PROFILES } from '../ai/profiles';
import { getMagicView, isBaseSpell, SLOT_LIMITS } from '../magic';
import { getLegalActions, getPublicView, type PlayerAction } from '../rules/engine';
import { Rng } from '../rules/rng';
import { type HumanCommand, humanSeat, sessionStatus, type TableSession } from '../table/session';
import { currentClaim, pactOptions, roles } from '../world';
import {
  ARCHIVE_RIVALS,
  attuneOptions,
  canRecover,
  ENDINGS,
  mirrorCandidates,
  mirrorChoice,
  resonanceTargets,
  evolutionOffers,
  playerChips,
  runAi,
  runClaim,
  type RunCommand,
  runCommand,
  runHuman,
  runNextHand,
  type RunState,
} from './run';

export type PolicyName = 'skilled' | 'passive' | 'maniac' | 'tight' | 'mixed_aggressive';
export const POLICIES: PolicyName[] = ['skilled', 'passive', 'maniac', 'tight', 'mixed_aggressive'];

/** The skilled policy plays like a disciplined, magic-using rival. */
export const SKILLED: AiProfile = { ...PROFILES.corvin, id: 'skilled', looseness: 0.35, aggression: 0.6, bluff: 0.08, stickiness: 0.35 };

/**
 * Mixed-aggressive (design v1.0 §02): opens and value-bets more, semi-bluffs
 * drawing hands, applies pot-sized pressure — and never shoves unless short or
 * already committed. Distinct from the all-in maniac. Uses only its own view.
 */
export const MIXED: AiProfile = { ...PROFILES.corvin, id: 'mixed_aggressive', looseness: 0.55, aggression: 0.9, bluff: 0.22, stickiness: 0.4 };

function mixedAggressive(t: TableSession, action: PlayerAction, rng: Rng): PlayerAction {
  const me = humanSeat(t);
  const hand = t.table.hand;
  const legal = getLegalActions(hand)!;
  const p = hand.seats[me];
  const pot = hand.seats.reduce((a, x) => a + x.totalCommitted, 0);
  const stackBB = (p.stack + p.streetCommitted) / hand.setup.bigBlind;
  const committed = p.totalCommitted / (p.totalCommitted + p.stack);
  // Semi-bluff: on the flop or turn, a drawing-strength hand bets instead of checking.
  if (action.type === 'check' && legal.raise && (hand.street === 'flop' || hand.street === 'turn')) {
    const view = getPublicView(hand, me);
    const eq = postflopEquity(view, rng, knownCards(view, getMagicView(t.table, me)));
    if (eq >= 0.3 && eq < 0.55 && rng.nextFloat() < 0.5) {
      const to = Math.max(legal.raise.minTo, Math.min(legal.raise.maxTo, Math.round(pot * 0.6)));
      return { type: legal.raise.isBet ? 'bet' : 'raise', to };
    }
  }
  // Pressure without shoving: cap bets at about the pot unless short-stacked or pot-committed.
  const shoves = action.type === 'allIn' || ((action.type === 'bet' || action.type === 'raise') && action.to >= p.stack + p.streetCommitted);
  if (shoves && legal.raise && stackBB > 12 && committed < 0.4) {
    const to = Math.max(legal.raise.minTo, Math.min(legal.raise.maxTo, Math.round(hand.currentBet + pot + legal.callAmount)));
    if (to < legal.raise.maxTo) return { type: legal.raise.isBet ? 'bet' : 'raise', to };
  }
  return action;
}

function pokerAction(t: TableSession, policy: PolicyName, rng: Rng): PlayerAction {
  const me = humanSeat(t);
  const legal = getLegalActions(t.table.hand)!;
  const free: PlayerAction = legal.canCheck ? { type: 'check' } : { type: 'fold' };
  switch (policy) {
    case 'passive':
      return legal.canCheck ? { type: 'check' } : { type: 'call' };
    case 'maniac':
      return legal.raise ? { type: 'allIn' } : legal.canCheck ? { type: 'check' } : { type: 'call' };
    case 'tight': {
      const hole = t.table.hand.seats[me].hole;
      const strong = preflopPercentile(hole[0], hole[1]) > 0.85;
      return strong ? (legal.canCheck ? { type: 'check' } : { type: 'call' }) : free;
    }
    case 'skilled':
    case 'mixed_aggressive':
      throw new Error('magic-aware policies decide in humanDecision');
  }
  return free;
  void rng;
}

/**
 * The scripted player's decision at its own turn, window, Second Reflection or
 * Sigil, from its own views only (shared by runs and the offline spell-EV study).
 */
export function humanDecision(t: TableSession, policy: PolicyName, rng: Rng): HumanCommand {
  const me = humanSeat(t);
  const view = getPublicView(t.table.hand, me);
  const magic = getMagicView(t.table, me);
  switch (sessionStatus(t)) {
    case 'humanSigil': {
      // Skilled play rearranges a duplicate draw; other policies keep it.
      const hand = magic.myHand;
      const dup = policy === 'skilled' ? hand.find((c, i) => hand.findIndex((d) => d.spell === c.spell) !== i) : undefined;
      return { kind: 'sigil', uid: dup?.uid ?? null };
    }
    case 'humanChoice':
      return { kind: 'choose', pick: decideChoice(view, magic) };
    case 'humanWindow': {
      if (policy !== 'skilled' && policy !== 'mixed_aggressive') return { kind: 'pass' };
      const c = decideOpening(view, magic, policy === 'skilled' ? SKILLED : MIXED, rng);
      return c.kind === 'pass' ? { kind: 'pass' } : { kind: 'cast', uid: c.uid, params: c.params };
    }
    case 'humanToAct': {
      if (policy !== 'skilled' && policy !== 'mixed_aggressive') return { kind: 'act', action: pokerAction(t, policy, rng) };
      const c = decideTurn(view, magic, policy === 'skilled' ? SKILLED : MIXED, rng, publicShoveRates(t));
      if (c.kind === 'cast') return { kind: 'cast', uid: c.uid, params: c.params };
      return { kind: 'act', action: policy === 'mixed_aggressive' ? mixedAggressive(t, c.action, rng) : c.action };
    }
    default:
      throw new Error('Not the player’s decision');
  }
}

/** Smoothed public shove rates for every seat (design v0.7 §01). */
export function publicShoveRates(t: TableSession): number[] {
  const reads = t.reads ?? {};
  return t.seats.map((s) => shoveRate(reads[s.id], shovePrior(s.profileId ? PROFILES[s.profileId] : undefined)));
}

/** Policies that shop, study and bargain like a thinking player (route choices). */
const strategic = (policy: PolicyName) => policy === 'skilled' || policy === 'mixed_aggressive';

/** One step of the run under `policy`. Returns null when the run has ended. */
export function step(run: RunState, policy: PolicyName, rng: Rng): RunState | null {
  if (ENDINGS.includes(run.node)) return null;
  const t = run.table;
  if (t) {
    const status = sessionStatus(t);
    const me = humanSeat(t);
    switch (status) {
      case 'aiToAct':
        return runAi(run);
      case 'humanSigil':
      case 'humanChoice':
      case 'humanWindow':
      case 'humanToAct':
        return runHuman(run, humanDecision(t, policy, rng));
      case 'humanClaim': {
        const claim = currentClaim(t.claims!)!;
        if (claim.stage === 'counter') return runClaim(run, { kind: 'answerCounter', accept: true });
        const usable = pactOptions(t.claims!, t.world).filter((o) => !o.blocker);
        const debtor = roles(t.world, claim).proposer === 'debtor';
        if (!usable.length) return runClaim(run, { kind: debtor ? 'acceptFate' : 'claimLife' });
        // Debtors plead for the best outlook; claimants grant mercy (skilled) or claim the life.
        if (!debtor && !strategic(policy)) return runClaim(run, { kind: 'claimLife' });
        const rank = { HIGH: 0, FAIR: 1, LOW: 2 } as const;
        const best = [...usable].sort((a, b) => rank[a.outlook!] - rank[b.outlook!])[0];
        return runClaim(run, { kind: 'propose', pact: debtor ? best.pact : 'mercy' });
      }
      case 'claimResolved':
        return runClaim(run, { kind: 'acknowledge' });
      case 'handComplete': {
        const att = attuneOptions(run)[0];
        if (att) return runCommand(run, { kind: 'attune', uid: att.uid });
        const evo = evolutionOffers(run).find((o) => !o.needsToken);
        if (evo) return runCommand(run, { kind: 'evolve', uid: evo.card.uid, branch: evo.branches[0] });
        return runNextHand(run);
      }
      default:
        return runCommand(run, { kind: 'advance' });
    }
  }
  return runCommand(run, routeChoice(run, policy));
}

function routeChoice(run: RunState, policy: PolicyName): RunCommand {
  switch (run.node) {
    case 'lantern_shop': {
      const chips = playerChips(run);
      const affordable = run.shop!.offers.findIndex((o) => !o.sold && chips - o.price >= 40);
      if (strategic(policy) && affordable >= 0) return { kind: 'buy', offer: affordable };
      return { kind: 'leaveShop', to: strategic(policy) && !run.eventResolved ? 'optional_event' : 'contract_2' };
    }
    case 'velvet_exchange': {
      const chips = playerChips(run);
      const affordable = run.shop!.offers.findIndex((o) => !o.sold && chips - o.price >= 60 && (run.player.magic.relics ?? []).length < SLOT_LIMITS.relics);
      if (strategic(policy) && affordable >= 0) return { kind: 'buy', offer: affordable };
      return { kind: 'leaveShop', to: strategic(policy) ? 'mirror_audience' : 'secret_bargain' };
    }
    case 'mirror_audience': {
      if (mirrorChoice(run)) return { kind: 'advance' };
      const rival = mirrorCandidates(run)[0];
      return rival ? { kind: 'event', take: true, rival } : { kind: 'event', take: false };
    }
    case 'secret_bargain':
      return policy === 'maniac' || strategic(policy) ? { kind: 'event', take: true, uid: resonanceTargets(run)[0]?.uid } : { kind: 'event', take: false };
    case 'act2_petition':
      return { kind: 'petition', choice: 'favor' };
    case 'crown_writ':
      return canRecover(run) && policy !== 'maniac' ? { kind: 'recover' } : { kind: 'advance' };
    case 'crown_archive': {
      if (run.flags.includes('archive_done')) return { kind: 'advance' };
      const uid = resonanceTargets(run)[0]?.uid;
      return strategic(policy) || !uid ? { kind: 'archive', choice: 'study', rival: ARCHIVE_RIVALS[0] } : { kind: 'archive', choice: 'resonate', uid };
    }
    case 'royal_exchange': {
      const chips = playerChips(run);
      const affordable = run.shop!.offers.findIndex((o) => !o.sold && chips - o.price >= 80 && (run.player.magic.relics ?? []).length < SLOT_LIMITS.relics);
      if (strategic(policy) && affordable >= 0) return { kind: 'buy', offer: affordable };
      return { kind: 'leaveShop', to: 'seals_table' };
    }
    case 'optional_event':
      return { kind: 'event', take: playerChips(run) >= 60 };
    case 'reward': {
      const offers = evolutionOffers(run);
      if (offers.length && strategic(policy)) {
        const token = run.reward!.findIndex((r) => r.kind === 'evolution_token');
        if (token >= 0) return { kind: 'reward', index: token };
      }
      const full = (run.player.magic.relics ?? []).length >= SLOT_LIMITS.relics;
      return {
        kind: 'reward',
        index: 0,
        replace: full && run.reward![0].kind === 'relic' ? run.player.magic.relics![0] : undefined,
        uid: run.reward![0].kind === 'resonance' ? resonanceTargets(run)[0]?.uid : undefined,
      };
    }
    case 'setback_audience':
      return { kind: 'setback', choice: 'public_record' };
    default: {
      const att = attuneOptions(run)[0];
      if (att) return { kind: 'attune', uid: att.uid };
      const evo = evolutionOffers(run)[0];
      if (evo && isBaseSpell(evo.card.spell)) return { kind: 'evolve', uid: evo.card.uid, branch: evo.branches[1], useToken: evo.needsToken };
      return { kind: 'advance' };
    }
  }
}

/** Plays a run to its ending (bounded), returning the final state. */
export function playRun(run: RunState, policy: PolicyName, seed: number, maxSteps = 50_000): RunState {
  const rng = new Rng(seed);
  for (let i = 0; i < maxSteps; i++) {
    const next = step(run, policy, rng);
    if (!next) return run;
    run = next;
  }
  throw new Error(`Run did not finish within ${maxSteps} steps (stuck at ${run.node})`);
}
