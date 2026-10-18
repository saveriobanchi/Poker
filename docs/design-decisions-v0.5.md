# THE LAST WAGER — DESIGN DECISIONS v0.5 / P3 HANDOFF

**Status:** APPROVED FOR IMPLEMENTATION, 18 October 2026. Owner: ChatGPT (creative/rules); engineer: Claude. This file adds to v0.4 and overrides only explicit contradictions. All chips are fictional Lifechips. No real money.

## P2 responses

| Item | Answer | Clarification / test |
|---|---|---|
| Card art dimensions | APPROVE | 300x420 RGBA source for 52 faces and back. Back must be precisely rotationally symmetric, same transparent rounded silhouette as faces. Runtime sprite sheet may be WebP. |
| Fate Exchange tell | APPROVE | `A mirrored card turns face-down.`; caster name printed separately. |
| Cinder caller | MODIFY | A direct call **or legal re-raise** that commits at least the amount of the enchanted raise qualifies as matching the wager, even if the first reply was a raise. Actual bonus is awarded only if the caster wins a contested pot at showdown for which it is eligible, once per cast. No bonus from uncalled raises except the separately printed 1-Aether all-fold effect. Pot eligibility is enforced, especially in side-pot situations. |
| Showdown regeneration | APPROVE | +1 to each nonfolded participant in a genuinely contested showdown, including all-in contributors; none for uncontested folds. Apply before Cinder reward, all capped at 3. |
| Opening windows | APPROVE | Prompt only if seat can act and has at least one legal affordable spell. AI must not gain access to other seats' spellhands through skipping logic. |
| Unmask on all-in | APPROVE | Target may be all-in if not folded, not already fully revealed, and caster has legal own decision timing. Never permit casting after betting is closed and automatic runout begun. |
| Deterministic 52-card deck | APPROVE | Canonical gameplay source style at 300x420; readable deterministic ranks/pips, public-domain Byron Knoll courts. Unique face-card portrait variants are optional P5+, not a blocker. Original A♠ / 7♥ sample assets remain archived as historical direction, not runtime assets. |

## DESIGN CHANGE — bible v0.4 → v0.5 — 01: Card resolution
**What:** 300x420 canonical source assets.
**Rule text:** Faces and back share silhouettes, render at 300x420, are packed into runtime sheet. Back is EXACTLY 180° symmetric, including transparency, to prevent orientation tells.
**Numbers:** 52 faces + 1 back. 300x420; portrait sources 512x512.
**Invariants touched:** Readability, orientation fairness, common silhouettes, atlas mapping.
**Acceptance test:** Dimensions/alpha validate; card-back `array == rotate180(array)` exactly; board and enlarged hole cards remain crisp at iPhone DPR3.

## DESIGN CHANGE — bible v0.4 → v0.5 — 02: P2 settlement corrections
**What:** Spell tells, Cinder qualifying matching, contested-showdown regeneration, eligible opening windows and all-in Unmask targets.
**Rule text:** See P2 responses above; the engine remains otherwise unchanged.
**Numbers:** No cost changes; maximum Aether = 3; +1 showdown; Cinder per-cast maximum one triggered reward.
**Invariants touched:** Aether accounting, side-pot eligibility, actor-only magic knowledge, replay.
**Acceptance test:** Test call, raise, and short all-in against enchanted wager, side-pot wins/losses, no regeneration on uncontested pots, and saved RNG replay.

## DESIGN CHANGE — bible v0.4 → v0.5 — 03: Last Claim state machine
**What:** Gameplay interrupt at final bankruptcy, including AI-vs-AI cases.
**Rule text:** After pot calculation/refunds/awards, identify every seat with zero Lifechips. Freeze new poker actions before the next hand. Resolve Last Claims clockwise from the seat left of the hand's dealer button, using seat order captured at settlement (not moving-button order after eliminations). A bankrupt seat cannot bet, cast, shop or take part in a new hand. The right to negotiate derives from the **pot containing that seat's last committed chips**: sole winner of the contested pot = claimant; split/tied winners = neutral Ledger adjudicator; ambiguity or claimant invalidity = adjudicator. Claim decisions never change the poker award. A claimant must retain >=1 chip after any funding transfer. NPCs eliminated remain out of this table even if funded.
**Numbers:** At most one successful player survival Covenant per run, otherwise later final bankruptcy ends the run. One counteroffer maximum per claim.
**Invariants touched:** Chip conservation, hand settlement finality, claimant identity, active seat list, save/resume, zero-chip state.
**Acceptance test:** Side-pot and multiway bankruptcies select valid claimants; saved pending claim resumes once; two simultaneous claims resolve in captured order without replaying pot settlement; any transfer debits the named funder and credits the recipient equally.

