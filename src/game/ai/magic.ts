/**
 * AI spell use. Like poker decisions, it reads only the seat's PublicView and
 * MagicView: its own spells, public Aether and tells, publicly shown cards, and
 * cards it revealed itself. Casting follows exactly the same legal windows as the
 * player, for base spells and their evolutions alike.
 */
import type { CastOption, CastParams, MagicView } from '../magic/table';
import { SPELLS } from '../magic/spells';
import type { Card } from '../rules/cards';
import type { PlayerAction, PublicView } from '../rules/engine';
import { rankOf } from '../rules/cards';
import { Rng } from '../rules/rng';
import { decide } from './agent';
import { preflopPercentile } from './preflop';
import type { AiProfile } from './profiles';

export type AiMagicChoice = { kind: 'cast'; uid: string; params: CastParams } | { kind: 'pass' };

const family = (o: CastOption) => SPELLS[o.spell].family;

/** Every opponent card this seat may legitimately use: its own reveals plus public ones. */
export function knownCards(view: PublicView, magic: MagicView): { seat: number; card: Card }[] {
  return [...magic.known, ...magic.publicKnown.filter((k) => k.seat !== view.viewer)];
}

/** Decision inside a street-opening window (Briar and Fate families). */
export function decideOpening(view: PublicView, magic: MagicView, p: AiProfile, rng: Rng): AiMagicChoice {
  const me = view.seats[view.viewer];
  const hole = me.hole!;
  const fate = magic.options.find((o) => family(o) === 'fate_exchange');
  if (fate && preflopPercentile(hole[0], hole[1]) < 0.3 && rng.nextFloat() < p.magic.fate) {
    const holeIndex = rankOf(hole[0]) <= rankOf(hole[1]) ? 0 : 1; // throw back the weaker card
    return { kind: 'cast', uid: fate.uid, params: { spell: fate.spell as 'fate_exchange', holeIndex } };
  }

  const briar = magic.options.find((o) => family(o) === 'briar_lock');
  if (briar) {
    // Thorn discipline: cap the stakes when out-stacked by a live opponent.
    const myChips = me.stack + me.totalCommitted;
    const biggest = Math.max(
      ...view.seats.filter((s, i) => i !== view.viewer && s.inHand && !s.folded).map((s) => s.stack + s.totalCommitted),
    );
    const outStacked = biggest > myChips * 1.3;
    const chance = p.magic.briar * (outStacked ? 1 : 0.25) * (view.street === 'preflop' ? 0.6 : 1);
    if (rng.nextFloat() < chance) return { kind: 'cast', uid: briar.uid, params: { spell: briar.spell as 'briar_lock' } };
  }
  return { kind: 'pass' };
}

/** Second Reflection: keep the higher-ranked candidate (pairing the kept card if possible). */
export function decideChoice(view: PublicView, magic: MagicView): 0 | 1 {
  const c = magic.choice!;
  const kept = view.seats[view.viewer].hole![1 - c.holeIndex];
  const score = (card: Card) => rankOf(card) + (rankOf(card) === rankOf(kept) ? 20 : 0);
  return score(c.candidates[1]) > score(c.candidates[0]) ? 1 : 0;
}

export type AiTurnChoice = { kind: 'cast'; uid: string; params: CastParams } | { kind: 'act'; action: PlayerAction };

/** Decision on the AI's own turn: maybe an Unmask-family spell first, maybe enchant a raise, else play poker. */
export function decideTurn(view: PublicView, magic: MagicView, p: AiProfile, rng: Rng, shoveRates?: number[]): AiTurnChoice {
  const legal = view.legal!;
  const veil = magic.options.find((o) => family(o) === 'unmask');
  if (veil && magic.known.length === 0) {
    const pot = view.seats.reduce((s, x) => s + x.totalCommitted, 0);
    const facingPressure = legal.callAmount > 0 && legal.callAmount >= pot * 0.3;
    if (facingPressure && rng.nextFloat() < p.magic.unmask) {
      // Read the most recent aggressor if possible.
      const aggressor = [...view.log].reverse().find((e) => e.action.type === 'bet' || e.action.type === 'raise')?.seat;
      const targets = veil.targets!;
      const target = targets.includes(aggressor ?? -1) ? aggressor! : targets[0];
      if (veil.spell === 'twin_oracle') {
        const pair = targets.length > 1 ? [target, targets.find((x) => x !== target)!] : [target];
        return { kind: 'cast', uid: veil.uid, params: { spell: 'twin_oracle', targets: pair } };
      }
      return { kind: 'cast', uid: veil.uid, params: { spell: veil.spell as 'unmask', target } };
    }
  }

  let action = decide(view, p, rng, knownCards(view, magic), shoveRates);
  if (action.type === 'allIn' && legal.raise) action = { type: legal.raise.isBet ? 'bet' : 'raise', to: legal.raise.maxTo };
  const ember = magic.options.find((o) => family(o) === 'cinder_challenge');
  if (ember && (action.type === 'bet' || action.type === 'raise') && rng.nextFloat() < p.magic.cinder) {
    return { kind: 'cast', uid: ember.uid, params: { spell: ember.spell as 'cinder_challenge', raiseTo: action.to } };
  }
  return { kind: 'act', action };
}
