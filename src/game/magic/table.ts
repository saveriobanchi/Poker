/**
 * The magic layer: wraps a poker HandState with each seat's Spellbook, Aether,
 * relics and covenants, plus the per-hand spell state. All functions are pure
 * and deterministic; every accepted command is recorded so a hand replays exactly.
 *
 * Rules: design bible v0.4 (decisions 05–08), v0.5 (§02) and v0.6 (§04, §05);
 * spell data in spells.json and run/data/p4-*.json.
 * Magic never creates, moves or destroys chips. Only the poker engine moves
 * chips, through ordinary legal actions.
 */
import { type Card, rankOf } from '../rules/cards';
import {
  applyAction,
  assertInvariants,
  exchangeHoleCard,
  exchangeHoleCardFor,
  getLegalActions,
  type HandState,
  isStreetOpening,
  type PlayerAction,
  setStreetLimit,
  type Street,
} from '../rules/engine';
import { Rng } from '../rules/rng';
import { type CovenantId, FAMILY_DISCOUNT, type RelicId } from './relics';
import { allCards, discardSpells, drawSpells, type SpellCard, type Spellbook, SPELLBOOK_MAX, SPELLBOOK_MIN } from './spellbook';
import {
  AETHER,
  type BaseSpellId,
  CINDER_REWARD,
  isBaseSpell,
  MAX_SPELLS_DRAWN,
  type SpellId,
  SPELLS,
  SPELLS_DRAWN_PER_HAND,
} from './spells';

/** Persistent per-character magic (survives between hands). */
export interface SeatMagic {
  aether: number;
  book: Spellbook;
  relics?: RelicId[];
  covenants?: CovenantId[];
  /** Once-per-table markers (relic triggers and first-cast discounts); cleared at each new table. */
  tableFlags?: string[];
  /** Ember Echo: spells to draw in addition at the start of the next hand (0 or 1). */
  extraDraw?: number;
  /**
   * Offline research only (design v1.1 §04): an isolated Aether variant for this
   * table. Never set in play; absent means exact P8 rules.
   */
  research?: AetherVariant;
  /** Research instrumentation: Aether lost to the cap at this table (only counted when `research` is set). */
  capWaste?: number;
  /** ember_overflow_reserve: at most 1 Aether lost to the cap by a Cinder reward, held until the next hand opens. */
  emberReserve?: number;
  /** ember_next_hand_discount: one 1-Aether discount on a later Cinder-family cast at this table. */
  emberDiscount?: number;
}

/** `baseline` changes no rule: it only turns on the cap-waste counter so the control arm is measured alike. */
/**
 * `ember_overflow_reserve` is the hand-off's literal rule (return at the next hand's opening
 * if below the cap). A reward only overflows when it fills Aether to the cap, and nothing
 * lowers Aether before the next hand opens, so the literal rule can never return anything.
 * `ember_reserve_on_spend` is the labelled interpretation awaiting a ruling: the reserve
 * returns right after the holder's first paid cast in the next hand, else expires with it.
 */
export type AetherVariant = 'baseline' | 'ember_overflow_reserve' | 'ember_reserve_on_spend' | 'ember_next_hand_discount';

export type CastParams =
  | { spell: 'briar_lock' | 'thorn_lattice' | 'quiet_briars' }
  | { spell: 'fate_exchange' | 'marked_fate' | 'second_reflection'; holeIndex: 0 | 1 }
  | { spell: 'unmask' | 'ravenous_eye'; target: number }
  | { spell: 'twin_oracle'; targets: number[] }
  | { spell: 'cinder_challenge' | 'ember_echo' | 'red_oath'; raiseTo: number };

export type MagicCommand =
  | { kind: 'cast'; seat: number; uid: string; params: CastParams }
  | { kind: 'pass'; seat: number }
  | { kind: 'act'; seat: number; action: PlayerAction }
  /** Second Reflection: pick one of the two private candidates. */
  | { kind: 'choose'; seat: number; pick: 0 | 1 }
  /** Fateweaver's Sigil: send one drawn spell to the bottom and draw a replacement, or keep (null). */
  | { kind: 'sigil'; seat: number; uid: string | null };

