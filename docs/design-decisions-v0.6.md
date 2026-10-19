# THE LAST WAGER — Design decisions v0.6 / P4 implementation contract
**Status:** Creative sign-off for P4 implementation; untested numerical balance seed values. **Does not overwrite v0.5**, except explicitly named changes. Prepared 19 October 2026. Poker kernel and P0–P3 tests remain authoritative.
**Safety/setting:** Fictional Lifechips only, no redeemable real-money stakes. Last Claim is non-graphic; optional mature patronage remains disabled and no coercive sexual content is depicted.

## P3 responses
| Question | Decision | Implementation |
|---|---|---|
| Relief treasury | ACCEPT 20 | Single world-ledger wallet: 20 at new-run initialization, never reset mid-run; max two 10-chip adjudicator petitions. |
| Reputation | ADJUST | Claim Life +1 Dread; unconditional funded mercy +1 Honor; imposing debt/service +0 Favor, creditor gains +1 Favor when debt fully paid or per completed service duty; unique event IDs prevent replay. |
| NPC as debtor | REJECT auto-accept | Debtor chooses legal offers by personality; Vesper hard-refuses service (may prefer death), all NPCs may reject counteroffers; one saved RNG roll per claim. |
| Adjudicator | REPLACE portrait | Painted dark-fantasy bust 512×512 RGBA; keep current vector until final source delivered; no artificial claim powers. |
| Card back | KEEP | Preserve existing 300×420 vector back and its pixel-exact 180° symmetry gate; no repaint requested. |

## DESIGN CHANGE — bible v0.5 → v0.6 — 01
**What:** Relief treasury and reputation calibration.  **Rule text:** Initialize one neutral treasury of 20 real Lifechips. Reputations are event-based, not automatically rewarded for imposing a contract. **Numbers:** Treasury 20; claim life +1 Dread; funded unbound mercy +1 Honor; fulfilling each distinct service duty +1 creditor Favor; debt discharged in full +1 creditor Favor once. **Invariants touched:** World-ledger conservation, reputation and idempotency. **Acceptance test:** Two fully funded neutral petitions succeed, third is unavailable; repeat/reload transfers and reputation deltas exactly once.

## DESIGN CHANGE — bible v0.5 → v0.6 — 02
**What:** Autonomous debtor decisions. **Rule text:** No AI debtor automatically accepts service or counteroffer. Filter illegal offers and hard refusals before evaluating the persistent claim roll. NPCs choose the best acceptable offer according to their character, and may select death when every offer is unacceptable. **Numbers:** See probability/priority table. **Invariants touched:** Claim persistence, personality integrity, seeded negotiation. **Acceptance test:** Vesper rejects service independent of the sampled roll; Oracle can prefer debt; Corvin favors mercy; reload cannot reroll.

## DESIGN CHANGE — bible v0.5 → v0.6 — 03
**What:** First finite branching run slice. **Rule text:** Start, two Contract Tables, one shop, optional event, and one 3-seat boss table; a failure without bankruptcy goes to a mandatory one-time setback audience then forward, never back to the failed table. **Numbers:** Six primary nodes (start + 2 contracts + shop + optional event + boss); 8 hands each contract; 12-hand boss. **Invariants touched:** Route reachability, encounter persistence, real stack carried across tables, no passive farming. **Acceptance test:** Enumerate every route through victory, living failure, Last Claim and Fallen; no endless loop; no reset of owned Lifechips.

## DESIGN CHANGE — bible v0.5 → v0.6 — 04
**What:** Spell Resonance and branching evolution. **Rule text:** Resonance is per spell *instance*, at most one increment per hand from its qualifying event. At 2 Resonance, offer two exclusive branch replacements between hands. Evolutions inherit legal casting bounds and can never duplicate the physical 52-card poker deck. **Numbers:** Four base spells, eight branches, milestone 2 per instance, four max initial magic cards drawn only when explicitly triggered by Ember Echo. **Invariants touched:** Spell instance conservation, Aether <=3, one cast/hand, timing and replay. **Acceptance test:** Replace one instance 1:1; evolved spell saves/replays, and invalid casts leave RNG and state unchanged.

