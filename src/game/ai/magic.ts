/**
 * AI spell use. Like poker decisions, it reads only the seat's PublicView and
 * MagicView: its own spells, public Aether and tells, and cards it legitimately
 * revealed. Casting follows exactly the same legal windows as the player.
 */
import type { CastParams, MagicView } from '../magic/table';
import type { PlayerAction, PublicView } from '../rules/engine';
import { rankOf } from '../rules/cards';
import { Rng } from '../rules/rng';
import { decide } from './agent';
import { preflopPercentile } from './preflop';
import type { AiProfile } from './profiles';

export type AiMagicChoice = { kind: 'cast'; uid: string; params: CastParams } | { kind: 'pass' };

/** Decision inside a street-opening window (Briar Lock / Fate Exchange). */
export function decideOpening(view: PublicView, magic: MagicView, p: AiProfile, rng: Rng): AiMagicChoice {
  const me = view.seats[view.viewer];
  const hole = me.hole!;
  const find = (spell: string) => magic.options.find((o) => o.spell === spell);

  const fate = find('fate_exchange');
  if (fate && preflopPercentile(hole[0], hole[1]) < 0.3 && rng.nextFloat() < p.magic.fate) {
    const holeIndex = rankOf(hole[0]) <= rankOf(hole[1]) ? 0 : 1; // throw back the weaker card
    return { kind: 'cast', uid: fate.uid, params: { spell: 'fate_exchange', holeIndex } };
  }

  const briar = find('briar_lock');
  if (briar) {
    // Thorn discipline: cap the stakes when out-stacked by a live opponent.
    const myChips = me.stack + me.totalCommitted;
    const biggest = Math.max(
      ...view.seats.filter((s, i) => i !== view.viewer && s.inHand && !s.folded).map((s) => s.stack + s.totalCommitted),
    );
    const outStacked = biggest > myChips * 1.3;
    const chance = p.magic.briar * (outStacked ? 1 : 0.25) * (view.street === 'preflop' ? 0.6 : 1);
    if (rng.nextFloat() < chance) return { kind: 'cast', uid: briar.uid, params: { spell: 'briar_lock' } };
  }
  return { kind: 'pass' };
}

export type AiTurnChoice = { kind: 'cast'; uid: string; params: CastParams } | { kind: 'act'; action: PlayerAction };

/** Decision on the AI's own turn: maybe Unmask first, maybe enchant a raise with Cinder, else play poker. */
export function decideTurn(
  view: PublicView,
  magic: MagicView,
  p: AiProfile,
  rng: Rng,
): AiTurnChoice {
  const legal = view.legal!;
  const unmask = magic.options.find((o) => o.spell === 'unmask');
  if (unmask && magic.known.length === 0) {
    const pot = view.seats.reduce((s, x) => s + x.totalCommitted, 0);
    const facingPressure = legal.callAmount > 0 && legal.callAmount >= pot * 0.3;
    if (facingPressure && rng.nextFloat() < p.magic.unmask) {
      // Read the most recent aggressor if possible.
      const aggressor = [...view.log].reverse().find((e) => e.action.type === 'bet' || e.action.type === 'raise')?.seat;
      const target = unmask.targets!.includes(aggressor ?? -1) ? aggressor! : unmask.targets![0];
      return { kind: 'cast', uid: unmask.uid, params: { spell: 'unmask', target } };
    }
  }

  let action = decide(view, p, rng, magic.known);
  if (action.type === 'allIn' && legal.raise) action = { type: legal.raise.isBet ? 'bet' : 'raise', to: legal.raise.maxTo };
  const cinder = magic.options.find((o) => o.spell === 'cinder_challenge');
  if (cinder && (action.type === 'bet' || action.type === 'raise') && rng.nextFloat() < p.magic.cinder) {
    return { kind: 'cast', uid: cinder.uid, params: { spell: 'cinder_challenge', raiseTo: action.to } };
  }
  return { kind: 'act', action };
}
