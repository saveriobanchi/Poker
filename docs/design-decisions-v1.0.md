# THE LAST WAGER — P8 / Design Bible v0.9 → v1.0

**Status:** Creative specification; NOT implemented or gameplay-verified. 21 October 2026. Preserve P0–P7 poker kernel, audited Lifechip economy, save formats and finite route graph. No real-money wagering. No new fourth act in P8.

## Signoff on P7
183 passing automated tests and the reported 2,580,260 invariant checks are encouraging; human enjoyment is NOT validated by simulation. Approve 27.5% conditional Act III entrant mortality as P8 reference point, without adjusting blinds, claims or cards solely to match a number. Full clear skilled 11.35% vs tight 4.85%, maniac 1.65%, passive 0%. Preserve tests.

## DESIGN CHANGE — bible v0.9 → v1.0 — 01
**What:** Long-horizon spell evaluation.
**Rule text:** From a legally reached, persistable pre-cast state, compare one branch that casts a legal spell and one branch that declines it (or performs the same raise without Cinder). Carry both through the same table under matched policy randomness, maintaining opponent observation rules. Pair on initial state, preserve independent deterministic branch RNG, document whenever downstream events diverge. Compare end-of-table net Lifechips, survival, table clearance, Aether and spell use. Include the hand-level baseline for context, not additive with the full-table result. Never credit a spell with influence after the relevant table if no modeled continuation exists.
**Numbers:** Target ≥5,000 paired table continuations each for Cinder Challenge, Briar Lock, Unmask and Fate Exchange; ≥2,000 for each eligible first-tier evolution as feasible, otherwise report undersampling. At least 10 independent batches. Bootstrap pairs by run/seed cluster, not treating correlated hands as independent.
**Invariants touched:** Exact replay, 52-card uniqueness, Lifechip/Aether conservation, private information, legal casts.
**Acceptance test:** Every branch maintains all invariants; measured differences have uncertainty intervals and sample sizes; across-state duplicate sampling is reported; unchanged source state produces identical replay.

## DESIGN CHANGE — bible v0.9 → v1.0 — 02
**What:** Strategic policy evaluation.
**Rule text:** Add a separate mixed-aggressive policy with selective value bets, semi-bluffs and non-shove pressure, distinct from a reckless all-in policy. Analyze policy-specific spell benefits rather than targeting universal positive EV.
**Numbers:** ≥2,000 seeded runs per policy for final comparative balance; existing four policies plus mixed-aggressive; fixed seed batch matching, with phase-specific entrant denominators.
**Invariants touched:** AI information restrictions, policy randomness, simulation comparability.
**Acceptance test:** Never consult secret rivals' hands; no aggressive action outside legal bet sizes; no threshold tuning on one seed batch.

## DESIGN CHANGE — bible v0.9 → v1.0 — 03
**What:** Final-act difficulty freeze.
**Rule text:** Keep current Act III blind schedule, payout and Last Claim rules until human playtests provide evidence for specific pain points. Highlight risk with clear pre-table readouts; difficulty may not come from hidden rule exceptions.
**Numbers:** Current skilled conditional Act III mortality 27.5% (P7 CI 24.8–30.3%); reference band 20–35%; skilled final clear 11.35% is observational, not guaranteed.
**Invariants touched:** Economic/bet rules, route saves, data analysis.
**Acceptance test:** Regression matching P7 seed sample plus novel seeds; any rebalance proposal must state player-facing benefit and statistical change.

