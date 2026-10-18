# THE LAST WAGER — P0/P1 review and P2 production decisions

**Authoritative design handoff · bible v0.3 → v0.4 · 18 October 2026**  
**Status:** proposed approved design decisions for Claude to integrate; implementation and simulations remain Claude's responsibility.  
**Reference:** actual `saveriobanchi/Poker/docs/asset-manifest.json`; all asset names adhere to its rank/suit IDs and portrait variants.

**P0/P1 review:** user-provided report says 10,000 random hands had 0 invariant failures, AI-only profiling ~7,000 hands yielded Vesper VPIP/PFR 34%/32%, Oracle 29%/11%, Corvin 17%/12%, and ~14% hands reached showdown. Strong baseline; no claim of independent verification.

### DESIGN CHANGE — bible v0.3 → v0.4 · 01: Moving-button policy

**What:** Approve the existing moving button after seat elimination.

**Rule text:** Dealer button advances to next active seat; no dead button. Recompute SB/BB and legal first actor, including transition from 3+ players to heads-up.

**Numbers:** No ante; blinds unchanged at 1/2 in P2.

**Invariants touched:** Active-seat rotation, blind collection, acting order, chip conservation.

**Acceptance test:** Eliminate an SB/BB/button occupant in 4-handed and 3-handed tables; next 3 hands give correct blinds and position; every chip conserved.

### DESIGN CHANGE — bible v0.3 → v0.4 · 02: Showdown disclosure

**What:** Retain P1 reveal-all-live-hands policy for P2.

**Rule text:** At contested showdown reveal hole cards of every nonfolded player who remains eligible, including side-pot participants. Never reveal folded hole cards except via legal magic; never alter pot allocation. Revisit optional mucking in P5.

**Numbers:** All live hands at showdown; zero folded hands revealed automatically.

**Invariants touched:** Private-information visibility, AI hand histories, result presentation, RNG.

**Acceptance test:** One 4-way side-pot showdown exposes precisely live players; a folded player remains secret to all except legal prior Unmask caster.

### DESIGN CHANGE — bible v0.3 → v0.4 · 03: No antes

**What:** No forced antes until separately approved.

**Rule text:** Start each hand with SB and BB only. No antes are posted or required at any stage of P2–P4.

**Numbers:** Ante 0.

**Invariants touched:** Pot initialization and betting state; blind invariants.

**Acceptance test:** Fresh hand initial pot equals actual SB+BB posts, including short-all-in cases; ante is always zero.

### DESIGN CHANGE — bible v0.3 → v0.4 · 04: Check and short all-ins

**What:** Affirm established poker action rule.

**Rule text:** A player who checked in current round may legally raise when facing an initial short all-in bet, subject to minimum legal raise; a short all-in raise after that player already bet or raised does not automatically reopen action.

**Numbers:** No numerical changes.

**Invariants touched:** Legal action generator, minimum raise/reopening.

**Acceptance test:** A checks → B makes short opening all-in → A may raise if stack allows. A bets → B short all-in raises → A may not reraise unless action has reopened.

### DESIGN CHANGE — bible v0.3 → v0.4 · 05: Spell windows and effects

**What:** Resolve P2 spell timing, target information and effect order.

**Rule text:** Use four spells and the p2-spells.json table. Street-opening spells resolve before first voluntary poker action in clockwise action order, with preflop opening after blind posts. Own-action spells resolve as atomic legal actions. Do not allow spells after all-in runout or hand resolution. After pot settlement, base showdown Aether regeneration then Cinder bonus, capped at 3.

**Numbers:** 2 starting Aether, cap 3, +1 for a live showdown participant, 1 spell/hand. Priorities Fate 10, Briar 20, Unmask 30, Cinder 40, regen 90.

**Invariants touched:** 52 unique physical cards, privacy, chip conservation, deterministic RNG and replay, one-cast rule.

**Acceptance test:** Invalid spell action leaves chips, Aether, RNG and hand state unchanged; serialized replay reproduces target/card reveal/effect precisely. One spell per actor per hand.