/** Public record of a cast: what every seat at the table sees. */
export interface MagicEvent {
  seat: number;
  spell: SpellId;
  street: Street;
  target?: number;
  targets?: number[];
  /** Marked Fate: the rank (not suit) of the discarded card, announced publicly. */
  markedRank?: number;
  tell: string;
}

export type AetherGainReason =
  | 'ember_reserve'
  | 'showdown'
  | 'cinder_called'
  | 'cinder_folded'
  | 'quiet_briars'
  | 'ashen_signet'
  | 'gambler_knot'
  | 'open_book';

export interface AetherGain {
  seat: number;
  amount: number;
  reason: AetherGainReason;
}

/**
 * An enchanted raise and each opponent's first response to it on that street.
 * `match`: a call or re-raise committing at least `raiseTo` (design v0.5);
 * `short`: an all-in call for less; `fold`.
 */
export interface CinderMark {
  seat: number;
  uid: string;
  spell: SpellId;
  logIndex: number;
  street: Street;
  raiseTo: number;
  responses: { seat: number; kind: 'match' | 'short' | 'fold' }[];
}

/** A hole card made public to the whole table (Open Book, Red Oath). The slot follows any exchange. */
export interface PublicReveal {
  seat: number;
  holeIndex: 0 | 1;
  source: 'open_book' | 'red_oath';
}

/** Conditions that earn a base spell instance one Resonance this hand (design v0.6 §04). */
type ResonanceWatch =
  | { kind: 'unmask'; uid: string; seat: number; target: number; logLen: number }
  | { kind: 'briar'; uid: string; street: Street }
  | { kind: 'fate'; uid: string; seat: number };

export interface HandMagic {
  /** Spells drawn this hand, per seat (private to the owner). Cast cards stay here until hand end. */
  hands: SpellCard[][];
  cast: (string | null)[];
  /** Pending street-opening window: seats still to decide, in action order. */
  window: { street: Street; queue: number[] } | null;
  /** Streets whose opening window has already been offered. */
  openedStreets: Street[];
  cinder: CinderMark[];
  /** Private reveals (Unmask family); each is visible only to its caster. */
  reveals: { caster: number; target: number; card: Card }[];
  publicReveals: PublicReveal[];
  /** Public non-spell tells (Covenant of the Open Book). */
  notices: { seat: number; text: string }[];
  events: MagicEvent[];
  gains: AetherGain[];
  commands: MagicCommand[];
  /** Second Reflection awaiting the caster's private choice; blocks the table. */
  pendingChoice: { seat: number; uid: string; holeIndex: 0 | 1; candidates: [Card, Card] } | null;
  /** Fateweaver's Sigil (design v0.8 §05): the seat deciding whether to rearrange one drawn spell. */
  sigil?: number | null;
  /** Thorn Lattice: the next street to lock automatically. */
  lattice: { seat: number; street: Street } | null;
  /** Quiet Briars refunds to check when their street ends. */
  quiet: { seat: number; street: Street }[];
  watches: ResonanceWatch[];
  /** Instance uids that earned Resonance this hand (applied once at settlement). */
  resonated: string[];
  rngState: number;
  settled: boolean;
}

export interface MagicTable {
  hand: HandState;
  seats: SeatMagic[];
  magic: HandMagic;
}

export class MagicError extends Error {}

const NEXT_STREET: Record<Street, Street | null> = { preflop: 'flop', flop: 'turn', turn: 'river', river: null };

// ───────────────────────────── setup ─────────────────────────────

export function createSeatMagic(book: Spellbook, extras: Partial<SeatMagic> = {}): SeatMagic {
  return { aether: AETHER.initial, book, ...extras };
}

function has<T extends string>(list: T[] | undefined, item: T): boolean {
  return (list ?? []).includes(item);
}

function flag(s: SeatMagic, name: string): void {
  (s.tableFlags ??= []).push(name);
}

