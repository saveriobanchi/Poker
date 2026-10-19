/**
 * No-limit Texas Hold'em hand engine (P0 poker kernel).
 *
 * Pure and deterministic: every public function takes a plain JSON-serializable
 * HandState and returns a new one, never mutating its input. A hand is fully
 * reproducible from its HandSetup (including the RNG seed) plus its action log.
 *
 * Seats are indexed clockwise. Rules follow Poker TDA conventions; any engine
 * simplification is listed in docs/poker-rules-exceptions.md.
 */
import { Card, freshDeck } from './cards';
import { evaluateBest, HandValue } from './evaluator';
import { awardPots, buildPots, PotAward } from './pots';
import { Rng } from './rng';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** Open the betting on a street; `to` is the seat's total street commitment. */
  | { type: 'bet'; to: number }
  /** Raise an existing bet; `to` is the seat's total street commitment. */
  | { type: 'raise'; to: number }
  /** Convenience: resolves to the largest legal raise, otherwise a call. */
  | { type: 'allIn' };

export interface PlayerSetup {
  id: string;
  stack: number;
}

export interface HandSetup {
  seed: number;
  /** Clockwise seat order. Seats with 0 chips are skipped for this hand. */
  players: PlayerSetup[];
  button: number;
  smallBlind: number;
  bigBlind: number;
}

export interface SeatState {
  id: string;
  stack: number;
  hole: Card[];
  /** Dealt into this hand (had chips at the start). */
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  streetCommitted: number;
  totalCommitted: number;
  hasActed: boolean;
  /** The bet level this seat left behind after its last action this street. */
  betLevelWhenActed: number;
}

export interface LoggedAction {
  seat: number;
  street: Street;
  /** Normalized action actually applied (an `allIn` is logged as bet/raise/call). */
  action: PlayerAction;
}

export interface ShowdownEntry {
  seat: number;
  hole: Card[];
  hand: HandValue;
}

export interface ZeroChipSeat {
  seat: number;
  id: string;
  /** Index into `pots` of the contested pot holding this seat's final contribution. */
  claimPotIndex: number;
  /** Winners of that pot. More than one means a split pot (neutral adjudicator). */
  claimants: number[];
}

export type BetLimit = 'no-limit' | 'pot-limit';

/**
 * Rule-level effects applied by the magic layer. Recorded with the log position
 * they happened at, so replayHand reproduces them exactly. They carry no card
 * identities (those stay private).
 */
export type EngineEffect =
  | { kind: 'streetLimit'; atLog: number; limit: BetLimit }
  | { kind: 'exchange'; atLog: number; seat: number; holeIndex: number }
  | { kind: 'exchangeFor'; atLog: number; seat: number; holeIndex: number; card: Card };

export interface HandResult {
  /** Final per-seat contribution after any uncalled bet was returned. */
  contributions: number[];
  uncalledReturn: { seat: number; amount: number } | null;
  pots: PotAward[];
  /** Empty when the hand was won uncontested (no cards need to be shown). */
  showdown: ShowdownEntry[];
  /** Net chip change per seat for the whole hand. */
  netChange: number[];
  zeroChipSeats: ZeroChipSeat[];
}

export interface HandState {
  version: 1;
  setup: HandSetup;
  rngState: number;
  /** Undealt cards; index 0 is the top of the deck. */
  deck: Card[];
  burns: Card[];
  board: Card[];
  seats: SeatState[];
  button: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  street: Street;
  phase: 'betting' | 'complete';
  toAct: number | null;
  /** Highest street commitment a seat must match to stay in. */
  currentBet: number;
  /** Size of the last full bet/raise this street; the minimum raise increment. */
  lastRaiseSize: number;
  /** Chips in play at the start of the hand; conserved at every transition. */
  chipTotal: number;
  log: LoggedAction[];
  /** Betting structure of the current street (pot-limit only under Briar Lock). Missing means no-limit. */
  streetLimit?: BetLimit;
  effects?: EngineEffect[];
  result: HandResult | null;
}

export interface LegalActions {
  seat: number;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  /** Chips the call actually costs (capped by the stack: a short call is all-in). */
  callAmount: number;
  /** Null when the seat may not bet/raise (no chips beyond a call, betting not reopened, or no one left to respond). */
  raise: { minTo: number; maxTo: number; isBet: boolean } | null;
}

