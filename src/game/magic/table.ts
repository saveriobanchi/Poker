/**
 * The magic layer (P2): wraps a poker HandState with each seat's Spellbook,
 * Aether and the per-hand spell state. All functions are pure and
 * deterministic; every accepted command is recorded so a hand replays exactly.
 *
 * Rules: design bible v0.4, decisions 05–08, and src/game/magic/spells.json.
 * Magic never creates, moves or destroys chips. Only the poker engine moves
 * chips, through ordinary legal actions.
 */
import type { Card } from '../rules/cards';
import {
  applyAction,
  assertInvariants,
  exchangeHoleCard,
  getLegalActions,
  HandState,
  isStreetOpening,
  PlayerAction,
  setStreetLimit,
  Street,
} from '../rules/engine';
import { Rng } from '../rules/rng';
import { discardSpells, drawSpells, SpellCard, Spellbook, SPELLBOOK_MAX, SPELLBOOK_MIN } from './spellbook';
import { AETHER, CINDER_REWARD, SpellId, SPELLS, SPELLS_DRAWN_PER_HAND } from './spells';

/** Persistent per-character magic (survives between hands). */
export interface SeatMagic {
  aether: number;
  book: Spellbook;
}

export type CastParams =
  | { spell: 'briar_lock' }
  | { spell: 'fate_exchange'; holeIndex: 0 | 1 }
  | { spell: 'unmask'; target: number }
  | { spell: 'cinder_challenge'; raiseTo: number };

export type MagicCommand =
  | { kind: 'cast'; seat: number; uid: string; params: CastParams }
  | { kind: 'pass'; seat: number }
  | { kind: 'act'; seat: number; action: PlayerAction };

/** Public record of a cast: what every seat at the table sees. */
export interface MagicEvent {
  seat: number;
  spell: SpellId;
  street: Street;
  target?: number;
  tell: string;
}

export interface AetherGain {
  seat: number;
  amount: number;
  reason: 'showdown' | 'cinder_called' | 'cinder_folded';
}

/**
 * An enchanted raise and each opponent's first response to it on that street.
 * `match`: a call or re-raise committing at least `raiseTo` (design v0.5);
 * `short`: an all-in call for less; `fold`.
 */
export interface CinderMark {
  seat: number;
  logIndex: number;
  street: Street;
  raiseTo: number;
  responses: { seat: number; kind: 'match' | 'short' | 'fold' }[];
}

export interface HandMagic {
  /** Spells drawn this hand, per seat (private to the owner). Cast cards stay here until hand end. */
  hands: SpellCard[][];
  cast: (string | null)[];
  /** Pending street-opening window: seats still to decide, in action order. */
  window: { street: Street; queue: number[] } | null;
  /** Streets whose opening window has already been offered. */
  openedStreets: Street[];
  cinder: CinderMark[];
  /** Unmask results; each is visible only to its caster. */
  reveals: { caster: number; target: number; card: Card }[];
  events: MagicEvent[];
  gains: AetherGain[];
  commands: MagicCommand[];
  rngState: number;
  settled: boolean;
}

export interface MagicTable {
  hand: HandState;
  seats: SeatMagic[];
  magic: HandMagic;
}

export class MagicError extends Error {}

// ───────────────────────────── setup ─────────────────────────────

export function createSeatMagic(book: Spellbook): SeatMagic {
  return { aether: AETHER.initial, book };
}

/** Starts the magic layer for a freshly dealt hand: each live seat draws spells, then the preflop window opens. */
export function beginHand(hand: HandState, seats: SeatMagic[], magicSeed: number): MagicTable {
  if (seats.length !== hand.seats.length) throw new MagicError('One SeatMagic per seat required');
  const t: MagicTable = {
    hand,
    seats: structuredClone(seats),
    magic: {
      hands: seats.map(() => []),
      cast: seats.map(() => null),
      window: null,
      openedStreets: [],
      cinder: [],
      reveals: [],
      events: [],
      gains: [],
      commands: [],
      rngState: magicSeed >>> 0,
      settled: false,
    },
  };
  hand.seats.forEach((p, i) => {
    if (!p.inHand) return;
    const { book, drawn } = drawSpells(t.seats[i].book, SPELLS_DRAWN_PER_HAND);
    t.seats[i].book = book;
    t.magic.hands[i] = drawn;
  });
  afterChange(t);
  assertMagicInvariants(t);
  return t;
}

// ─────────────────────────── eligibility ───────────────────────────

function actionable(t: MagicTable, seat: number): boolean {
  const p = t.hand.seats[seat];
  return p.inHand && !p.folded && !p.allIn;
}

