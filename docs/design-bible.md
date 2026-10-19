# THE LAST WAGER

**Canonical World, Gameplay & Production Blueprint — v0.6**

Status: Working design baseline, dated 18 October 2026 (v0.4, v0.5 and v0.6 amendments below). Values labeled *prototype* require simulation and playtesting. All names are working titles. This document is intended to be shared with ChatGPT (design, writing, visuals) and Claude (implementation and tests). It is not a claim that any game is already coded.

> **v0.4 amendments (18 October 2026).** The decisions in
> [`design-decisions-v0.4.md`](design-decisions-v0.4.md) are part of this bible and
> override any conflicting text below:
> (01) moving button; (02) all live hands revealed at showdown, folded hands never;
> (03) no antes; (04) a checker may raise a short opening all-in;
> (05) spell windows, priorities and Aether rules; (06) beginner Spellbook 2/2/2/2;
> (07) rival Spellbooks; (08) Briar Lock is street-opening only and never retroactive;
> (09) eight-hand Contract Table and its setback. Machine-readable spell data:
> `src/game/magic/spells.json`. Visual rules: [`art-bible.md`](art-bible.md).
>
> **v0.5 amendments (18 October 2026).** [`design-decisions-v0.5.md`](design-decisions-v0.5.md)
> adds: 300×420 cards with an exactly symmetric back; Cinder Challenge "matching"
> (a call or legal re-raise committing at least the enchanted amount); the Last Claim
> state machine and negotiation flow; endowments and rival temperaments; debt and
> default rules; the Fallen placeholder; and the P3 art specification
> ([`art-bible-v0.2-addendum.md`](art-bible-v0.2-addendum.md)). Numbers live in
> `src/game/world/rules.ts`.

> **v0.6 amendments (19 October 2026).** [`design-decisions-v0.6.md`](design-decisions-v0.6.md)
> adds: NPC debtor temperaments with priorities and Vesper's service veto; reputation
> events (mercy Honor only, Favor to a creditor once on discharge); the P4 route
> (Ash Table → Selene's Lantern → Mirror's Petition → Lantern Circuit → Bailiff's
> Ledger), the Keeper's Audit, named wallets for every character, Selene and the
> Witness escrow; per-instance Resonance and eight branch evolutions; six relics and
> the Covenant of the Open Book; four new rivals with VPIP/PFR targets; and the Fallen
> route (Registry Below → Coal Table → Audience of the Bound) with sworn-service
> duties. Data lives in `src/game/run/data/p4-*.json`; P4 art in
> [`art-bible-v0.3-p4-addendum.md`](art-bible-v0.3-p4-addendum.md).

---

## 0. North-star promise

A mobile-first, single-player, dark-fantasy roguelike built around actual three- or four-handed Texas Hold'em, where AI players compete independently; chips represent life and wealth; spells form an evolving, deckbuilt secondary system; and victories, bankruptcies and bargains change a coherent social world.

Experience curve: Act I feels like authentic, tense poker with restrained magic. Act II enables distinct magical builds, rivalries and strategic adaptation. Act III unlocks wild but legible synergies, complex opponents and high-stakes consequences. At all stages, good poker fundamentals remain useful.

Five pillars: (1) True poker; (2) Lifechip stakes; (3) living magic; (4) social ascent/fall; (5) independent, persistent rivals.

### Strict exclusions

- No traditional HP, damage bar, energy-as-health, automatic extra life, or magically protected bankroll.
- No rigged hidden cards, predetermined losing hands, or AI knowledge of private information it cannot legitimately obtain.
- No pay-to-win, real-money gambling, redeemable chips or wagering with real-world value.
- No erotic/explicit scenes. Any mature patronage/companionship consequence remains off-screen, adult-only, narratively serious and never described as freely consensual when made under duress.
- No multiplying chips through magical triggers or mishandled pots.
- No upgrades that require the player to abandon genuine poker strategy.

---

## 1. World law: The Ledger of Souls

The Ledger is an ancient mystical institution that recognizes Lifechips as transferable claims on a person's continued existence. A citizen can win, inherit, earn, buy or lose Lifechips. In the world's supernatural logic, owning at least one maintains their legal and metaphysical right to continue living. When someone has zero Lifechips after a transaction or poker hand is fully settled, their claim expires.

