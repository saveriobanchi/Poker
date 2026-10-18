/**
 * Spell definitions. Gameplay numbers come from spells.json (the design
 * hand-off, bible v0.4); the casting window is the engine's reading of each
 * spell's "timing window" text.
 */
import data from './spells.json';

export type SpellId = 'cinder_challenge' | 'unmask' | 'briar_lock' | 'fate_exchange';

/**
 * - `opening`: street-opening window, any street (before the first voluntary action)
 * - `preflopOpening`: street-opening window, preflop only
 * - `decision`: on the caster's own turn, before their poker action
 * - `raise`: atomic with the caster's own legal bet/raise
 */
export type SpellWindow = 'opening' | 'preflopOpening' | 'decision' | 'raise';

export interface SpellDef {
  id: SpellId;
  name: string;
  discipline: 'Ember' | 'Veil' | 'Thorn' | 'Mirror';
  cost: number;
  window: SpellWindow;
  priority: number;
  tell: string;
  effect: string;
}

const WINDOWS: Record<SpellId, SpellWindow> = {
  cinder_challenge: 'raise',
  unmask: 'decision',
  briar_lock: 'opening',
  fate_exchange: 'preflopOpening',
};

export const SPELLS = Object.fromEntries(
  data.spells.map((s) => [
    s.id,
    {
      id: s.id as SpellId,
      name: s.name,
      discipline: s.discipline as SpellDef['discipline'],
      cost: s.aether_cost,
      window: WINDOWS[s.id as SpellId],
      priority: s.conflict_priority,
      tell: s.public_tell_text,
      effect: s.effect,
    },
  ]),
) as Record<SpellId, SpellDef>;

export const AETHER = {
  initial: data.aether.initial,
  max: data.aether.maximum,
  showdownRegen: data.aether.showdown_regeneration,
  castsPerHand: data.aether.max_spells_cast_per_hand,
};

/** Cinder Challenge rewards (design decision 05). */
export const CINDER_REWARD = { calledAndWon: 2, allFolded: 1 };

export const SPELLS_DRAWN_PER_HAND = 3;

export type SpellCounts = Partial<Record<SpellId, number>>;

export const BEGINNER_SPELLBOOK = data.beginner_spellbook as SpellCounts;
export const RIVAL_SPELLBOOKS = data.rival_spellbooks as Record<string, SpellCounts>;