function canAfford(t: MagicTable, seat: number, spell: SpellId): boolean {
  return t.seats[seat].aether >= SPELLS[spell].cost;
}

/** Can `seat` cast this opening spell in the current street-opening window? */
function openingSpellUsable(t: MagicTable, seat: number, spell: SpellId): boolean {
  const def = SPELLS[spell];
  if (def.window === 'preflopOpening') return t.hand.street === 'preflop';
  if (spell === 'briar_lock') return (t.hand.streetLimit ?? 'no-limit') === 'no-limit';
  return def.window === 'opening';
}

function hasOpeningOption(t: MagicTable, seat: number): boolean {
  if (t.magic.cast[seat] !== null || !actionable(t, seat)) return false;
  return t.magic.hands[seat].some(
    (c) =>
      (SPELLS[c.spell].window === 'opening' || SPELLS[c.spell].window === 'preflopOpening') &&
      openingSpellUsable(t, seat, c.spell) &&
      canAfford(t, seat, c.spell),
  );
}

/** Seats in action order from the seat to act, clockwise. */
function actionOrder(t: MagicTable): number[] {
  const n = t.hand.seats.length;
  const start = t.hand.toAct ?? 0;
  return Array.from({ length: n }, (_, i) => (start + i) % n);
}

function openWindow(t: MagicTable): void {
  const queue = actionOrder(t).filter((seat) => hasOpeningOption(t, seat));
  t.magic.window = queue.length ? { street: t.hand.street, queue } : null;
}

/** Drops seats that can no longer cast anything in the current window. */
function pruneWindow(t: MagicTable): void {
  if (!t.magic.window) return;
  t.magic.window.queue = t.magic.window.queue.filter((seat) => hasOpeningOption(t, seat));
  if (t.magic.window.queue.length === 0) t.magic.window = null;
}

/** Called after every accepted command: opens windows on new streets and settles finished hands. */
function afterChange(t: MagicTable): void {
  if (t.hand.phase === 'complete') {
    t.magic.window = null;
    if (!t.magic.settled) settleMagic(t);
    return;
  }
  if (isStreetOpening(t.hand) && !t.magic.openedStreets.includes(t.hand.street)) {
    t.magic.openedStreets.push(t.hand.street);
    openWindow(t);
  }
}

/** The seat that must decide in the current opening window, if any. */
export function windowSeat(t: MagicTable): number | null {
  return t.magic.window?.queue[0] ?? null;
}

export interface CastOption {
  uid: string;
  spell: SpellId;
  /** Unmask: legal targets. */
  targets?: number[];
}

/** Spells `seat` may cast right now (empty when none). */
export function castOptions(t: MagicTable, seat: number): CastOption[] {
  if (t.hand.phase !== 'betting' || t.magic.cast[seat] !== null) return [];
  const inWindow = windowSeat(t) === seat;
  const onTurn = t.magic.window === null && t.hand.toAct === seat;
  const options: CastOption[] = [];
  const seen = new Set<SpellId>();
  for (const card of t.magic.hands[seat]) {
    if (seen.has(card.spell) || !canAfford(t, seat, card.spell)) continue;
    const def = SPELLS[card.spell];
    if (inWindow && (def.window === 'opening' || def.window === 'preflopOpening')) {
      if (openingSpellUsable(t, seat, card.spell)) options.push({ uid: card.uid, spell: card.spell });
    } else if (onTurn && def.window === 'decision') {
      const targets = unmaskTargets(t, seat);
      if (targets.length) options.push({ uid: card.uid, spell: card.spell, targets });
    } else if (onTurn && def.window === 'raise') {
      if (getLegalActions(t.hand)?.raise) options.push({ uid: card.uid, spell: card.spell });
    } else continue;
    seen.add(card.spell);
  }
  return options;
}

function unmaskTargets(t: MagicTable, caster: number): number[] {
  return t.hand.seats
    .map((p, i) => i)
    .filter((i) => {
      const p = t.hand.seats[i];
      return i !== caster && p.inHand && !p.folded && p.hole.length === 2;
    });
}

// ───────────────────────────── commands ─────────────────────────────

export function apply(t0: MagicTable, command: MagicCommand): MagicTable {
  switch (command.kind) {
    case 'cast':
      return castSpell(t0, command.seat, command.uid, command.params);
    case 'pass':
      return passWindow(t0, command.seat);
    case 'act':
      return act(t0, command.seat, command.action);
  }
}

