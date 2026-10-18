/**
 * A table session: a sequence of hands at one table with fixed seats, each
 * seat's persistent magic (Spellbook + Aether), and the persistence needed for
 * immediate save/resume. Plain JSON throughout.
 */
import { decideOpening, decideTurn } from '../ai/magic';
import { PROFILES } from '../ai/profiles';
import {
  apply,
  assertMagicInvariants,
  beginHand,
  BEGINNER_SPELLBOOK,
  createSeatMagic,
  createSpellbook,
  getMagicView,
  MagicCommand,
  MagicTable,
  RIVAL_SPELLBOOKS,
  windowSeat,
} from '../magic';
import { SPELLS } from '../magic/spells';
import { getPublicView, HandState, nextHandSetup, startHand } from '../rules/engine';
import { Rng } from '../rules/rng';

export interface SeatConfig {
  id: string;
  name: string;
  kind: 'human' | 'ai';
  /** Key into PROFILES for AI seats. */
  profileId?: string;
}

export interface HandSummary {
  handNumber: number;
  netChange: number[];
  /** One line per pot, e.g. "Lady Vesper wins the pot (24) with Two Pair". */
  lines: string[];
  /** One line per spell cast, e.g. "Sir Corvin cast Briar Lock". */
  magic: string[];
}

export interface TableSession {
  version: 2;
  seed: number;
  handNumber: number;
  seats: SeatConfig[];
  table: MagicTable;
  history: HandSummary[];
}

export type SessionStatus =
  | 'humanWindow'
  | 'humanToAct'
  | 'aiToAct'
  | 'handComplete'
  | 'humanBusted'
  | 'tableWon';

const HISTORY_LIMIT = 20;
const MAGIC_SALT = 0x6d61;

/** Deterministic per-hand / per-decision seeds derived from the session seed. */
export function deriveSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  }
  return h >>> 0;
}

export interface NewSessionOptions {
  seed: number;
  seats: SeatConfig[];
  stacks: number[];
  smallBlind: number;
  bigBlind: number;
}

export function createSession(opts: NewSessionOptions): TableSession {
  if (opts.seats.filter((s) => s.kind === 'human').length !== 1) throw new Error('Exactly one human seat');
  const hand = startHand({
    seed: deriveSeed(opts.seed, 1),
    players: opts.seats.map((s, i) => ({ id: s.id, stack: opts.stacks[i] })),
    button: deriveSeed(opts.seed, 0) % opts.seats.length,
    smallBlind: opts.smallBlind,
    bigBlind: opts.bigBlind,
  });
  const magic = opts.seats.map((s, i) => {
    const counts = s.kind === 'human' ? BEGINNER_SPELLBOOK : RIVAL_SPELLBOOKS[s.profileId!];
    return createSeatMagic(createSpellbook(s.id, counts, deriveSeed(opts.seed, MAGIC_SALT, i)));
  });
  const table = beginHand(hand, magic, deriveSeed(opts.seed, MAGIC_SALT, 1));
  return { version: 2, seed: opts.seed, handNumber: 1, seats: opts.seats, table, history: [] };
}

/** The default Act I table: the Wagerer against three named rivals at 1/2. */
export function createDefaultSession(seed: number): TableSession {
  return createSession({
    seed,
    smallBlind: 1,
    bigBlind: 2,
    seats: [
      { id: 'you', name: 'You', kind: 'human' },
      { id: 'vesper', name: PROFILES.vesper.name, kind: 'ai', profileId: 'vesper' },
      { id: 'oracle', name: PROFILES.oracle.name, kind: 'ai', profileId: 'oracle' },
      { id: 'corvin', name: PROFILES.corvin.name, kind: 'ai', profileId: 'corvin' },
    ],
    // Rival stacks come from the table's own budget, not mirrored from the player.
    stacks: [100, 120, 100, 90],
  });
}

export function humanSeat(session: TableSession): number {
  return session.seats.findIndex((s) => s.kind === 'human');
}

/** The seat whose decision the table is waiting for (magic window first, then poker). */
export function currentActor(session: TableSession): number | null {
  const t = session.table;
  if (t.hand.phase !== 'betting') return null;
  return windowSeat(t) ?? t.hand.toAct;
}

export function sessionStatus(session: TableSession): SessionStatus {
  const { hand } = session.table;
  const me = humanSeat(session);
  if (hand.phase === 'betting') {
    const actor = currentActor(session);
    if (actor !== me) return 'aiToAct';
    return windowSeat(session.table) === me ? 'humanWindow' : 'humanToAct';
  }
  if (hand.seats[me].stack === 0) return 'humanBusted';
  if (hand.seats.filter((p) => p.stack > 0).length < 2) return 'tableWon';
  return 'handComplete';
}

