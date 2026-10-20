# THE LAST WAGER — DESIGN DECISIONS v0.9 / P7 HANDOFF

**Status:** Creative design specification; P7 engineering implementation and balance validation pending. **Branch/reference:** saveriobanchi/Poker, current Claude project. Supersedes v0.8 only where stated.

## Approval and design intent

P6 progression is complete. Preserve the real No-Limit Hold’em kernel, deterministic world ledger, actual Lifechip death law, all prior saved decisions and finite one-time table rules. P7 priorities: (1) closure of narrative and acceptance details; (2) personalities; (3) causal magic balance measurements; (4) visual delivery and mobile playtesting; (5) no endless Act IV content creep.

## DESIGN CHANGE — bible v0.8 → v0.9 — 01
**What:** Fateweaver Sigil pass semantics.
**Rule text:** Keeping the original three-spell draw remains a valid explicit decision and consumes this table’s Sigil activation. Show “Keep — consumes Sigil for this table” before confirmation. No replacement card is sampled on Keep. The Sigil cannot be reopened this table.
**Numbers:** One activation per table; zero extra casts; zero change to the poker deck.
**Invariants touched:** Spell count, deterministic RNG, no free repeat selection.
**Acceptance test:** Keep costs the table activation, consumes no draw RNG, and reload cannot reopen. Swap moves exactly one spell and draws one legal replacement.

## DESIGN CHANGE — bible v0.8 → v0.9 — 02
**What:** Archival opponent dossiers.
**Rule text:** Court and Silver Archive dossiers contain only archived public actions from deterministic legal simulation of the named NPC against peers. Precompute and persist the dossier seed before the player makes a choice. Distinguish “archived sample” from the player’s personally witnessed hands. Do not synthesize nominal hand frequencies without an actual action log.
**Numbers:** Up to 12 archived public preflop hands per dossier; show n alongside VPIP/PFR/shove frequency.
**Invariants touched:** AI privacy, public information, reproducible archival provenance.
**Acceptance test:** All shown figures recompute from stored legal public action records; no hole cards or future board cards are exposed.

## DESIGN CHANGE — bible v0.8 → v0.9 — 03
**What:** Whisper spell disclosure.
**Rule text:** The first Arena hand publicly names one seeded spell ID in the player’s drawn spellhand; not the instance UUID, not a hole card and not a promise that the spell will be cast.
**Numbers:** One disclosure only; +1 Notoriety and prior +1 Resonance/Aether fallback unchanged.
**Invariants touched:** Spellhand privacy, seeded once-only events.
**Acceptance test:** No duplicated reveal, no leaked poker card and no inconsistent disclosure after save/restore.

## DESIGN CHANGE — bible v0.8 → v0.9 — 04
**What:** Cinder Pass.
**Rule text:** Earning the Cinder Pass from a top-two Ember Steps finish grants a single-use waiver of the 1-Favor Crown Writ petition fee once the player is otherwise eligible. Does not grant entry to the Writ without the applicable route requirements; does not erase obligations, grant Lifechips, permit table replays or bypass a required Underlamp qualification. If a fee was already paid, do not refund it.
**Numbers:** One per run; maximum 1 Favor saved; consumed atomically when used.
**Invariants touched:** Reputation, writ eligibility, one-time reward.
**Acceptance test:** Pass is not reusable; does not bypass bound-status conditions; redemption and reload produce the same Favor.

## DESIGN CHANGE — bible v0.8 → v0.9 — 05
**What:** Crown Writ return and fee idempotency.
**Rule text:** A Crown Writ fee is charged no more than once per run. Eligibility is checked at each arrival, and previously played tables remain permanently exhausted. A second arrival after Undercircuit can continue only to as-yet-unplayed content.
**Numbers:** Maximum one Favor petition fee; Favor floor −3.
**Invariants touched:** Finite graph, unique transition ids, social accounting.
**Acceptance test:** Any cycle through Writ refuses paid replay and cannot repeatedly charge Favor.

