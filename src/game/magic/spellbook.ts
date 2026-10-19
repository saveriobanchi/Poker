/**
 * A character's private Spellbook: a separate deck of spell card instances
 * with its own seeded RNG. Instances move draw -> hand -> discard -> (reshuffle)
 * draw and are never copied or destroyed.
 */
import { Rng } from '../rules/rng';
import { SpellCounts, SpellId } from './spells';

export interface SpellCard {
  /** Unique instance id, e.g. "vesper:3". */
  uid: string;
  spell: SpellId;
  /** Resonance earned by this instance (design v0.6 §04); duplicates level separately. */
  resonance?: number;
}

export interface Spellbook {
  owner: string;
  draw: SpellCard[];
  discard: SpellCard[];
  /** Exhausted until the current table ends (Ravenous Eye). Still owned and counted. */
  exhausted?: SpellCard[];
  rngState: number;
}

/** Every instance the owner holds outside the current hand. */
export function allCards(book: Spellbook): SpellCard[] {
  return [...book.draw, ...book.discard, ...(book.exhausted ?? [])];
}

/** At a new table: exhausted instances rejoin the deck, and everything is reshuffled. */
export function resetForTable(book: Spellbook): Spellbook {
  const b = structuredClone(book);
  const rng = new Rng(b.rngState);
  b.draw = rng.shuffle(allCards(b));
  b.discard = [];
  b.exhausted = [];
  b.rngState = rng.state;
  return b;
}

/**
 * Replaces one owned instance 1:1 (evolution or Spell Rethread), keeping its uid
 * and position. Resonance resets to zero. Throws if the instance is not owned.
 */
export function replaceInstance(book: Spellbook, uid: string, spell: SpellId): Spellbook {
  const b = structuredClone(book);
  for (const pile of [b.draw, b.discard, b.exhausted ?? []]) {
    const card = pile.find((c) => c.uid === uid);
    if (card) {
      card.spell = spell;
      card.resonance = 0;
      return b;
    }
  }
  throw new Error(`Spell instance ${uid} is not owned`);
}

/** Changes one owned instance's Resonance by `delta` (never below zero). */
export function adjustResonance(book: Spellbook, uid: string, delta: number): Spellbook {
  const b = structuredClone(book);
  const card = allCards(b).find((c) => c.uid === uid);
  if (!card) throw new Error(`Spell instance ${uid} is not owned`);
  card.resonance = Math.max(0, (card.resonance ?? 0) + delta);
  return b;
}

export const SPELLBOOK_MIN = 8;
export const SPELLBOOK_MAX = 12;

export function createSpellbook(owner: string, counts: SpellCounts, seed: number): Spellbook {
  const cards: SpellCard[] = [];
  for (const [spell, n] of Object.entries(counts) as [SpellId, number][]) {
    for (let i = 0; i < n; i++) cards.push({ uid: `${owner}:${cards.length}`, spell });
  }
  if (cards.length < SPELLBOOK_MIN || cards.length > SPELLBOOK_MAX) {
    throw new Error(`A Spellbook holds ${SPELLBOOK_MIN}-${SPELLBOOK_MAX} spells, got ${cards.length}`);
  }
  const rng = new Rng(seed);
  rng.shuffle(cards);
  return { owner, draw: cards, discard: [], rngState: rng.state };
}

/** Draws up to `n` spells, reshuffling the discard pile into the draw pile only when needed. */
export function drawSpells(book: Spellbook, n: number): { book: Spellbook; drawn: SpellCard[] } {
  const b = structuredClone(book);
  const drawn: SpellCard[] = [];
  const rng = new Rng(b.rngState);
  while (drawn.length < n) {
    if (b.draw.length === 0) {
      if (b.discard.length === 0) break;
      b.draw = rng.shuffle(b.discard);
      b.discard = [];
    }
    drawn.push(b.draw.shift()!);
  }
  b.rngState = rng.state;
  return { book: b, drawn };
}

export function discardSpells(book: Spellbook, cards: SpellCard[]): Spellbook {
  return { ...book, discard: [...book.discard, ...structuredClone(cards)] };
}
