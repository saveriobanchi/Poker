# Change log

## 2026-10-19 — Design v0.7 + P5: Act II and the Cinder road

**Design (ChatGPT's v0.7 hand-off):** `docs/design-decisions-v0.7.md`, the four
`src/game/run/data/p5-*.json` files and `docs/art-brief-p5.md`. The bible is bumped
to v0.7.

**Balance first**
- `npm run balance`: 10 seed batches × 100 runs per policy, shared seeds, Wilson
  95% intervals (`docs/reports/balance-*.json`).
- Rivals keep public shove reads per character (the last 24 preflop decisions,
  smoothed towards a personality prior with weight 12). Facing a stack-committing
  bet, they weigh equity against the aggressor's modeled range and the real pot
  odds, plus a survival premium. There is no hidden data and no call quota.
  On the same 4,000 runs, the shove policy's Act I victory rate fell from 37.7%
  to 8.9%.

**Rule changes:**
- Boss tables: a tie for first wins, or a top-two finish with net profit of at
  least max(12, 20% of entry); the Crown Inquest uses 16.
- Evolution tokens attune a spell (+1 Resonance) when none is ready to evolve.
- Circuit relic rewards are weighted 60/35/5 by rarity. With full slots, the
  player gives one relic up.
- NPC debtors make one voluntary payment (15% above their last chip) at each act
  boundary.
- Bailiff Sable carries Quiet Briars.
- Twin Oracle with three or more eligible opponents asks the caster for two
  targets.

**New content**
- **Save v2:** P4 saves migrate once, with no transfer.
- **Audited ingress:** Act II (1,150) and the Cinder road (96) open their external
  ledger accounts once each. Each newcomer is funded once, by name, when they
  first appear. The P4 total stays auditable as the base.
- **Act II, the Gilded Circuit:**
  - Entry is by invitation after a victory (Favor +1) or by petition after an
    exile.
  - Route: Gilded Gate → Masked Salon → Velvet Exchange → Court of Mirrors or
    Whispered Contract → Velvet Arena → Crown Inquest.
  - Seven new rivals, calibrated to their VPIP/PFR targets.
- **The Cinder road:**
  - Broker Understairs, the Ember Steps (with substitutes for dead regulars),
    then the Oathbreaker Hearing.
  - From the Hearing, a free player goes up to the Gate; a bound player goes
    down to the Undercircuit.
- **Last Claim:** a "What sways them" box explains the history, the funder's
  stake, reputation and the other party's known leanings, in words only.

**Fix:** a hand that settles as it is dealt (every live seat all-in from the
blinds) now opens its Last Claims. Before, a bankrupt player could stay seated.

## 2026-10-19 — Design v0.6 + P4: The roguelike slice

**Design (ChatGPT's v0.6 hand-off):** `docs/design-decisions-v0.6.md`, the eight
`src/game/run/data/p4-*.json` files and `docs/art-bible-v0.3-p4-addendum.md`. The
bible is bumped to v0.6.

**Rule changes**
- NPC debtors use their own temperament: acceptance per pact, a priority order,
  and Vesper's veto on service (a hard zero). A counteroffer is answered with the
  same persisted roll; nothing is auto-accepted.
- Only mercy earns the player Honor. A creditor gains Favor once, when a debt is
  discharged in full or a service pact is released.

**Implementation**
- **Run engine (`src/game/run/`):**
  - Named wallets for every character, Selene (80) and the Witness escrow. Tables
    buy in from and cash out to these accounts.
  - A global invariant (accounts + treasury + table) is checked after every command.
  - Route: start → Ash Table → Selene's Lantern → optional Mirror's Petition →
    Lantern Circuit → Bailiff's Ledger, with the four endings. A failed table is
    never replayed; a living failure gets one Keeper's Audit.
  - Seeded rewards and shop offers that survive a reload; Spell Rethread; the
    Open Book fee goes to escrow; purchases can never take the final Lifechip.
  - Fallen route: Registry Below → Coal Table (4 hands, 1/1) → Audience of the
    Bound. Sworn-service duties advance one per hand, in order, with event ids
    that can never count twice. Debt repayment applies after positive-net tables.
- **Magic:** per-instance Resonance, eight branch evolutions (only between hands,
  1:1 replacement), six relics, the Covenant of the Open Book with public reveals,
  and Second Reflection's private pick.
- **AI:**
  - Mara Quill, Eldric Vale, Bailiff Sable and Sister Rill are calibrated to their
    VPIP/PFR targets over 12,000 preflop opportunities each (all within 1.5 points).
  - Preflop percentiles now break Chen-score ties, so ranges move smoothly.
- **Simulation:** `npm run simulate` plays 1,000 seeded runs across four player
  policies and writes `docs/reports/p4-simulation.json`.
- **UI:**
  - The run is now the main flow, with a route trail on every screen, the shop,
    the petition, rewards, the audit, evolution choices, results, the Fallen
    screens and the endings.
  - The table shows hand x/cap, relics, public reveals in gold, evolved spells,
    and provisional monograms for portraits not yet painted.
  - A P3 Fallen save can be continued once.

## 2026-10-18 — Design bible v0.5 + P3: Life and consequences

**Design (ChatGPT's v0.5 hand-off):** `docs/design-decisions-v0.5.md` and
`docs/art-bible-v0.2-addendum.md`. The bible is bumped to v0.5.

**P2 corrections**
- **Cinder Challenge matching:** a call or legal re-raise that commits at least
  the enchanted amount counts as a match; a short all-in call does not. Each
  response is recorded when it happens, and side-pot eligibility is enforced.
- **Fate Exchange tell:** now reads "A mirrored card turns face-down."
- **Card back:** the new 300×420 back is checked on every asset build to be
  exactly symmetric under 180° rotation.

**Implementation**
- **`src/game/world/`:**
  - Characters, reputation, relationships, the Ledger relief treasury, covenants
    and an append-only transfer journal.
  - A global invariant: table chips + off-table chips + treasury stay constant.
- **The Last Claim state machine:**
  - Claims open only after settlement and resolve clockwise from the button.
  - The claimant is the sole winner of the pot holding the debtor's last chips;
    a split pot goes to the neutral adjudicator.
  - Funding comes from the named claimant's own stack, who must hold more than
    the endowment.
  - One persisted roll per claim and one counteroffer, so reloading cannot
    change an answer.
  - The player may survive at most one covenant per run.
- **Willingness and debt:** willingness follows the design tables (clamped,
  with banded labels only). Debt repayment, defaulting at 30% and overdue after
  4 tables, is a tested function ready for P4.
- **Session v3:** claims block the next hand. NPC-vs-NPC claims resolve by the
  same rules. A survivor leaves the table as one of the Fallen with
  `pendingNode = FALLEN_RECOVERY`. Saves validate the world ledger.
- **UI:**
  - The Last Claim scene on ChatGPT's parchment contract (three-sliced so
    ornaments never stretch), with the Ledger title card, wax seal and portraits.
  - Every word and choice is real, accessible HTML.
  - A review step before sealing; second-step confirmation for Accept Fate,
    Claim Life and declining a counteroffer.
  - "The Cinder Warrens — to be continued" and end-of-run screens. A Fallen
    save is archived when a new run starts.

**Measured:** 94 tests. 30 whole tables with claims kept the world ledger
balanced, and departed seats never played again.

**Verified on an iPhone 13 viewport:** the full claim flow (choose, review,
seal, counteroffer, outcome, Fallen screen) with no console errors and no
horizontal overflow.

## 2026-10-18 — Design bible v0.4 + P2: magic kernel

**Design (from ChatGPT's v0.4 hand-off):** nine decisions adopted
(`docs/design-decisions-v0.4.md`), the art bible v0.1 (`docs/art-bible.md`), and the
spell data (`src/game/magic/spells.json`). The bible is bumped to v0.4. The
exceptions register now lists the Briar Lock and Fate Exchange rules.

**Implementation**
- **Engine:** a per-street pot-limit ceiling (`setStreetLimit`) and a hole-card
  exchange from the undealt stub (`exchangeHoleCard`). Both are recorded as
  effects, so `replayHand` stays exact.
- **`src/game/magic/`:**
  - Spellbooks: 8 instances each, with their own RNG; draw 3, discard, and
    reshuffle only when needed.
  - Aether (2 to start, cap 3), street-opening windows in action order, and the
    four spells.
  - Settlement: showdown regeneration, then Cinder rewards.
  - `MagicView` gives per-seat privacy. There are magic invariants and full
    command replay.
- **AI** (`src/game/ai/magic.ts`): spell temperament per rival. Equity sampling
  now honours a legitimately unmasked card.
- **Session v2:** magic-aware statuses (`humanWindow`), deterministic AI commands,
  and validated saves. Old v1 saves start a fresh table.
- **UI:**
  - Real card art and portrait medallions with public Aether pips.
  - A spell tray with discipline colours, Unmask target and Fate card pickers,
    and Cinder arming on the raise button.
  - A "Pot-limit" badge, public tell banners, and a violet outline on unmasked cards.
  - A second tap to confirm any all-in, the art-bible button hierarchy, and a
    mute toggle.
- **Assets:**
  - `scripts/build-assets.mjs` generates the 52-card deck (public-domain court
    art recolored, OFL index font), the felt, the Lifechip and the dealer button.
  - `scripts/pack-assets.py` packs the runtime files: 692 KB in total, against
    about 11 MB of source PNGs.
  - Fonts are bundled offline with `@fontsource`. Sounds are synthesized with Web Audio.
  - `CREDITS.md` lists every source and license.
- **Service worker v2:** network-first for un-hashed files, so art updates are
  never stuck in the cache.

**Measured:** 68 tests. A 1,000-hand random-cast fuzz and 1,200 AI-only magic
hands found 0 invariant violations. AI casts: Cinder 160, Briar 100, Unmask 52,
Fate 41.

**Verified on an iPhone 13 viewport:**
- Every spell can be cast through the UI.
- There is no overflow and no horizontal scroll.
- There are no console errors.

**Open for design:** the questions in `docs/briefs/002-report-for-chatgpt.md`.

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
