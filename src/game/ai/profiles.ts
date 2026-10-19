/** Personality knobs for a local AI agent. All values are 0..1. */
export interface AiProfile {
  id: string;
  name: string;
  title: string;
  /** Share of starting hands played: higher plays more hands. */
  looseness: number;
  /** Preference for betting/raising over checking/calling. */
  aggression: number;
  /** Frequency of betting without the goods. */
  bluff: number;
  /** Willingness to call down with marginal equity. */
  stickiness: number;
  /** Spell temperament: base probability of using each spell when its conditions are met. */
  magic: { cinder: number; unmask: number; briar: number; fate: number };
}

export const PROFILES: Record<string, AiProfile> = {
  vesper: {
    id: 'vesper',
    name: 'Lady Vesper',
    title: 'Aggressive noble',
    looseness: 0.65,
    aggression: 0.85,
    bluff: 0.3,
    stickiness: 0.3,
    magic: { cinder: 0.85, unmask: 0.35, briar: 0.3, fate: 0.45 },
  },
  oracle: {
    id: 'oracle',
    name: 'The Sightless Oracle',
    title: 'Patient collector of secrets',
    looseness: 0.5,
    aggression: 0.3,
    bluff: 0.08,
    stickiness: 0.8,
    magic: { cinder: 0.4, unmask: 0.8, briar: 0.25, fate: 0.7 },
  },
  corvin: {
    id: 'corvin',
    name: 'Sir Corvin',
    title: 'Disciplined survivor',
    looseness: 0.2,
    aggression: 0.5,
    bluff: 0.05,
    stickiness: 0.15,
    magic: { cinder: 0.4, unmask: 0.5, briar: 0.75, fate: 0.35 },
  },
  // P4 (design v0.6 §07). Knobs are tuned so measured VPIP/PFR land near the
  // design targets; see tests/ai-calibration.test.ts.
  mara_quill: {
    id: 'mara_quill',
    name: 'Mara Quill',
    title: 'Market bookmaker',
    looseness: 1,
    aggression: 0.1,
    bluff: 0.06,
    stickiness: 0.75,
    magic: { cinder: 0.3, unmask: 0.6, briar: 0.25, fate: 0.6 },
  },
  eldric_vale: {
    id: 'eldric_vale',
    name: 'Eldric Vale',
    title: 'Duelling gambler',
    looseness: 0.5,
    aggression: 0.7,
    bluff: 0.35,
    stickiness: 0.35,
    magic: { cinder: 0.75, unmask: 0.5, briar: 0.2, fate: 0.3 },
  },
  bailiff_sable: {
    id: 'bailiff_sable',
    name: 'Bailiff Sable',
    title: 'Enforcer of the Ledger',
    looseness: 0.3,
    aggression: 0.9,
    bluff: 0.15,
    stickiness: 0.3,
    magic: { cinder: 0.5, unmask: 0.7, briar: 0.7, fate: 0.3 },
  },
  sister_rill: {
    id: 'sister_rill',
    name: 'Sister Rill',
    title: 'Patient card veteran',
    looseness: 0.6,
    aggression: 0.25,
    bluff: 0.03,
    stickiness: 0.7,
    magic: { cinder: 0.3, unmask: 0.5, briar: 0.6, fate: 0.45 },
  },
  night_clerk: {
    id: 'night_clerk',
    name: 'The Night Clerk',
    title: 'Keeper of the Coal Table',
    looseness: 0.4,
    aggression: 0.4,
    bluff: 0.1,
    stickiness: 0.5,
    magic: { cinder: 0.4, unmask: 0.4, briar: 0.4, fate: 0.4 },
  },
  dock_runner: {
    id: 'dock_runner',
    name: 'Dock Runner',
    title: 'Hungry gambler of the wharves',
    looseness: 0.6,
    aggression: 0.6,
    bluff: 0.2,
    stickiness: 0.4,
    magic: { cinder: 0.5, unmask: 0.3, briar: 0.2, fate: 0.5 },
  },
  // P5 (design v0.7 §09): Act II rivals; knobs calibrated to VPIP/PFR targets (tests/ai-calibration.test.ts).
  isolde_morn: {
    id: 'isolde_morn',
    name: 'Dame Isolde Morn',
    title: 'Calculating aristocrat',
    looseness: 0.25,
    aggression: 0.35,
    bluff: 0.06,
    stickiness: 0.3,
    magic: { cinder: 0.3, unmask: 0.65, briar: 0.75, fate: 0.3 },
  },
  ravel_croft: {
    id: 'ravel_croft',
    name: 'Ravel Croft',
    title: 'Deceptive court challenger',
    looseness: 0.75,
    aggression: 0.75,
    bluff: 0.3,
    stickiness: 0.35,
    magic: { cinder: 0.8, unmask: 0.3, briar: 0.2, fate: 0.6 },
  },
  vesa_kael: {
    id: 'vesa_kael',
    name: 'Vesa Kael',
    title: 'Collector and cold reader',
    looseness: 0.6,
    aggression: 0.2,
    bluff: 0.05,
    stickiness: 0.6,
    magic: { cinder: 0.25, unmask: 0.8, briar: 0.25, fate: 0.7 },
  },
  witness_arden: {
    id: 'witness_arden',
    name: 'Witness Arden',
    title: 'Ledger witness',
    looseness: 0.45,
    aggression: 0.7,
    bluff: 0.05,
    stickiness: 0.45,
    magic: { cinder: 0.3, unmask: 0.8, briar: 0.6, fate: 0.25 },
  },
  livia_shade: {
    id: 'livia_shade',
    name: 'Livia Shade',
    title: 'Reckless society outsider',
    looseness: 1,
    aggression: 0.3,
    bluff: 0.25,
    stickiness: 0.6,
    magic: { cinder: 0.8, unmask: 0.55, briar: 0.2, fate: 0.3 },
  },
  margrave_noct: {
    id: 'margrave_noct',
    name: 'Margrave Noct',
    title: 'Lord of the Crown Inquest',
    looseness: 0.4,
    aggression: 0.85,
    bluff: 0.12,
    stickiness: 0.35,
    magic: { cinder: 0.35, unmask: 0.3, briar: 0.75, fate: 0.6 },
  },
  aurelia_ash: {
    id: 'aurelia_ash',
    name: 'Aurelia Ash',
    title: 'Patient multiway player',
    looseness: 0.7,
    aggression: 0.4,
    bluff: 0.06,
    stickiness: 0.65,
    magic: { cinder: 0.3, unmask: 0.3, briar: 0.6, fate: 0.7 },
  },
  // Cinder substitutes for a dead or penniless Night Clerk / Dock Runner (design v0.7 §10).
  ash_porter: {
    id: 'ash_porter',
    name: 'The Ash Porter',
    title: 'Carrier of the Ember Steps',
    looseness: 0.45,
    aggression: 0.45,
    bluff: 0.1,
    stickiness: 0.5,
    magic: { cinder: 0.4, unmask: 0.4, briar: 0.4, fate: 0.4 },
  },
  cinder_mason: {
    id: 'cinder_mason',
    name: 'The Cinder Mason',
    title: 'Builder of the Undercircuit',
    looseness: 0.5,
    aggression: 0.5,
    bluff: 0.15,
    stickiness: 0.45,
    magic: { cinder: 0.45, unmask: 0.35, briar: 0.35, fate: 0.45 },
  },
};
