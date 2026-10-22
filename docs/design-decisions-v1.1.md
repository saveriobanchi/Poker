# THE LAST WAGER — P9 Design Handoff (v1.1)

**Date:** 2026-10-22  
**Role:** ChatGPT: game/visual director; Claude: engineering.  
**Baseline:** P8 implemented on `saveriobanchi/Poker`, branch `claude/last-wager-design-x2bds3`, commit `dcc0b48760aac48f22cacae0b64ca4f86fca5f47` (2026-10-21).  
**Status:** Creative instructions only. P9 is not coded or playtested. No art files falsely marked delivered.

## Read-first findings from current GitHub

- `docs/briefs/008-report-for-chatgpt.md` confirms P8 is implemented, 197 passing automated tests, 123,126 full-table paired branches, 0 mismatched continuations and baseline unchanged on matched seeds.
- `docs/reports/paired-policies-p8.json`: skilled clear 11.35%; selective mixed-aggressive 13.15% with higher mortality 72.6% vs skilled 66.1%; maniac 1.65%. On novel seeds skilled 10.1%, mixed-aggressive 12.4%.
- `docs/reports/table-ev-p8.json`: for skilled downstream, all end-of-table spell net-difference 95% intervals include zero. Mixed-aggressive Cinder Challenge +0.64 chips/decision (CI +0.04 to +1.26). Minor spell branches are undersampled; cannot conclude they are weak from these results.
- `docs/briefs/008/se-turn.jpg`: actionable buttons remain 40px on SE, with a dense vertical layout; main card/pot information legible. `portrait-64-proof.png` confirms seven production portraits absent. `docs/playtest-protocol-p8.md` provides private local logs with `?playtest=1`; no real human sessions yet.

## P9 mandate — First-person quality & visual completion

1. Keep existing No-limit Hold'em, Last Claim, accounts, deterministic replay, save migration, route, and Act III balance unchanged in production.
2. Prepare and validate the seven overdue painted source portraits **as independently created files**, and the two cosmetic backs if time allows. Never replace correct art with unreviewed placeholders. Existing saved artwork remains valid.
3. Run 5–8 moderated real-phone naïve playtests with informed participant agreement. Instrumentation is on-device and exportable; no claims of human results without actual humans. Engineer may prepare analysis, cannot substitute simulations for participants.
4. Fix the top three serious reproducible usability blockers after real sessions. Before that, only fixes supported by screenshots/automated checks, with regressions.
5. Run OFFLINE isolated Aether experiments and stratified EV studies to assess Cinder and rarely chosen evolutions; **do not rebalance live game solely from speculative effect sizes**.
6. Provide a P9 completion report with screenshots, exact manifest status, player feedback attribution, metrics and known limitations. No Act IV, chip injection or gameplay monetization.

## Approvals / questions from P8

| Topic | Decision |
|---|---|
| Background unlocking | ACCEPT existing ending-linked unlocks; no power inherited. |
| One prose variant per run | ACCEPT seed parity; add a deterministic test that cosmetic seed reads do not advance game RNG. |
| Mixed-aggressive research agent | ACCEPT; keep strictly offline; not an enemy template or human difficulty proxy. |
| Cinder skip-arm | ACCEPT **for enchantment isolation** (same legal raise in both arms); report that estimand separately from ordinary cast-vs-skip behavior. |
| SE 40px controls | TEMPORARY EXCEPTION; test optional compact bottom-sheet/drawer to reach 44px without clipping board, then verify real devices. Don't blindly shrink table. |
| Aether economy | NO default production change at P9 start. Compare baseline with isolated variants, and gate implementation on measured benefit and UX findings. |
| Four minor evolutions | Targeted study in parallel with playtest setup; do not rebalance from 55–508 samples. |
| Current Act III difficulty | FREEZE; P8 novel seeds confirm ~27.9% mortality on entry, consistent with baseline. |
| Portrait paths | KEEP previous manifest exactly, 512x512 RGBA source and 64px crop gate. |

## DESIGN CHANGE — bible v1.0 → v1.1 — 01
**What:** P9 quality gate and balance freeze.  
**Rule text:** Preserve all tested poker and life rules for production. P9 focuses on evidence-based presentation fixes, portraits, and offline experiments; no new Act IV.  
**Numbers:** 197-test P8 baseline; 0 allowed chip/card/Aether/ingress violations.  
**Invariants touched:** Rule integrity, save migration, AI privacy, chip ledger.  
**Acceptance test:** Existing tests pass; matched-seed P8 sample outcomes unchanged until an expressly accepted change.

## DESIGN CHANGE — bible v1.0 → v1.1 — 02
**What:** Real participant UX verification.  
**Rule text:** Use `?playtest=1` for 5–8 naïve real-phone sessions, at least two narrow-screen sessions, participants free to stop; collect local opt-in logs and observation notes without secret cards/personal identifiers. Distinguish automated screenshots from real-device findings.  
**Numbers:** 5–8 sessions; checkpoint questions at 15 and 45 minutes when the player continues that long.  
**Invariants touched:** User privacy, accessibility, fair betting, informed Last Claim choices.  
**Acceptance test:** Each session's consent/notes/log export validated; summary names denominator and any early exits; no synthetic human findings.

