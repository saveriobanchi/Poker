/**
 * Standard 52-card poker deck. A card is an integer 0..51:
 *   card = (rank - 2) * 4 + suitIndex
 * Plain numbers keep hand state JSON-serializable for save/resume.
 */
export type Card = number;

export const SUITS = ['c', 'd', 'h', 's'] as const;
export type Suit = (typeof SUITS)[number];

/** 2..14, where 11=J, 12=Q, 13=K, 14=A. */
export type Rank = number;

const RANK_CHARS = '23456789TJQKA';

export function makeCard(rank: Rank, suit: Suit): Card {
  if (!Number.isInteger(rank) || rank < 2 || rank > 14) throw new Error(`Invalid rank ${rank}`);
  return (rank - 2) * 4 + SUITS.indexOf(suit);
}

export function rankOf(card: Card): Rank {
  return Math.floor(card / 4) + 2;
}

export function suitOf(card: Card): Suit {
  return SUITS[card % 4];
}

export function cardToString(card: Card): string {
  return RANK_CHARS[rankOf(card) - 2] + suitOf(card);
}

/** Parses "As", "Td", "2c" (case-insensitive rank, lowercase suit). */
export function parseCard(text: string): Card {
  const rankIndex = RANK_CHARS.indexOf(text[0]?.toUpperCase() ?? '');
  const suit = text[1] as Suit;
  if (text.length !== 2 || rankIndex < 0 || !SUITS.includes(suit)) {
    throw new Error(`Invalid card "${text}"`);
  }
  return makeCard(rankIndex + 2, suit);
}

/** Parses a space-separated list such as "As Kd 7h". */
export function parseCards(text: string): Card[] {
  return text.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function freshDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

export function isValidCard(card: unknown): card is Card {
  return Number.isInteger(card) && (card as number) >= 0 && (card as number) < 52;
}