## DESIGN CHANGE — bible v0.4 → v0.5 — 04: Negotiation
**What:** Deterministic, legible life-debt choices.
**Rule text:** Claim begins with a short ledger settlement and claimant identification. Player as debtor can (if available) propose Unbound Mercy, Funded Debt, Sworn Service, or a context-specific Asset/Identity transfer; can also Accept Fate. Player as claimant can Claim Life, Grant Mercy, Demand Debt or Propose Service/Identity transfer. Offers show endowment, payer, obligations, acceptance outlook, and risks **before** confirmation. Claimant may accept, refuse or counter once. No reroll/reopen exploit: persist claimId, proposer/recipient, offer payload, claimant response, and RNG state. If rejected with no counter/secondary patron and no valid funder, death. With split-pots, neutral adjudicator never gains personal service/debt rights: only a separately funded neutral mercy petition, else death.
**Numbers:** One counteroffer; willingness roll drawn once per distinct negotiation resolution using persistent RNG; odds clamped 5–90%, labels by bands.
**Invariants touched:** Determinism, privacy, contract consent/response, transfer rules, adult presentation.
**Acceptance test:** Repeated save/reload cannot improve a rejected offer; unsupported demands do not appear; claimant lacking sufficient chips cannot fund; screen always allows explicit "Accept Fate" confirmation.

### Exact LAST CLAIM flow (player debtor)
1. **Settlement** — `Your final Lifechip has been claimed.` Display actual settled pot, winner, claimant, remaining stack 0.
2. **Claimant's audience** — show portrait, name, social profile, eligible pact categories, and outlook label.
3. **Choose** — `Seek Mercy` (no obligation, hard to win); `Pledge a Debt` (chip repayment); `Swear Service` (3 nonsexual duties); rare `Surrender a Title/Relic` (only where assets are legitimately owned and transferred); `Accept Fate` (confirm death). Mature implied personal-patronage subvariant is disabled by default, only for clearly adult fictional characters, no depictions or coercion presented as consent, never mechanically mandatory.
4. **Review exact price** — endowment and its source, contract, duration, loss of status, total owed and reputation consequences. Confirm.
5. **Claimant response** — accept, refuse or exactly one counteroffer. Player can accept or decline counter; no recursive negotiation.
6. **Resolve** — funded transfer + persistent Fallen record; otherwise non-graphic death and run summary. After all claims, current table ends or continues without eliminated NPC as permitted; a saved Fallen player exits table immediately.

### Exact LAST CLAIM flow (player claimant)
1. Show defeated NPC, pot provenance and chip totals.
2. Choose `Claim Life`, `Grant Mercy`, `Demand Debt`, `Demand Service`, optional eligible `Claim Title/Relic`.
3. Display actual funding requirement; no free resurrection. An NPC can refuse personally unacceptable terms; refusal can lead to one counteroffer or death. Claiming death affects Dread/reputation; funded mercy increases Honor and can alter relationship.
4. Record the outcome immutably; remove NPC from current table. If funded, NPC returns on future route only.

### Willingness labels
| Internal probability after modifiers | Exact player-facing label | Supporting text |
|---|---|---|
| < 0.35 | `LOW` | `They see little reason to spare you.` |
| 0.35 to < 0.65 | `FAIR` | `They may consider a serious bargain.` |
| >= 0.65 | `HIGH` | `They seem inclined to negotiate. Nothing is guaranteed.` |

No raw percent shown to player; underlying model is transparent in tests, not UI.

## DESIGN CHANGE — bible v0.4 → v0.5 — 05: Endowments and temperaments
**What:** Named claimant funding and personality-sensitive willingness.
**Rule text:** An eligible claimant may transfer the fixed endowment from their own actual Lifechips; they must have strictly more than the endowment. A neutral adjudicator is only allowed to fund mercy from an explicitly tracked Ledger relief treasury (not abstract minting). If treasury or claimant cannot cover the transaction, the offer is disabled. An NPC debtor may refuse demands, even if the player offers funding.
**Numbers:** See tables below; all values P3 prototypes to measure in P4.
**Invariants touched:** Chip conservation, rival resources, deterministic AI, claimant eligibility.
**Acceptance test:** Test funder with endowment-1, endowment, endowment+1 and sufficient balance; validate transfer journal and resulting stack status.

