/**
 * Local rules-based poker AI. Decides from a PublicView only: its own cards,
 * the board, stacks and the public action log. It never sees the deck or other
 * seats' hidden cards (design bible §4, §6 fairness invariant).
 */
import type { Card } from '../rules/cards';
import type { LegalActions, PlayerAction, PublicView } from '../rules/engine';
import { Rng } from '../rules/rng';
import { estimateEquity } from './equity';
import { preflopPercentile } from './preflop';
import type { AiProfile } from './profiles';

const POSTFLOP_ITERATIONS = 260;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Bet/raise to roughly `desiredTo`, clamped to legal sizes; shoves when the rest would be trivial. */
function sizedRaise(legal: LegalActions, desiredTo: number): PlayerAction {
  const r = legal.raise!;
  let to = clamp(Math.round(desiredTo), r.minTo, r.maxTo);
  if (r.maxTo - to < 0.3 * to) to = r.maxTo;
  return { type: r.isBet ? 'bet' : 'raise', to };
}

function passive(legal: LegalActions): PlayerAction {
  return legal.canCheck ? { type: 'check' } : { type: 'fold' };
}

function continueCheaply(legal: LegalActions): PlayerAction {
  return legal.canCheck ? { type: 'check' } : { type: 'call' };
}

/**
 * Infers how strong an opponent's preflop range is from their public actions:
 * the minimum preflop percentile assumed when sampling their hidden cards.
 */
export function inferRange(view: PublicView, seat: number): number {
  let pct = 0;
  for (const e of view.log) {
    if (e.seat !== seat) continue;
    const aggressive = e.action.type === 'bet' || e.action.type === 'raise';
    if (e.street === 'preflop') {
      if (aggressive) pct = Math.max(pct, 0.7);
      else if (e.action.type === 'call') pct = Math.max(pct, 0.4);
    } else if (aggressive) {
      pct = Math.min(0.9, Math.max(pct, 0.45) + 0.1);
    } else if (e.action.type === 'call') {
      pct = Math.min(0.9, Math.max(pct, 0.3) + 0.05);
    }
  }
  return pct;
}

/**
 * @param known opponent cards this seat legitimately learned (Unmask), never anything else.
 */
export function decide(
  view: PublicView,
  profile: AiProfile,
  rng: Rng,
  known: { seat: number; card: Card }[] = [],
): PlayerAction {
  const legal = view.legal;
  const me = view.seats[view.viewer];
  if (!legal || !me.hole) throw new Error('AI asked to act when it is not its turn');
  return view.street === 'preflop' ? preflop(view, profile, legal, rng) : postflop(view, profile, legal, rng, known);
}

function preflop(view: PublicView, p: AiProfile, legal: LegalActions, rng: Rng): PlayerAction {
  const me = view.seats[view.viewer];
  const bb = view.bigBlind;
  const pct = preflopPercentile(me.hole![0], me.hole![1]);
  const playRange = 0.2 + 0.35 * p.looseness;
  const stackBB = (me.stack + me.streetCommitted) / bb;

  // Short stack: push or fold.
  if (stackBB <= 12) {
    if (pct >= 1 - playRange * 0.8) return legal.raise ? { type: 'allIn' } : continueCheaply(legal);
    return passive(legal);
  }

  if (view.currentBet <= bb) {
    // Unraised pot.
    const raiseShare = 0.3 + 0.6 * p.aggression;
    const limpers = view.seats.filter(
      (s, i) => i !== view.viewer && i !== view.bigBlindSeat && s.inHand && !s.folded && s.streetCommitted >= bb,
    ).length;
    if (legal.raise && pct >= 1 - playRange * raiseShare) return sizedRaise(legal, bb * (3 + limpers));
    if (pct >= 1 - playRange) return continueCheaply(legal);
    if (legal.raise && rng.nextFloat() < p.bluff * 0.25) return sizedRaise(legal, bb * 3);
    return passive(legal);
  }

  // Facing a raise: bigger raises narrow the continuing range.
  const pressure = clamp(3 / (view.currentBet / bb), 0.15, 1);
  const continueRange = playRange * 0.55 * pressure * (0.7 + 0.6 * p.stickiness);
  const threeBetRange = 0.03 + 0.05 * p.aggression;
  if (legal.raise && pct >= 1 - threeBetRange) return sizedRaise(legal, view.currentBet * 3);
  if (pct >= 1 - continueRange) return continueCheaply(legal);
  if (legal.callAmount <= bb && pct >= 1 - playRange) return continueCheaply(legal);
  if (legal.raise && rng.nextFloat() < p.bluff * 0.08) return sizedRaise(legal, view.currentBet * 3);
  return passive(legal);
}

/** Postflop equity against inferred ranges, honoring legitimately known cards. */
export function postflopEquity(view: PublicView, rng: Rng, known: { seat: number; card: Card }[] = []): number {
  const me = view.seats[view.viewer];
  const opponents = view.seats
    .map((s, i) => i)
    .filter((i) => i !== view.viewer && view.seats[i].inHand && !view.seats[i].folded);
  const ranges = opponents.map((i) => inferRange(view, i));
  const fixed = opponents.map((i) => known.find((k) => k.seat === i)?.card ?? null);
  return estimateEquity(me.hole!, view.board, ranges, POSTFLOP_ITERATIONS, rng, fixed);
}

function postflop(
  view: PublicView,
  p: AiProfile,
  legal: LegalActions,
  rng: Rng,
  known: { seat: number; card: Card }[],
): PlayerAction {
  const opponents = view.seats
    .map((s, i) => i)
    .filter((i) => i !== view.viewer && view.seats[i].inHand && !view.seats[i].folded);
  const equity = postflopEquity(view, rng, known);
  const fair = 1 / (opponents.length + 1);
  const strength = (equity - fair) / (1 - fair);
  const pot = view.seats.reduce((sum, s) => sum + s.totalCommitted, 0);
  const valueBar = 0.28 - 0.15 * p.aggression;

  if (legal.canCheck) {
    if (legal.raise && strength >= valueBar && rng.nextFloat() < 0.6 + 0.35 * p.aggression) {
      return sizedRaise(legal, pot * (0.45 + 0.4 * Math.min(1, strength)));
    }
    const bluffRate = p.bluff * (view.street === 'river' ? 0.6 : 1);
    if (legal.raise && opponents.length <= 2 && strength < 0.05 && rng.nextFloat() < bluffRate) {
      return sizedRaise(legal, pot * 0.5);
    }
    return { type: 'check' };
  }

  const toCall = legal.callAmount;
  const potOdds = toCall / (pot + toCall);
  if (legal.raise && strength >= valueBar + 0.25 && rng.nextFloat() < 0.4 + 0.5 * p.aggression) {
    return sizedRaise(legal, view.currentBet + (pot + toCall) * 0.7);
  }
  if (equity >= potOdds * (1.1 - 0.45 * p.stickiness)) return { type: 'call' };
  if (legal.raise && opponents.length === 1 && toCall < pot * 0.6 && rng.nextFloat() < p.bluff * 0.25) {
    return sizedRaise(legal, view.currentBet + (pot + toCall) * 0.8);
  }
  return { type: 'fold' };
}
