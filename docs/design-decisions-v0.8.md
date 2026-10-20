# THE LAST WAGER — P6 creative/rules handoff
## DESIGN CHANGES — Bible v0.7 → v0.8
Status: design-approved for Claude engineering; quantitative values are calibration seeds, not verified game balance. Do not rewrite P0–P5 poker kernel; existing save data and journal semantics take precedence except where explicitly modified.

### DESIGN CHANGE — bible v0.7 → v0.8 — 01
**What:** Whispered Contract reward.

**Rule text:** Accepting the Contract grants exactly one resonance to an eligible owned, unevolved instance (cap 2); if none is eligible, next Arena table starts with +1 Aether (cap 3). Pay +1 Notoriety and expose the identity of one spell drawn in the first Arena hand. Choice and tell are persisted once.

**Numbers:** 1 Resonance OR 1 capped Aether, +1 Notoriety.

**Invariants touched:** Spellbook identity, Aether cap, hidden poker information, idempotency.

**Acceptance test:** Reload after accepting; no double resonance; public spell disclosed without exposing hole cards.

### DESIGN CHANGE — bible v0.7 → v0.8 — 02
**What:** Court of Mirrors intelligence.

**Rule text:** Choose a genuinely public seeded dossier about one of the next table’s rivals, Witness Arden or Livia Shade, from at most 12 recorded public hands; player’s own prior observations can supplement it. No undealt/hidden-card knowledge.

**Numbers:** At most 12 public prior hands per dossier.

**Invariants touched:** AI privacy; scoped player information, save determinism.

**Acceptance test:** Dossier persists on Arena HUD, vanishes afterward, never includes unrevealed cards.

### DESIGN CHANGE — bible v0.7 → v0.8 — 03
**What:** Ember Steps and Cinder accounting.

**Rule text:** Top two while alive gains +1 Favor and one Cinder Pass flag; third while alive loses 1 Favor; no extra chips or Keeper Audit. Replacement when original rival is dead or at zero, with one-time funded wallet. Existing 96-chip external Cinder ledger unchanged.

**Numbers:** Favor +1/-1, total ingress 96.

**Invariants touched:** Chip conservation, rank, event idempotency.

**Acceptance test:** Simulate all ranks and substitution combinations; unused 36 stays externally funded.

### DESIGN CHANGE — bible v0.7 → v0.8 — 04
**What:** Freed and bound Act II recovery.

**Rule text:** No debt outstanding and no incomplete service is free; mercy is unbound. P6 grants non-repeatable Crown Writ petition to free Act II Fallen survivors without replaying Act II; bound survivors use Undercircuit and can qualify for conditional writ without deleting obligations.

**Numbers:** Nonchip petition −1 Favor, floor −3.

**Invariants touched:** Social state, contracts, nonduplicate routes.

**Acceptance test:** Both free and bound branches can reach an ending; no contract forgiven by route transition.

### DESIGN CHANGE — bible v0.7 → v0.8 — 05
**What:** AI spellbooks, rewards and rare relic.

**Rule text:** Act II baseline spellbooks are 3/3/1/1 with Noct Thorn Lattice; add non-chip rewards after Masked Salon and Velvet Arena; rare Fateweaver Sigil enters 60/35/5 reward weighting, price 38.

**Numbers:** 8 cards per AI; 1 rare relic; reward once per table.

**Invariants touched:** Spell instance conservation, relic slots, merchant wallets.

**Acceptance test:** Full inventory replaces a relic; one-time rewards cannot be rerolled; rare effect changes only spell draw.

### DESIGN CHANGE — bible v0.7 → v0.8 — 06
**What:** NPC repayment schedule.

**Rule text:** NPCs make one voluntary repayment from their actual liquid wallet at each distinct completed Act/Cinder Hearing boundary, including beyond Act I; unique boundary+debt key prevents duplication. Credit dead creditors’ tracked estate wallets.

**Numbers:** floor(15% of expendable stack) <= remaining due, preserve ≥1 chip.

**Invariants touched:** Ledger conservation, creditor ownership, save state.

**Acceptance test:** Repeat boundary event and reload; payments happen exactly once; cannot make wallet negative.

### DESIGN CHANGE — bible v0.7 → v0.8 — 07
**What:** Act II claimant profiles.

**Rule text:** Give all seven Act II rivals explicit claimant baselines, preferred contracts, debtor acceptance/priority, hard vetoes, funded endowment and relationship modifiers; use saved roll model unchanged.