export class RulesError extends Error {}

// ───────────────────────────── setup ─────────────────────────────

function validateSetup(setup: HandSetup): void {
  const { players, button, smallBlind, bigBlind } = setup;
  if (players.length < 2 || players.length > 10) throw new RulesError('A table needs 2-10 seats');
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new RulesError('Duplicate player ids');
  for (const p of players) {
    if (!Number.isInteger(p.stack) || p.stack < 0) throw new RulesError(`Invalid stack for ${p.id}`);
  }
  if (players.filter((p) => p.stack > 0).length < 2) throw new RulesError('At least two seats need chips');
  if (!Number.isInteger(smallBlind) || !Number.isInteger(bigBlind) || smallBlind < 1 || bigBlind < smallBlind) {
    throw new RulesError('Invalid blinds');
  }
  if (!Number.isInteger(button) || button < 0 || button >= players.length || players[button].stack <= 0) {
    throw new RulesError('Button must be on a seat with chips');
  }
  if (!Number.isInteger(setup.seed)) throw new RulesError('Seed must be an integer');
}

function nextLiveSeat(s: HandState, from: number): number {
  const n = s.seats.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    if (s.seats[seat].inHand) return seat;
  }
  throw new RulesError('No live seat');
}

function commit(s: HandState, seat: number, amount: number): void {
  const p = s.seats[seat];
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.streetCommitted += paid;
  p.totalCommitted += paid;
  if (p.stack === 0) p.allIn = true;
}

export function startHand(setup: HandSetup): HandState {
  validateSetup(setup);
  const rng = new Rng(setup.seed);
  const deck = rng.shuffle(freshDeck());
  const s: HandState = {
    version: 1,
    setup: structuredClone(setup),
    rngState: rng.state,
    deck,
    burns: [],
    board: [],
    seats: setup.players.map((p) => ({
      id: p.id,
      stack: p.stack,
      hole: [],
      inHand: p.stack > 0,
      folded: false,
      allIn: false,
      streetCommitted: 0,
      totalCommitted: 0,
      hasActed: false,
      betLevelWhenActed: -1,
    })),
    button: setup.button,
    smallBlindSeat: -1,
    bigBlindSeat: -1,
    street: 'preflop',
    phase: 'betting',
    toAct: null,
    currentBet: setup.bigBlind,
    lastRaiseSize: setup.bigBlind,
    chipTotal: setup.players.reduce((sum, p) => sum + p.stack, 0),
    log: [],
    result: null,
  };

  const live = s.seats.filter((p) => p.inHand).length;
  // Heads-up: the button posts the small blind.
  s.smallBlindSeat = live === 2 ? s.button : nextLiveSeat(s, s.button);
  s.bigBlindSeat = nextLiveSeat(s, s.smallBlindSeat);
  // A short stack posts what remains as an all-in blind. The amount to call
  // stays the full big blind (currentBet), per TDA.
  commit(s, s.smallBlindSeat, setup.smallBlind);
  commit(s, s.bigBlindSeat, setup.bigBlind);

  // Deal one card at a time, starting left of the button.
  for (let round = 0; round < 2; round++) {
    let seat = s.button;
    for (let k = 0; k < live; k++) {
      seat = nextLiveSeat(s, seat);
      s.seats[seat].hole.push(s.deck.shift()!);
    }
  }

  // Preflop action starts left of the big blind (heads-up: the button/SB).
  s.toAct = findNextToAct(s, s.bigBlindSeat);
  if (s.toAct === null) advance(s);
  assertInvariants(s);
  return s;
}

// ───────────────────────────── action ─────────────────────────────

function actionable(s: HandState, seat: number): boolean {
  const p = s.seats[seat];
  return p.inHand && !p.folded && !p.allIn;
}

function countActionable(s: HandState, except = -1): number {
  let n = 0;
  for (let i = 0; i < s.seats.length; i++) if (i !== except && actionable(s, i)) n++;
  return n;
}

function countLive(s: HandState): number {
  return s.seats.filter((p) => p.inHand && !p.folded).length;
}

function needsToAct(s: HandState, seat: number): boolean {
  if (!actionable(s, seat)) return false;
  const p = s.seats[seat];
  if (p.streetCommitted < s.currentBet) return true;
  if (p.hasActed) return false;
  // Unacted and already matched: acts only if someone could still respond.
  return countActionable(s, seat) > 0;
}