## DESIGN CHANGE — bible v0.8 → v0.9 — 06
**What:** Alternative path past Act II.
**Rule text:** A bound Fallen character may earn a conditional writ through the Undercircuit without replaying Act II. This is a legitimate difficult alternative, not automatic progression. Require Underlamp top-two, not-overdue obligations and retained binding public notice. No bonuses or retroactive Act II rewards.
**Numbers:** Underlamp 6 hands; top-two; 1/1 blinds; one conditional writ.
**Invariants touched:** Branch reachability, contract preservation, chip economy.
**Acceptance test:** Bound character cannot enter via mere Cinder Pass; an earned writ retains obligations and existing chip balances.

## DESIGN CHANGE — bible v0.8 → v0.9 — 07
**What:** Fall during Act III.
**Rule text:** A survivor rescued during Act III follows Fallen and, if eligible, Undercircuit content without replaying prior Crown tables. On becoming free, they receive the living epilogue The Unchosen Road. While bound, they may conclude at The Low Lanterns Remain. Persist actual debts, chips and achievements.
**Numbers:** At most one successful survival covenant per run; no Crown table re-entry.
**Invariants touched:** No replay, last-chip law, ending integrity.
**Acceptance test:** Fall during any Act III node never resets a table or rescues twice and always resolves into an eligible ending/death.

## DESIGN CHANGE — bible v0.8 → v0.9 — 08
**What:** Low-stack threshold.
**Rule text:** Keep the existing pre-Coronet safety offer for stacks strictly below 24 Lifechips. The offer sends an eligible player to the one-time Undercircuit route; it is optional, not chip protection. Once Undercircuit is used, display the risk but do not offer a replay.
**Numbers:** Trigger 1–23 Lifechips; starting Crown big blind 8.
**Invariants touched:** Actionable information, finite route, no artificial bankroll floor.
**Acceptance test:** At 23 show option, at 24 do not; at second arrival route is closed and no chips are created.

## DESIGN CHANGE — bible v0.8 → v0.9 — 09
**What:** Act III personalities.
**Rule text:** Replace generic “other” Last Claim behavior for all seven named Act III rivals with explicit claimant rates, preferences, debtor rates, priority and veto data in p7-act3-temperaments.json. Merchants get authored social temperament but are never Last Claim claimants unless genuinely seated and funded in a later expansion.
**Numbers:** Seven rivals; each endowment 10 actual chips; clamp non-veto rates to [0.05,0.90].
**Invariants touched:** NPC autonomy, seeded claim, wallet debit, one-counteroffer limit.
**Acceptance test:** Every profile negotiates deterministically using one persisted roll and never accepts a vetoed pact.

## DESIGN CHANGE — bible v0.8 → v0.9 — 10
**What:** Ledger Regent evolving magic.
**Rule text:** Replace exactly one Fate Exchange copy in the Regent’s legal eight-card Spellbook with Second Reflection. This is the sole evolved spell in their P7 boss deck; no relic and no extra cast. Preserve exact casting cost and private selection as already defined for that evolution.
**Numbers:** Eight total spell instances; one Second Reflection, cost 3 Aether.
**Invariants touched:** Private information, spell-instance conservation, AI magic legality.
**Acceptance test:** Regent still casts only one spell per hand, never sees player-private information, never duplicates a card.

## DESIGN CHANGE — bible v0.8 → v0.9 — 11
**What:** Table of Seals rewards.
**Rule text:** Approve the single evolution token reward. If a spell has 1 Resonance, evolve exactly one instance; otherwise the existing +1 Resonance fallback applies to a legal unevolved instance. If all owned spells are evolved or capped, offer “Decline” without an extra chip reward; report no valid target.
**Numbers:** One reward per success; evolution requires Resonance ≥1.
**Invariants touched:** Inventory conservation, event idempotency, no chip rewards.
**Acceptance test:** Cannot dupe token with save/load; hard-cap one branch per spell instance.

