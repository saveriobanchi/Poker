import {
  applyAction,
  Card,
  freshDeck,
  HandSetup,
  HandState,
  parseCards,
  PlayerAction,
  startHand,
} from '../src/game/rules';

export function setup(stacks: number[], opts: Partial<HandSetup> = {}): HandSetup {
  return {
    seed: 1,
    players: stacks.map((stack, i) => ({ id: `P${i}`, stack })),
    button: 0,
    smallBlind: 1,
    bigBlind: 2,
    ...opts,
  };
}

/**
 * Test-only: starts a hand, then rearranges the shuffled deck so that seats get
 * the given hole cards and the board runs out as given. The result is still a
 * permutation of the 52 cards, so every invariant holds.
 */
export function riggedHand(hs: HandSetup, holes: (string | null)[], board: string): HandState {
  const s = structuredClone(startHand(hs));
  if (s.log.length || s.board.length) throw new Error('riggedHand needs a hand awaiting preflop action');
  const wantedHoles = holes.map((h) => (h ? parseCards(h) : null));
  const boardCards = parseCards(board);
  const used = new Set<Card>([...boardCards, ...wantedHoles.flatMap((h) => h ?? [])]);
  const rest = freshDeck().filter((c) => !used.has(c));
  s.seats.forEach((p, i) => {
    if (!p.inHand) return;
    p.hole = wantedHoles[i] ?? [rest.shift()!, rest.shift()!];
  });
  const [f1, f2, f3, t, r] = boardCards;
  const b = () => rest.shift()!;
  s.deck = [b(), f1, f2, f3, b(), t, b(), r, ...rest];
  return s;
}

export function act(s: HandState, ...actions: [number, PlayerAction][]): HandState {
  for (const [seat, action] of actions) s = applyAction(s, seat, action);
  return s;
}

export const fold: PlayerAction = { type: 'fold' };
export const check: PlayerAction = { type: 'check' };
export const call: PlayerAction = { type: 'call' };
export const allIn: PlayerAction = { type: 'allIn' };
export const bet = (to: number): PlayerAction => ({ type: 'bet', to });
export const raise = (to: number): PlayerAction => ({ type: 'raise', to });

export function stacks(s: HandState): number[] {
  return s.seats.map((p) => p.stack);
}