function findNextToAct(s: HandState, fromExclusive: number): number | null {
  const n = s.seats.length;
  for (let i = 1; i <= n; i++) {
    const seat = (fromExclusive + i) % n;
    if (needsToAct(s, seat)) return seat;
  }
  return null;
}

function computeLegal(s: HandState, seat: number): LegalActions {
  const p = s.seats[seat];
  const toCall = Math.max(0, s.currentBet - p.streetCommitted);
  let maxTo = p.streetCommitted + p.stack;
  if (s.streetLimit === 'pot-limit') {
    // Pot-limit: raise by at most the pot after calling (all committed chips + the call).
    const pot = s.seats.reduce((sum, q) => sum + q.totalCommitted, 0);
    maxTo = Math.min(maxTo, s.currentBet + pot + toCall);
  }
  let raise: LegalActions['raise'] = null;
  // A seat that already acted may raise again only when facing at least a full
  // raise since then (cumulative short all-ins count, TDA). A seat that checked
  // an unopened street keeps its option.
  const reopened =
    !p.hasActed || p.betLevelWhenActed === 0 || s.currentBet - p.betLevelWhenActed >= s.lastRaiseSize;
  if (maxTo > s.currentBet && reopened && countActionable(s, seat) > 0) {
    raise = {
      minTo: Math.min(s.currentBet + s.lastRaiseSize, maxTo),
      maxTo,
      isBet: s.currentBet === 0,
    };
  }
  return {
    seat,
    canFold: true,
    canCheck: toCall === 0,
    canCall: toCall > 0,
    callAmount: Math.min(toCall, p.stack),
    raise,
  };
}

/** Legal options for the seat to act, or null if the hand is not awaiting action. */
export function getLegalActions(state: HandState): LegalActions | null {
  if (state.phase !== 'betting' || state.toAct === null) return null;
  return computeLegal(state, state.toAct);
}

function normalize(s: HandState, legal: LegalActions, action: PlayerAction): PlayerAction {
  switch (action.type) {
    case 'fold':
      return { type: 'fold' };
    case 'check':
      if (!legal.canCheck) throw new RulesError('Cannot check facing a bet');
      return { type: 'check' };
    case 'call':
      if (!legal.canCall) throw new RulesError('Nothing to call');
      return { type: 'call' };
    case 'bet':
    case 'raise': {
      if (!legal.raise) throw new RulesError('Betting is not open to this seat');
      if (action.type === 'bet' && !legal.raise.isBet) throw new RulesError('Cannot bet: there is already a bet; raise instead');
      if (action.type === 'raise' && legal.raise.isBet) throw new RulesError('Cannot raise: no bet to raise; bet instead');
      const { minTo, maxTo } = legal.raise;
      if (!Number.isInteger(action.to) || action.to < minTo || action.to > maxTo) {
        throw new RulesError(`Amount must be an integer from ${minTo} to ${maxTo}`);
      }
      return { type: action.type, to: action.to };
    }
    case 'allIn':
      if (legal.raise) {
        return { type: legal.raise.isBet ? 'bet' : 'raise', to: legal.raise.maxTo };
      }
      if (legal.canCall) return { type: 'call' };
      throw new RulesError('No all-in available');
  }
}

/** Applies the seat's action and returns the next state. Throws RulesError if illegal. */
export function applyAction(state: HandState, seat: number, action: PlayerAction): HandState {
  if (state.phase !== 'betting' || state.toAct === null) throw new RulesError('Hand is not awaiting action');
  if (seat !== state.toAct) throw new RulesError(`It is seat ${state.toAct}'s turn, not seat ${seat}'s`);
  const s = structuredClone(state);
  const legal = computeLegal(s, seat);
  const applied = normalize(s, legal, action);
  const p = s.seats[seat];

  switch (applied.type) {
    case 'fold':
      p.folded = true;
      break;
    case 'check':
      break;
    case 'call':
      commit(s, seat, s.currentBet - p.streetCommitted);
      break;
    case 'bet':
    case 'raise': {
      const increment = applied.to - s.currentBet;
      commit(s, seat, applied.to - p.streetCommitted);
      // An all-in below a full raise does not change the minimum raise size.
      if (increment >= s.lastRaiseSize) s.lastRaiseSize = increment;
      s.currentBet = applied.to;
      break;
    }
  }
  p.hasActed = true;
  p.betLevelWhenActed = s.currentBet;
  s.log.push({ seat, street: s.street, action: applied });

  if (countLive(s) === 1) {
    settle(s);
  } else {
    s.toAct = findNextToAct(s, seat);
    if (s.toAct === null) advance(s);
  }
  assertInvariants(s);
  return s;
}

