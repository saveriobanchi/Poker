import { Card } from '../rules/cards';
import { scoreBest } from '../rules/evaluator';
import { Rng } from '../rules/rng';
import { preflopPercentile } from './preflop';

/**
 * Monte Carlo equity of `hole` against opponents whose hidden cards are
 * sampled from the unseen cards. `minPercentile[i]` narrows opponent i's range
 * to hands at least that strong preflop (rejection sampling with a retry cap,
 * so the estimate degrades gracefully instead of looping).
 *
 * Only public information goes in: own cards, the board, and inferred ranges.
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  minPercentile: number[],
  iterations: number,
  rng: Rng,
  /** Per opponent: a hole card this player legitimately knows (via Unmask), or null. */
  knownCards: (Card | null)[] = [],
): number {
  const known = new Set([...hole, ...board, ...knownCards.filter((c): c is Card => c !== null)]);
  const unseen: Card[] = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) unseen.push(c);
  const missing = 5 - board.length;
  let won = 0;
  const pool = unseen.slice();

  for (let it = 0; it < iterations; it++) {
    // Partial Fisher–Yates over `pool`: `used` cards are taken from the front.
    let used = 0;
    const take = () => {
      const j = used + rng.nextInt(pool.length - used);
      [pool[used], pool[j]] = [pool[j], pool[used]];
      return pool[used++];
    };
    const oppHands: Card[][] = [];
    for (let o = 0; o < minPercentile.length; o++) {
      const minPct = minPercentile[o];
      const fixed = knownCards[o] ?? null;
      if (fixed !== null) {
        oppHands.push([fixed, take()]);
        continue;
      }
      let a = take();
      let b = take();
      // Very narrow ranges (a nit's shove) need more draws to be represented faithfully.
      const maxTries = minPct > 0.9 ? 80 : 12;
      for (let tries = 0; tries < maxTries && preflopPercentile(a, b) < minPct; tries++) {
        used -= 2; // put them back and draw again
        a = take();
        b = take();
      }
      oppHands.push([a, b]);
    }
    const fullBoard = board.slice();
    for (let i = 0; i < missing; i++) fullBoard.push(take());

    const mine = scoreBest([...hole, ...fullBoard]);
    let best = mine;
    let tiedWithBest = 1;
    let iLead = true;
    for (const h of oppHands) {
      const s = scoreBest([...h, ...fullBoard]);
      if (s > best) {
        best = s;
        iLead = false;
        tiedWithBest = 1;
      } else if (s === best) {
        tiedWithBest++;
      }
    }
    if (iLead) won += 1 / tiedWithBest;
  }
  return won / iterations;
}
