/**
 * Spell definitions. Gameplay numbers come from the design hand-offs
 * (spells.json for the four base spells, run/data/p4-spell-evolutions.json for
 * the eight evolutions); the casting window is the engine's reading of each
 * spell's "timing window" text.
 */
import opponents from '../run/data/p4-opponents.json';
import evolutionData from '../run/data/p4-spell-evolutions.json';
import data from './spells.json';

export type BaseSpellId = 'cinder_challenge' | 'unmask' | 'briar_lock' | 'fate_exchange';
export type EvolvedSpellId =
  | 'twin_oracle'
  | 'ravenous_eye'
  | 'ember_echo'
  | 'red_oath'
  | 'thorn_lattice'
  | 'quiet_briars'
  | 'second_reflection'
  | 'marked_fate';
export type SpellId = BaseSpellId | EvolvedSpellId;

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
  /** The base spell this one descends from (itself for base spells). */
  family: BaseSpellId;
  /** Evolved spells only: Ravenous Eye exhausts until the table ends. */
  exhausts: boolean;
}

const FAMILY_WINDOW: Record<BaseSpellId, SpellWindow> = {
  cinder_challenge: 'raise',
  unmask: 'decision',
  briar_lock: 'opening',
  fate_exchange: 'preflopOpening',
};

interface RawSpell {
  id: string;
  name: string;
  discipline: string;
  aether_cost: number;
  public_tell_text: string;
  effect: string;
  exhaust_or_discard: string;
  conflict_priority: number;
}

function def(s: RawSpell, family: BaseSpellId): SpellDef {
  return {
    id: s.id as SpellId,
    name: s.name,
    discipline: s.discipline as SpellDef['discipline'],
    cost: s.aether_cost,
    window: FAMILY_WINDOW[family],
    priority: s.conflict_priority,
    tell: s.public_tell_text,
    effect: s.effect,
    family,
    exhausts: /exhaust until/i.test(s.exhaust_or_discard),
  };
}

export const SPELLS = Object.fromEntries([
  ...data.spells.map((s) => [s.id, def(s, s.id as BaseSpellId)]),
  ...evolutionData.evolutions.flatMap((e) => e.branches.map((b) => [b.id, def(b, e.parent as BaseSpellId)])),
]) as Record<SpellId, SpellDef>;

export function isBaseSpell(spell: SpellId): spell is BaseSpellId {
  return SPELLS[spell].family === spell;
}

/** Evolution branches and Resonance threshold for each base spell (design v0.6 §04). */
export const EVOLUTIONS: Record<BaseSpellId, { threshold: number; branches: [EvolvedSpellId, EvolvedSpellId] }> = Object.fromEntries(
  evolutionData.evolutions.map((e) => [e.parent, { threshold: e.threshold, branches: e.branches.map((b) => b.id) }]),
) as Record<BaseSpellId, { threshold: number; branches: [EvolvedSpellId, EvolvedSpellId] }>;

export const AETHER = {
  initial: data.aether.initial,
  max: data.aether.maximum,
  showdownRegen: data.aether.showdown_regeneration,
  castsPerHand: data.aether.max_spells_cast_per_hand,
};

/** Cinder Challenge rewards (design decisions 05). Red Oath grants 1 instead of 2 on a matched win. */
export const CINDER_REWARD = { calledAndWon: 2, allFolded: 1, redOathCalledAndWon: 1 };

export const SPELLS_DRAWN_PER_HAND = 3;
/** Ember Echo's next-hand bonus draw raises the draw to at most this many. */
export const MAX_SPELLS_DRAWN = 4;

export type SpellCounts = Partial<Record<SpellId, number>>;

export const BEGINNER_SPELLBOOK = data.beginner_spellbook as SpellCounts;
/** Fixed 8-card books for every named rival; Coal Table regulars use a balanced 2/2/2/2 book. */
export const RIVAL_SPELLBOOKS: Record<string, SpellCounts> = {
  ...(data.rival_spellbooks as Record<string, SpellCounts>),
  ...Object.fromEntries(opponents.opponents.map((o) => [o.id, o.spellbook as SpellCounts])),
  night_clerk: BEGINNER_SPELLBOOK,
  dock_runner: BEGINNER_SPELLBOOK,
};