/** Casts a spell. Throws MagicError (state untouched) when the cast is not legal right now. */
export function castSpell(t0: MagicTable, seat: number, uid: string, params: CastParams): MagicTable {
  if (t0.hand.phase !== 'betting') throw new MagicError('No spells once the hand is settled or running out');
  if (t0.magic.cast[seat] !== null) throw new MagicError('Only one spell per hand');
  const card = t0.magic.hands[seat]?.find((c) => c.uid === uid);
  if (!card) throw new MagicError('That spell is not in your hand');
  if (card.spell !== params.spell) throw new MagicError('Spell parameters do not match the card');
  if (!castOptions(t0, seat).some((o) => o.spell === card.spell)) {
    throw new MagicError(`${SPELLS[card.spell].name} cannot be cast right now`);
  }
  const def = SPELLS[card.spell];
  const t = structuredClone(t0);
  const event: MagicEvent = { seat, spell: card.spell, street: t.hand.street, tell: def.tell };

  try {
    switch (params.spell) {
      case 'briar_lock':
        t.hand = setStreetLimit(t.hand, 'pot-limit');
        break;
      case 'fate_exchange':
        t.hand = exchangeHoleCard(t.hand, seat, params.holeIndex);
        break;
      case 'unmask': {
        if (!unmaskTargets(t, seat).includes(params.target)) throw new MagicError('Not a legal Unmask target');
        const rng = new Rng(t.magic.rngState);
        const card = t.hand.seats[params.target].hole[rng.nextInt(2)];
        t.magic.rngState = rng.state;
        t.magic.reveals.push({ caster: seat, target: params.target, card });
        event.target = params.target;
        break;
      }
      case 'cinder_challenge': {
        const legal = getLegalActions(t.hand)!;
        const r = legal.raise!;
        if (!Number.isInteger(params.raiseTo) || params.raiseTo < r.minTo || params.raiseTo > r.maxTo) {
          throw new MagicError(`Cinder Challenge needs a legal raise from ${r.minTo} to ${r.maxTo}`);
        }
        t.magic.cinder.push({ seat, logIndex: t.hand.log.length, street: t.hand.street, raiseTo: params.raiseTo, responses: [] });
        t.hand = applyAction(t.hand, seat, { type: r.isBet ? 'bet' : 'raise', to: params.raiseTo });
        break;
      }
    }
  } catch (e) {
    if (e instanceof MagicError) throw e;
    throw new MagicError((e as Error).message);
  }

  t.seats[seat].aether -= def.cost;
  t.magic.cast[seat] = uid;
  t.magic.events.push(event);
  t.magic.commands.push({ kind: 'cast', seat, uid, params });
  if (t.magic.window) {
    t.magic.window.queue = t.magic.window.queue.filter((s) => s !== seat);
    pruneWindow(t);
  }
  afterChange(t);
  assertMagicInvariants(t);
  return t;
}

/** Declines to cast in the current opening window. */
export function passWindow(t0: MagicTable, seat: number): MagicTable {
  if (windowSeat(t0) !== seat) throw new MagicError('Not your magic window');
  const t = structuredClone(t0);
  t.magic.window!.queue.shift();
  pruneWindow(t);
  t.magic.commands.push({ kind: 'pass', seat });
  afterChange(t);
  return t;
}

/** An ordinary poker action. Blocked while a street-opening window is pending. */
export function act(t0: MagicTable, seat: number, action: PlayerAction): MagicTable {
  if (t0.magic.window) throw new MagicError('The street-opening magic window must close first');
  const t = structuredClone(t0);
  const before = t0.hand.seats[seat];
  const street = t0.hand.street;
  t.hand = applyAction(t.hand, seat, action);
  recordCinderResponse(t, seat, street, before.streetCommitted + before.stack, t0.hand.currentBet);
  t.magic.commands.push({ kind: 'act', seat, action });
  afterChange(t);
  assertMagicInvariants(t);
  return t;
}

/** Records `seat`'s first response to any open enchanted raise on this street. */
function recordCinderResponse(t: MagicTable, seat: number, street: Street, maxLevel: number, betBefore: number): void {
  const applied = t.hand.log.at(-1)!.action;
  for (const mark of t.magic.cinder) {
    if (mark.seat === seat || mark.street !== street || mark.responses.some((r) => r.seat === seat)) continue;
    let level = 0;
    if (applied.type === 'call') level = Math.min(betBefore, maxLevel);
    else if (applied.type === 'bet' || applied.type === 'raise') level = applied.to;
    if (applied.type === 'fold') mark.responses.push({ seat, kind: 'fold' });
    else if (level > 0) mark.responses.push({ seat, kind: level >= mark.raiseTo ? 'match' : 'short' });
  }
}

// ──────────────────────────── settlement ────────────────────────────