A character's Lifechips are both: (a) wealth/currency, and (b) life-stakes. Spending is as consequential as betting. No second health resource exists.

**Accounting invariant:** Within any resolved poker hand, sum of all player stacks plus committed pots is conserved; chips change owners but are not created or destroyed. Shop purchases, bribes and patron loans transfer chips from a named merchant/treasury/patron reserve; they do not create chips. New entrants to the world can be bound through a separate fiction/lore mechanism that does not mint chips during a run.

**At a table:** the protagonist's entire current Lifechip balance is the stack they can wager. There is no protected reserve outside the table. Players are never forced to commit their entire stack on entry: it is available to wager through normal poker actions. Tables may have minimum Lifechip requirements and blind levels, but must not silently lock away spendable or protected chips. A player with fewer chips than a required blind posts what remains as an all-in blind under normal rules.

**Danger of shops:** Spending your final Lifechip would trigger the same zero-chip state, so merchants decline purchases that would leave the buyer at zero. This prevents accidental deaths from a shopping interface, not a secret financial safety net.

### Last Claim — exactly defined

**Trigger:** after pot awards (including side pots), transfers, refunds and all bookkeeping are complete, a character has 0 Lifechips. During the resulting Last Claim state, they are not alive with usable chips; their fate is awaiting resolution. They cannot cast, make wagers, escape, or shop.

**Outcomes:**

1. **Life claimed:** death; protagonist's current run ends; NPC is permanently removed from that run unless special fiction explicitly allows a successor (not resurrection).
2. **Mercy without debt:** rare, at victor's discretion; requires a real Lifechip endowment from the victor or other explicitly identified funder, not spontaneous creation. Recipient restarts as Fallen.
3. **Debt covenant:** winner/patron transfers a small loan from their own Lifechips, receiving enforceable debt/obligation rights. The survivor becomes Fallen.
4. **Service or patronage covenant:** a serious social subordination contract, likewise requiring Lifechip transfer; survivor becomes Fallen. Limited-access adult-only off-screen personal companionship/consort implications may appear as a non-graphic narrative contract with tangible agency, resentment and consequences, not an erotic reward.
5. **Identity/birthright exchange:** rare story agreement that forfeits title, house, heirloom or magical privilege in return for funded survival.

**No guaranteed mercy.** Whether an AI claimant even listens depends on temperament, history, expected value, alliances and table status. The player's proposal can be rejected. The gameplay UI presents uncertainty honestly (e.g., low/fair/high willingness), not as a false guaranteed success percentage. For MVP, the player may receive one survival covenant per run; further zero-chip losses mean death unless the story explicitly establishes a unique exception. This preserves the meaningfulness of bankruptcy.

**When the player is claimant:** They can claim death, offer mercy or propose legally possible demands. Granting survival means transferring at least a minimum revival endowment from their own balance or a visible patron treasury. The player cannot choose an outcome they cannot fund. A spared NPC retains history, agency and may seek emancipation/revenge. Claiming NPCs is not an effortless, consequence-free permanent power upgrade.

**Multiple winners / split pot:** Poker is settled first. For narrative rights, each newly bankrupt character's Last Claim is attached to the contested pot containing their final contribution. If there is one winner of that pot, they are claimant. If the pot is split among tied winners, the claim is held by a neutral table adjudicator: no co-winner can independently impose a personal covenant. The adjudicator offers only neutral death or a separately funded mercy petition. This rare tie policy is announced and testable; it never modifies payouts.

**Special rule:** AI elimination and player elimination obey the same 0-chip law, even when the player is not in the pot. Defeat of a character can occur during an AI-vs-AI hand.

---

## 2. Society, geography and progression

Setting (working name): **The Dominion of Veyr**, a layered city-state organized around lawful and illegal gambling institutions. Five tiers form the social map:

| Tier | Region         | Character of place                            | Gameplay access                                      |
|------|----------------|-----------------------------------------------|------------------------------------------------------|
| I    | Cinder Warrens | Poor alleys, backroom tables, debt-keepers    | Low-blind games; basic spell tutors; redemption path |
| II   | Lantern Market | Merchants, brokers, informal guild tables     | Spell editing, relic markets, rumors                 |
| III  | Gilded Circuit | Licensed guild halls, influential houses      | Four-player contract tables, advanced rivals         |
| IV   | High Court     | Nobles, political wagers, dangerous patronage | Covenants, elite opponents, reputation stakes        |
| V    | Crown Table    | Ultimate arbiters of Lifechip law             | Final act bosses and existential bargains            |