## DESIGN CHANGE — bible v0.5 → v0.6 — 05
**What:** First six passive relics, one Covenant, shops. **Rule text:** Relics are unique per inventory, have explicit triggers and cannot mint Lifechips. Covenant of the Open Book increases Aether supply but publicly exposes one current hole card each hand. Purchases transfer chips atomically to a real merchant or escrow wallet. **Numbers:** 5 relic slots, 2 covenant slots, 6 relics, event Covenant 22 chips, shop 3 relics + 1 Spell Rethread offer. **Invariants touched:** Chip ledger, hidden-card visibility, activation frequency, deterministic inventory. **Acceptance test:** Public revealed card remains correct after Fate Exchange, chips conserved, no more than one trigger per qualifying event.

## DESIGN CHANGE — bible v0.5 → v0.6 — 06
**What:** Fallen recovery and sworn-service schedule. **Rule text:** Rescued player transitions to Fallen Registry → 4-hand Coal Table → Patron Audience. Each creditor assigns three ordered duties, one active at a time; player progress is saved, and each completed duty grants only the defined narrative/reputation reward. **Numbers:** 3 Fallen nodes, 4 Coal Table hands at 1/1, 9 task definitions (3 per existing named rival). **Invariants touched:** Existing funded rescue endowment, serial contract records, task idempotency. **Acceptance test:** Resume a P3 Fallen save and finish the sequence without minting chips or duplicating completion.

## DESIGN CHANGE — bible v0.5 → v0.6 — 07
**What:** New AI table populations. **Rule text:** Add four independent AI characters with fixed funded opening wallets, distinctive VPIP/PFR targets, legal existing spells and memories. No agent receives private information outside own cards and paid reveals. **Numbers:** Four new profiles in the table below; boss does not cheat. **Invariants touched:** World-ledger accounts, agent privacy, determinism, AI-vs-AI outcomes. **Acceptance test:** ≥10,000 decision opportunities per archetype for measured style; automated AI information-boundary test; seeded deterministic table results.

## DESIGN CHANGE — bible v0.5 → v0.6 — 08
**What:** P4 art integration scope. **Rule text:** Keep existing vector 300×420 back. Replace vector adjudicator portrait with 512×512 painterly alpha original when supplied, matching the three rival portraits. Use code-rendered text in contracts and map nodes. **Numbers:** One priority portrait, four P4 rival portraits recommended. **Invariants touched:** Portrait readability at 64px, no deck orientation tells, production manifest. **Acceptance test:** 512×512 source RGBA transparent outside bust, recognizable 64px circle crop, match art bible v0.1 lighting and palette.

## Run map & encounter economics
| Node | Format / opponents | Clock & rules | Success / fail |
|---|---|---|---|
| START | Wagerer arrival | Carry 100 Lifechips, beginner Spellbook | Contract 1 |
| C1: Ash Table | 4 seats: You / Vesper 120 / Oracle 100 / Corvin 90 | 1/2 blinds; 8 hands | Top 2 + ≥1 Lifechip; choice of 1 seeded common relic, no chips created |
| SHOP: Selene | Mandatory merchant | 3 distinct seeded relic offers, one Spell Rethread | Can skip all purchases |
| EVENT: Mirror’s Petition | Optional, one visit | Pay 22 chips into named escrow to gain Open Book Covenant, or decline | Proceed to C2; must retain ≥1 chip |
| C2: Lantern Circuit | 3 seats: You / Mara Quill 110 / Eldric Vale 95 | 1/2 blinds; 8 hands | Top 2 + ≥1 chip; non-chip relic/evolution choice |
| BOSS: Bailiff’s Ledger | 3 seats: You / Bailiff Sable 145 / Sister Rill 115 | 12 hands, 2/4 for first 6 then 3/6 | Finish tied for highest positive stack; win or living exile ending |
| SETBACK: Keeper’s Audit | On living failed contract | -1 Favor and choice: +1 Notoriety OR -1 Resonance on eligible owned spell (fallback Notoriety) | Continue forward; no contract replay |
**World accounts:** Rival starting stacks are registered real wallets at world initialization. When they enter a table, transfer from those wallets to table stack, not create chips. Persistent rivals never silently reset. A C1 rival is not re-used in C2 or Boss, avoiding wallet ambiguity in this slice. The 20-chip relief treasury and Selene’s wallet count toward the world total. All merchant prices, purchases and optional-event payments are tracked actual transfers.
**End-of-hand death law:** Once a player is at zero after full settlement, P3 Last Claim interrupts; P4 route must not advance before claim resolution. Boss failure with >0 is a living ending, not automatic death. A living failed C1/C2 advances via Keeper’s Audit. Remaining chip stack always carries forward.

