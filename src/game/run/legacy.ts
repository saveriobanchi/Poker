/**
 * The world testament (design v0.9, "New Run / Legacy"): a record of finished
 * characters kept apart from any run. It is read only for story variation —
 * never by `createRun`, so it cannot carry inventory, Lifechips or odds into a
 * new character.
 */
import { CHAPTER_ENDS, ENDINGS, PLAYER_ID, type RunState } from './run';

export const LEGACY_KEY = 'lastWager.legacy.v1';

export interface LegacyEntry {
  /** Run seed: one entry per character. */
  seed: number;
  ending: string;
  /** Epilogue fate or Ledger allegiance chosen, if any. */
  fate: string | null;
  chapters: string[];
  /** Exact Lifechips the archived character holds (not transferable). */
  lifechips: number;
  tablesPlayed: number;
  debtsOutstanding: number;
}

export interface Legacy {
  version: 1;
  entries: LegacyEntry[];
}

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function loadLegacy(store: Store): Legacy {
  try {
    const l = JSON.parse(store.getItem(LEGACY_KEY) ?? 'null') as Legacy | null;
    if (l && l.version === 1 && Array.isArray(l.entries)) return l;
  } catch {
    /* start a fresh testament */
  }
  return { version: 1, entries: [] };
}

export function saveLegacy(store: Store, legacy: Legacy): void {
  store.setItem(LEGACY_KEY, JSON.stringify(legacy));
}

/** Archives a finished run once (idempotent by seed); later fate choices update its entry. */
export function recordEnding(legacy: Legacy, run: RunState): Legacy {
  if (!ENDINGS.includes(run.node)) return legacy;
  const fate = run.flags.find((f) => f.startsWith('fate:'))?.slice(5) ?? null;
  const entry: LegacyEntry = {
    seed: run.seed,
    ending: run.node,
    fate,
    chapters: run.chapters.filter((c) => CHAPTER_ENDS.includes(c)),
    lifechips: run.node === 'death' ? 0 : run.accounts[PLAYER_ID],
    tablesPlayed: run.results.length,
    debtsOutstanding: run.contracts.filter((k) => k.debtor === PLAYER_ID && k.status !== 'cleared' && k.pact !== 'mercy').length,
  };
  return { version: 1, entries: [...legacy.entries.filter((e) => e.seed !== run.seed), entry] };
}

const ENDING_MEMORY: Record<string, string> = {
  the_ledger_unbound: 'who unbound the Ledger',
  the_unchosen_road: 'who walked away from the Crown alive',
  under_living_end: 'who still keeps the low lanterns',
  death: 'whose account the Ledger closed',
};

/** One line of story variation for a new character's arrival, from the most recent archived Wagerer. */
export function legacyIntro(legacy: Legacy): string | null {
  const last = legacy.entries.at(-1);
  if (!last) return null;
  const allegiance = last.fate === 'reform' ? ' The Lantern district still argues over the reforms they demanded.' : last.fate === 'claim' ? ' The Lantern district still whispers of the one who claimed the Ledger.' : '';
  return `Older players remember a Wagerer ${ENDING_MEMORY[last.ending] ?? 'who came before you'}.${allegiance} You are someone new, and you start with nothing of theirs.`;
}