Wealth is not identical to rank. Lifechips let you pay and bet, but standing requires invitations, reputation, negotiated obligations or victory at qualifying tables. This keeps social progression meaningful instead of making it a simple wealth threshold. High-status characters may be poor; a wealthy outsider may still be excluded.

**Reputation vectors:** Honor (keeps bargains), Dread (claims lives), Favor (debts and contacts), and Notoriety (known magical tactics). Favor and obligations unlock opportunities; high Dread can intimidate but close diplomatic routes. These affect dialogue, AI beliefs and encounter availability, not poker card randomness.

### The Fallen route

A successful Last Claim bargain starts a Fallen branch. The survivor receives a visible, funded endowment (prototype 8–15 chips, dependent on claimant's finances) and is relocated to Cinder Warrens. They lose social rank, prestigious table access and most uncontracted assets; bound artifacts may remain, mutate, or be seized as the specific covenant states. They must repay debts, fulfill non-explicit obligations, negotiate release or defeat their patron in a legitimate challenge.

The Fallen path is a harder but fully playable continuation with unique encounters, rare rewards and a clear route back toward freedom. It does not protect the player from a second bankruptcy or restore all their old power. It should be viable, not a mechanically pointless punishment.

### Persistent rivals

Named rivals have stable identities, resources, lifechip balances, rank, Spellbook archetypes, records of poker decisions, and remembered relationship events. NPCs can play against each other in scripted or simulated offscreen events between encounters. Offscreen event results are bounded by consistent resources and cannot overwrite the player's already-resolved game states.

---

## 3. Core gameplay loops

### Per poker decision (5–20 seconds)

Evaluate cards/board, opponent ranges, effective stacks, revealed magic, current pot and position. Decide: fold/check/call/bet/raise/all-in; optionally cast a legally timed spell drawn from the Spellbook. Read feedback and opponent behavior.

### Per hand (30–90 seconds target, speed controls enabled)

1. Rotate dealer button, assign blinds and post bets; handle short all-in blind posts.
2. Shuffle an authentic 52-card poker deck; deal two private cards to every active player.
3. Draw three spell cards from personal secondary Spellbook (reshuffle exhausted spell discard at the next legal draw); one cast per hand by default.
4. Allow opening legal pre-flop magic window where applicable, then pre-flop betting.
5. Burn/reveal flop (3), then betting; burn/reveal turn (1), then betting; burn/reveal river (1), then betting.
6. For each street, resolve any mutually applicable publicly announced magic before affected betting choices.
7. If all but one player folds, that remaining player wins without needing to show hole cards. Otherwise compare best five-of-seven poker hands, with side pots and ordinary tie handling; reveal only required hands.
8. Return uncalled excess wagers; award pots and update all stacks; run zero-chip checks and Last Claims only after settlement.
9. Resolve spell experience, rival observations, event triggers and new-hand preparation.

Baseline poker follows published tournament-standard mechanics, including clockwise action, opening pre-flop position, correct minimum raises, reopening rules after short all-ins, and main/side pots. Official rule anchor: <https://www.pokertda.com/view-poker-tda-rules/> (2026 Poker TDA). Any deliberate fantasy departure must have a separate, public exception.

### Per table (6–12 hands for contract tables; elite tables may extend)

Meet 2–3 independent AI opponents at 3- or 4-handed tables (occasionally heads-up story duel). Learn tells and rival behavior. Win stacks through ordinary poker. The table's public entry rules determine success:

- **Contract table:** at a fixed hand limit (prototype 8 hands), achieve a declared objective, such as finish in the top 2 stacks and retain at least one Lifechip. Failure without bankruptcy costs status/opportunity and advances to a setback branch; survival is not always contingent on outright table victory.
- **Last Survivor:** blinds escalate until one player remains. Any player busted resolves a Last Claim immediately. These tables occur at pivotal story beats, not every room.

Table payouts are backed by competitor losses or a clearly identified organizer treasury; never conjured out of nowhere. Each AI has its own bankroll and stack, rather than mirroring the player through cheating.

### Per run (approximately 45–90 minutes target; save and resume)

Three acts; each contains two main tables, 1–2 optional nodes (shop, pact, event or service) and one major showdown, plus an alternative Fallen route when triggered. Encounter paths branch but reach at least one ending. Player may stop at any moment; deterministic saves preserve deck/RNG state and hand state.

### Between runs

Death concludes that character's arc. Metaprogression can unlock starting backgrounds, opponents, spell families, cosmetic designs, and lore, but should not provide giant numerical buffs or extra permanent Lifechips. A new run begins with a new character; a world legacy may reference a predecessor without undoing death.

---

## 4. True multiplayer Hold'em engine

Three or four seats (including the player), every other player autonomous AI. Duel mode remains available for a special story arc but is not the core experience.

- Standard 52 unique poker cards, 2 private per active player, 5 shared board cards dealt flop/turn/river; the best five-card hand uses any combination of hole and community cards.
- Button rotates through active seats. At 3+ seats: left of button posts small blind, next posts big blind; first action preflop is left of big blind; on later streets first active seat left of button acts. Heads-up special case: button posts small blind and acts first preflop, last postflop.
- Check, fold, call, bet, legal no-limit raise and all-in implemented; proper minimum raise, short-all-in reopening rules, turn order, and dead/absent-seat treatment.
- At least one separately funded side pot for unequal all-ins; players only eligible for pots they contributed to; contested and uncontested pots awarded with correct ties; odd-chip rules publicly defined.
- Pot/stack conservation and zero duplicate-card invariant are automatically checked on every state transition.
- Opponent AI only sees legal public information, its own hole cards, and anything obtained by a properly paid revelation spell; no peek at full hidden deck.
- All hand results fully reproducible by random seed and action log. Builds and balance should be testable via automated simulation.

**Multiway challenge:** An AI player makes decisions against ranges of multiple opponents and may fold or bluff even when the human folds; AI agents do not coordinate simply to punish the player.

---

## 5. Living magic: Spellbook, Aether, affinities and evolution

**Two separate decks:** The poker deck is a normal shared 52-card deck. Each character also owns a private magical Spellbook deck. Spells never silently replace poker cards or act as additional hole cards.

### Prototype Spellbook rules

- Initial Spellbook: 8 spells per character; minimum 8, maximum 12 through editing, duplication limited by rarity and rules.
- At beginning of each poker hand, draw 3 spells into a magical hand. Unused spells go to magical discard at end of poker hand. Spells cast are placed in magical discard or exhaust as printed. Reshuffle discard into draw when next draw requires cards. A depleted draw pile never produces infinite card copies.
- One spell cast per poker hand by default. Some rare, explicitly printed rule modifiers may grant extra casts; hard-cap exceptional casts at 2 for early balancing.
- Aether starts at 2, maximum 3 (prototype). Recover 1 Aether after participating in a showdown (never simply from folding); other gains must be explicitly printed and capped. Aether is not chips and cannot replace the cost of a wager.
- Each spell has cost, phase/timing tag (before first preflop action, before a street opens, at own decision, on showdown, etc.), targets, public tell, resolution, and a deterministic conflict priority.
- Casting a spell while not legally eligible or after all-in action is closed is rejected. Cannot retroactively change a resolved bet or hand result.

### Disciplines

- **Ember (Hearts):** aggression, bluff incentives, volatility and energy on called raises.
- **Veil (Spades):** information, deliberate misdirection, scouting opponents and counter-reading.
- **Thorn (Clubs):** control of permissible bet sizes, defensive consistency and long-term stack discipline.
- **Mirror (Diamonds):** carefully delimited card manipulation, odds and foresight.

### First spells (for tech prototype)

1. **Cinder Challenge**, Ember, 1 Aether: mark your next legal raise this hand. If called and you win at showdown, regain up to 2 Aether; if opponents all fold to the enchanted raise, regain up to 1. Only resolves once; cannot exceed cap.
2. **Unmask**, Veil, 2 Aether: see one randomly chosen hole card belonging to one opponent still in the hand. Only you receive the information. The opponent sees that Unmask was cast.
3. **Briar Lock**, Thorn, 1 Aether: before betting begins on the current street, change that street's betting ceiling to pot-limit for everyone. All-in raises remain legal only within that ceiling; previously committed chips are unaffected. This is a clearly announced fantasy deviation from standard no-limit.
4. **Fate Exchange**, Mirror, 2 Aether: before any pre-flop betting action, exchange one of your hole cards with a uniformly random card from the unused deck. Return the discarded card to the unused deck after drawing replacement, then shuffle. Already dealt hole cards remain untouched. Announce the cast but conceal discarded/replacement identities; cannot duplicate cards.

### Growth feels alive — not +5% statistics

Each spell carries **Resonance**: experience earned from limited meaningful events, not from spam. After satisfying a milestone it offers mutually exclusive evolution branches, with new art, audio, story and strategic behavior. Example: Unmask → Twin Oracle (one random card each from two different remaining opponents) or Ravenous Eye (both hole cards from one opponent, then exhaust spell for table). The choice is permanent for that run unless an explicitly priced retraining option is used.

**Affinities** attach to suits, ranks and motifs (e.g., Queens, clubs, paired boards). They grant bonuses triggered by normal legal poker events, not altered hand rankings. Players can build a character identity around a suit/rank without stacking impossible duplicate poker cards.

**Spell fusions** combine compatible evolutions, but consume or replace components rather than giving free extra slots. Hard synergies have explicit costs and counterplay. **Relics** are passive rules (prototype 5 slots); **Covenants** are large tradeoffs (prototype 2 slots). Strongest builds modify decisions and information, not chips directly.

**World-responsive magic:** Repeated lies, public victories, servitude, patron allegiance, table type and spell origin can create cosmetic mutation, specific new branches and rare interaction unlocks. The player's existing choices matter; events don't mutate spells arbitrarily without preview or consent.

**Magic boundaries:** no spell can generate/steal/destroy Lifechips directly; no hidden card rigging; no impossible duplicate cards; no retroactive pot change; no unstated hand-rank changes; no casting after a hand is settled.

---

## 6. AI players and world continuity

Each AI agent has:

- **Poker profile:** preflop range model, aggression, bluff frequency, risk tolerance, adjustment to stack/blinds, pot odds, position and multiway equity approximation.
- **Magic profile:** legal Spellbook state, Aether, phase constraints, targeted spell utility, synergy goals, ability awareness.
- **Social profile:** status, allegiances, grudges, debts, mercy tendency, political ambitions, willingness to bargain.
- **Bounded memory:** estimated human frequencies (fold to raise, showdowns, betting sizes) based solely on visible hands/actions; updated gradually; persistent story memory across encounters.

Archetypes (prototype):

1. **Lady Vesper**, aggressive noble, Ember, intimidates short stacks; may spare for service if personally advantageous.
2. **The Sightless Oracle**, patient information collector, Veil/Mirror, often calls weak bluffs and favors complicated bargains.
3. **Sir Corvin**, disciplined survivor, Thorn, folds marginal holdings and generally considers funded mercy.
4. **A wild-card broker**, Mirror, shifts strategies and trades magical artifacts rather than demanding service.

**Fairness invariant:** AIs cannot know unopened board cards, hidden human hole cards or human spell draw order unless their declared effects legitimately reveal them. Increase difficulty through ranges, decisions, aggression and sophisticated decks — never by fixing deals.

AI decisions are implemented in a fast, testable local rules/equity engine. Full text-generating language models are not required per turn; authored or templated dialogue with remembered variables keeps mobile play fast/offline. Rival-to-rival interactions occur even if the player folds. Save each character's actual chip transfers, not just scripted narrative outcomes.

---

## 7. Bargain negotiation and ethical presentation

When Last Claim offers bargaining, use a small negotiation scene, not an automatic 'retry for free' button.

**Offer schema:** proposer, claimant, bargain type, funded endowment, payment/obligation, duration, reputation consequences, acceptance conditions, and immutable outcome log. A claimant may demand a different contract or refuse entirely; repeated negotiation attempts are limited (prototype one counteroffer) to avoid exploiting AI.

**Types:** mercy, debt, sworn service, lost status/identity, bonded spell ownership, adult-only implied personal companionship/patronage. Never depict sexual acts or make sexual access a collectible reward. An agreement made under threat of death is coercive in-world and must be framed as such, with consequences and routes to resistance or freedom rather than glamourized romance.

The game can let a player offer to enter such an unequal relationship, and the player may impose binding non-explicit personal-service terms on adult NPCs, but all story outcomes stay non-graphic and can be avoided without missing mandatory gameplay mechanics. Include optional mature-theme content preferences.

If the claimant funds a contract, these Lifechips leave their balance and enter the survivor's balance; the loan is a tracked obligation, not free money. The game should not automatically release a service NPC into a player's magic inventory or permanently stop their agency.

### Prototype acceptance model (for testing, not player-facing raw percentages)

Start with a claimant's disposition and financial capacity. Modify by expected utility of the proposed service/debt, reputation, past history and the feasibility of the offered transfer. Avoid uniform 50/50 dice-roll drama. Examples: harsh enemies rarely spare; a former ally more likely; a patron with no Lifechips to lend cannot fund survival. Death remains the default when no legitimate bargain concludes.

---

## 8. Economy and pacing — proposed calibration

**Starting character:** 100 Lifechips; blind level at first tables 1/2; 8-card beginner Spellbook; 2/3 Aether; no Covenant; 1 minor starting relic or an equivalent background selection.

- **Act I:** 1/2 blind tables, 3-handed or 4-handed, 1 active spell per hand; basic relics; poker decisions dominate.
- **Act II:** 2/4 typical blinds (announced), majority 4-handed, evolution and first Covenant, broader AI ranges.
- **Act III:** 4/8 typical blinds, 4-handed elite tables, high-impact but limited synergies, major fate choices.

These levels are only seed parameters. Because stacks can change drastically, each table should publish a minimum entry balance and a clear blind schedule. An opponent's initial stack is drawn from an explicit narrative/table budget, not copied from the player's exact bankroll to rubber-band against them. Avoid impossibly expensive mandatory entry points when the player is still alive; provide a difficult but achievable recovery route through Cinder tables or debt work. That route must still put Lifechips at risk.

**No repetitive buy-in farming:** The player cannot freely reset a profitable table to replay passive AI. Tables have finite contracts, changing rivals and story consequences. Shops consume Lifechips through real transfers and risk bankrupting an over-spending character, so the UI forecasts remaining stack after every purchase.

**Target run:** around 45–90 minutes on first successful standard route, broken into fast individual poker hands, with mid-hand saving/resuming. These values are goals to test, not promises.

**Key balance metrics to simulate** (10,000+ deterministic hands with varied AI agents, then complete runs): chip conservation violations = 0; illegal betting states = 0; duplicate poker cards = 0; player win rates by skill and spell archetype; expected stack at act boundaries; frequency of bankruptcy and successful Last Claim; time/hand; spell use rates; dominant synergy/loop prevalence; AI-vs-AI elimination rates; perceived fairness in blind escalation.

**Initial design targets** to evaluate, not hard guarantees: beginner full-run survival below experienced-player survival, no build with near-certain victory, no single spell offering universally superior expected value, meaningful difference between tight/aggressive/counterplay archetypes.

---

## 9. Example story trajectory

**Opening:** An unranked Wagerer enters a Lantern district table with 100 Lifechips. They play authentic multiway poker with sparse magic, noticing one rival habitually raises from the button.

**Early build:** They gain a Veil card, evolve Unmask into an information-focused variant and accumulate enough chips to access Gilded Circuit invitations.

**Crisis:** A four-handed table creates a multiway all-in. Side pots are awarded correctly; the protagonist loses the last Lifechip to a named rival. Last Claim starts. A former acquaintance considers funding a debt covenant but may refuse.

**Fall:** The protagonist agrees to an offered covenant. The rival transfers 10 real Lifechips as survival capital, and the protagonist becomes Fallen in Cinder Warrens, losing elite access and carrying a binding obligation. Their spells now offer one alternative social evolution branch.

**Recovery:** The player wins low-stakes hands, trades favors, repays or challenges the patron, and can return to social ascent — with changed enemies and relationships. A second unrescued bankruptcy ends that character's run.

The same world rules apply if an AI NPC goes bankrupt: it may die, become another character's debtor, or be spared by the player if funded. No character is exempt just because the plot prefers it.

---

## 10. Production architecture: ChatGPT × Claude

**ChatGPT owns:** canonical design decisions, mathematical assumptions and balancing briefs, lore/characters, art bible, concept art, actual exportable UI/card/environment assets and visual review. Every design change increments this spec's version with a clear change log.

**Claude owns:** TypeScript/Phaser codebase, rules engine, data schemas and state machines, AI agents, save/resume, UI implementation, tests, packaging, deployment and reproducible debugging.

**Shared artifacts:**

- `docs/design-bible.md` (this file)
- `docs/poker-rules-exceptions.md` (explicit magical deviations from Hold'em)
- `docs/economy-balance.csv` (simulation parameters and empirical outcomes)
- `docs/art-bible.md` (palette, proportions, typography, game-view references)
- `docs/asset-manifest.json` (IDs, file paths, alpha, pixel dimensions, license/origin, status)
- `docs/change-log.md` (approved changes, their gameplay/visual impact)
- `src/game/rules/` (pure poker rules and tests)
- `src/game/magic/` (timing-constrained magic event layer)
- `src/game/world/` (characters, quests, contracts, Last Claim)

**Proposed platform:** Phaser + TypeScript + Vite, exported as mobile-first PWA to Safari's Home Screen on iPhone, with future native wrappers only if actually required. Optimize for portrait play, responsive layouts, short animations that can be skipped, tap targets, no internet requirement for AI turns, autosave and correct app restore.

### Execution milestones, in order

- **P0 — Poker kernel:** no graphics dependency. Test deal, ranking, legal action generator, button/blinds, all-ins, short raises, multiple side pots, ties, pot conservation, seeded hand log. Reject advancement unless these pass.
- **P1 — One actual 4-seat table:** player plus 3 distinct local AI agents; full poker hand interactions, chip stacks, no magic yet; phone browser playable with immediate save/resume.
- **P2 — Magic kernel:** separate Spellbooks, Aether, legal timing, first four spells, observable magic tells, determinism, no duplicate cards or chip leaks.
- **P3 — Life and consequences:** zero-chip interrupt, non-graphic Last Claim UI, debt endowment transfer, NPC claims, Fallen starting state and basic social effects.
- **P4 — Roguelike slice:** compact path with multiple tables and one boss, spell evolutions, relic choices, one Covenant, shops and a small recurring NPC cast.
- **P5 — Visual polish:** integrate coherent ChatGPT-produced real asset PNGs, ornate card faces/backs, chip stacks, narrative portraits, menu panels, touch interactions, animations, audio and performance metrics.
- **P6 — Balance and QA:** large automated simulations; assess beginner/experienced AI difficulty, avoid infinite resource loops, manually play full runs, test fresh install and iPhone Safari/PWA lifecycle.

Each milestone ends with a runnable, testable mobile build. Never postpone first playable delivery until all art is completed; never ship art mockups as if they were real functional controls.

---

## 11. Non-negotiable acceptance tests

1. 4-seat deal contains eight distinct hole cards; board never duplicates any dealt card.
2. A short all-in raise does not illegally reopen betting.
3. Different effective all-in contributions correctly form main and side pots; every pot paid to eligible winners only.
4. A folded player cannot win a pot, and uncalled excess is returned.
5. At hand settlement, sum of all player stacks plus awards equals pre-hand chip total; a player cannot gain chips merely by casting a spell.
6. AI cannot access unrevealed player hole cards through code or heuristics unless a legal reveal happened.
7. When a player has exactly 0 chips after settlement, Last Claim interrupts gameplay before the next hand.
8. A negotiated survival transfers actual chips from a named funder, sends character to Fallen state and records debt; a rejected proposal ends in death.
9. A magic card evolves only after valid triggers, replaces its earlier spell version and does not duplicate itself in draw/discard.
10. A saved in-progress hand restores exact stacks, hole cards, deck order, spell draws, turn and RNG state.
11. A player can lose a contract table objective while remaining alive with chips and reaching a setback path.
12. A real iPhone portrait viewport can complete a four-handed poker hand without overflow or inaccessible betting actions.

---

## 12. Open design questions / deliberate placeholders

The overall genre, stakes and AI tables are approved. The following are not yet finalized:

- Final game title, realm name, house factions and characters.
- Exact probabilities and cost curves for spell evolutions, patron mercy and shops.
- Exact tournament blind progression and boss victory conditions after data is collected.
- Whether contract bargaining should have timed pressure or be untimed (mobile-friendly default: untimed).
- The complete spell catalog and frequency distribution of effects.
- Mature-theme preferences, accessibility and localization choices.

**Design decision procedure:** if a new idea conflicts with the above invariants, change the idea or explicitly version and justify the invariant. Do not implement silent exceptions.
