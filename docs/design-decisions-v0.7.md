# THE LAST WAGER — P5 DESIGN DECISIONS v0.7
**Status:** Authoritative creative decisions for Claude to implement, subject to test. This is a proposed change set to v0.6, not a claim that the game already runs these rules. Preserve P0–P4 kernel and save determinism. 19 October 2026.

**Baseline:** 250 runs per policy: skilled 14 victories (5.6%), tight 26 (10.4%), maniac 97 (38.8%), passive 2 (0.8%). The maniac policy is exploiting AI over-folding; fixing that is higher priority than new content. 933 Last Claims, of which 351 were death by refusal (~37.6%), do not yet warrant a global mercy probability change.

## DESIGN CHANGE — bible v0.6 → v0.7 — 01
**What:** AI exploit correction.  
**Rule text:** Preserve No-Limit Hold'em. Estimate shove frequency from public observed actions, with Bayesian-style smoothing to rival personality priors, then compare showdown equity against opponent ranges and real pot odds. Improve decisions against frequent large shoves and effective stack pressure; do not automatically call whenever 10 BB is shoved, give AI hidden data, or set call quotas.  
**Numbers:** Public lookback 24 decisions; prior weight 12 illustrative; compare ≥1,000 runs per policy across 10 seed batches before/after.  
**Invariants touched:** Information firewall, pot accounting, betting legality and strategy.  
**Acceptance test:** No illicit card knowledge; maniac success materially decreases from 38.8% while skilled/tight improve relative to maniac; report CI and policy implementation, not just hard targets.

## DESIGN CHANGE — bible v0.6 → v0.7 — 02
**What:** Bailiff boss calibration.  
**Rule text:** At the conclusion of hand 12 (or last survivor), win if the player has at least 1 Lifechip and either (a) ties for first in final stacks or (b) finishes top two and has earned net table profit >= max(12, ceiling(20% of table-entry stack)). Negative result while alive remains a living exile.  
**Numbers:** Blind schedule unchanged: 2/4 hands 1–6, 3/6 hands 7–12; 12 hands.  
**Invariants touched:** Victory qualification, snapshot idempotency, character survival.  
**Acceptance test:** Validate both success branches, 1-chip survival, multiple ties and inability to alter entry snapshot by reloading.

## DESIGN CHANGE — bible v0.6 → v0.7 — 03
**What:** Last Claim tone and readability.  
**Rule text:** Keep mercy probabilities unchanged in P5. Improve player-facing explanation of what affects willingness, show previous relationship and likely demands, and preview obligations before confirmation; never show raw success chance or grant a free rescue.  
**Numbers:** Existing 5–90% soft clamp and hard veto unchanged.  
**Invariants touched:** Funder ledger, seeded single-roll decision and moral consequence.  
**Acceptance test:** Seeded offer results unchanged from v0.6 for identical state; player understands accept/reject risk.

## DESIGN CHANGE — bible v0.6 → v0.7 — 04
**What:** Evolution token usability.  
**Rule text:** If an unevolved owned spell has Resonance>=1, spend token to evolve it once and reset Resonance. If none qualifies, grant +1 Resonance to one unevolved spell instead; no evolution in that case.  
**Numbers:** One use per token; threshold remains 2.  
**Invariants touched:** Spell instance conservation, permanent choice, hand-phase legality.  
**Acceptance test:** At 0/1/2 Resonance and full relic inventory, a rewarded token always has a usable legal path and cannot be replayed.

## DESIGN CHANGE — bible v0.6 → v0.7 — 05
**What:** Circuit rewards.  
**Rule text:** Seed one nonowned relic using available rarity tiers weighted 60/35/5 common/uncommon/rare; re-normalize when a tier has no entries. Alternatively give one evolution token. With five relic slots allow replacement of one existing relic, losing it with no chip refund. If all relics owned offer token.  
**Numbers:** 5 relic slots, 1 reward per Circuit completion.  
**Invariants touched:** Seeded offers, no duplication, no chip mint and inventory.  
**Acceptance test:** Full slots, all owned, empty eligible evolution list and save/reload all have a defined unique reward outcome.

## DESIGN CHANGE — bible v0.6 → v0.7 — 06
**What:** Duty event and creditor reputation interpretations.  
**Rule text:** Approve same-hand later betting decision, two nonfolded showdown hands, fold facing current BB wager, Coal Table qualifying as contract, and creditor-only Favor rewards. Credit for exactly one duty per qualifying event ID.  
**Numbers:** All existing duty counts and Favor values unchanged.  
**Invariants touched:** Unique event IDs, service contract, debt table accounting.  
**Acceptance test:** Event replay cannot complete a second duty; completion of Coal Table advances contract-eligible duties.

