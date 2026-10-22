/**
 * Usage: npm run playtest-summary -- <folder of exported logs> [notes.json]
 * Validates the JSON files exported from the ?playtest=1 panel (one per session)
 * and pools them into one summary with explicit denominators (design v1.1 §02):
 * sessions, narrow-screen sessions, early exits before each check-in, and every
 * metric with the number of sessions it is based on. It refuses files that look
 * like they contain cards or personal identifiers. It never invents data: with no
 * files it reports that human testing has not been performed.
 * Writes docs/reports/playtest-summary.json.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PlaytestLog, summarizePlaytest } from '../src/ui/playtest';

const dir = process.argv[2];
const notesPath = process.argv[3];
const files = dir ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
const problems: string[] = [];
const sessions: { file: string; narrow: boolean; minutes: number; summary: ReturnType<typeof summarizePlaytest> }[] = [];
const FORBIDDEN = /"(hole|board|cards?|deck|email|phone|name|address)"\s*:/i;
for (const f of files) {
  const raw = readFileSync(join(dir!, f), 'utf8');
  if (FORBIDDEN.test(raw)) {
    problems.push(`${f}: contains a card or personal-identifier field; excluded`);
    continue;
  }
  let log: PlaytestLog;
  try {
    log = JSON.parse(raw) as PlaytestLog;
  } catch {
    problems.push(`${f}: not valid JSON; excluded`);
    continue;
  }
  if (log.version !== 1 || !Array.isArray(log.sessions) || !log.sessions.length) {
    problems.push(`${f}: not a playtest export (version 1 with sessions); excluded`);
    continue;
  }
  const width = Math.min(...log.sessions.map((s) => Number(s.viewport.split('x')[0]) || 9999));
  const minutes = Math.max(...log.sessions.map((s) => (s.events.at(-1)?.t ?? 0) / 60_000));
  sessions.push({ file: f, narrow: width <= 360, minutes: +minutes.toFixed(1), summary: summarizePlaytest(log) });
}
const n = sessions.length;
const nums = (f: (s: (typeof sessions)[number]) => number | null | undefined) => sessions.map(f).filter((x): x is number => typeof x === 'number');
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const per = (f: (s: (typeof sessions)[number]) => number) => ({ total: sessions.reduce((a, s) => a + f(s), 0), sessions: n });
const feedback = sessions.flatMap((s) => s.summary.feedback.map((x) => ({ file: s.file, ...(x ?? {}) })));
const out = {
  humanTesting: n === 0 ? 'NOT_PERFORMED: no exported session logs were supplied' : `${n} exported session logs`,
  sessions: n,
  target: '5–8 sessions, at least 2 on a narrow screen (design v1.1 §02)',
  narrowScreenSessions: sessions.filter((s) => s.narrow).length,
  reachedCheckIn15: sessions.filter((s) => s.minutes >= 15).length,
  reachedCheckIn45: sessions.filter((s) => s.minutes >= 45).length,
  earlyExitsBefore15: sessions.filter((s) => s.minutes < 15).length,
  medianFirstLegalActionMs: median(nums((s) => s.summary.firstLegalActionMs.find((x) => typeof x === 'number') as number | undefined)),
  medianDecisionMs: median(nums((s) => s.summary.medianDecisionMs)),
  allInConfirms: { shown: per((s) => s.summary.allInConfirmsShown), cancelled: per((s) => s.summary.allInConfirmsCancelled) },
  disabledTaps: per((s) => s.summary.disabledTaps),
  spellInfoOpens: per((s) => s.summary.spellInfoOpens),
  claimReviewBacks: per((s) => s.summary.claimReviewBacks),
  errors: per((s) => s.summary.errors),
  reloads: per((s) => s.summary.reloads),
  interruptions: per((s) => s.summary.interruptions),
  feedback,
  directorNotes: notesPath ? JSON.parse(readFileSync(notesPath, 'utf8')) : 'none supplied',
  excluded: problems,
};
mkdirSync('docs/reports', { recursive: true });
writeFileSync('docs/reports/playtest-summary.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