## DESIGN CHANGE — bible v0.9 → v1.0 — 04
**What:** World Testament legacy unlocks without permanent wealth power.
**Rule text:** World Testament unlocks up to four new character backgrounds, two finite narrative encounter variants and three cosmetic backs. These are presentation and story variants; createRun receives the same starting 100 Lifechips, beginner Spellbook, RNG and poker configuration regardless of unlocks. The standard background is always available. Background choice is stored in a separate cosmetic/narrative layer and must not alter poker draw, AI range or reward odds.
**Numbers:** Four total backgrounds incl. Unmarked; two optional encounter text variants; three cosmetics incl. Standard (so two unlockable); exactly one event variant max per run, no extra poker table or free chips.
**Invariants touched:** No pay-to-win legacy, deterministic seed, live run independence, player privacy.
**Acceptance test:** Same seed and scripted actions with any background have identical chip trajectory, hole cards, opponents, magical offers and legal states; legacy archive is append-once by character ID.

## DESIGN CHANGE — bible v0.9 → v1.0 — 05
**What:** Card-back cosmetic fairness.
**Rule text:** Alternate cosmetics affect the appearance of every facedown poker card at the table, not one special seat, and must obey 180-degree exact rotation symmetry, shared alpha silhouette and contrast/accessibility checks. The Standard pack remains unchanged; cosmetics cannot affect card identity or orientation.
**Numbers:** All back sources 300×420 RGBA with identical rounded alpha silhouette; exact 180° equality check.
**Invariants touched:** Information fairness, poker readability, assets and save compatibility.
**Acceptance test:** Exact RGBA rotational equality and identical alpha masks; replay outcomes byte-identical across cosmetic choices.

## DESIGN CHANGE — bible v0.9 → v1.0 — 06
**What:** Dossier shove definition consistency.
**Rule text:** Public dossier actions retain fold/check/call/raise/all-in raw event types, and derive LARGE_SHOVE by calling the *same predicate* used by the P5 AI large-shove observation model, with a denominator fixed to the player's starting stack for the hand. Do not create a second definition based on a changing at-action stack. Preserve whatever precise amount measure (bet, raise or committed total) the currently tested P5 model actually uses, and document it in one shared helper. A short-stack all-in below the threshold is still ALL_IN but not LARGE_SHOVE.
**Numbers:** threshold 0.50 of start-of-hand stack using the existing AI helper; history window at most 24 relevant preflop decisions for AI model; dossier up to 12 archived public hands plus personally witnessed hands clearly separated.
**Invariants touched:** Public data provenance, privacy, behavior estimation.
**Acceptance test:** An identical hand-history record yields the same classification in the dossier and AI estimator using one common predicate; only public recorded actions are used.

## DESIGN CHANGE — bible v0.9 → v1.0 — 07
**What:** Whisper and Sigil interactions.
**Rule text:** Preserve named-spell (not UUID) Whisper disclosure from run-seeded, persisted event; it does not imply future casting. Fateweaver's Sigil 'Keep — consumes Sigil for this table' spends activation but must not alter the Spellbook or draw RNG. Keep existing costs and no extra spell cast.
**Numbers:** One Sigil activation/table, one Whisper disclosure/event.
**Invariants touched:** Private hand, spell instance uniqueness, deterministic replay.
**Acceptance test:** Zero extra RNG for Keep; save/reload cannot reopen event; information stays within lawful public bounds.

## DESIGN CHANGE — bible v0.9 → v1.0 — 08
**What:** Cinder Pass petition routing.
**Rule text:** Consume a Pass on the first otherwise valid Crown Writ or Petition of Cinders Favor fee; no retroactive refund; never bypass Underlamp qualification, unpaid obligations or visit restrictions. If a previous eligible fee was already paid, preserve its finality rather than charging twice.
**Numbers:** One pass per run, at most one Favor waived, fee per run at most once.
**Invariants touched:** Petition idempotency, social rank, route finiteness.
**Acceptance test:** Exhaust state combinations for pass/fee already paid, invalid writ eligibility, and returning to Writ; no unlimited re-entry.

