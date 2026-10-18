/**
 * Main/side pot construction and awarding. Pure functions over per-seat totals.
 */

export interface Pot {
  amount: number;
  /** Seats (non-folded, contributed at least this pot's level) that may win it. */
  eligible: number[];
}

export interface PotAward {
  amount: number;
  eligible: number[];
  winners: number[];
  /** Chips paid to each winner, by seat. Sums to `amount`. */
  shares: Record<number, number>;
}

/**
 * Builds pots from each seat's total contribution this hand. Folded seats'
 * chips stay in the pots but they are never eligible. Adjacent layers with an
 * identical eligible set are merged; a layer nobody is eligible for (only
 * possible from dead money) is merged into the previous pot.
 */
export function buildPots(contributions: number[], folded: boolean[]): Pot[] {
  const levels = [...new Set(contributions.filter((c) => c > 0))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of contributions) amount += Math.max(0, Math.min(c, level) - prev);
    const eligible = contributions
      .map((c, seat) => (c >= level && !folded[seat] ? seat : -1))
      .filter((seat) => seat >= 0);
    prev = level;
    const last = pots[pots.length - 1];
    if (last && (eligible.length === 0 || sameSeats(last.eligible, eligible))) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligible });
    }
  }
  return pots;
}

function sameSeats(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Seats in clockwise order beginning with the first seat left of the button.
 * Used for the odd-chip rule.
 */
export function oddChipOrder(numSeats: number, button: number): number[] {
  return Array.from({ length: numSeats }, (_, i) => (button + 1 + i) % numSeats);
}

/**
 * Awards each pot to the eligible seat(s) with the highest score. Split pots
 * are divided equally; leftover odd chips go one at a time to tied winners in
 * clockwise order starting left of the button (Poker TDA convention).
 *
 * @param scores per-seat hand score; null for seats without a live hand.
 */
export function awardPots(
  pots: Pot[],
  scores: (number | null)[],
  button: number,
): PotAward[] {
  const order = oddChipOrder(scores.length, button);
  return pots.map((pot) => {
    let best = -Infinity;
    for (const seat of pot.eligible) {
      const s = scores[seat];
      if (s !== null && s !== undefined && s > best) best = s;
    }
    const winners = order.filter((seat) => pot.eligible.includes(seat) && scores[seat] === best);
    if (winners.length === 0) throw new Error('Pot has no eligible winner');
    const base = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - base * winners.length;
    const shares: Record<number, number> = {};
    for (const seat of winners) {
      shares[seat] = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
    return { amount: pot.amount, eligible: [...pot.eligible], winners, shares };
  });
}