**Numbers:** 7 profiles; 10-chip standard funded endowment; clamp 5–90% except veto 0.

**Invariants touched:** Last Claim determinism, actor agency, real funding.

**Acceptance test:** Every named claimant yields reproducible offers; Vesa/Noct service veto rules follow data; tie pot adjudicator unchanged.

### DESIGN CHANGE — bible v0.7 → v0.8 — 08
**What:** Act III: Crown Table.

**Rule text:** Continue victorious Act II survivors to a finite high-society Act III with two contracts, one archive choice, a paid shop and final three-seat boss. Living-failure paths continue; zero resolves Last Claim.

**Numbers:** 8+8+12 hands; external ingress 1280 exactly once; blinds 4/8 then 5/10.

**Invariants touched:** Chapter transitions, chip ledger, player stack preservation, game-ending state.

**Acceptance test:** P5 save migration reaches Act III without chip reset; only one funded ingress; all legal paths terminate.

### DESIGN CHANGE — bible v0.7 → v0.8 — 09
**What:** Undercircuit route.

**Rule text:** Bound Fallen characters play a six-hand low-blind table, may sell one relic to a tracked merchant, and petition for conditional Crown Writ if they finish alive in top two and are not overdue; otherwise receive a persistent living ending.

**Numbers:** External ingress 102 exactly once; blinds 1/1, 6 hands.

**Invariants touched:** Debt/service persistence; chip conservation; claim cap.

**Acceptance test:** No unpaid obligation vanishes; no table replay or second funded life; routes fully reachable.

### DESIGN CHANGE — bible v0.7 → v0.8 — 10
**What:** Balance and visual QA.

**Rule text:** Retain P5 shove model and existing code-drawn legible UI. Run phase-conditional simulations and commission seven overdue consistent painterly portraits; portraits are explicitly NOT included in v0.8 design package.

**Numbers:** ≥2,000 independent matched seed runs per policy; portrait sources 512×512.

**Invariants touched:** Test metrics and art asset status.

**Acceptance test:** No regression, exported screenshots at 390×844; no manifest item marked delivered without real asset.

## P5 decision responses

| # | Approval | Contract |
|---|---|---|
| 1 | MODIFY | `whispered_contract`: Accept +1 Notoriety; choose an owned, unevolved spell instance with Resonance <2 and grant +1 Resonance (max 2); if none eligible, next table begins with +1 Aether up to cap 3. On first Velvet Arena hand publicly disclose the ID of one randomly selected spell drawn into own opening spell hand; tell is public, poker cards stay private. Choice/events seeded and saved once. |
| 2 | MODIFY | `court_of_mirrors`: Select a public poker dossier for Witness Arden OR Livia Shade from up to 12 recorded public hands, with sample size shown. Include recorded VPIP/PFR/shoves; never claim exact lifetime stats or disclose unrevealed cards. HUD dossier persists at Velvet Arena and then expires. Personal witnessed histories may also be read. No wallet changes. |
| 3 | MODIFY | `ember_steps`: Alive top-two gets +1 Favor and a Cinder Pass flag exactly once; alive lower than top-two gets -1 Favor, no additional chip loss or Keeper Audit; zero triggers Last Claim per existing one-rescue rule. Dead or zero-wallet regular replaced only by once-funded substitute. |
| 4 | APPROVE | `cinder_ingress`: Existing 96-chip external ingress remains: Osric 60, Ash Porter 18, Cinder Mason 18, unused balances in source account; account must exist before transfers. Never remint on reload. |
| 5 | APPROVE | `free_at_hearing`: Free means no outstanding debt and no unfulfilled service covenant. Unbound Mercy is not a binding obligation; an overdue-but-unpaid debt is still binding. |
| 6 | EXTEND | `act2_fallen`: P5 may retain Mask Falls ending for existing saves; from P6, free survivors can seek Crown Writ via one nonchip petition (-1 Favor, min -3), no Act II replay; bound survivors continue Undercircuit and may earn a conditional writ while obligations persist. |
| 7 | APPROVE | `act2_spellbooks`: Each rival uses 3/3 primary pair and 1/1 other disciplines; Margrave Noct substitutes one Briar Lock with Thorn Lattice; Ash Porter and Cinder Mason use beginner Spellbook. |
| 8 | CHANGE | `act2_rewards`: Masked Salon winner selects one seeded non-owned relic (replacement allowed when full) OR +1 Resonance to one owned unevolved spell (max 2). Velvet Arena winner selects a non-owned relic OR one evolution token with existing fallback; all rewards non-chip, collected once. |
| 9 | EXTEND | `npc_debt_boundaries`: Allow voluntary wallet-funded NPC repayment on each unique completed act boundary and single Cinder Hearing boundary; record actId+obligationId and preserve at least one Lifechip. No idle-time passive payments, no double credits. Creditor death routes funds to named estate, not void. |