// ──────────────────────────── streets ────────────────────────────

const NEXT_STREET: Record<Street, { street: Street; cards: number } | null> = {
  preflop: { street: 'flop', cards: 3 },
  flop: { street: 'turn', cards: 1 },
  turn: { street: 'river', cards: 1 },
  river: null,
};

/** Closes the betting round, dealing further streets (all-in runouts included) until someone must act or the hand ends. */
function advance(s: HandState): void {
  for (;;) {
    const next = NEXT_STREET[s.street];
    if (!next) {
      settle(s);
      return;
    }
    s.burns.push(s.deck.shift()!);
    for (let i = 0; i < next.cards; i++) s.board.push(s.deck.shift()!);
    s.street = next.street;
    s.currentBet = 0;
    s.lastRaiseSize = s.setup.bigBlind;
    s.streetLimit = 'no-limit';
    for (const p of s.seats) {
      p.streetCommitted = 0;
      p.hasActed = false;
      p.betLevelWhenActed = -1;
    }
    // Post-flop action starts with the first active seat left of the button.
    s.toAct = findNextToAct(s, s.button);
    if (s.toAct !== null) return;
  }
}

// ───────────────────────── magic primitives ─────────────────────────

/** True before anyone has taken a voluntary action on the current street (blinds are not actions). */
export function isStreetOpening(state: HandState): boolean {
  return state.phase === 'betting' && state.toAct !== null && !state.log.some((e) => e.street === state.street);
}

function recordEffect(s: HandState, effect: EngineEffect): void {
  (s.effects ??= []).push(effect);
}

/** Sets the betting structure for the rest of the current street. Only legal at street opening. */
export function setStreetLimit(state: HandState, limit: BetLimit): HandState {
  if (!isStreetOpening(state)) throw new RulesError('The betting limit can only change before the street\'s first action');
  if ((state.streetLimit ?? 'no-limit') === limit) throw new RulesError(`This street is already ${limit}`);
  const s = structuredClone(state);
  s.streetLimit = limit;
  recordEffect(s, { kind: 'streetLimit', atLog: s.log.length, limit });
  assertInvariants(s);
  return s;
}

/**
 * Replaces one of `seat`'s hole cards with a uniformly random undealt card,
 * then returns the old card to the undealt stub and reshuffles it with the
 * hand's deck RNG. Only legal preflop before any voluntary action.
 */
export function exchangeHoleCard(state: HandState, seat: number, holeIndex: number): HandState {
  if (state.street !== 'preflop' || !isStreetOpening(state)) {
    throw new RulesError('Hole cards can only be exchanged before preflop betting');
  }
  const p = state.seats[seat];
  if (!p || !p.inHand || p.folded) throw new RulesError('Seat has no live hand');
  if (holeIndex !== 0 && holeIndex !== 1) throw new RulesError('Invalid hole card');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  const [drawn] = s.deck.splice(rng.nextInt(s.deck.length), 1);
  const old = s.seats[seat].hole[holeIndex];
  s.seats[seat].hole[holeIndex] = drawn;
  s.deck.push(old);
  rng.shuffle(s.deck);
  s.rngState = rng.state;
  recordEffect(s, { kind: 'exchange', atLog: s.log.length, seat, holeIndex });
  assertInvariants(s);
  return s;
}

/**
 * Replaces one of `seat`'s hole cards with a specific undealt card (chosen
 * privately from candidates the magic layer drew from the stub), returns the old
 * card to the stub and reshuffles it. Preflop, before any voluntary action only.
 */
