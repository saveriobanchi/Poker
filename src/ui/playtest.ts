/**
 * Opt-in instrumentation for director-led usability sessions (design v1.0 §11).
 * Off unless the page is opened with `?playtest=1` (remembered on this device until
 * `?playtest=0`). Everything stays in local storage on the tester's device and is
 * exported by hand as JSON; nothing is ever sent anywhere. The log records
 * interface events only — never a card, a spell draw or any hidden table state —
 * and is never read by the game.
 */
import type { KeyValueStore } from '../game/table/session';

export const PLAYTEST_FLAG_KEY = 'lastWager.playtest.v1';
export const PLAYTEST_LOG_KEY = 'lastWager.playtest.log.v1';
/** Feedback prompts at 15 and 45 minutes of the session (design v1.0 §11). */
export const FEEDBACK_MINUTES = [15, 45] as const;
const MAX_EVENTS = 5000;

export type PlaytestEventKind =
  | 'session_start'
  | 'first_legal_action'
  | 'decision'
  | 'allin_confirm_shown'
  | 'allin_confirm_cancelled'
  | 'disabled_tap'
  | 'spell_info_open'
  | 'claim_review_back'
  | 'cancel_choice'
  | 'error'
  | 'hidden'
  | 'visible'
  | 'feedback'
  | 'screen';

export interface PlaytestEvent {
  /** Milliseconds since the session started. */
  t: number;
  kind: PlaytestEventKind;
  data?: Record<string, string | number | boolean | null>;
}

export interface PlaytestLog {
  version: 1;
  /** Local session counter: a page load that resumes a session adds a `reload` start. */
  sessions: { started: string; viewport: string; reload: boolean; events: PlaytestEvent[] }[];
}

/** Decides from the URL and the stored flag whether instrumentation is on; updates the flag. */
export function playtestEnabled(search: string, store: KeyValueStore): boolean {
  const p = new URLSearchParams(search).get('playtest');
  if (p === '1') store.setItem(PLAYTEST_FLAG_KEY, '1');
  if (p === '0') store.removeItem(PLAYTEST_FLAG_KEY);
  return store.getItem(PLAYTEST_FLAG_KEY) === '1';
}

export function loadPlaytestLog(store: KeyValueStore): PlaytestLog {
  try {
    const raw = JSON.parse(store.getItem(PLAYTEST_LOG_KEY) ?? 'null') as PlaytestLog | null;
    if (raw && raw.version === 1 && Array.isArray(raw.sessions)) return raw;
  } catch {
    /* start a fresh log */
  }
  return { version: 1, sessions: [] };
}

/** Summary figures a director reads first (all derived from the raw events). */
export function summarizePlaytest(log: PlaytestLog) {
  const all = log.sessions.flatMap((s) => s.events);
  const count = (k: PlaytestEventKind) => all.filter((e) => e.kind === k).length;
  const decisions = all.filter((e) => e.kind === 'decision').map((e) => Number(e.data?.ms ?? 0)).sort((a, b) => a - b);
  return {
    pageLoads: log.sessions.length,
    reloads: log.sessions.filter((s) => s.reload).length,
    firstLegalActionMs: log.sessions.map((s) => s.events.find((e) => e.kind === 'first_legal_action')?.data?.ms ?? null),
    decisions: decisions.length,
    medianDecisionMs: decisions.length ? decisions[Math.floor(decisions.length / 2)] : null,
    allInConfirmsShown: count('allin_confirm_shown'),
    allInConfirmsCancelled: count('allin_confirm_cancelled'),
    disabledTaps: count('disabled_tap'),
    spellInfoOpens: count('spell_info_open'),
    claimReviewBacks: count('claim_review_back'),
    cancelledChoices: count('cancel_choice'),
    errors: count('error'),
    interruptions: count('hidden'),
    feedback: all.filter((e) => e.kind === 'feedback').map((e) => e.data),
  };
}

export class Playtest {
  private readonly start: number;
  private readonly session: PlaytestLog['sessions'][number];
  private turnShownAt: number | null = null;
  private firstActionLogged = false;
  private readonly prompted = new Set<number>();

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => number,
    viewport: string,
    reload: boolean,
    startedIso: string,
  ) {
    this.start = now();
    this.log = loadPlaytestLog(store);
    this.session = { started: startedIso, viewport, reload, events: [] };
    this.log.sessions.push(this.session);
    this.record('session_start', { viewport, reload });
  }

  private readonly log: PlaytestLog;

  /** Minutes elapsed in this page session. */
  minutes(): number {
    return (this.now() - this.start) / 60_000;
  }

  record(kind: PlaytestEventKind, data?: PlaytestEvent['data']): void {
    if (this.session.events.length >= MAX_EVENTS) return;
    this.session.events.push({ t: Math.round(this.now() - this.start), kind, ...(data ? { data } : {}) });
    this.store.setItem(PLAYTEST_LOG_KEY, JSON.stringify(this.log));
  }

  /** The player's legal action became available. */
  turnShown(): void {
    if (this.turnShownAt === null) this.turnShownAt = this.now();
  }

  /** The player acted (fold/check/call/raise/cast/pass). */
  acted(what: string): void {
    if (this.turnShownAt === null) return;
    const ms = Math.round(this.now() - this.turnShownAt);
    if (!this.firstActionLogged) {
      this.firstActionLogged = true;
      this.record('first_legal_action', { ms, what });
    }
    this.record('decision', { ms, what });
    this.turnShownAt = null;
  }

  /** The next feedback checkpoint now due (15 or 45 minutes), once each. */
  dueFeedback(): number | null {
    for (const m of FEEDBACK_MINUTES) if (this.minutes() >= m && !this.prompted.has(m)) return (this.prompted.add(m), m);
    return null;
  }

  export(): string {
    return JSON.stringify({ ...this.log, summary: summarizePlaytest(this.log) }, null, 2);
  }

  clear(): void {
    this.log.sessions.splice(0, this.log.sessions.length - 1);
    this.session.events.splice(0);
    this.store.setItem(PLAYTEST_LOG_KEY, JSON.stringify(this.log));
  }
}

/** The active instrumentation, or null (the default). UI code calls `pt()?.record(...)`. */
let active: Playtest | null = null;
export function pt(): Playtest | null {
  return active;
}
export function setPlaytest(p: Playtest | null): void {
  active = p;
}