## DESIGN CHANGE — bible v1.0 → v1.1 — 03
**What:** Evidence-first blocker triage.  
**Rule text:** Classify failures by severity, frequency, reproducibility and irreversibility. Fix actual unintentional folds/all-ins and inaccessible decisions before aesthetic complaints. Keep user confirmation for irreversible actions.  
**Numbers:** Three highest-severity reproducible blockers; target 44px touch controls on supported devices, with SE 40px recorded exception until solved.  
**Invariants touched:** Betting legality, accessibility, persistence.  
**Acceptance test:** Before/after reproduction and screenshots at 390×844 and 320×568, no horizontal overflow, no hidden legal action.

## DESIGN CHANGE — bible v1.0 → v1.1 — 04
**What:** Controlled Ember-family experiment.  
**Rule text:** Compare baseline to two separately toggled research-only Aether variants (no production rule change). One allows a single overflow Aether from Cinder's settled reward to be stored until next hand, the other provides one next-hand Ember-family spell discount on successful qualifying resolution. No variant may create Lifechips or increase casts.  
**Numbers:** Aether 0–3, Ember overflow reserve 0–1, one discount/token 0–1. No stacking variants.  
**Invariants touched:** Aether accounting, reward order, one-cast rule, save/replay, AI parity.  
**Acceptance test:** Identical initial states with independently seeded arms, clustered intervals over source runs, match total table economics. Disable flag -> exact P8 behavior.

## DESIGN CHANGE — bible v1.0 → v1.1 — 05
**What:** Rare-branch strategic sampling.  
**Rule text:** Generate legally reached source states with deliberately seeded evolution paths, not forced illegal spells. Independently study Quiet Briars, Ravenous Eye, Second Reflection and Marked Fate at table and phase horizons, each versus its base family in equivalent legal situations; state selection biases explicitly.  
**Numbers:** 2,000 target legal cast comparisons per branch when reachable, minimum 100 independent source runs, 20 seed batches if practical. If below target, label undersampled.  
**Invariants touched:** Spell availability, card uniqueness, causal interpretation, RNG reproducibility.  
**Acceptance test:** All branch pairs start legal; no incompatible continuation; reports show independent-run counts, cluster CIs and comparability limits.

## DESIGN CHANGE — bible v1.0 → v1.1 — 06
**What:** Portrait-led art completion.  
**Rule text:** Each of seven manifest portraits is individually illustrated as an original independent bust with alpha background matching Gilded Eclipse. Keep source naming from v6. Do not mark integrated before source and 64px + engine mobile proof.  
**Numbers:** Seven 512×512 RGBA; runtime 256×256 WebP as existing packer; visible at 64px.  
**Invariants touched:** Manifest provenance, visual readability, performance and licensing.  
**Acceptance test:** Source exists, image gate passes, looks distinct and painterly at 512/64px, and survives packed on 320px and 390px screens. Mark `delivered` then `integrated` only after checks.

## DESIGN CHANGE — bible v1.0 → v1.1 — 07
**What:** Optional card-back cosmetics.  
**Rule text:** Cinder Etching and Crown Filigree become selectable only with real source art meeting the same transparent silhouette, 180° symmetry and contrast criteria. Unavailable art remains explicitly art pending.  
**Numbers:** Two 300×420 RGBA sources, 180° exact equality, alpha mask identical to standard.  
**Invariants touched:** Deck information fairness, save and visual accessibility.  
**Acceptance test:** `scripts/check-art.py` verifies both before use; same seed/card identity under all backs.

## DESIGN CHANGE — bible v1.0 → v1.1 — 08
**What:** Mobile table visual hierarchy.  
**Rule text:** Lifechips, pot, amount to call, action buttons and active spell timing have visual priority over decorative effects. The top title may collapse but must have a readable expanded route. Disabled spells convey *why* they cannot currently be cast. Keep reduced-motion equivalence.  
**Numbers:** Tested at 320×568 and 390×844; 44px target; time/amount labels remain readable.  
**Invariants touched:** Poker information accuracy, accessibility, no additional AI information.  
**Acceptance test:** No clipping of legal actions or current costs, special-case small screens and landscape, touch-safe prompts before final-chip commitment.

## DESIGN CHANGE — bible v1.0 → v1.1 — 09
**What:** P9 evidence standards and release gate.  
**Rule text:** The engineer's P9 report must distinguish automated tests, simulated policies, offline A/B studies, real-device QA and real human reactions. No release-ready claim without finished art, verified real-phone input and review of priority defects.  
**Numbers:** Full original test suite + explicit P9 acceptance tests; zero accounting violations.  
**Invariants touched:** Trustworthy reporting, reproducibility, versioned inputs.  
**Acceptance test:** P9 report contains all required evidence or clearly marks outstanding blockers; no P10 inferred until sign-off.

## Non-negotiable constraints

- No direct magical chip addition, HP bars, real-money wagering or pay-to-win meta bonuses.
- No player death except existing Last Claim resolution; no extra revival or hidden bailout.
- No new cast-per-hand allowance or revised poker evaluator during P9.
- No fake human playtest observations; human studies remain pending until the director supplies data.
- Any experimental Aether variant must use seeded legal state transitions and be off in shipping code.