function gain(t: MagicTable, seat: number, amount: number, reason: AetherGain['reason']): void {
  const before = t.seats[seat].aether;
  const after = Math.min(AETHER.max, before + amount);
  if (after > before) t.magic.gains.push({ seat, amount: after - before, reason });
  t.seats[seat].aether = after;
}

/** After pot settlement: showdown regeneration first, then Cinder Challenge, all capped (decision 05). */
function settleMagic(t: MagicTable): void {
  const result = t.hand.result!;
  for (const entry of result.showdown) gain(t, entry.seat, AETHER.showdownRegen, 'showdown');

  for (const mark of t.magic.cinder) {
    const matchers = mark.responses.filter((r) => r.kind === 'match').map((r) => r.seat);
    if (result.showdown.length > 0 && matchers.length > 0) {
      // Once per cast: the caster must be the sole winner of a contested pot a matcher is eligible for.
      const wonAgainstMatcher = result.pots.some(
        (pot) => pot.winners.length === 1 && pot.winners[0] === mark.seat && matchers.some((c) => pot.eligible.includes(c)),
      );
      if (wonAgainstMatcher) gain(t, mark.seat, CINDER_REWARD.calledAndWon, 'cinder_called');
    } else if (
      result.showdown.length === 0 &&
      !t.hand.seats[mark.seat].folded &&
      mark.responses.length > 0 &&
      mark.responses.every((r) => r.kind === 'fold')
    ) {
      gain(t, mark.seat, CINDER_REWARD.allFolded, 'cinder_folded');
    }
  }

  t.magic.hands.forEach((cards, seat) => {
    t.seats[seat].book = discardSpells(t.seats[seat].book, cards);
  });
  t.magic.hands = t.magic.hands.map(() => []);
  t.magic.settled = true;
}

// ─────────────────────────── invariants ───────────────────────────

export function assertMagicInvariants(t: MagicTable): void {
  assertInvariants(t.hand);
  t.seats.forEach((s, seat) => {
    if (!Number.isInteger(s.aether) || s.aether < 0 || s.aether > AETHER.max) {
      throw new Error(`Magic invariant: Aether ${s.aether} out of range for seat ${seat}`);
    }
    const all = [...s.book.draw, ...s.book.discard, ...t.magic.hands[seat]];
    const uids = new Set(all.map((c) => c.uid));
    if (uids.size !== all.length) throw new Error(`Magic invariant: duplicated spell instance for seat ${seat}`);
    if (all.length < SPELLBOOK_MIN || all.length > SPELLBOOK_MAX) {
      throw new Error(`Magic invariant: Spellbook of seat ${seat} has ${all.length} spells`);
    }
    if (all.some((c) => !c.uid.startsWith(`${s.book.owner}:`))) throw new Error('Magic invariant: foreign spell instance');
  });
  const casts = t.magic.events.length;
  if (casts !== t.magic.cast.filter((c) => c !== null).length) throw new Error('Magic invariant: cast bookkeeping');
}

// ───────────────────────────── replay ─────────────────────────────

/** Rebuilds a magic hand from its starting inputs and command list. */
export function replayMagicHand(
  hand: HandState,
  seats: SeatMagic[],
  magicSeed: number,
  commands: MagicCommand[],
): MagicTable {
  let t = beginHand(hand, seats, magicSeed);
  for (const c of commands) t = apply(t, c);
  return t;
}

// ─────────────────────────── private view ───────────────────────────

export interface MagicView {
  viewer: number;
  /** Aether is public. */
  aether: number[];
  /** Number of spells each seat holds this hand (public); contents only for the viewer. */
  handSizes: number[];
  myHand: SpellCard[];
  castThisHand: boolean[];
  events: MagicEvent[];
  gains: AetherGain[];
  /** Opponent cards this viewer legitimately learned via Unmask this hand. */
  known: { seat: number; card: Card }[];
  windowSeat: number | null;
  streetLocked: boolean;
  options: CastOption[];
}

/** What one seat may know about the magic layer. Never includes others' spells or reveals. */
export function getMagicView(t: MagicTable, viewer: number): MagicView {
  const handSizes = t.magic.settled ? t.magic.hands.map(() => 0) : t.magic.hands.map((h) => h.length);
  return structuredClone({
    viewer,
    aether: t.seats.map((s) => s.aether),
    handSizes,
    myHand: t.magic.hands[viewer] ?? [],
    castThisHand: t.magic.cast.map((c) => c !== null),
    events: t.magic.events,
    gains: t.magic.gains,
    known: t.magic.reveals.filter((r) => r.caster === viewer).map((r) => ({ seat: r.target, card: r.card })),
    windowSeat: windowSeat(t),
    streetLocked: t.hand.streetLimit === 'pot-limit',
    options: castOptions(t, viewer),
  });
}
