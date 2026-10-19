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

/**
 * Fine strength key: the Chen score, with ties broken by high card, low card and
 * suitedness, so percentile thresholds move smoothly with AI style knobs.
 */
function strengthKey(a: Card, b: Card): number {
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  return chenScore(a, b) * 1000 + hi * 40 + lo * 2 + (suitOf(a) === suitOf(b) ? 1 : 0);
}

/** percentile[a * 52 + b]: share of all 1326 starting hands this hand beats (0 = worst, 1 = best). */
const PERCENTILE: Float64Array = (() => {
  const keys: number[] = [];
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) keys.push(strengthKey(a, b));
  keys.sort((x, y) => x - y);
  const total = keys.length;
  const lowerBound = (k: number, strict: boolean) => {
    let lo = 0;
    let hi = total;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? keys[mid] < k : keys[mid] <= k) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const table = new Float64Array(52 * 52);
  for (let a = 0; a < 52; a++) {
    for (let b = a + 1; b < 52; b++) {
      const k = strengthKey(a, b);
      const below = lowerBound(k, true);
      const equal = lowerBound(k, false) - below;
      table[a * 52 + b] = table[b * 52 + a] = (below + equal / 2) / total;
    }
  }
  return table;
})();

export function preflopPercentile(a: Card, b: Card): number {
  return PERCENTILE[a * 52 + b];
}