### DESIGN CHANGE — bible v0.3 → v0.4 · 06: Starting Spellbook

**What:** Keep P2 to four fully implemented spell types; use duplicate starters.

**Rule text:** Each participant has an eight-card Spellbook. Player starts with 2 copies each of Cinder Challenge, Unmask, Briar Lock and Fate Exchange. Shuffle with independently seeded spell RNG, draw 3 at hand start; unresolved cards discard at hand end.

**Numbers:** Player counts 2/2/2/2. Deck min 8 max 12.

**Invariants touched:** Spell card ownership, draw/discard, save/restores, no copied poker cards.

**Acceptance test:** After every hand, cast/unused spell instances move exactly once; across reshuffles total owned card instances remains exactly 8 until a paid edit.

### DESIGN CHANGE — bible v0.3 → v0.4 · 07: Rival Spellbooks

**What:** Give the 3 AI rivals fixed theme-weighted eight-card starter decks.

**Rule text:** Vesper: 3 Cinder,1 Unmask,2 Briar,2 Fate; Oracle:1 Cinder,3 Unmask,1 Briar,3 Fate; Corvin:1 Cinder,2 Unmask,3 Briar,2 Fate. AI pays Aether and follows all legal windows. No hidden card access except declared Unmask.

**Numbers:** 8 per NPC (see p2-spells.json).

**Invariants touched:** AI information boundary, RNG, parity, resource caps.

**Acceptance test:** 1000 sampled AI hands: no illegal spells, Aether below 0/above 3, duplicate cards or unauthorized private disclosures; repeated seed/actions yield same outcomes.

### DESIGN CHANGE — bible v0.3 → v0.4 · 08: Briar Lock nonretroactivity

**What:** Accept street-opening-only model; no earlier voluntary bets can exist.

**Rule text:** Briar Lock may only resolve in the street-opening magic window, with all currently committed chips (including blinds) unchanged. Pot-limit cap applies only to later bets and raises on that street; ordinary no-limit returns next street. Reject cast after first voluntary betting action and reject double-cast if limit already active.

**Numbers:** Cost 1 Aether; duration one street.

**Invariants touched:** Bet ceilings, short raise/reopening, forced-blind accounting, card chip invariants.

**Acceptance test:** Cast preflop before action and postflop before first bet: legal pot-limit caps apply. Try after first voluntary bet: reject no charge. Follow next street: no-limit restored.

### DESIGN CHANGE — bible v0.3 → v0.4 · 09: Eight-hand Contract Table and setback

**What:** Fix P4 prototype win and survival path.

**Rule text:** A Contract Table finishes after eight fully settled poker hands or sooner if one player remains. Player succeeds if alive (>=1 Lifechip) and ranked first or tied/second by remaining Lifechip stack. Failure while alive: no contract reward; lose 1 Favor reputation point, floor -3; next route must include one recovery/low-status contract before elite access. No arbitrary chip fine; losses are already real wagers. Failure at 0 chips triggers Last Claim before ranking check.

**Numbers:** 8 hands; top two (ties for 2nd count); >=1 Lifechip; setback -1 Favor floor -3; one mandatory recovery node.

**Invariants touched:** Lifechip economy, encounter progress, reputation, Last Claim priority.

**Acceptance test:** Eight settled hands with player third and 5 chips -> setback, chips unchanged. Player tied for 2nd and 1 chip -> succeeds. Player 0 chips on 8th -> Last Claim; no standard setback. Early single survivor -> table ends.

## First four P2 spells — authoritative schema