### Revival endowments by claimant
| Claimant | Endowment in Lifechips | Funding source |
|---|---:|---|
| Lady Vesper | 10 | Vesper's post-pot stack |
| Sightless Oracle | 12 | Oracle's post-pot stack |
| Sir Corvin | 8 | Corvin's post-pot stack |
| Player when claimant | 10 | Player's post-pot stack |
| Neutral Ledger adjudicator | 10 | Existing, explicitly recorded Ledger relief treasury |
| Other named claimant | 10 | That named character's actual post-pot stack |

The minimum permitted player-funded revival is exactly **10**. For a claimant whose entire post-pot stack is <= endowment, survival by their funding is unavailable; separately identified third-party patronage may be added in P4 with an explicit actual balance.

### AI claimant willingness (base)
| Rival | Base probability to consider an otherwise valid survival bargain | Personality preference |
|---|---:|---|
| Lady Vesper | 0.25 | Service +0.15; debt +0.05; mercy -0.15 |
| Sightless Oracle | 0.50 | Debt +0.15; service -0.10; mercy -0.05 |
| Sir Corvin | 0.70 | Mercy +0.10; debt +0.05; service -0.20 |
| Neutral adjudicator | 0.40 | Mercy only; requires funded relief treasury |
| Other claimant | 0.40 | No preference until characterized |

### Common modifiers for claimants (cumulative, then clamp to [0.05, 0.90])
| Factor | Modifier |
|---|---:|
| Strong friendly history / ally | +0.10 |
| Claimant previously spared by debtor | +0.15 |
| Hostile relationship / severe grudge | -0.15 |
| Debtor betrayed claimant | -0.25 |
| Debtor Honor >= +2 | +0.10 |
| Debtor Dread >= +2 and claimant is Corvin | -0.10 |
| Claimant retains at least 30 Lifechips after funding | +0.05 |
| Claimant retains fewer than 10 after funding (but >=1) | -0.10 |

Modifiers are NOT rolled at proposal time and are not exposed in exact numeric form to players. Recompute when offer terms change before the single final resolution; once resolved, persist outcome. Invalid funding sets offer eligibility false (not a 0% roll).

**NPC debtor acceptance (when player offers survival):** start Vesper 0.40, Oracle 0.80, Corvin 0.70; modifiers: unbound mercy +0.15, debt 0, service -0.20, humiliation/identity forfeiture -0.20, prior friendly +0.10, betrayed -0.20, then clamp 0.05–0.90 and commit a seeded single decision. NPC can prefer death to unacceptable terms. No automatic ownership or recruitment.

## DESIGN CHANGE — bible v0.4 → v0.5 — 06: Debt and default
**What:** Deterministic repayment and manageable failure consequences.
**Rule text:** Debt principal is the funded transfer. At execution, set total contractual obligation to ceiling(1.5 x endowment). At each completed **future** table, transfer 30% of positive net table winnings from debtor to creditor, rounded DOWN, capped by remaining obligation and available Lifechips above 1. Losses generate no repayment and no interest. The repayment must be a real Lifechip transfer. When four qualifying tables have been completed without clearing the obligation, mark contract OVERDUE; do not silently confiscate chips or cause an automatic death. Mark -1 Favor and require a creditor/recovery narrative node at P4. Enforcement may restrict access and impose further explicit choices, but cannot directly manufacture/destroy Lifechips.
**Numbers:** Multiplier 1.5; 30% of positive net table profit; deadline 4 completed future tables; mandatory preserved stack >=1 for automated repayment. Example Vesper funded 10 => 15 due; Oracle funded 12 => 18 due; Corvin funded 8 => 12 due.
**Invariants touched:** Ledger accounting, contract lifecycle, reputations, no second resurrection.
**Acceptance test:** Positive/zero/negative net outcomes yield correct payments; no negative debt; funded transfers conserved; restarting never pays twice; overdue carries penalties but does not produce 0-Lifechip transition spontaneously.