## NPC debtor negotiation model
| Debtor | Mercy | Debt | Service | Offer preference / veto |
|---|---:|---:|---:|---|
| vesper | 55% | 40% | 0% | mercy, debt; hard refuse service |
| oracle | 90% | 80% | 35% | debt, mercy, service; no hard veto |
| corvin | 85% | 70% | 15% | mercy, debt, service; no hard veto |
| other | 65% | 55% | 25% | debt, mercy, service; no hard veto |
These are target acceptance thresholds before relationship modifiers (+0.10 friendly, −0.20 betrayed) and the standard 5–90% clamp, except that a hard veto is **zero chance** and is not clamped. The single existing saved claim random value is reused, never rerolled for a counteroffer. The claimant side continues using unchanged v0.5 preferences. Unfunded deals are invalid before sampling. A claimant can refuse an NPC proposal; the NPC may prefer death over forbidden/undesirable contracts.

## Shop & relic prices
| Relic | Price (chips) | Trigger / exact effect |
|---|---:|---|
| Ashen Signet | 12 | Once per table, after the caster wins as sole winner of an eligible contested showdown pot following their own legal preflop raise, gain +1 Aether after regular regeneration, capped at 3. Cannot trigger more than once per table. |
| Veiled Monocle | 18 | The first Unmask-family spell cast each table costs 1 less Aether, min 0. Only affects the spell instance actually cast; excludes Ravenous Eye exhaust removal rules. |
| Thorn Anchor | 14 | The first Briar-family cast each table costs 1 less Aether, min 0. The pot-limit ceiling still applies equally to every seat. |
| Lantern Reservoir | 10 | At each new table, initialize owner's Aether at min(3, base table-entry Aether + 1). Does not provide chips or raise the 3-Aether cap. |
| Mirror Prism | 22 | The first Fate Exchange-family cast each table costs 1 less Aether, min 0. Does not permit an additional cast or extra exchanged cards. |
| Gambler's Knot | 16 | Once per table, after owner legally folds facing a positive outstanding wager, gain +1 Aether capped at 3. Never triggers on a check or folded seat action outside legal turn. |

| Additional offer | Price | Effect |
|---|---:|---|
| Spell Rethread (one stock) | 11 | Replace one owned starter spell with a different starter base spell; keep deck size, reset that instance Resonance. |
| Covenant of the Open Book (optional event only) | 22 | Begin each hand +1 Aether (cap 3); expose one random current hole card publicly, updating visibility after any exchange; no extra casts. |
**Merchant:** Selene of the Lantern Market, initial actual wallet **80 Lifechips**. Three relic offers selected once by seeded draw; duplicates and save/reload rerolls prohibited. Inventory stock one per offer. The optional covenant fee transfers to `patron_witness_escrow` as a real world account.

**Exact final-Lifechip checkout error:** `The Ledger forbids a purchase that would surrender your final Lifechip.`

## New opponents
| Name | Table | Initial chips | VPIP target | PFR target | Personality | 8-card Spellbook (C/U/B/F) |
|---|---|---:|---:|---:|---|---|
| Mara Quill | contract_2 | 110 | 42% | 14% | loose-passive | 1/3/1/3 |
| Eldric Vale | contract_2 | 95 | 33% | 24% | loose-aggressive | 3/3/1/1 |
| Bailiff Sable | boss_ledger | 145 | 25% | 20% | tight-aggressive | 1/3/3/1 |
| Sister Rill | boss_ledger | 115 | 30% | 12% | cautious-calling | 1/2/3/2 |
VPIP/PFR are measured design targets, NOT fixed forced action rates. These new rivals inherit fully legal P2 spells. All have independent funded Lifechip wallets and can bankrupt each other; their souls are not plot-protected.