| id | name | discipline | aether cost | timing window | target | public tell text | effect | exhaust or discard | conflict priority |
|---|---|---|---:|---|---|---|---|---|---:|
| cinder_challenge | Cinder Challenge | Ember | 1 | Own poker action, immediately before a legal raise; cast+raise atomic | Self; chosen legal raise | The wager burns with cinderlight. | On successful legal raise, mark that raise once. If at least one opponent calls that raise and caster later wins a contested pot including that caller at showdown, grant +2 Aether. If instead all opponents immediately fold to the raise, grant +1 Aether. No reward on tie, later uncontested win, caster fold or caster loss. Normal showdown regeneration resolves first; all capped at 3. | Discard at hand end; marker expires after hand; exactly one resolution | 40 |
| unmask | Unmask | Veil | 2 | Own decision, any street after hole cards dealt and before own poker action | One active opposing seat with two hole cards | A violet eye opens above the chosen rival. | Uniformly choose one of target two hole cards and reveal its identity privately only to caster; public observers see target and cast but not card. Hidden info persists to caster for this hand only. | Discard at hand end | 30 |
| briar_lock | Briar Lock | Thorn | 1 | Street opening magic window (preflop after blinds / postflop before first betting action) | Whole table for current street | Thorns bind the stakes. Pot-limit this street. | For the current street only, every legal bet/raise, including all-in attempts, is restricted by standard pot-limit maximum computed from current pot, outstanding bet and call amount. Existing contributions, including blinds, are unchanged. Rejected if street already locked or terminal with no betting. | Discard at hand end; modifier expires at street end | 20 |
| fate_exchange | Fate Exchange | Mirror | 2 | Preflop opening magic window, after hole cards dealt and blinds posted, before first voluntary bet | Exactly one of caster’s hole cards | A mirrored card turns face-down in the Wagerer’s hand. | Choose 1 own hole card. Draw a uniformly random replacement from undealt poker deck; only after drawing, return discarded card to undealt pool and shuffle. Never touch board, burn or other hole cards. The identity of old/new card is private to caster. | Discard at hand end | 10 |

### Magic ordering / determinism

Street-opening windows are processed one participant at a time in normal street action order (preflop after blind posting, postflop after board revelation); all decisions are recorded before the first ordinary betting action. Only one effective Briar Lock per street; later proposals rejected without consuming Aether or card. No preflop spell may retroactively rewrite blinds. Fate Exchange draws first, returns selected old card second, then reshuffles undealt stub; legal distinct cards are guaranteed. Atomic Cinder cast is rejected with no expenditure when the accompanying raise is illegal. Unmask reveals exactly one target card only to the caster; the AI information projection respects this. Settlement returns all chips/refunds and awards pots before regeneration. No spell activity is possible after legal betting closes for an all-in runout.

**Card note:** private card visibility must be authorized per opponent, not broadcast accidentally through public hand-history or UI logs. At fully settled showdown, v0.4 intentionally reveals all live hands; folded cards remain private.

### Beginner Spellbook (8)

`cinder_challenge ×2; unmask ×2; briar_lock ×2; fate_exchange ×2`

### AI starter books (8 each)

- Lady Vesper: `cinder_challenge ×3, unmask ×1, briar_lock ×2, fate_exchange ×2`
- Sightless Oracle: `cinder_challenge ×1, unmask ×3, briar_lock ×1, fate_exchange ×3`
- Sir Corvin: `cinder_challenge ×1, unmask ×2, briar_lock ×3, fate_exchange ×2`

### Contract setback note

The -1 Favor is a **social consequence**, not a chip loss, magic chip tax or death substitute. An active zero-chip Last Claim always takes priority. Ranks are computed only after chip settlement. No contract ever credits chips without a specified counterparty or organizer treasury.

## Source-of-truth files

- `docs/art-bible.md` — design language, palette, typography, visual export rules and prototypes.
- `docs/p2-spells.json` — exact schema and loadouts in machine-readable format.
- `docs/asset-manifest.json` — copy of current manifest with sample asset statuses set to delivered (but not integrated).
- `public/assets/cards/back.png`, `As.png`, `7h.png` — 150×210 RGBA.
- `public/assets/portraits/vesper.png`, `oracle.png`, `corvin.png`, `wagerer.png` — 512×512 RGBA.

**Review caveat:** outputs are visual proof-of-direction, not final commissioned 512px illustration. In particular `wagerer.png` is a recolored/modified source portrait and must be newly illustrated before final release. No repo commits made by this handoff; Claude should import these files and test them in the PWA.