export function exchangeHoleCardFor(state: HandState, seat: number, holeIndex: number, card: Card): HandState {
  if (state.street !== 'preflop' || !isStreetOpening(state)) {
    throw new RulesError('Hole cards can only be exchanged before preflop betting');
  }
  const p = state.seats[seat];
  if (!p || !p.inHand || p.folded) throw new RulesError('Seat has no live hand');
  if (holeIndex !== 0 && holeIndex !== 1) throw new RulesError('Invalid hole card');
  const at = state.deck.indexOf(card);
  if (at < 0) throw new RulesError('That card is not in the undealt stub');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  s.deck.splice(at, 1);
  const old = s.seats[seat].hole[holeIndex];
  s.seats[seat].hole[holeIndex] = card;
  s.deck.push(old);
  rng.shuffle(s.deck);
  s.rngState = rng.state;
  recordEffect(s, { kind: 'exchangeFor', atLog: s.log.length, seat, holeIndex, card });
  assertInvariants(s);
  return s;
}

function applyEffect(s: HandState, e: EngineEffect): HandState {
  if (e.kind === 'streetLimit') return setStreetLimit(s, e.limit);
  if (e.kind === 'exchangeFor') return exchangeHoleCardFor(s, e.seat, e.holeIndex, e.card);
  return exchangeHoleCard(s, e.seat, e.holeIndex);
}

// ─────────────────────────── settlement ───────────────────────────

function settle(s: HandState): void {
  const n = s.seats.length;
  const startStacks = s.seats.map((p) => p.stack + p.totalCommitted);

  // Return the uncalled part of the largest contribution.
  let top = -1;
  for (let i = 0; i < n; i++) if (top < 0 || s.seats[i].totalCommitted > s.seats[top].totalCommitted) top = i;
  const second = Math.max(0, ...s.seats.filter((_, i) => i !== top).map((p) => p.totalCommitted));
  let uncalledReturn: HandResult['uncalledReturn'] = null;
  const excess = s.seats[top].totalCommitted - second;
  if (excess > 0) {
    s.seats[top].totalCommitted -= excess;
    s.seats[top].streetCommitted = Math.max(0, s.seats[top].streetCommitted - excess);
    s.seats[top].stack += excess;
    if (s.seats[top].stack > 0) s.seats[top].allIn = false;
    uncalledReturn = { seat: top, amount: excess };
  }

  const contributions = s.seats.map((p) => p.totalCommitted);
  const folded = s.seats.map((p) => !p.inHand || p.folded);
  const pots = buildPots(contributions, folded);
  const liveSeats = s.seats.map((_, i) => i).filter((i) => !folded[i]);

  const scores: (number | null)[] = new Array(n).fill(null);
  const showdown: ShowdownEntry[] = [];
  if (liveSeats.length === 1) {
    scores[liveSeats[0]] = 0;
  } else {
    for (const seat of liveSeats) {
      const hand = evaluateBest([...s.seats[seat].hole, ...s.board]);
      scores[seat] = hand.score;
      showdown.push({ seat, hole: [...s.seats[seat].hole], hand });
    }
  }

  const awards = awardPots(pots, scores, s.button);
  for (const award of awards) {
    for (const [seat, chips] of Object.entries(award.shares)) s.seats[Number(seat)].stack += chips;
  }
  for (const p of s.seats) {
    p.totalCommitted = 0;
    p.streetCommitted = 0;
  }

  const zeroChipSeats: ZeroChipSeat[] = [];
  s.seats.forEach((p, seat) => {
    if (!p.inHand || p.stack > 0) return;
    let claimPotIndex = -1;
    awards.forEach((a, i) => {
      if (a.eligible.includes(seat)) claimPotIndex = i;
    });
    zeroChipSeats.push({
      seat,
      id: p.id,
      claimPotIndex,
      claimants: claimPotIndex >= 0 ? [...awards[claimPotIndex].winners] : [],
    });
  });

  s.result = {
    contributions,
    uncalledReturn,
    pots: awards,
    showdown,
    netChange: s.seats.map((p, i) => p.stack - startStacks[i]),
    zeroChipSeats,
  };
  s.phase = 'complete';
  s.toAct = null;
}

// ─────────────────────────── invariants ───────────────────────────