/** Starts the magic layer for a freshly dealt hand: covenants, spell draws, then the preflop window. */
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
      publicReveals: [],
      notices: [],
      events: [],
      gains: [],
      commands: [],
      pendingChoice: null,
      lattice: null,
      quiet: [],
      watches: [],
      resonated: [],
      rngState: magicSeed >>> 0,
      settled: false,
    },
  };
  const rng = new Rng(t.magic.rngState);
  hand.seats.forEach((p, i) => {
    const s = t.seats[i];
    // Research variant: a held overflow Aether returns as the next hand opens if below the cap, then expires.
    if (s.emberReserve && s.research === 'ember_overflow_reserve') {
      if (p.inHand && s.aether < AETHER.max) gain(t, i, s.emberReserve, 'ember_reserve');
      s.emberReserve = 0;
    }
    if (!p.inHand) s.emberReserve = 0;
    if (!p.inHand) return;
    // Covenant of the Open Book: +1 Aether, and one hole card shown to everyone before any window.
    if (has(s.covenants, 'covenant_open_book')) {
      gain(t, i, 1, 'open_book');
      const holeIndex = rng.nextInt(2) as 0 | 1;
      t.magic.publicReveals.push({ seat: i, holeIndex, source: 'open_book' });
      t.magic.notices.push({ seat: i, text: 'The Open Book turns a page: one card lies face up.' });
    }
    const count = Math.min(MAX_SPELLS_DRAWN, SPELLS_DRAWN_PER_HAND + Math.min(1, s.extraDraw ?? 0));
    const { book, drawn } = drawSpells(s.book, count);
    s.book = book;
    s.extraDraw = 0;
    t.magic.hands[i] = drawn;
    // Fateweaver's Sigil: once per table, after the draw and before any window, if another draw source exists.
    const source = s.book.draw.length + s.book.discard.length;
    if (has(s.relics, 'fateweavers_sigil') && !has(s.tableFlags, 'sigil') && drawn.length > 0 && source > 0 && t.magic.sigil == null) {
      flag(s, 'sigil');
      t.magic.sigil = i;
    }
  });
  t.magic.rngState = rng.state;
  afterChange(t);
  assertMagicInvariants(t);
  return t;
}

// ─────────────────────────── eligibility ───────────────────────────

function actionable(t: MagicTable, seat: number): boolean {
  const p = t.hand.seats[seat];
  return p.inHand && !p.folded && !p.allIn;
}

/** Aether cost after relic discounts (first family cast each table, minimum 0). */
export function castCost(s: SeatMagic, spell: SpellId): { cost: number; discount: RelicId | null } {
  const base = SPELLS[spell].cost;
  // Research variant only: one Ember token reduces a later Cinder-family cast by 1 (floor 0).
  const ember = s.emberDiscount && SPELLS[spell].family === 'cinder_challenge' ? 1 : 0;
  for (const relic of s.relics ?? []) {
    if (FAMILY_DISCOUNT[relic] === SPELLS[spell].family && !has(s.tableFlags, `discount:${relic}`)) {
      return { cost: Math.max(0, base - 1 - ember), discount: relic };
    }
  }
  return { cost: Math.max(0, base - ember), discount: null };
}

function canAfford(t: MagicTable, seat: number, spell: SpellId): boolean {
  return t.seats[seat].aether >= castCost(t.seats[seat], spell).cost;
}

/** Can `seat` cast this opening spell in the current street-opening window? */
function openingSpellUsable(t: MagicTable, spell: SpellId): boolean {
  const def = SPELLS[spell];
  if (def.window === 'preflopOpening') return t.hand.street === 'preflop';
  if (def.family === 'briar_lock') return (t.hand.streetLimit ?? 'no-limit') === 'no-limit';
  return def.window === 'opening';
}

function isOpening(spell: SpellId): boolean {
  const w = SPELLS[spell].window;
  return w === 'opening' || w === 'preflopOpening';
}

