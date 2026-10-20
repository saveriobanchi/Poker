/**
 * Relics and Covenants (design v0.6 §05, run/data/p4-relics-and-covenants.json).
 * Relics change Aether and costs only; none can create or move Lifechips.
 */
import data from '../run/data/p4-relics-and-covenants.json';
import rare from '../run/data/p6-rare-relics.json';
import type { BaseSpellId } from './spells';

export type RelicId =
  | 'ashen_signet'
  | 'veiled_monocle'
  | 'thorn_anchor'
  | 'lantern_reservoir'
  | 'mirror_prism'
  | 'gambler_knot'
  // Rare (design v0.8 §05).
  | 'fateweavers_sigil';
export type CovenantId = 'covenant_open_book';

export interface RelicDef {
  id: RelicId;
  name: string;
  rarity: string;
  price: number;
  effect: string;
}

const ALL_RELICS = [...data.relics, ...rare.relics];
export const RELICS = Object.fromEntries(ALL_RELICS.map((r) => [r.id, r])) as unknown as Record<RelicId, RelicDef>;
export const RELIC_IDS = ALL_RELICS.map((r) => r.id) as RelicId[];
export const COVENANTS = Object.fromEntries(data.covenants.map((c) => [c.id, c])) as unknown as Record<CovenantId, { id: CovenantId; name: string; effect: string }>;
export const SLOT_LIMITS = data.slot_limits;

/** Relics that make the first cast of a spell family each table cost 1 less Aether. */
export const FAMILY_DISCOUNT: Partial<Record<RelicId, BaseSpellId>> = {
  veiled_monocle: 'unmask',
  thorn_anchor: 'briar_lock',
  mirror_prism: 'fate_exchange',
};