/** Throws if chips are not conserved or any card is missing/duplicated. Runs on every transition. */
export function assertInvariants(s: HandState): void {
  let chips = 0;
  for (const p of s.seats) {
    for (const v of [p.stack, p.streetCommitted, p.totalCommitted]) {
      if (!Number.isInteger(v) || v < 0) throw new Error(`Invariant: invalid chip value for ${p.id}`);
    }
    if (p.streetCommitted > p.totalCommitted) throw new Error(`Invariant: street > total commitment for ${p.id}`);
    if (!p.inHand && (p.hole.length > 0 || p.totalCommitted > 0)) throw new Error(`Invariant: sitting-out seat ${p.id} in hand`);
    chips += p.stack + p.totalCommitted;
  }
  if (chips !== s.chipTotal) throw new Error(`Invariant: chip total ${chips} != ${s.chipTotal}`);

  const cards = [...s.deck, ...s.burns, ...s.board, ...s.seats.flatMap((p) => p.hole)];
  if (cards.length !== 52 || new Set(cards).size !== 52 || cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51)) {
    throw new Error('Invariant: deck is not exactly 52 unique cards');
  }
  if (s.phase === 'complete' && s.seats.some((p) => p.totalCommitted !== 0)) {
    throw new Error('Invariant: chips left in pot after settlement');
  }
}

// ──────────────────────── replay, save, rotation ────────────────────────

/** Rebuilds a hand from its setup, action log and effects; identical inputs give identical states. */
export function replayHand(
  setup: HandSetup,
  log: Pick<LoggedAction, 'seat' | 'action'>[],
  effects: EngineEffect[] = [],
): HandState {
  let s = startHand(setup);
  const pending = [...effects];
  const flush = (at: number) => {
    while (pending.length && pending[0].atLog === at) s = applyEffect(s, pending.shift()!);
  };
  log.forEach((entry, i) => {
    flush(i);
    s = applyAction(s, entry.seat, entry.action);
  });
  flush(log.length);
  if (pending.length) throw new RulesError('Unapplied effects in replay');
  return s;
}

export function serializeHand(state: HandState): string {
  return JSON.stringify(state);
}

export function deserializeHand(json: string): HandState {
  const s = JSON.parse(json) as HandState;
  if (s.version !== 1) throw new RulesError(`Unsupported save version ${s.version}`);
  assertInvariants(s);
  return s;
}

/** Setup for the following hand: carries stacks over and moves the button to the next seat with chips. */
export function nextHandSetup(state: HandState, seed: number): HandSetup {
  if (state.phase !== 'complete') throw new RulesError('Hand is not complete');
  const players = state.seats.map((p) => ({ id: p.id, stack: p.stack }));
  const n = players.length;
  let button = -1;
  for (let i = 1; i <= n; i++) {
    const seat = (state.button + i) % n;
    if (players[seat].stack > 0) {
      button = seat;
      break;
    }
  }
  return { seed, players, button, smallBlind: state.setup.smallBlind, bigBlind: state.setup.bigBlind };
}

// ─────────────────────────── public view ───────────────────────────

export interface PublicSeat {
  id: string;
  stack: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  streetCommitted: number;
  totalCommitted: number;
  /** Own cards, cards shown at showdown, or null when hidden. */
  hole: Card[] | null;
}

export interface PublicView {
  viewer: number;
  board: Card[];
  seats: PublicSeat[];
  button: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  street: Street;
  phase: HandState['phase'];
  toAct: number | null;
  currentBet: number;
  lastRaiseSize: number;
  bigBlind: number;
  log: LoggedAction[];
  result: HandResult | null;
  legal: LegalActions | null;
}

/**
 * What one seat may legitimately know. AI agents must decide from this view
 * only: it never contains the deck, burns, or another seat's unshown cards.
 */
export function getPublicView(state: HandState, viewer: number): PublicView {
  const shown = new Set(state.result?.showdown.map((e) => e.seat) ?? []);
  return structuredClone({
    viewer,
    board: state.board,
    seats: state.seats.map((p, i) => ({
      id: p.id,
      stack: p.stack,
      inHand: p.inHand,
      folded: p.folded,
      allIn: p.allIn,
      streetCommitted: p.streetCommitted,
      totalCommitted: p.totalCommitted,
      hole: i === viewer || shown.has(i) ? p.hole : null,
    })),
    button: state.button,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    street: state.street,
    phase: state.phase,
    toAct: state.toAct,
    currentBet: state.currentBet,
    lastRaiseSize: state.lastRaiseSize,
    bigBlind: state.setup.bigBlind,
    log: state.log,
    result: state.result,
    legal: state.toAct === viewer ? getLegalActions(state) : null,
  });
}
