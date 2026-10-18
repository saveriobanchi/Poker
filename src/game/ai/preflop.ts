import { Card, rankOf, suitOf } from '../rules/cards';

/** Bill Chen's preflop formula: a quick, well-known strength heuristic. */
export function chenScore(a: Card, b: Card): number {
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  const points = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  if (hi === lo) return Math.max(points(hi) * 2, 5);
  let score = points(hi);
  if (suitOf(a) === suitOf(b)) score += 2;
  const gap = hi - lo - 1;
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

/** percentile[a * 52 + b]: share of all 1326 starting hands this hand beats (0 = worst, 1 = best). */
const PERCENTILE: Float64Array = (() => {
  const scores: number[] = [];
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) scores.push(chenScore(a, b));
  const total = scores.length;
  const table = new Float64Array(52 * 52);
  for (let a = 0; a < 52; a++) {
    for (let b = a + 1; b < 52; b++) {
      const s = chenScore(a, b);
      let below = 0;
      let equal = 0;
      for (const t of scores) {
        if (t < s) below++;
        else if (t === s) equal++;
      }
      table[a * 52 + b] = table[b * 52 + a] = (below + equal / 2) / total;
    }
  }
  return table;
})();

export function preflopPercentile(a: Card, b: Card): number {
  return PERCENTILE[a * 52 + b];
}