## DESIGN CHANGE — bible v0.8 → v0.9 — 12
**What:** Rarity-weighted merchant stocks and UI polish.
**Rule text:** Approve 60/35/5 rarity-weighted stock for all *freshly opened* shops. Existing saved stock must remain byte-for-byte stable. Seeded distinct offers and nonowned rules remain. Track scarcity and show owned/replaced warnings.
**Numbers:** 60% common / 35% uncommon / 5% rare before unavailable-tier renormalization.
**Invariants touched:** Shop determinism, migration stability, wallet conservation.
**Acceptance test:** Load an old Selene save to identical offers; new shops sample weights and preserve their stock across reloads.

## Act III Last Claim numbers

| Rival | Claimant base | Mercy pref | Debt pref | Service pref | Debtor mercy | Debtor debt | Debtor service | Veto |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| dame_neris | 57% | +10% | +5% | -18% | 85% | 70% | 0% | service |
| copper_saint | 42% | -5% | +15% | +5% | 75% | 80% | 35% | none |
| master_fen | 60% | +8% | +4% | -12% | 78% | 70% | 15% | none |
| archivist_sorn | 49% | -5% | +17% | -20% | 82% | 83% | 0% | service |
| captain_rusk | 33% | -15% | +8% | +12% | 60% | 52% | 25% | none |
| ledger_regent | 24% | -25% | +22% | +12% | 55% | 45% | 0% | service |
| the_uncrowned | 66% | +12% | +5% | -25% | 88% | 72% | 0% | service |

These are *calibration proposals* using the already implemented 5–90% clamp (except hard veto), relationship and financial modifiers, one saved roll and one counteroffer. Endowment is 10 Lifechips, transferred from the actual claimant wallet while leaving it ≥1. No decision silently restores chips.

## Endings and what comes next

**The Ledger Unbound:** an earned final victory; choose **Reform** (pursue liberation within the law) or **Claim** (take charge of the Ledger). Both are explicit narrative world-testament choices recorded permanently. Neither grants real chips, rerolls hands or resurrects the current character.

**The Unchosen Road:** living character archives with chips and contracts intact; opens a written epilogue, not a new unlimited table.

**The Low Lanterns Remain:** living bound/unbound character archives with all obligations and chips intact; can unlock a future *finite* Cinder sequel but there is no new farmable poker node in P7.

**New Run / Legacy:** begins as a new character, with no direct transfer of predecessor inventory or Lifechips. Legacy remembers endings, identities, lore, unlocked backgrounds and cosmetic/campaign variations. Legacy affects available story encounters, not poker odds.

## P7 balance sign-off

- Retain Act III mechanics and blind schedule unchanged initially. P6 skilled mortality of 33.4% conditional on Act III entrants is on target; keep it until human playtesting proves unfair.
- Test skill-aware policies without assuming simulated play is human enjoyment. P6 reports skilled full-clear 11.5% over 2,000 runs, tight 4.7%, maniac 1.7%.
- **Yes** to counterfactual incremental-EV-by-spell measurements; execute paired runs from the *same legally reached state*, with common randomness and privacy intact. See JSON plan.
- Report outcomes by phase entrant and policy, not just percent of all initial runs. Add cast frequency, evolution diversity and independent sample sizes.

## Artistic and mobile priorities

Portrait production is outstanding. Preserve the existing symmetric 300×420 card back and deck. Use `docs/p7-art-production.md` for the seven needed original portraits; do **not** change manifest status to delivered without actual RGBA PNG files. The screenshots in `docs/briefs/006/` could not be visually reviewed from text-only repository access; carry out a phone QA pass.

## Build order for Claude

1. Merge versioned v0.9 decisions, backed by migration/replay tests.
2. Wire Cinder Pass, debt/character profiles, Writ and ending state flags without replaying tables.
3. Add Regent Second Reflection and verify NPC privacy/legality.
4. Run 10,000+ paired spell EV comparisons per frequent spell plus all previous regression tests.
5. Run full seeded multi-policy simulations on matched seeds, with per-act entrants.
6. Integrate independent painted portraits only when delivered; validate 512px and 64px phone view.
7. Conduct human-play UX acceptance for pot odds clarity, legal actions, all-in confirmation, spell discovery, table time and skip/reduce-motion controls.