## DESIGN CHANGE — bible v0.6 → v0.7 — 07
**What:** NPC debt continuation.  
**Rule text:** NPC debts remain active after tables. In addition to standard repayments after positive-net qualifying games, an NPC can voluntarily pay from its actual wallet exactly once per completed act boundary, min(outstanding balance, floor(0.15*max(0,wallet-1))). There is no automatic earning or generation of chips. A debt only becomes overdue after 4 actually qualifying completed tables, never merely because the character was offscreen.  
**Numbers:** Voluntary repayment 15% of expendable wallet, floor; at most one per act boundary.  
**Invariants touched:** World ledger, debt persistence, one-chip safeguard, migration.  
**Acceptance test:** No wallet-negative, no double processing and visible debt journal even if debtor does not reappear.

## DESIGN CHANGE — bible v0.6 → v0.7 — 08
**What:** Rival magic and Twin Oracle.  
**Rule text:** Bailiff Sable replaces exactly one Briar Lock with Quiet Briars; total Spellbook remains eight. Twin Oracle targets one when only one is eligible; automatically both when exactly two; when three or more, choose two (AI selection may use only legal observations).  
**Numbers:** One evolved spell for boss.  
**Invariants touched:** Information fairness, casting cost/timing, Spellbook conservation.  
**Acceptance test:** Verify auto targets for 1/2 and selection for 3, hidden information only to caster, standard cooldown and replay.

## DESIGN CHANGE — bible v0.6 → v0.7 — 09
**What:** Act II, The Gilded Circuit.  
**Rule text:** The act follows existing P4 outcomes, preserving stacks, magic, NPC deaths and obligations. It adds two 10-hand contract tables, a merchant, a route choice and a 12-hand boss. No defeated P4 NPC silently returns.  
**Numbers:** Two 10-hand contracts at 2/4; boss 12 hands at 3/6 then 4/8; seven new named NPCs with explicit initial source balances, one merchant.  
**Invariants touched:** Expanded accounting perimeter, seeded scene progression and save versioning.  
**Acceptance test:** Any Act I winning/living exile save migrates exactly once, old totals remain auditable, actor wallet imports have equal external debits, and player gains 0 chips at transition.

## DESIGN CHANGE — bible v0.6 → v0.7 — 10
**What:** Cinder recovery continuation.  
**Rule text:** After Audience of the Bound, visit Broker Understairs, play a six-hand Ember Steps contract, and hold Oathbreaker Hearing. No additional free rescue. If free, access Gilded Gate; if bound, enter the Undercircuit with active obligations. Merchants buying an item pay from real wallets.  
**Numbers:** Broker optional one relic at floor(50% of its documented shop value), backed by funded buyer wallet; 6-hand table at 1/2, real saved rival wallets or explicitly imported substitutes.  
**Invariants touched:** Lifechip ledger, patron contract continuation, NPC death continuity, debt+Favor once.  
**Acceptance test:** P3-import Fallen character can finish existing P4 route and P5 extension, cannot repeat endowment or merchant payment, and saves all statuses.

## DESIGN CHANGE — bible v0.6 → v0.7 — 11
**What:** Act II imported Lifechip accounting.  
**Rule text:** P4's 1,009 Lifechips are conserved in its original local ledger. Introducing Act II visitors with balances requires a formal boundary expansion: create an explicitly auditable external-ledger funding source and transfer pre-existing funds into new named local wallets once. Never label freshly instantiated balances as prizes, duplicate old NPCs, or imply poker created the funds. On legacy saves, persist a unique world migration key, source and destination journal entries and expanded accounting total.  
**Numbers:** Entrants and starting stacks in `p5-act2-route.json`; imported amounts equal recipients' starting wallets.  
**Invariants touched:** World conservation across versions, idempotent migration, funding provenance.  
**Acceptance test:** `old local total 1009` remains true before ingress; after ingress, (all tracked local+external holdings) is identical to the initialized expanded perimeter before and after transfers; one migration event only.

## DESIGN CHANGE — bible v0.6 → v0.7 — 12
**What:** Painted portrait pipeline.  
**Rule text:** Keep the current symmetric playing-card back; commission seven cohesive 512×512 RGBA independent character busts for Adjudicator, Mara, Eldric, Bailiff, Rill, Night Clerk and Dock Runner. Integrate only after 64px review. Never mark an uncreated file integrated.  
**Numbers:** 7 images, 512×512 RGBA, neutral transparent backgrounds.  
**Invariants touched:** Visual identity, pixel dimensions, manifest truthfulness.  
**Acceptance test:** Alpha and size check, independently distinctive at 64px, lighting matches prior cast, screenshot review at phone viewport.

## HANDOFF IMPLEMENTATION ORDER
1. Freeze a regression baseline. Fix shove-exploitable AI, then measure policies again on comparable seeds (do not 'fix' by secretly raising bot equity).
2. Apply boss objective, P4 reward consistency and NPC debt handling; preserve original P0–P4 tests.
3. Add v0.7 save migration and external actor ingress with audited funding.
4. Build P5 Fallen route and Act II map. Use named actor wallets without resetting P4 dead characters.
5. Test end-to-end survival, repeatable replay, mobile performance and portrait placeholders. Integrate painted assets only after a validated delivery.
