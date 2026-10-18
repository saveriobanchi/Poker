import { Card, rankOf, suitOf } from './cards';

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.OnePair]: 'One Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush',
};

export interface HandValue {
  /** Higher is better; equal scores tie exactly. */
  score: number;
  category: HandCategory;
  /** The five cards forming the best hand. */
  cards: Card[];
}

function encode(category: HandCategory, tiebreak: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 15 + (tiebreak[i] ?? 0);
  return score;
}

/** Evaluates exactly five cards. */
export function evaluateFive(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error('evaluateFive requires 5 cards');
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));

  const unique = [...new Set(ranks)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5; // wheel A-2-3-4-5
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Groups ordered by size, then rank (both descending).
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const groupRanks = groups.map(([r]) => r);
  const shape = groups.map(([, n]) => n).join('');

  let category: HandCategory;
  let tiebreak: number[];
  if (straightHigh && flush) {
    category = HandCategory.StraightFlush;
    tiebreak = [straightHigh];
  } else if (shape === '41') {
    category = HandCategory.FourOfAKind;
    tiebreak = groupRanks;
  } else if (shape === '32') {
    category = HandCategory.FullHouse;
    tiebreak = groupRanks;
  } else if (flush) {
    category = HandCategory.Flush;
    tiebreak = ranks;
  } else if (straightHigh) {
    category = HandCategory.Straight;
    tiebreak = [straightHigh];
  } else if (shape === '311') {
    category = HandCategory.ThreeOfAKind;
    tiebreak = groupRanks;
  } else if (shape === '221') {
    category = HandCategory.TwoPair;
    tiebreak = groupRanks;
  } else if (shape === '2111') {
    category = HandCategory.OnePair;
    tiebreak = groupRanks;
  } else {
    category = HandCategory.HighCard;
    tiebreak = ranks;
  }
  return { score: encode(category, tiebreak), category, cards: [...cards] };
}

/** Best five-card hand from 5–7 cards (any combination of hole and board). */
export function evaluateBest(cards: Card[]): HandValue {
  if (cards.length < 5 || cards.length > 7) throw new Error('evaluateBest requires 5-7 cards');
  if (new Set(cards).size !== cards.length) throw new Error('Duplicate cards in evaluation');
  let best: HandValue | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const v = evaluateFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || v.score > best.score) best = v;
          }
  return best!;
}

/** Highest straight in a rank bitmask (bit r set for rank r, ace also as bit 1), or 0. */
function straightHigh(mask: number): number {
  for (let high = 14; high >= 5; high--) {
    const need = 0b11111 << (high - 4);
    if ((mask & need) === need) return high;
  }
  return 0;
}

/**
 * Fast path: same score as evaluateBest(cards).score for 5–7 cards, without
 * enumerating combinations. Used by AI equity sampling and simulations.
 */
export function scoreBest(cards: Card[]): number {
  const counts = new Array<number>(15).fill(0);
  const suitCounts = [0, 0, 0, 0];
  const suitMasks = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = (c >> 2) + 2;
    const s = c & 3;
    counts[r]++;
    suitCounts[s]++;
    suitMasks[s] |= 1 << r;
    mask |= 1 << r;
  }
  const withLowAce = (m: number) => (m & (1 << 14) ? m | 2 : m);

  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = straightHigh(withLowAce(suitMasks[flushSuit]));
    if (sf) return encode(HandCategory.StraightFlush, [sf]);
  }

  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
    else if (counts[r] === 1) singles.push(r);
  }
  const highestExcept = (...excluded: number[]) => {
    for (let r = 14; r >= 2; r--) if (counts[r] > 0 && !excluded.includes(r)) return r;
    return 0;
  };

  if (quads.length) return encode(HandCategory.FourOfAKind, [quads[0], highestExcept(quads[0])]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pair = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    return encode(HandCategory.FullHouse, [trips[0], pair]);
  }
  if (flushSuit >= 0) {
    const ranks: number[] = [];
    for (let r = 14; r >= 2 && ranks.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) ranks.push(r);
    return encode(HandCategory.Flush, ranks);
  }
  const st = straightHigh(withLowAce(mask));
  if (st) return encode(HandCategory.Straight, [st]);
  if (trips.length) {
    const kickers = singles.slice(0, 2);
    return encode(HandCategory.ThreeOfAKind, [trips[0], ...kickers]);
  }
  if (pairs.length >= 2) {
    return encode(HandCategory.TwoPair, [pairs[0], pairs[1], highestExcept(pairs[0], pairs[1])]);
  }
  if (pairs.length === 1) return encode(HandCategory.OnePair, [pairs[0], ...singles.slice(0, 3)]);
  return encode(HandCategory.HighCard, singles.slice(0, 5));
}