### Non-debt pact terms
| Pact | Endowment | Obligation | Lifecycle |
|---|---|---|---|
| Unbound mercy | Claimant-funded as above | No chip repayment | Immediate Fallen transition, relationship memory |
| Funded debt | Claimant-funded as above | Repay ceil(1.5 * endowment), 30% of positive per-table net until cleared; overdue after 4 tables | Contract `active/overdue/cleared` |
| Sworn service | Claimant-funded as above | 3 authored, nonsexual tasks owed; no additional numeric debt by default | Remains `active` until 3 obligations resolved |
| Title / relic forfeiture | Claimant-funded as above | Transfer an EXISTING named title/relic; no chip-minting | Content-flagged, implement in P4 rather than arbitrary P3 placeholders |

Personal-patronage implication is optional adult-only off-screen narrative flavour, never mechanically incentivized, and not a sexual act or collectible reward. Under existential duress, do not label it free consent. Player can disable mature-theme references entirely with no lost mechanics.

## DESIGN CHANGE — bible v0.4 → v0.5 — 07: Fallen P3 placeholder, P4 continuation
**What:** Save a real Fallen continuation state without pretending P4 already exists.
**Rule text:** After successful funded survival, exit the current table permanently. Set character `alive=true`, `socialRank=FALLEN`, `district=CINDER_WARRENS`, stack=endowment, `survivalCovenantsUsed=1`, obligations/reputations recorded, and `pendingNode=FALLEN_RECOVERY`. During P3, present a scene titled `THE CINDER WARRENS — TO BE CONTINUED` with a summary and saved progress. Do not return to the same poker table. In P4, replace the placeholder with playable recovery content. On failed negotiation or second bankruptcy, end the current character's run.
**Numbers:** First successful funded rescue once per run; subsequent unrescued/second bankruptcy = death.
**Invariants touched:** Existing saves, no free retry, life/death state, encounter progression.
**Acceptance test:** Restart mid-claim and after successful survival; restore exact state, no duplicated funding, no same-table exploit, P4 can resume from pendingNode.

## DESIGN CHANGE — bible v0.4 → v0.5 — 08: P3 art specification
**What:** New Ledger, contract and neutral adjudicator art, plus 300x420 back.
**Rule text:** Add manifest entries below. The title card and contract panel are TEXT-FREE artwork: real text, signatures, contract terms, labels, player choices and legally meaningful chip amounts must be generated by the UI for localization/accessibility. The neutral adjudicator is a distinct hooded porcelain-masked figure; not Oracle reused. Keep charcoal/aged brass/parchment/crimson, portrait circle readability at 64px.
**Numbers:** Card back 300x420 RGBA; contract panel 960x1200 RGBA; seal 256x256 RGBA; title card 1200x630 RGBA; adjudicator bust 512x512 RGBA.
**Invariants touched:** Legibility, UI clarity, identity consistency, asset manifest, visual fairness.
**Acceptance test:** Validate exact pixel dimensions and alpha; card back pixel-exact symmetry; 64px adjudicator circle reads distinct; contract body remains text-safe; compare against P2 phone screenshots before marking integrated.

## Non-negotiable P3 implementation checks
- Bankruptcy is checked **only after** pot award/refund settlement and initial state journal commit.
- Claimant derives from eligible last-contribution pot, not from whoever has the largest global stack.
- Split winner rights go to neutral adjudicator, with no personal service entitlement.
- Order multiple claims deterministically; disallow participant interaction until full batch resolution.
- Donations/transfers preserve global Lifechips and cannot put funder at zero.
- Contract is created and funded exactly once; event replay/save reload idempotent.
- A bankrupt player cannot bet, cast or trigger spell experience during pending claim.
- NPC-vs-NPC bankruptcies use identical rules, including when player folded.
- Rejected debt/service offer is never re-rolled by save/reload.
- Mature implications off by default, non-graphic, never mandatory.
- The existing 68 P2 tests must keep passing unchanged except intentional clarified behaviors; repeat 1,000+ deterministic hands with zero card/chip/Aether violations.
- P3 accepts no magic-induced unearned Lifechip transfers, no rigged showdowns.

## Art integration notes
See `docs/asset-manifest-p3-additions.json`. The art delivered in this pack is original procedural vector-style concept art from ChatGPT's production pass (not hand-painted AI portrait artwork). Adjudicator is a **provisional portrait** pending painterly production polish and user sign-off. The game UI should overlay dynamic text on decorative title/panel assets. `public/assets/cards/back.png` may replace the older source if in-engine preview confirms stylistic fit; it is exact symmetric and ready for comparison. Asset status should be set to `delivered`, not `integrated`, until Claude confirms via phone screenshots.
