import { describe, expect, it } from 'vitest';
import { evaluateBest, evaluateFive, HandCategory, parseCards } from '../src/game/rules';

const five = (t: string) => evaluateFive(parseCards(t));
const best = (t: string) => evaluateBest(parseCards(t));

describe('hand evaluator', () => {
  it('classifies every category', () => {
    expect(five('As Ks Qs Js Ts').category).toBe(HandCategory.StraightFlush);
    expect(five('9c 9d 9h 9s 2c').category).toBe(HandCategory.FourOfAKind);
    expect(five('9c 9d 9h 2s 2c').category).toBe(HandCategory.FullHouse);
    expect(five('2h 7h 9h Jh Kh').category).toBe(HandCategory.Flush);
    expect(five('5c 6d 7h 8s 9c').category).toBe(HandCategory.Straight);
    expect(five('Ac 2d 3h 4s 5c').category).toBe(HandCategory.Straight);
    expect(five('9c 9d 9h 2s 3c').category).toBe(HandCategory.ThreeOfAKind);
    expect(five('9c 9d 2h 2s 3c').category).toBe(HandCategory.TwoPair);
    expect(five('9c 9d 2h 4s 3c').category).toBe(HandCategory.OnePair);
    expect(five('9c Jd 2h 4s 3c').category).toBe(HandCategory.HighCard);
  });

  it('orders categories and kickers correctly', () => {
    const ordered = [
      '2c 3d 4h 5s 7c',
      'Ac Kd Qh Js 9c',
      '2c 2d 3h 4s 5h',
      'Ac Ad 3h 4s 5h',
      'Ac Ad Kh Ks 2h',
      '2c 2d 2h 4s 5h',
      'Ac 2d 3h 4s 5c', // wheel
      '6c 2d 3h 4s 5c',
      'Ac Kd Qh Js Tc',
      '2h 3h 4h 5h 7h',
      '2h 2d 2c 3h 3d',
      '2h 2d 2c 2s 3d',
      'Ah 2h 3h 4h 5h',
      'Ah Kh Qh Jh Th',
    ].map((t) => five(t).score);
    for (let i = 1; i < ordered.length; i++) expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
  });

  it('breaks ties by kicker and recognizes exact ties', () => {
    expect(five('Ac Ad Kh 4s 3h').score).toBeGreaterThan(five('As Ah Qh Js Th').score);
    expect(five('Ac Ad Kh 4s 3h').score).toBe(five('As Ah Kd 4c 3d').score);
    expect(five('Kc Kd 7h 7s 9h').score).toBeGreaterThan(five('Kh Ks 7c 7d 8h').score);
  });

  it('picks the best five of seven', () => {
    const v = best('Ah Kh 2c 3d Qh Jh Th');
    expect(v.category).toBe(HandCategory.StraightFlush);
    expect(best('2c 2d 5h 5s 9c 9d Ah').score).toBe(five('9c 9d 5h 5s Ah').score);
    // Board plays: both players hold the same best five.
    expect(best('2c 3d As Ks Qs Js Ts').score).toBe(best('4h 5h As Ks Qs Js Ts').score);
  });

  it('rejects duplicate cards', () => {
    expect(() => best('Ah Ah 2c 3d 4s')).toThrow();
  });
});
