# Change log

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