## Spell Resonance and evolution
| Parent | Resonance condition (max 1/hand) | Evolution threshold |
|---|---|---:|
| unmask | Cast legally and target remains eligible through next completed betting action | 2 |
| cinder_challenge | The enchanted raise is legally matched or exceeded by another seat after cast | 2 |
| briar_lock | After legal cast, at least one voluntary betting action occurs under its pot-limit restriction | 2 |
| fate_exchange | Legal exchange is completed and caster survives to flop or hand ends by all-fold preflop | 2 |
Each branch is a full replacement for **one** owned instance, chosen only between hands and persisted. Same engine phases/priorities as P2. Even an exhausted instance must remain tracked in the total owned deck and reenter only at next table.

### Evolution spell table — every required field
| id | name | discipline | cost | timing window | target | public tell | effect | exhaust/discard | priority |
|---|---|---|---:|---|---|---|---|---|---:|
| twin_oracle | Twin Oracle | Veil | 3 | Own decision on any betting street | 1 or 2 distinct nonfolded opponents with concealed hole cards | Two violet eyes turn toward the wagerers. | Reveal exactly one random hole card from each chosen opponent privately to caster; if only one eligible target, reveal one from that target. Publicly disclose identities of targeted seats only. | Discard at hand end | 30 |
| ravenous_eye | Ravenous Eye | Veil | 3 | Own decision on any betting street | One nonfolded opponent with concealed hole cards | The eye opens fully and consumes its sigil. | Reveal both target hole cards privately to caster; after cast this spell instance exhausts until the table ends. No shared disclosure. | Exhaust until next table | 30 |
| ember_echo | Ember Echo | Ember | 1 | Own poker action immediately before legal raise; atomic cast+raise | Self and accompanying legal raise | The raised wager echoes like a struck bell. | Use base Cinder qualifying rules, plus on a sole contested showdown win with a qualifying matcher, draw one additional magic card at the start of the next poker hand (max 4 drawn). The Aether gain stays +2, capped at 3. All fold remains +1. Exactly one next-hand draw marker. | Discard at hand end | 40 |
| red_oath | Red Oath | Ember | 0 | Own poker action immediately before legal raise; atomic cast+raise | Self and accompanying legal raise | The caster stakes a visible sigil on the raise. | Publicly reveal one randomly selected current hole card of the caster on cast; matched sole contested showdown victory grants +1 Aether instead of +2; all fold grants +1; base Cinder eligibility rules otherwise apply. Reveal remains current if any subsequent legal hole-card exchange occurs. | Discard at hand end | 40 |
| thorn_lattice | Thorn Lattice | Thorn | 2 | Street-opening window only | All live seats, current and next street (if next street exists) | Thorns spread toward the next street. | Apply pot-limit this street and automatically at start of next street before any voluntary action, unless hand ends. Identical caps for all seats. If cast on river, current street only. | Discard at hand end | 20 |
| quiet_briars | Quiet Briars | Thorn | 1 | Street-opening window only | Whole table for current street | The thorns drink the sound of wagers. | Apply base Briar Lock. If no voluntary raise or bet occurs during the locked street, refund 1 Aether at street end (capped at 3, once per cast). Checks do not count as bets; earlier blinds do not count. | Discard at hand end | 20 |
| second_reflection | Second Reflection | Mirror | 3 | Preflop opening magic window before voluntary bet | One caster hole card | Two reflections hover above a face-down card. | Draw two distinct random candidates without replacement from undealt stub, choose one as replacement; return other candidate and original removed card to stub only after selection, then reshuffle. No other hole/board/burn card modified. Choice private. | Discard at hand end | 10 |
| marked_fate | Marked Fate | Mirror | 1 | Preflop opening magic window before voluntary bet | One caster hole card | The discarded rank is inscribed on the Ledger. | Execute base Fate Exchange, but publicly announce the rank (not suit) of the discarded card after replacement. Current replacement remains private. No duplicate cards. | Discard at hand end | 10 |

