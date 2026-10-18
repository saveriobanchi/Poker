import type { LoggedAction, PlayerAction } from '../game/rules/engine';
import { Card, rankOf, suitOf } from '../game/rules/cards';

export const SUIT_GLYPH: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
const RANK_LABEL = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function rankLabel(card: Card): string {
  return RANK_LABEL[rankOf(card)];
}

export function suitGlyph(card: Card): string {
  return SUIT_GLYPH[suitOf(card)];
}

export function isRed(card: Card): boolean {
  const s = suitOf(card);
  return s === 'h' || s === 'd';
}

/** Short label shown under a seat, e.g. "Raise 12". */
export function actionLabel(action: PlayerAction, allIn: boolean): string {
  if (allIn && action.type !== 'fold' && action.type !== 'check') return 'All-in';
  switch (action.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return 'Call';
    case 'bet':
      return `Bet ${action.to}`;
    case 'raise':
      return `Raise ${action.to}`;
    case 'allIn':
      return 'All-in';
  }
}

/** Sentence for the action ticker, e.g. "Lady Vesper raises to 6." */
export function describeAction(entry: LoggedAction, name: string): string {
  const a = entry.action;
  switch (a.type) {
    case 'fold':
      return `${name} folds.`;
    case 'check':
      return `${name} checks.`;
    case 'call':
      return `${name} calls.`;
    case 'bet':
      return `${name} bets ${a.to}.`;
    case 'raise':
      return `${name} raises to ${a.to}.`;
    case 'allIn':
      return `${name} goes all-in.`;
  }
}