## DESIGN CHANGE — bible v0.9 → v1.0 — 09
**What:** Living narrative endings and legacy.
**Rule text:** Preserve current endings and unique choices. Reform/Claim, Retire/Continue, Honor contract/Seek release are epilogue/allegiance consequences for *future* stories, not a second current character run or instant material reward. Store testament in independent archive; new run can display a predecessor sentence without reading gameplay bonuses or altering the deal seed.
**Numbers:** One testament per unique character ID, one final fate selection; no additional chip grant.
**Invariants touched:** Archived history, permanent death, no save duplication.
**Acceptance test:** End an old run, start new same seed and verify untouched initial state; repeated ending commits do not produce new testament IDs.

## DESIGN CHANGE — bible v0.9 → v1.0 — 10
**What:** Merchants and readability.
**Rule text:** Approve existing merchant personalities subject to editorial polish. Every sale and buyback shows the exact transfer, current stack and chips remaining. Maintain distinct dialog voices without modifying prices, treasury, covenant obligations or Last Claim authority.
**Numbers:** Preserve all existing prices and wallets; 44px touch targets when feasible, high-contrast chip numerals.
**Invariants touched:** Shop transaction clarity, save and world ledger.
**Acceptance test:** Human tester can identify chip cost, reserve after purchase and creditor of payment; no narrative side-effect grants currency.

## DESIGN CHANGE — bible v0.9 → v1.0 — 11
**What:** Human-first mobile research.
**Rule text:** Run moderated naive-player usability sessions before any large feature expansion. Observe onboarding, real Hold'em understanding, chip-as-life distinction, spell opportunities and irreversible Last Claim. Don't rebalance due only to a few subjective scores.
**Numbers:** 5–8 testers; 15-min and 45-min feedback; 320×568 and 390×844 viewports; measure first legal action, action mistakes, comprehension and interruptions/reload.
**Invariants touched:** Player accessibility, trust and usability; no kernel changes.
**Acceptance test:** Signed off qualitative findings and reproducible high-priority UI defects; fix top 3 severe usability blockers before P9.

## DESIGN CHANGE — bible v0.9 → v1.0 — 12
**What:** Visual assets and honest provenance.
**Rule text:** Preserve 'Gilded Eclipse' painterly art bible. Existing seven required portraits remain status=needed until actual independently rendered 512×512 PNGs are delivered and inspected, and status=integrated only after mobile pack/crop verification. Do not silently substitute gold monograms with generic procedural or mismatched portraits. Wagerer independent portrait remains an additional later requirement.
**Numbers:** Seven 512×512 RGBA sources under unchanged manifest filenames; 64px circle verification. No new card face work in this milestone.
**Invariants touched:** Visual consistency, build artifact reproducibility, manifest truth.
**Acceptance test:** Every source has 512×512 dimensions, transparent exterior, distinct bust framing, readable 64px crop, and successful in-engine screenshot before integration status update.

## Explicit approvals from Report #007
- Keep the existing seven P7 Act III claim temperaments EXACTLY as implemented in `src/game/run/data/p7-act3-temperaments.json`; P8 does not revise them.
- Merchant personalities are also mechanically unchanged.
- The living epilogues and one-use Pass rules are approved.

## P8 sequencing to Claude
1. Amend dossier large-shove threshold and regression tests; lock P7 save compatibility.
2. Implement World Testament visual/background/cosmetic layer with zero gameplay advantage; don't change createRun's deterministic core.
3. Add mixed-aggressive policy and run paired table-value research (Cinder first; then Briar/Unmask/Fate).
4. Review outcome tables and avoid sweeping balance changes without user-playtesting evidence.
5. Integrate seven portraits ONLY once real images exist; preserve interim gold monograms.
6. Run human QA or prepare one-button instrumentation for director-led sessions; compile concise P8 report.

## Required P8 report
- Tests passing; chip conservation; replay and save migration.
- Decision-by-decision before/after delta in matched tables, confidence intervals clustered by seed/run.
- Mixed-aggressive policy full-run results.
- Legacy selection comparison proving no bankroll/poker difference.
- Screenshots at 390×844 and 320×568 and 64px portrait proof.
- Naive-player usability notes from genuine testers or explicitly 'not conducted'.