**Edge cases:** Twin Oracle may target only one opponent (reveals one random card in that case). Ravenous Eye exhausts for the table, not merely the hand. Thorn Lattice next-street effect expires if the hand ends. The all-fold Cinder bonus never doubles; Ember Echo creates **one next-hand draw marker**, not another cast. A Red Oath publicly revealed slot stays public if exchanged later. Second Reflection returns unchosen card and discarded original only after selecting replacement. Each choice is logged deterministically.

## Fallen recovery route
| Node | Action | Cost / reward | Exit |
|---|---|---|---|
| F1 — Registry Below | Load immutable funded survival contract, patron and current stack | No chip grant | Coal Table |
| F2 — Coal Table | 3-handed, 4 poker hands; player + Night Clerk 16 + Dock Runner 18 | 1/1 blinds, rank irrelevant, real stakes; survive >=1 | Patron Audience or death on new bankruptcy |
| F3 — Audience of the Bound | Review progress on active duty or debt and the contract deadline | One-time service task completion effects; no free chips | Fallen route unlocked (P4 slice end) |
Recovery opponents have actual seed wallets. When a debt table produces positive net profit, 30% repayment transfers to creditor under P3 at table completion, preserving one Lifechip. An overdue contract remains tracked. Servitude completes only after 3 duties, and at most one ordered duty progresses per actionable event.

### Three sworn-service duties for each named rival
| id | giver | Text | completion condition | reward/consequence |
|---|---|---|---|---|
| vesper_raise | vesper | Prove your nerve: make a legal preflop raise and remain through the next betting decision. | {'event': 'own_preflop_raise_then_next_decision', 'once': True} | service_progress +1; Vesper Favor +1; no punitive chip confiscation; remains active until completed |
| vesper_showdown | vesper | Let the table see you: participate in one contested showdown. | {'event': 'contested_showdown_participant', 'once': True} | service_progress +1; Vesper Favor +1; remains active |
| vesper_rank | vesper | Bring the house honor: finish a contract table in its top two living stacks. | {'event': 'contract_finish_rank_top2_alive', 'once': True} | service_progress +1; Vesper Favor +1; all 3 duties release service pact; remains active |
| oracle_witness | oracle | Witness the truth: observe one contested showdown, whether or not you remain in the hand. | {'event': 'observed_any_contested_showdown', 'once': True} | service_progress +1; Oracle Favor +1; remains active |
| oracle_spell | oracle | Record one Veil or Mirror spell cast legally while you remain at the table. | {'event': 'owner_cast_spell', 'disciplines': ['Veil', 'Mirror'], 'once': True} | service_progress +1; Oracle Favor +1; remains active |
| oracle_reveal | oracle | Complete a showdown in which at least one opponent reveals a poker hand. | {'event': 'contested_showdown_participant_with_opponent_reveal', 'once': True} | service_progress +1; Oracle Favor +1; all 3 duties release service pact; remains active |
| corvin_check | corvin | Show restraint: take a legal check action in a hand. | {'event': 'owner_checked', 'once': True} | service_progress +1; Corvin Favor +1; remains active |
| corvin_fold | corvin | Know when to yield: fold once to a bet or raise of at least the current big blind. | {'event': 'owner_fold_facing_wager_gte_bb', 'once': True} | service_progress +1; Corvin Favor +1; remains active |
| corvin_finish | corvin | Survive honestly: finish a full contract table with one or more Lifechips. | {'event': 'contract_finish_player_alive', 'once': True} | service_progress +1; Corvin Favor +1; all 3 duties release service pact; remains active |