const CATEGORY = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'a Straight',
  'a Flush',
  'a Full House',
  'Four of a Kind',
  'a Straight Flush',
];

function summarize(session: TableSession, t: MagicTable): HandSummary {
  const hand: HandState = t.hand;
  const r = hand.result!;
  const name = (seat: number) => session.seats[seat].name;
  const lines = r.pots.map((pot, i) => {
    const label = r.pots.length > 1 ? (i === 0 ? 'main pot' : `side pot ${i}`) : 'the pot';
    const who = pot.winners.map(name).join(' & ');
    const human = pot.winners.length === 1 && session.seats[pot.winners[0]].kind === 'human';
    const verb = pot.winners.length > 1 ? 'split' : human ? 'win' : 'wins';
    const shown = r.showdown.find((e) => e.seat === pot.winners[0]);
    const how = shown ? ` with ${CATEGORY[shown.hand.category]}` : '';
    return `${who} ${verb} ${label} (${pot.amount})${how}`;
  });
  const magic = t.magic.events.map((e) => {
    const target = e.target !== undefined ? ` on ${name(e.target)}` : '';
    return `${name(e.seat)} cast ${SPELLS[e.spell].name}${target}`;
  });
  return { handNumber: session.handNumber, netChange: r.netChange, lines, magic };
}

function withTable(session: TableSession, table: MagicTable): TableSession {
  const next: TableSession = { ...session, table };
  if (table.hand.phase === 'complete' && session.table.hand.phase !== 'complete') {
    next.history = [...session.history, summarize(session, table)].slice(-HISTORY_LIMIT);
  }
  return next;
}

/** A command without its seat (the session fills in the human's seat). */
export type HumanCommand = MagicCommand extends infer C ? (C extends MagicCommand ? Omit<C, 'seat'> : never) : never;

/** Applies the human's command (poker action, spell, or passing a window). */
export function applyHumanCommand(session: TableSession, command: HumanCommand): TableSession {
  const me = humanSeat(session);
  if (currentActor(session) !== me) throw new Error('Not your turn');
  return withTable(session, apply(session.table, { ...command, seat: me } as MagicCommand));
}

/** The AI to decide uses only its own public and magic views, with a deterministic per-decision seed. */
export function chooseAiCommand(session: TableSession): MagicCommand {
  const seat = currentActor(session);
  if (seat === null || session.seats[seat].kind !== 'ai') throw new Error('No AI to act');
  const profile = PROFILES[session.seats[seat].profileId!];
  const t = session.table;
  const rng = new Rng(deriveSeed(session.seed, session.handNumber, t.magic.commands.length, seat));
  const view = getPublicView(t.hand, seat);
  const magic = getMagicView(t, seat);
  if (windowSeat(t) === seat) {
    const choice = decideOpening(view, magic, profile, rng);
    return choice.kind === 'pass' ? { kind: 'pass', seat } : { kind: 'cast', seat, uid: choice.uid, params: choice.params };
  }
  const choice = decideTurn(view, magic, profile, rng);
  return choice.kind === 'act'
    ? { kind: 'act', seat, action: choice.action }
    : { kind: 'cast', seat, uid: choice.uid, params: choice.params };
}

export function stepAi(session: TableSession): TableSession {
  return withTable(session, apply(session.table, chooseAiCommand(session)));
}

export function startNextHand(session: TableSession): TableSession {
  if (sessionStatus(session) !== 'handComplete') throw new Error('Cannot start the next hand now');
  const handNumber = session.handNumber + 1;
  const hand = startHand(nextHandSetup(session.table.hand, deriveSeed(session.seed, handNumber)));
  const table = beginHand(hand, session.table.seats, deriveSeed(session.seed, MAGIC_SALT, handNumber));
  return { ...session, handNumber, table };
}

// ───────────────────────────── persistence ─────────────────────────────

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'lastWager.table.v2';

export function saveSession(store: KeyValueStore, session: TableSession): void {
  store.setItem(SAVE_KEY, JSON.stringify(session));
}

/** Restores a saved session; returns null when missing or invalid (all poker and magic invariants are re-checked). */
export function loadSession(store: KeyValueStore): TableSession | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TableSession;
    if (parsed.version !== 2) return null;
    if (parsed.table.hand.version !== 1 || parsed.table.hand.seats.length !== parsed.seats.length) return null;
    assertMagicInvariants(parsed.table);
    return parsed;
  } catch {
    return null;
  }
}
