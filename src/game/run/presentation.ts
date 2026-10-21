/**
 * Presentation layer for World Testament unlocks (design v1.0 §04–§05, §09):
 * character backgrounds, one prose variant per run, and card-back cosmetics.
 * It is stored apart from the run and never passed to `createRun`, so a
 * background cannot change Lifechips, the Spellbook, any RNG, a deal, an
 * opponent, an offer or a reward. It changes words and looks only.
 */
import data from './data/p8-legacy-unlocks.json';
import type { Legacy } from './legacy';

export const PRESENTATION_KEY = 'lastWager.presentation.v1';

export type BackgroundId = 'unmarked' | 'exiled_heir' | 'cinder_bound' | 'ledger_witness';
export type BackId = 'standard' | 'cinder_etch' | 'crown_filigree';
export type VariantId = 'arrival_echo' | 'cinder_gossip';

export interface Presentation {
  /** The run this presentation belongs to. */
  runSeed: number;
  background: BackgroundId;
  back: BackId;
  /** At most one prose variant per run. */
  variant: VariantId | null;
}

export const BACKGROUNDS = data.backgrounds as { id: BackgroundId; title: string; unlock: string; intro: string; mechanical_modifiers: Record<string, never> }[];
export const BACKS = data.cosmetic_backs as { id: BackId; title: string; unlock: string; status: string }[];

/** Which backgrounds the testament has unlocked (the Unmarked always). */
export function unlockedBackgrounds(legacy: Legacy): BackgroundId[] {
  const e = legacy.entries;
  const out: BackgroundId[] = ['unmarked'];
  if (e.some((x) => x.ending === 'the_unchosen_road' && x.fate === 'retire')) out.push('exiled_heir');
  if (e.some((x) => x.ending === 'under_living_end' && (x.fate === 'honor_contract' || x.fate === 'seek_liberation_in_future_content'))) out.push('cinder_bound');
  if (e.some((x) => x.ending === 'the_ledger_unbound' && (x.fate === 'reform' || x.fate === 'claim'))) out.push('ledger_witness');
  return out;
}

/** Card backs: unlocked by the testament, but usable only once their art exists and passes the symmetry check. */
export function backStates(legacy: Legacy): { id: BackId; title: string; unlocked: boolean; artReady: boolean }[] {
  const e = legacy.entries;
  const unlocked: Record<BackId, boolean> = {
    standard: true,
    cinder_etch: e.some((x) => x.ending === 'under_living_end'),
    crown_filigree: e.some((x) => x.ending === 'the_ledger_unbound'),
  };
  return BACKS.map((b) => ({ id: b.id, title: b.title, unlocked: unlocked[b.id], artReady: b.status === 'integrated' }));
}

/** Prose variants the testament makes available. */
export function unlockedVariants(legacy: Legacy): VariantId[] {
  const out: VariantId[] = [];
  if (legacy.entries.length) out.push('arrival_echo');
  if (legacy.entries.some((x) => x.fell || x.ending === 'under_living_end')) out.push('cinder_gossip');
  return out;
}

/**
 * The presentation for a new run. The variant is picked from the run seed's
 * parity — a read of the seed, never a draw from any game RNG.
 */
export function choosePresentation(runSeed: number, legacy: Legacy, background: BackgroundId = 'unmarked', back: BackId = 'standard'): Presentation {
  const bg = unlockedBackgrounds(legacy).includes(background) ? background : 'unmarked';
  const usableBack = backStates(legacy).find((b) => b.id === back && b.unlocked && b.artReady) ? back : 'standard';
  const variants = unlockedVariants(legacy);
  const variant = variants.length ? variants[runSeed % variants.length] : null;
  return { runSeed, background: bg, back: usableBack, variant };
}

/** The arrival line for this background. */
export function backgroundIntro(p: Presentation | null): { title: string; intro: string } {
  const b = BACKGROUNDS.find((x) => x.id === (p?.background ?? 'unmarked')) ?? BACKGROUNDS[0];
  return { title: b.title, intro: b.intro };
}

/** Cinder gossip: one prose beat at the Registry or the Underledger referencing the predecessor (no mechanics). */
export function cinderGossip(p: Presentation | null, legacy: Legacy): string | null {
  if (p?.variant !== 'cinder_gossip') return null;
  const last = [...legacy.entries].reverse().find((x) => x.fell || x.ending === 'under_living_end');
  if (!last) return null;
  const choice = last.fate === 'honor_contract' ? 'kept their contract to the letter' : last.fate === 'seek_liberation_in_future_content' ? 'swore to buy their freedom' : 'came down these stairs once, Fallen';
  return `A clerk lowers their voice: “Your predecessor ${choice}. The Ledger remembers; it does not hold it against you.”`;
}

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function loadPresentation(store: Store, runSeed: number): Presentation | null {
  try {
    const p = JSON.parse(store.getItem(PRESENTATION_KEY) ?? 'null') as Presentation | null;
    return p && p.runSeed === runSeed ? p : null;
  } catch {
    return null;
  }
}

export function savePresentation(store: Store, p: Presentation): void {
  store.setItem(PRESENTATION_KEY, JSON.stringify(p));
}
