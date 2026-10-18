# Report for ChatGPT #001 (after P0 + P1)

*Copy everything below the line into ChatGPT.*

---

Hi! I'm working on **The Last Wager** (design bible v0.3, which you wrote) with
Claude as the engineer. Here is Claude's progress report. Please answer the
open questions and start the art bible. Use the exact formats requested at the end.

## What exists now (built and tested)

- **P0 — Poker kernel:** a pure TypeScript No-limit Hold'em engine following
  TDA rules: blinds and short all-in blinds, minimum raises, short all-ins that
  do not reopen the betting, side pots, ties, odd chips, and return of uncalled
  bets. Chip conservation and the 52-unique-card invariant are checked on every
  state change. A 10,000-hand random simulation found 0 violations.
- **P1 — Playable 4-seat table** in the phone browser: you against Lady Vesper,
  the Sightless Oracle and Sir Corvin at 1/2 blinds. Starting stacks are You 100,
  Vesper 120, Oracle 100, Corvin 90 (the table's own budget, not copied from the
  player). The game saves after every action and restores exactly.
- **AI:** the rivals decide only from public information plus their own cards,
  and this is enforced by a test. Measured styles over about 7,000 AI-only hands:

  | Rival | Plays a hand (VPIP) | Raises preflop (PFR) |
  |---|---|---|
  | Lady Vesper | 34% | 32% |
  | The Sightless Oracle | 29% | 11% |
  | Sir Corvin | 17% | 12% |

  A hand reaches showdown about 14% of the time.
- **Busting:** when you reach 0 chips, the game stops and announces Last Claim.
  The bargaining scene itself is milestone P3.

## Engine interpretations that need your approval

1. **Moving button** instead of TDA's dead button when players are eliminated.
2. **Showdowns:** every live hand is revealed. There is no mucking yet.
3. **No antes.**
4. **Checking keeps your options:** a player who checked may still raise after a
   short all-in bet. This follows TDA forum rulings and Robert's Rules.

## Open questions (needed before P2 — the magic kernel)

1. **Spell data for the first four spells.** Confirm or adjust, one row per
   spell: `id, name, discipline, aether cost, timing window, target, public tell
   text, effect, exhaust or discard, conflict priority`.
2. **The beginner Spellbook (8 cards).** Which 8 spells, given that only 4 are
   designed? Duplicates of those 4 are allowed (how many of each?), or name
   4 more simple spells in the same format.
3. **AI spell use.** Should each rival get a fixed 8-card Spellbook matching
   their discipline (Vesper: Ember; Oracle: Veil/Mirror; Corvin: Thorn)? If so,
   list them.
4. **Briar Lock and earlier bets.** If Briar Lock is cast when a street opens,
   does the pot-limit ceiling also cap a re-raise of a bet made before it was
   cast on that street? (Our proposal: the timing window "before betting begins
   on the current street" makes this impossible, so cast only at the start of a
   street.)
5. **Contract table (P4 prep).** Confirm 8 hands, objective "top 2 stacks and at
   least 1 Lifechip", and what the setback branch costs.

## Please also start the art bible

Write `docs/art-bible.md` covering palette (hex values), typography, card face
and back style, chip style, portrait style, and UI panel style. The current
placeholder look is dark wood and black-green felt, gold (#c9a24a, #f3d27a),
crimson (#8e1b2a) and parchment (#f2e8d0) cards with a serif font. Keep it or
replace it.

Then produce the assets listed in `docs/asset-manifest.json`, starting with the
**card back**, **two sample card faces (A♠ and 7♥)** and the **four portraits**,
so we can check the style at phone size before making all 52 faces. Exact sizes:

- Card faces and back: 150×210 PNG, transparent rounded corners.
- Portraits: 512×512 PNG, transparent background, bust framing, consistent style,
  readable as a 64 px circle.

## Response format

- **Design changes:** use one `DESIGN CHANGE — bible v0.3 → v0.4` block per
  change (What / Rule text / Numbers / Invariants touched / Acceptance test).
- **Spells:** a table with every field filled in.
- **Images:** the file names from the manifest.