## Art addendum and manifest paths
**Decision:** Keep the existing symmetric `art/source/chatgpt-p3/back-300.png` as canonical. Do **not** replace it merely to match portrait painting. The painted adjudicator remains a priority **undelivered** replacement. A source-image edit was unavailable in this conversation because no usable image target was attached; do not claim the new portrait has been produced.
| Asset ID | Production filename (source) | Runtime filename | Size | Status |
|---|---|---|---|---|
| portrait.adjudicator.paint | `art/incoming/p4/adjudicator.png` | `public/assets/portraits/adjudicator.webp` | 512×512 RGBA source → 256×256 WebP runtime | Needed; current vector remains placeholder |
| portrait.mara-quill | `art/incoming/p4/mara-quill.png` | `public/assets/portraits/mara-quill.webp` | 512×512 RGBA → 256×256 WebP | Needed, illustrated after adjudicator |
| portrait.eldric-vale | `art/incoming/p4/eldric-vale.png` | `public/assets/portraits/eldric-vale.webp` | 512×512 RGBA → 256×256 WebP | Needed, illustrated after adjudicator |
| portrait.bailiff-sable | `art/incoming/p4/bailiff-sable.png` | `public/assets/portraits/bailiff-sable.webp` | 512×512 RGBA → 256×256 WebP | Needed, illustrated after adjudicator |
| portrait.sister-rill | `art/incoming/p4/sister-rill.png` | `public/assets/portraits/sister-rill.webp` | 512×512 RGBA → 256×256 WebP | Needed, illustrated after adjudicator |
**Adjudicator portrait brief:** 512×512 alpha PNG; gender-neutral middle-aged ceremonial archivist and neutral arbiter; layered charcoal gown, tarnished gilt collar, sealed black ledger held low; steady impartial gaze, stone-grey hair, distinctive silhouette under a small draped cowl; light from warm upper-left, subtle cool bounce from upper-right; painterly gouache/engraved fantasy realism consistent with Vesper/Oracle/Corvin; head and shoulders in 64px round crop. No letters, readable text, poker cards, revealing information, erotic themes or UI framing embedded into image. Avoid flat icon vectors. Maintain palette: #231A18, #F2E8D0, #C9A24A, #77629A. Build full portrait from an independently generated original illustration, not by modifying an unrelated NPC.
**Other four portraits:** all bust, character-specific large silhouettes, consistent light direction: Mara Quill (copper-skinned market bookmaker with chestnut curls and bronze ear cuff); Eldric Vale (lean auburn gambler in ash-red dueling coat); Bailiff Sable (stern masked black-iron official carrying suspended seals); Sister Rill (composed green-grey robed gambler with braided hair and silver prayer coin). Avoid text or spells inside portrait.

## Critical P4 acceptance criteria
- All existing P0–P3 tests remain green; zero physical card duplication, illegal actions, chip leaks or Aether out-of-bounds.
- 1000 seeded complete P4 slice runs across contrasting skill policies; report distribution of survival, node completion, bankruptcy, contract acceptance and victory; do not promise a win-rate before measurement.
- No direct chip reward from relic, spell evolution, shop or reputation; every non-poker chip move has named debit and credit in an idempotent journal.
- Reload at node entrance, offer generation, after shop purchase, mid-evolution, Last Claim, Fallen Registry and after debt repayment reproduces exactly.
- AI-vs-AI games remain real; P4 opponent AI does not receive hidden cards beyond its own and legally revealed ones.
- UI is comfortable at iPhone 13 viewport, all required legal actions visible, portraits do not obscure amounts; art status changes to integrated only after real viewport review.
- Hand cap and first-place/top-two contract standings treat ties explicitly and never resurrect a zero-chip bankrupt contender merely for contract score.
- NPC debtor may refuse and die; Vesper service veto overrides probability clamp; no bargain is an automatic extra life.
- Service duties record event IDs and cannot progress twice from a single showdown; creditor Favor increments when task actually completes.
- All portrait replacements are flagged needed until actual image files are handed over and checked at 64px circle crop.

## Engineer handoff
Read this spec plus all `data/p4-*.json`. Put rule constants in existing `src/game/world/rules.ts` or scoped game-data config; do not fork poker evaluator. Build sequentially: nodes and persistence → economy/shop → Resonance evolution → new AI tables → Fallen route → full deterministic simulations → mobile polish. P4 screenshot report must show route, shop, branch evolution and Fallen continuation.
