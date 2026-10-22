# Change log

## 2026-10-22 — Design v1.1 + P9: Evidence, art gate and mobile polish (engineering milestone)

**Design (ChatGPT's v1.1 hand-off):**
- `docs/design-decisions-v1.1.md`, `docs/p9-art-production.md` and
  `docs/p9-qa-matrix.md`.
- The research configs in `docs/research/`.
- The bible is bumped to v1.1.

**Production rules: unchanged.** Poker, Last Claims, the ledger, saved shops, Act
III, Aether 0–3 and one cast per hand are untouched. On the P8 seeds, outcomes
replay identically.

**Research (offline only, never on in play)**
- **Aether variants (`SeatMagic.research`):**
  - `baseline`: exact P8, with Aether lost at the cap counted.
  - `ember_overflow_reserve`: the literal rule. It is **inert**: an overflow
    leaves Aether at the cap, and nothing lowers it before the next hand opens.
    Proven by test and by the study, which found 0 changed tables.
  - `ember_reserve_on_spend`: a labelled interpretation awaiting a ruling.
  - `ember_next_hand_discount`.
  - Each variant applies to every seat and never stacks.
- **Studies:**
  - `npm run aether-ab`: table-level A/B from identical table starts, plus Cinder
    enchantment value under each rule, with cluster intervals.
  - `npm run rare-branches`: Quiet Briars, Ravenous Eye, Second Reflection and
    Marked Fate, reached through legal evolutions, with source-run counts and a
    selection-bias statement.

**Art**
- **`npm run art`:** one command that checks the files, packs the passing ones,
  writes the index and proof sheet, and sets the manifest statuses:
  - `needed` / `rejected` / `delivered` / `integrated`;
  - `integrated` needs a named reviewer, a provenance note and the file's
    SHA-256;
  - `--revert` restores the monogram.
- **New checks:** PNG format, a genuine alpha-zero exterior, bust framing,
  near-duplicates.
- **Tests:** `npm run test:art`.
- **Status:** no portrait or back was delivered. All seven stay **needed**.

**Mobile**
- **iPhone SE:** a ± control hides the slider, so every control reaches 44 px.
  The table grows from 216×281 to 252×327.
- **Landscape phones:** a side-by-side layout; the SE table goes from 63×83 to
  203×264.
- **Spells and title:** an uncastable spell can be tapped and says why. The
  title bar expands to the full table and route.
- **Audit:** an automated check at 390×844, 320×568 and both landscapes finds
  no control under 44×44 px, no horizontal overflow, and no off-screen action.

**Playtest kit**
- `docs/playtest-kit-p9.md`: consent script, severity scale, notes template.
- `npm run playtest-summary`: validates and pools real exports with
  denominators.
- **No human session has been run.**

## 2026-10-21 — Design v1.0 + P8: Depth, character and honest measurement

**Design (ChatGPT's v1.0 hand-off):** `docs/design-decisions-v1.0.md` and the six
`src/game/run/data/p8-*.json` files. The bible is bumped to v1.0.

**Rules**
- **Dossier shoves:** "large shove" is now the AI's own predicate (`isLargeShove`
  in `reads.ts`): a bet or raise to at least 50% of the start-of-hand stack. Raw
  actions keep all-in calls and raises apart. P7 dossiers keep the figures they
  were saved with.
- **Act III:** unchanged, as ordered: the blinds, the payout and all seven claim
  temperaments are as in P7.

**New**
- **World Testament unlocks (`presentation.ts`):**
  - What unlocks: three backgrounds besides the Unmarked, two prose variants
    (at most one per run), and two card backs that stay unusable until their
    art passes `scripts/check-art.py`.
  - What does not change: everything is stored apart from the run. `createRun`
    and the engine never import it (tested structurally), so every background
    plays a byte-identical seeded run.
- **Mixed-aggressive policy:** a looser, more aggressive driver than skilled. It
  semi-bluffs draws and caps oversized shoves. It is used in the balance run and
  as a downstream policy for spell value.
- **Full-table spell value (`tableEv.ts`, `npm run table-ev`):**
  - Method: cast vs skip from one persisted run state; both arms play to the
    end of the current table with common policy randomness. Endpoints are
    table net, death, table win, Aether left, later casts and turnover.
  - Intervals: cluster bootstrap over source runs.
- **Playtest instrumentation (`?playtest=1`):**
  - The log stays on the device and records interface events only.
  - It includes 15- and 45-minute check-ins and a JSON export.
  - Protocol: `docs/playtest-protocol-p8.md`.
- **Portrait gate:** `scripts/check-art.py` checks the seven portraits and the
  card backs, writes the 64 px proof and builds the portrait list the game loads.
  No file has been delivered, so the monograms stay.

**Mobile**
- Every sale, purchase, rethread and buyback states the exact transfer, who
  receives it, the current stack and what remains. Buy is disabled when the
  player cannot afford it.
- 44 px touch targets for the HUD, raise presets, small buttons, slider and the
  spell-info toggle. On short phones the action row stays at 40 px so it fits.
- At 320 px spell names break between words, never inside one (P7 split
  "Unmask" and "Challenge"). The HUD is tighter at 320 px.

**Results** (full figures in report #008):
- **P7 seeds:** the four P7 policies reproduce P7 exactly on the same seeds.
- **Act III:** skilled mortality is 27.5% on P7 seeds and 27.9% on novel seeds.
- **Mixed-aggressive:** it clears 13.15%, against 11.35% for skilled on the same
  worlds (+1.8 pp, 95% CI +0.05 to +3.6).
- **Spell value:** no spell shows end-of-table value for skilled play. Cinder
  Challenge is +0.64 Lifechips per decision (95% CI +0.04 to +1.26) for
  mixed-aggressive play only.
- **Human playtests:** not conducted yet.

## 2026-10-20 — Design v0.9 + P7: Closure and measurement

**Design (ChatGPT's v0.9 hand-off):** `docs/design-decisions-v0.9.md`, the five
`src/game/run/data/p7-*.json` files, `docs/art-production-p7.md` and
`docs/mobile-qa-p7.md`. The bible is bumped to v0.9.

**Rules**
- **Sigil:** "Keep" consumes the table's Sigil and draws nothing; it cannot be
  reopened.
- **Dossiers:** each one stores its seed (fixed on arrival) and the public action
  records its figures are recomputed from.
- **Cinder Pass:** waives one Crown Writ petition fee, once, and nothing else.
- **Last Claims:** Act III rivals have their own temperaments.
- **Ledger Regent:** carries one Second Reflection.
- **Table of Seals:** reports when no spell is a valid reward target.
- **Living endings:** each records one epilogue fate.

**New**
- **World testament (`legacy.ts`):** a separate store archiving each finished
  character. A new run never reads it, so no chips, inventory or odds carry over.
  The title screen lists it, and a new arrival hears one line about a predecessor.
- **Merchant voices (`merchants.ts`):** dialogue only. Shops show rarity badges
  and warnings for relics already owned or full slots.
- **Offline spell value (`spellEv.ts`, `npm run spell-ev`):**
  - Method: paired cast vs skip from the same cloned legal state, with common
    policy randomness and bootstrap 95% intervals by spell, street and depth.
  - Result: 317,781 pairs, 0 incompatible continuations.
  - Analysis only, never shown in game.
- **Mobile:**
  - A pot-odds line when facing a bet.
  - Reduce motion: follows the system setting, with a HUD toggle.
  - Tap-to-read spell details.
  - A tighter panel on short phones; the spell row fits at 320 px.

**Fix**
- A bound character who had already walked the Undercircuit and fell again was
  routed back to the Underlamp. The no-replay guard refused it; the character now
  ends at The Low Lanterns Remain. Found by the spell-EV study.

## 2026-10-20 — Design v0.8 + P6: Act III and the Undercircuit

**Design (ChatGPT's v0.8 hand-off):** `docs/design-decisions-v0.8.md`, the six
`src/game/run/data/p6-*.json` files and `docs/art-brief-p6.md`. The bible is bumped
to v0.8.

**Rule changes**
- **Whispered Contract:** +1 Resonance to an unevolved spell below 2 (otherwise +1
  Aether at the next table), +1 Notoriety, and one drawn spell named publicly in the
  Arena's first hand.
- **Court of Mirrors:** a seeded 12-hand public dossier on Witness Arden or Livia
  Shade, shown at the Arena only.
- **Act II rewards:** Salon (relic or +1 Resonance) and Arena (relic or token).
- **Fateweaver's Sigil:** a rare relic (38) with a once-per-table private spell
  rearrangement, a public tell and replay support.
- **Ember Steps:** finishing top two gives Favor +1 and a Cinder Pass.
- **NPC debt:** voluntary payments at every boundary, with estates for dead creditors.
- **Last Claim:** temperaments for the seven Act II rivals.

**New content**
- **Act III, the Crown Table:** the Crown Writ (invitation, petition or conditional
  entry, with an optional one-time Undercircuit recovery for short stacks), the Ashen
  Coronet, the Silver Archive, the Royal Exchange, the Table of Seals and the Crown
  Table. Endings: The Ledger Unbound (with a recorded allegiance) and The Unchosen
  Road. The Crown ledger ingress (1,280) happens once.
- **The Undercircuit:** the Underledger (102 ingress, once), Matron Wisp, the
  Underlamp Table and the Petition of Cinders, ending in a conditional writ or The
  Low Lanterns Remain. No obligation is forgiven.
- **Characters:** nine new characters; the seven Act III rivals are calibrated.
- **Saves:** save v3 migration; P5 endings become chapters.
- **Balance:** `npm run balance` reports phase-conditional cohorts with their own
  denominators, shove-call results, claims by character, relics by source and
  rarity, Whisper uptake, and debt repaid (`docs/reports/balance-p6.json`).

**Fixes**
- A table can never be entered twice. This closes an Act III re-entry path for a
  player who fell there, found by simulation.

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
