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
  },
  oracle: {
    id: 'oracle',
    name: 'The Sightless Oracle',
    title: 'Patient collector of secrets',
    looseness: 0.5,
    aggression: 0.3,
    bluff: 0.08,
    stickiness: 0.8,
  },
  corvin: {
    id: 'corvin',
    name: 'Sir Corvin',
    title: 'Disciplined survivor',
    looseness: 0.2,
    aggression: 0.5,
    bluff: 0.05,
    stickiness: 0.15,
  },
};
