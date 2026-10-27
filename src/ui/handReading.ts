/**
 * What the player holds, in words ("Two Pair, Nines and Fours"). Built only from the player's
 * own hole cards and the public board, so it never shows more than the player may know.
 */
import { type Card, rankOf, suitOf } from '../game/rules/cards';
import { evaluateBest, HandCategory } from '../game/rules/evaluator';

const NAMES = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];
const PLURAL = ['', '', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines', 'Tens', 'Jacks', 'Queens', 'Kings', 'Aces'];

/** Ranks of the best five, grouped by count then rank: [rank, count][] highest group first. */
function groups(cards: Card[]): [number, number][] {
  const count = new Map<number, number>();
  for (const c of cards) count.set(rankOf(c), (count.get(rankOf(c)) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
}

/** Straights are named by their top card; the wheel (A-2-3-4-5) is five high. */
function straightTop(cards: Card[]): number {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  return ranks[0] === 14 && ranks[1] === 5 ? 5 : ranks[0];
}

export function handReading(hole: Card[], board: Card[]): string {
  if (hole.length !== 2) return '';
  if (board.length === 0) {
    const [a, b] = [rankOf(hole[0]), rankOf(hole[1])].sort((x, y) => y - x);
    if (a === b) return `Pocket ${PLURAL[a]}`;
    return `${NAMES[a]}–${NAMES[b]}${suitOf(hole[0]) === suitOf(hole[1]) ? ' suited' : ''}`;
  }
  const best = evaluateBest([...hole, ...board]);
  const g = groups(best.cards);
  switch (best.category) {
    case HandCategory.HighCard:
      return `${NAMES[g[0][0]]} high`;
    case HandCategory.OnePair:
      return `Pair of ${PLURAL[g[0][0]]}`;
    case HandCategory.TwoPair:
      return `Two Pair, ${PLURAL[g[0][0]]} and ${PLURAL[g[1][0]]}`;
    case HandCategory.ThreeOfAKind:
      return `Three ${PLURAL[g[0][0]]}`;
    case HandCategory.Straight:
      return `Straight, ${NAMES[straightTop(best.cards)]} high`;
    case HandCategory.Flush:
      return `Flush, ${NAMES[g[0][0]]} high`;
    case HandCategory.FullHouse:
      return `Full House, ${PLURAL[g[0][0]]} full of ${PLURAL[g[1][0]]}`;
    case HandCategory.FourOfAKind:
      return `Four ${PLURAL[g[0][0]]}`;
    case HandCategory.StraightFlush:
      return straightTop(best.cards) === 14 ? 'Royal Flush' : `Straight Flush, ${NAMES[straightTop(best.cards)]} high`;
  }
}
