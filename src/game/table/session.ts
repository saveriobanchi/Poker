/**
 * A table session: a sequence of hands at one table with fixed seats, plus the
 * persistence needed for immediate save/resume. Plain JSON, like HandState.
 */
import { decide } from '../ai/agent';
import { PROFILES } from '../ai/profiles';
import {
  applyAction,
  deserializeHand,
  getPublicView,
  HandState,
  nextHandSetup,
  PlayerAction,
  startHand,
} from '../rules/engine';
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
  /** One line per pot, e.g. "Lady Vesper wins 24 with Two Pair". */
  lines: string[];
}

export interface TableSession {
  version: 1;
  seed: number;
  handNumber: number;
  seats: SeatConfig[];
  hand: HandState;
  history: HandSummary[];
}

export type SessionStatus = 'humanToAct' | 'aiToAct' | 'handComplete' | 'humanBusted' | 'tableWon';

const HISTORY_LIMIT = 20;

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
  return { version: 1, seed: opts.seed, handNumber: 1, seats: opts.seats, hand, history: [] };
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

export function sessionStatus(session: TableSession): SessionStatus {
  const { hand } = session;
  const me = humanSeat(session);
  if (hand.phase === 'betting') return hand.toAct === me ? 'humanToAct' : 'aiToAct';
  if (hand.seats[me].stack === 0) return 'humanBusted';
  if (hand.seats.filter((p) => p.stack > 0).length < 2) return 'tableWon';
  return 'handComplete';
}

function summarize(session: TableSession, hand: HandState): HandSummary {
  const r = hand.result!;
  const name = (seat: number) => session.seats[seat].name;
  const lines = r.pots.map((pot, i) => {
    const label = r.pots.length > 1 ? (i === 0 ? 'main pot' : `side pot ${i}`) : 'the pot';
    const who = pot.winners.map(name).join(' & ');
    const plural = pot.winners.length > 1 || session.seats[pot.winners[0]].kind === 'human';
    const verb = pot.winners.length > 1 ? 'split' : plural ? 'win' : 'wins';
    const shown = r.showdown.find((e) => e.seat === pot.winners[0]);
    const how = shown ? ` with ${categoryName(shown.hand.category)}` : '';
    return `${who} ${verb} ${label} (${pot.amount})${how}`;
  });
  return { handNumber: session.handNumber, netChange: r.netChange, lines };
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
function categoryName(category: number): string {
  return CATEGORY[category] ?? 'a hand';
}

function afterAction(session: TableSession, hand: HandState): TableSession {
  const next: TableSession = { ...session, hand };
  if (hand.phase === 'complete') {
    next.history = [...session.history, summarize(session, hand)].slice(-HISTORY_LIMIT);
  }
  return next;
}

export function applyHumanAction(session: TableSession, action: PlayerAction): TableSession {
  if (sessionStatus(session) !== 'humanToAct') throw new Error('Not your turn');
  return afterAction(session, applyAction(session.hand, humanSeat(session), action));
}

/** The AI to act decides from its own public view only, with a deterministic per-decision seed. */
export function chooseAiAction(session: TableSession): PlayerAction {
  const seat = session.hand.toAct;
  if (seat === null || session.seats[seat].kind !== 'ai') throw new Error('No AI to act');
  const profile = PROFILES[session.seats[seat].profileId!];
  const rng = new Rng(deriveSeed(session.seed, session.handNumber, session.hand.log.length, seat));
  return decide(getPublicView(session.hand, seat), profile, rng);
}

export function stepAi(session: TableSession): TableSession {
  const seat = session.hand.toAct!;
  return afterAction(session, applyAction(session.hand, seat, chooseAiAction(session)));
}

export function startNextHand(session: TableSession): TableSession {
  if (sessionStatus(session) !== 'handComplete') throw new Error('Cannot start the next hand now');
  const handNumber = session.handNumber + 1;
  const hand = startHand(nextHandSetup(session.hand, deriveSeed(session.seed, handNumber)));
  return { ...session, handNumber, hand };
}

// ───────────────────────────── persistence ─────────────────────────────

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'lastWager.table.v1';

export function saveSession(store: KeyValueStore, session: TableSession): void {
  store.setItem(SAVE_KEY, JSON.stringify(session));
}

/** Restores a saved session; returns null when missing or invalid (the hand's invariants are re-checked). */
export function loadSession(store: KeyValueStore): TableSession | null {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TableSession;
    if (parsed.version !== 1) return null;
    parsed.hand = deserializeHand(JSON.stringify(parsed.hand));
    if (parsed.hand.seats.length !== parsed.seats.length) return null;
    return parsed;
  } catch {
    return null;
  }
}
