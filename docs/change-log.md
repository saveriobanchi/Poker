# Change log

## 2026-10-18 — P1: playable 4-seat table

**Implementation**
- `src/game/ai/`: a local AI that uses only public information. It combines a
  preflop hand ranking (Chen formula percentiles), range-aware Monte Carlo
  equity, and three personalities: Lady Vesper (loose and aggressive), the
  Sightless Oracle (calls a lot), Sir Corvin (tight). Decisions are seeded per
  turn, so they are deterministic.
- `src/game/rules/evaluator.ts`: a fast 7-card scorer (`scoreBest`), checked
  against the exhaustive evaluator on 50,000 hands.
- `src/game/table/session.ts`: hand sequencing, starting stacks from the table's
  own budget, hand summaries, and save/load with invariant validation.
- `src/ui/` and `src/main.ts`: a Phaser table scene with placeholder vector art,
  plus native HTML controls (Fold / Check-Call / Bet-Raise with presets and a
  slider). It has a fast mode and stops for Last Claim when the player busts. It
  is a PWA (manifest, offline service worker, Home Screen icons).
- CI workflow, plus GitHub Pages deployment.

**Measured** (about 7,000 AI-only hands): VPIP/PFR is 34%/32% for Vesper, 29%/11%
for the Oracle and 17%/12% for Corvin; 14% of hands reach showdown; a decision
takes about 0.13 ms.

**Verified on an iPhone 13 viewport (390×844):** a full four-handed hand
completes with no overflow and no horizontal scroll, every button is at least
40 px tall, and a reload restores the identical state (acceptance test 12 in
emulation; a real device is still to be checked).

**Collaboration:** added `docs/collaboration.md`, `docs/asset-manifest.json`,
`docs/briefs/001-report-for-chatgpt.md`, and `art/incoming/`.

**Gameplay / visual impact:** the first playable build. All art is placeholder
until the manifest assets arrive.

## 2026-10-18 — Design bible v0.3 adopted; P0 poker kernel

**Design**
- Added `docs/design-bible.md` (v0.3, the canonical baseline as provided).
- Added `docs/poker-rules-exceptions.md`, the register of rule interpretations and
  departures from TDA.

**Implementation (P0 — Poker kernel, no graphics)**
- `src/game/rules/`: the deck, a seeded and serializable RNG, a 5-to-7-card hand
  evaluator, main/side pot building and awarding (TDA odd-chip rule), and a pure
  no-limit Hold'em hand engine covering:
  - button, blinds and short all-in blinds;
  - heads-up and 3+ seat action order;
  - a legal-action generator with minimum bet/raise sizes;
  - short all-in reopening rules;
  - uncalled bet return and all-in runouts;
  - showdown;
  - zero-chip detection, including the pot and claimant(s) each Last Claim is
    attached to;
  - save/restore with validation, replay from seed plus action log;
  - a public per-seat view for AI agents that hides the deck and unshown cards.
- Chip conservation and the 52-unique-card invariant are checked on every state
  transition.

**Tests**
- Unit tests cover acceptance tests 1–4, 5 (the chip half), 6 (the data-access
  half) and 10 (the poker half). There is also a seeded simulation of 10,000 random
  hands, plus 100 four-seat matches played to elimination, with zero invariant
  violations.

**Gameplay / visual impact:** none yet. There is no UI. P1 builds the playable
4-seat table on this kernel.