function hasOpeningOption(t: MagicTable, seat: number): boolean {
  if (t.magic.cast[seat] !== null || !actionable(t, seat)) return false;
  return t.magic.hands[seat].some((c) => isOpening(c.spell) && openingSpellUsable(t, c.spell) && canAfford(t, seat, c.spell));
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

function resonate(t: MagicTable, uid: string): void {
  if (!t.magic.resonated.includes(uid)) t.magic.resonated.push(uid);
}

/** Street-end effects for streets that just closed: Quiet Briars refunds. */
function closeStreets(t: MagicTable): void {
  const current = t.hand.phase === 'complete' ? null : t.hand.street;
  t.magic.quiet = t.magic.quiet.filter((q) => {
    if (q.street === current) return true;
    const loud = t.hand.log.some((e) => e.street === q.street && (e.action.type === 'bet' || e.action.type === 'raise'));
    if (!loud) gain(t, q.seat, 1, 'quiet_briars');
    return false;
  });
}

/** Resonance conditions that can be judged now. */
function checkWatches(t: MagicTable): void {
  t.magic.watches = t.magic.watches.filter((w) => {
    if (w.kind === 'unmask') {
      if (t.hand.log.length <= w.logLen) return t.hand.phase !== 'complete';
      if (!t.hand.seats[w.target].folded) resonate(t, w.uid);
      return false;
    }
    if (w.kind === 'fate' && t.hand.board.length >= 3) {
      if (!t.hand.seats[w.seat].folded) resonate(t, w.uid);
      return false;
    }
    return true;
  });
}

/** Called after every accepted command: street-end effects, new windows, settlement. */
function afterChange(t: MagicTable): void {
  checkWatches(t);
  closeStreets(t);
  if (t.hand.phase === 'complete') {
    t.magic.window = null;
    if (!t.magic.settled) settleMagic(t);
    return;
  }
  // The Sigil is decided before any opening window, so the window sees the final spell hand.
  if (t.magic.sigil != null) return;
  if (isStreetOpening(t.hand) && !t.magic.openedStreets.includes(t.hand.street)) {
    t.magic.openedStreets.push(t.hand.street);
    // Thorn Lattice carries the pot-limit onto this street before anyone may act.
    if (t.magic.lattice && t.magic.lattice.street === t.hand.street) {
      if ((t.hand.streetLimit ?? 'no-limit') === 'no-limit') t.hand = setStreetLimit(t.hand, 'pot-limit');
      t.magic.lattice = null;
    }
    openWindow(t);
  }
}

/** The seat that must decide in the current opening window, if any. */
export function windowSeat(t: MagicTable): number | null {
  if (t.magic.pendingChoice || t.magic.sigil != null) return null;
  return t.magic.window?.queue[0] ?? null;
}

/** The seat that must make a private Second Reflection choice, if any. */
export function choiceSeat(t: MagicTable): number | null {
  return t.magic.pendingChoice?.seat ?? null;
}

/** The seat deciding on its Fateweaver's Sigil, if any. */
export function sigilSeat(t: MagicTable): number | null {
  return t.magic.sigil ?? null;
}

/**
 * Fateweaver's Sigil: the chosen drawn spell goes to the bottom of the draw pile
 * (the discard is reshuffled in first if the pile is empty) and the top card is
 * drawn in its place. No Aether, no cast, no poker card. `null` keeps the draw.
 */
export function useSigil(t0: MagicTable, seat: number, uid: string | null): MagicTable {
  if (t0.magic.sigil !== seat) throw new MagicError('No Sigil decision is pending for this seat');
  const t = structuredClone(t0);
  t.magic.sigil = null;
  if (uid !== null) {
    const hand = t.magic.hands[seat];
    const i = hand.findIndex((c) => c.uid === uid);
    if (i < 0) throw new MagicError('That spell is not in your hand');
    const s = t.seats[seat];
    if (s.book.draw.length === 0) {
      const rng = new Rng(s.book.rngState);
      s.book.draw = rng.shuffle(s.book.discard);
      s.book.discard = [];
      s.book.rngState = rng.state;
    }
    const [card] = hand.splice(i, 1);
    s.book.draw.push(card);
    hand.splice(i, 0, s.book.draw.shift()!);
    t.magic.notices.push({ seat, text: 'The Sigil briefly rearranges a spell.' });
  }
  t.magic.commands.push({ kind: 'sigil', seat, uid });
  afterChange(t);
  assertMagicInvariants(t);
  return t;
}

export interface CastOption {
  uid: string;
  spell: SpellId;
  /** Aether this cast would cost now (after relic discounts). */
  cost: number;
  /** Unmask family: legal targets. */
  targets?: number[];
}

/** Spells `seat` may cast right now (empty when none). */
export function castOptions(t: MagicTable, seat: number): CastOption[] {
  if (t.hand.phase !== 'betting' || t.magic.cast[seat] !== null || t.magic.pendingChoice || t.magic.sigil != null) return [];
  const inWindow = windowSeat(t) === seat;
  const onTurn = t.magic.window === null && t.hand.toAct === seat;
  const options: CastOption[] = [];
  const seen = new Set<SpellId>();
  for (const card of t.magic.hands[seat]) {
    if (seen.has(card.spell) || !canAfford(t, seat, card.spell)) continue;
    const def = SPELLS[card.spell];
    const cost = castCost(t.seats[seat], card.spell).cost;
    if (inWindow && isOpening(card.spell)) {
      if (openingSpellUsable(t, card.spell)) options.push({ uid: card.uid, spell: card.spell, cost });
    } else if (onTurn && def.window === 'decision') {
      const targets = unmaskTargets(t, seat);
      if (targets.length) options.push({ uid: card.uid, spell: card.spell, cost, targets });
    } else if (onTurn && def.window === 'raise') {
      if (getLegalActions(t.hand)?.raise) options.push({ uid: card.uid, spell: card.spell, cost });
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
    case 'choose':
      return chooseCandidate(t0, command.seat, command.pick);
    case 'sigil':
      return useSigil(t0, command.seat, command.uid);
  }
}

function legalRaise(t: MagicTable, raiseTo: number, name: string): { isBet: boolean } {
  const r = getLegalActions(t.hand)!.raise!;
  if (!Number.isInteger(raiseTo) || raiseTo < r.minTo || raiseTo > r.maxTo) {
    throw new MagicError(`${name} needs a legal raise from ${r.minTo} to ${r.maxTo}`);
  }
  return r;
}

/** Casts a spell. Throws MagicError (state untouched) when the cast is not legal right now. */
export function castSpell(t0: MagicTable, seat: number, uid: string, params: CastParams): MagicTable {
  if (t0.hand.phase !== 'betting') throw new MagicError('No spells once the hand is settled or running out');
  if (t0.magic.pendingChoice) throw new MagicError('A Second Reflection choice is pending');
  if (t0.magic.sigil != null) throw new MagicError('A Sigil decision is pending');
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
  const rng = new Rng(t.magic.rngState);
  const reveal = (target: number, holeIndex: number) =>
    t.magic.reveals.push({ caster: seat, target, card: t.hand.seats[target].hole[holeIndex] });

  try {
    switch (params.spell) {
      case 'briar_lock':
      case 'quiet_briars':
      case 'thorn_lattice': {
        t.hand = setStreetLimit(t.hand, 'pot-limit');
        if (params.spell === 'briar_lock') t.magic.watches.push({ kind: 'briar', uid, street: t.hand.street });
        if (params.spell === 'quiet_briars') t.magic.quiet.push({ seat, street: t.hand.street });
        const next = NEXT_STREET[t.hand.street];
        if (params.spell === 'thorn_lattice' && next) t.magic.lattice = { seat, street: next };
        break;
      }
      case 'fate_exchange':
      case 'marked_fate': {
        const old = t.hand.seats[seat].hole[params.holeIndex];
        t.hand = exchangeHoleCard(t.hand, seat, params.holeIndex);
        if (params.spell === 'fate_exchange') t.magic.watches.push({ kind: 'fate', uid, seat });
        else event.markedRank = rankOf(old);
        break;
      }
      case 'second_reflection': {
        if (params.holeIndex !== 0 && params.holeIndex !== 1) throw new MagicError('Invalid hole card');
        const deck = t.hand.deck;
        const i = rng.nextInt(deck.length);
        let j = rng.nextInt(deck.length - 1);
        if (j >= i) j++;
        t.magic.pendingChoice = { seat, uid, holeIndex: params.holeIndex, candidates: [deck[i], deck[j]] };
        break;
      }
      case 'unmask':
      case 'ravenous_eye': {
        if (!unmaskTargets(t, seat).includes(params.target)) throw new MagicError('Not a legal target');
        if (params.spell === 'unmask') {
          reveal(params.target, rng.nextInt(2));
          t.magic.watches.push({ kind: 'unmask', uid, seat, target: params.target, logLen: t.hand.log.length });
        } else {
          reveal(params.target, 0);
          reveal(params.target, 1);
        }
        event.target = params.target;
        break;
      }
      case 'twin_oracle': {
        const legal = unmaskTargets(t, seat);
        const targets = [...new Set(params.targets)];
        if (targets.length < 1 || targets.length > 2 || targets.length !== params.targets.length) {
          throw new MagicError('Twin Oracle targets one or two distinct opponents');
        }
        if (targets.length === 1 && legal.length > 1) throw new MagicError('Choose two opponents when two are eligible');
        if (!targets.every((x) => legal.includes(x))) throw new MagicError('Not a legal target');
        for (const x of targets) reveal(x, rng.nextInt(2));
        event.targets = targets;
        break;
      }
      case 'cinder_challenge':
      case 'ember_echo':
      case 'red_oath': {
        const r = legalRaise(t, params.raiseTo, def.name);
        if (params.spell === 'red_oath') {
          t.magic.publicReveals.push({ seat, holeIndex: rng.nextInt(2) as 0 | 1, source: 'red_oath' });
        }
        t.magic.cinder.push({ seat, uid, spell: params.spell, logIndex: t.hand.log.length, street: t.hand.street, raiseTo: params.raiseTo, responses: [] });
        t.hand = applyAction(t.hand, seat, { type: r.isBet ? 'bet' : 'raise', to: params.raiseTo });
        break;
      }
    }
  } catch (e) {
    if (e instanceof MagicError) throw e;
    throw new MagicError((e as Error).message);
  }

  const { cost, discount } = castCost(t.seats[seat], card.spell);
  t.seats[seat].aether -= cost;
  if (discount) flag(t.seats[seat], `discount:${discount}`);
  if (t.seats[seat].emberDiscount && SPELLS[card.spell].family === 'cinder_challenge') t.seats[seat].emberDiscount = 0;
  if (t.seats[seat].emberReserve && t.seats[seat].research === 'ember_reserve_on_spend' && cost > 0) {
    gain(t, seat, t.seats[seat].emberReserve!, 'ember_reserve');
    t.seats[seat].emberReserve = 0;
  }
  t.magic.rngState = rng.state;
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

/** Second Reflection: keep one of the two candidates; the other and the old card return to the stub. */
export function chooseCandidate(t0: MagicTable, seat: number, pick: 0 | 1): MagicTable {
  const pending = t0.magic.pendingChoice;
  if (!pending || pending.seat !== seat) throw new MagicError('No choice is pending for this seat');
  if (pick !== 0 && pick !== 1) throw new MagicError('Pick one of the two candidates');
  const t = structuredClone(t0);
  try {
    t.hand = exchangeHoleCardFor(t.hand, seat, pending.holeIndex, pending.candidates[pick]);
  } catch (e) {
    throw new MagicError((e as Error).message);
  }
  t.magic.pendingChoice = null;
  t.magic.commands.push({ kind: 'choose', seat, pick });
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

/** An ordinary poker action. Blocked while a street-opening window or a private choice is pending. */
export function act(t0: MagicTable, seat: number, action: PlayerAction): MagicTable {
  if (t0.magic.pendingChoice) throw new MagicError('A Second Reflection choice is pending');
  if (t0.magic.sigil != null) throw new MagicError('A Sigil decision is pending');
  if (t0.magic.window) throw new MagicError('The street-opening magic window must close first');
  const t = structuredClone(t0);
  const before = t0.hand.seats[seat];
  const street = t0.hand.street;
  const facing = getLegalActions(t0.hand)?.callAmount ?? 0;
  t.hand = applyAction(t.hand, seat, action);
  const applied = t.hand.log.at(-1)!.action;
  recordCinderResponse(t, seat, street, before.streetCommitted + before.stack, t0.hand.currentBet);
  // Briar Lock Resonance: a voluntary betting action under its pot-limit.
  if (applied.type === 'call' || applied.type === 'bet' || applied.type === 'raise') {
    for (const w of t.magic.watches) if (w.kind === 'briar' && w.street === street) resonate(t, w.uid);
    t.magic.watches = t.magic.watches.filter((w) => !(w.kind === 'briar' && w.street === street));
  }
  // Gambler's Knot: once per table, a legal fold facing a positive wager.
  const s = t.seats[seat];
  if (applied.type === 'fold' && facing > 0 && has(s.relics, 'gambler_knot') && !has(s.tableFlags, 'gambler_knot')) {
    flag(s, 'gambler_knot');
    gain(t, seat, 1, 'gambler_knot');
  }
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
    else if (level > 0) {
      const kind = level >= mark.raiseTo ? 'match' : 'short';
      mark.responses.push({ seat, kind });
      // Cinder Challenge Resonance: the enchanted raise is matched or exceeded.
      if (kind === 'match' && mark.spell === 'cinder_challenge') resonate(t, mark.uid);
    }
  }
}

// ──────────────────────────── settlement ────────────────────────────

function gain(t: MagicTable, seat: number, amount: number, reason: AetherGainReason): void {
  const before = t.seats[seat].aether;
  const after = Math.min(AETHER.max, before + amount);
  if (after > before) t.magic.gains.push({ seat, amount: after - before, reason });
  t.seats[seat].aether = after;
  if (t.seats[seat].research && before + amount > after) t.seats[seat].capWaste = (t.seats[seat].capWaste ?? 0) + before + amount - after;
}

/**
 * After pot settlement: showdown regeneration, then Cinder-family rewards, then
 * Ashen Signet, all capped at 3 (decision 05, v0.6 §05). Then Resonance is
 * applied, cast Ravenous Eyes exhaust, and every other drawn spell is discarded.
 */
function settleMagic(t: MagicTable): void {
  const result = t.hand.result!;
  // ember_reserve_on_spend: a reserve carried into this hand and not spent expires now.
  for (const s of t.seats) if (s.research === 'ember_reserve_on_spend') s.emberReserve = 0;
  for (const entry of result.showdown) gain(t, entry.seat, AETHER.showdownRegen, 'showdown');

  for (const mark of t.magic.cinder) {
    const matchers = mark.responses.filter((r) => r.kind === 'match').map((r) => r.seat);
    if (result.showdown.length > 0 && matchers.length > 0) {
      // Once per cast: the caster must be the sole winner of a contested pot a matcher is eligible for.
      const wonAgainstMatcher = result.pots.some(
        (pot) => pot.winners.length === 1 && pot.winners[0] === mark.seat && matchers.some((c) => pot.eligible.includes(c)),
      );
      if (wonAgainstMatcher) {
        const reward = mark.spell === 'red_oath' ? CINDER_REWARD.redOathCalledAndWon : CINDER_REWARD.calledAndWon;
        const s = t.seats[mark.seat];
        const overflow = s.aether + reward - AETHER.max;
        gain(t, mark.seat, reward, 'cinder_called');
        // Research variants (off in play): keep one capped-away Aether, or grant one later Cinder discount.
        if ((s.research === 'ember_overflow_reserve' || s.research === 'ember_reserve_on_spend') && overflow > 0) s.emberReserve = Math.min(1, (s.emberReserve ?? 0) + overflow);
        if (s.research === 'ember_next_hand_discount' && reward === CINDER_REWARD.calledAndWon) s.emberDiscount = 1;
        if (mark.spell === 'ember_echo') t.seats[mark.seat].extraDraw = 1;
      }
    } else if (
      result.showdown.length === 0 &&
      !t.hand.seats[mark.seat].folded &&
      mark.responses.length > 0 &&
      mark.responses.every((r) => r.kind === 'fold')
    ) {
      gain(t, mark.seat, CINDER_REWARD.allFolded, 'cinder_folded');
    }
  }

  // Ashen Signet: once per table, a sole contested showdown win after the owner's own preflop raise.
  t.seats.forEach((s, seat) => {
    if (!has(s.relics, 'ashen_signet') || has(s.tableFlags, 'ashen_signet') || result.showdown.length === 0) return;
    const raisedPreflop = t.hand.log.some((e) => e.seat === seat && e.street === 'preflop' && (e.action.type === 'raise' || e.action.type === 'bet'));
    const wonContested = result.pots.some((pot) => pot.eligible.length >= 2 && pot.winners.length === 1 && pot.winners[0] === seat);
    if (raisedPreflop && wonContested) {
      flag(s, 'ashen_signet');
      gain(t, seat, 1, 'ashen_signet');
    }
  });

  // Fate Exchange Resonance when the hand ended preflop by folds with the caster still in.
  for (const w of t.magic.watches) {
    if (w.kind === 'fate' && result.showdown.length === 0 && !t.hand.seats[w.seat].folded) resonate(t, w.uid);
  }
  t.magic.watches = [];

  t.magic.hands.forEach((cards, seat) => {
    const book = t.seats[seat].book;
    const kept: SpellCard[] = [];
    for (const card of cards) {
      if (t.magic.resonated.includes(card.uid) && isBaseSpell(card.spell)) card.resonance = (card.resonance ?? 0) + 1;
      if (SPELLS[card.spell].exhausts && t.magic.cast[seat] === card.uid) (book.exhausted ??= []).push(card);
      else kept.push(card);
    }
    t.seats[seat].book = discardSpells(book, kept);
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
    if ((s.emberReserve ?? 0) > 1 || (s.emberDiscount ?? 0) > 1 || ((s.emberReserve || s.emberDiscount) && !s.research)) {
      throw new Error(`Magic invariant: research Aether state outside its variant for seat ${seat}`);
    }
    const all = [...allCards(s.book), ...t.magic.hands[seat]];
    const uids = new Set(all.map((c) => c.uid));
    if (uids.size !== all.length) throw new Error(`Magic invariant: duplicated spell instance for seat ${seat}`);
    if (all.length < SPELLBOOK_MIN || all.length > SPELLBOOK_MAX) {
      throw new Error(`Magic invariant: Spellbook of seat ${seat} has ${all.length} spells`);
    }
    if (all.some((c) => !c.uid.startsWith(`${s.book.owner}:`))) throw new Error('Magic invariant: foreign spell instance');
    if (new Set(s.relics ?? []).size !== (s.relics ?? []).length) throw new Error('Magic invariant: duplicate relic');
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
  notices: { seat: number; text: string }[];
  gains: AetherGain[];
  /** Opponent cards this viewer legitimately learned through its own spells this hand. */
  known: { seat: number; card: Card }[];
  /** Cards shown to the whole table (Open Book, Red Oath), always their current identity. */
  publicKnown: { seat: number; card: Card; source: PublicReveal['source'] }[];
  windowSeat: number | null;
  /** Second Reflection candidates, only for the seat choosing. */
  choice: { candidates: [Card, Card]; holeIndex: 0 | 1 } | null;
  /** True when this viewer must decide on its Fateweaver's Sigil. */
  sigil: boolean;
  streetLocked: boolean;
  options: CastOption[];
}

/** What one seat may know about the magic layer. Never includes others' spells or private reveals. */
export function getMagicView(t: MagicTable, viewer: number): MagicView {
  const handSizes = t.magic.settled ? t.magic.hands.map(() => 0) : t.magic.hands.map((h) => h.length);
  const pending = t.magic.pendingChoice;
  return structuredClone({
    viewer,
    aether: t.seats.map((s) => s.aether),
    handSizes,
    myHand: t.magic.hands[viewer] ?? [],
    castThisHand: t.magic.cast.map((c) => c !== null),
    events: t.magic.events,
    notices: t.magic.notices,
    gains: t.magic.gains,
    known: t.magic.reveals.filter((r) => r.caster === viewer).map((r) => ({ seat: r.target, card: r.card })),
    publicKnown: t.magic.publicReveals.map((r) => ({ seat: r.seat, card: t.hand.seats[r.seat].hole[r.holeIndex], source: r.source })),
    windowSeat: windowSeat(t),
    choice: pending && pending.seat === viewer ? { candidates: pending.candidates, holeIndex: pending.holeIndex } : null,
    sigil: t.magic.sigil === viewer,
    streetLocked: t.hand.streetLimit === 'pot-limit',
    options: castOptions(t, viewer),
  });
}

/** Spell family helper for UIs and AIs. */
export function familyOf(spell: SpellId): BaseSpellId {
  return SPELLS[spell].family;
}
