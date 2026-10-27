import { describe, expect, it } from 'vitest';
import { parseCard } from '../src/game/rules/cards';
import { handReading } from '../src/ui/handReading';

const c = (s: string) => s.split(' ').filter(Boolean).map(parseCard);

describe('hand reading', () => {
  it('names starting hands', () => {
    expect(handReading(c('9h 9d'), [])).toBe('Pocket Nines');
    expect(handReading(c('Ks As'), [])).toBe('Ace–King suited');
    expect(handReading(c('7c Td'), [])).toBe('Ten–Seven');
  });

  it('names made hands from hole cards and the board', () => {
    expect(handReading(c('Ah 7d'), c('Kc 9s 2h'))).toBe('Ace high');
    expect(handReading(c('9h 4d'), c('9c Ks 2h'))).toBe('Pair of Nines');
    expect(handReading(c('9h 4d'), c('9c 4s 2h'))).toBe('Two Pair, Nines and Fours');
    expect(handReading(c('9h 9d'), c('9c Ks 2h'))).toBe('Three Nines');
    expect(handReading(c('Ah 2d'), c('3c 4s 5h'))).toBe('Straight, Five high');
    expect(handReading(c('Ah 2h'), c('9h 4h Jh'))).toBe('Flush, Ace high');
    expect(handReading(c('9h 9d'), c('9c 4s 4h'))).toBe('Full House, Nines full of Fours');
    expect(handReading(c('9h 9d'), c('9c 9s 4h'))).toBe('Four Nines');
    expect(handReading(c('Ah Kh'), c('Qh Jh Th'))).toBe('Royal Flush');
    expect(handReading(c('9h 8h'), c('7h 6h 5h'))).toBe('Straight Flush, Nine high');
  });

  it('uses the best five of seven', () => {
    expect(handReading(c('2c 3d'), c('Ah Ad Kc Ks 9h'))).toBe('Two Pair, Aces and Kings');
  });
});