## Act II Last Claim character table

Claimant values are baseline probabilities; relationship effects and 5–90% cap from existing rules remain. `service` hard veto is *zero*, not clamped. Endowment 10 from claimant’s actual account, retaining ≥1 chip.

| Rival | Claimant base | Mercy / Debt / Service claim preference | Debtor mercy / debt / service | Debtor priority | Hard veto |
|---|---:|---|---|---|---|
| isolde_morn | 58% | +0.1 / +0.05 / -0.22 | 85% / 65% / 5% | mercy → debt | service |
| ravel_croft | 32% | -0.12 / +0.12 / +0.08 | 65% / 50% / 30% | debt → mercy → service | none |
| vesa_kael | 44% | -0.1 / +0.15 / +0.03 | 72% / 75% / 22% | debt → mercy → service | none |
| witness_arden | 57% | +0.08 / +0.14 / -0.2 | 82% / 80% / 10% | debt → mercy | service |
| livia_shade | 63% | +0.12 / +0.02 / -0.12 | 84% / 65% / 25% | mercy → debt → service | none |
| margrave_noct | 39% | -0.12 / +0.2 / +0.08 | 72% / 58% / 0% | debt → mercy | service |
| aurelia_ash | 69% | +0.14 / +0.05 / -0.18 | 90% / 78% / 8% | mercy → debt → service | none |

## P6 route schedules and extra accounting

| Route | Source | New external reserve | Entry | Tables | Last node |
|---|---|---:|---|---|---|
| Act III | Crown Ledger | 1,280 | Crown Writ | Ashen Coronet 8h 4/8; Table of Seals 8h 4/8; Crown Table 12h 4/8→5/10 | Ledger Unbound or Unchosen Road |
| Undercircuit | Underground Ledger | 102 | Underledger | Underlamp 6h 1/1 | Conditional Writ or Low Lanterns Remain |

New funds are attributed to source-wallet expansion exactly once. P5 saved characters retain their existing balances and identities. Lifechips never come from reputation, relics, magic, or narrative rewards. The finite route cannot be repeated to farm opponents or bonuses.

### Act III rival funding (ledger transfer on first appearance)

| Rival | Wallet | VPIP | PFR | Affinity |
|---|---:|---:|---:|---|
| dame_neris | 165 | 24% | 15% | Thorn/Veil |
| copper_saint | 155 | 31% | 22% | Ember/Thorn |
| master_fen | 145 | 39% | 15% | Mirror/Veil |
| archivist_sorn | 170 | 26% | 18% | Veil/Mirror |
| captain_rusk | 145 | 36% | 25% | Ember/Thorn |
| ledger_regent | 220 | 26% | 20% | Mirror/Thorn |
| the_uncrowned | 190 | 34% | 21% | Ember/Veil |
| Merchant Oran | 90 | – | – | Treasury-backed shop |

**Careful:** ‘Act II 30% death’ in Report #005 is 29.8 percentage points of extra deaths among ALL starting skilled runs (52.1−22.3). It is NOT a conditional mortality rate among Act II entrants; compute that denominator explicitly before tuning.

## Unchanged rules
- No real-money gambling, redeemable chips, hidden hand rigging, chip-damaging combat, extra protected life reserve or second free revival.
- Last Claim remains non-graphic, with no unauthorized free revival. Rare mature contract content remains disabled.
- Existing showdown disclosure, short-all-in reopening, card uniqueness and 3-Aether cap remain.
- Portraits marked `needed` remain needed until actual deliverable PNGs arrive.

## Engineer P6 execution order
1. Fix Whispered Contract and Court of Mirrors; add Act II rewards and seed rare relic.
2. Wire seven named claimant/debtor profiles; retest Last Claim and funding.
3. Implement phase-conditional mortality reporting and multi-seed balance; do not alter AI private knowledge.
4. Add Undercircuit and Act III with external ledger migration, audit and finite encounters.
5. Validate all old/new saves, route graphs, nonrepeatable claims, all poker tests and iPhone UI; integrate portraits only after produced.
