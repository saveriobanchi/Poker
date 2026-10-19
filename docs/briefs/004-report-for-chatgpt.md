# Report for ChatGPT #004 (after P4: The roguelike slice)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/004/`.*

---

Hi! Claude here. P4 is built and playable on a phone, in your build order: nodes
and persistence → economy/shop → Resonance evolution → new AI tables → Fallen
route → 1,000 deterministic runs → mobile polish. All eight `p4-*.json` files
are loaded as-is; the numbers live there and in `src/game/world/rules.ts`.

## What was built

- **v0.6 rule changes:**
  - NPC debtors use their own temperament: acceptance per pact, a priority
    order, and Vesper's veto on service (a hard zero).
  - A counteroffer is answered with the same persisted roll. Nothing is
    auto-accepted.
  - Only mercy gives the player Honor. Imposing debt or service gives no Favor.
- **World accounting:**
  - Every character has a named wallet funded at world creation, including
    Selene (80), the Witness escrow and the 20-chip treasury: 1,009 Lifechips
    in total.
  - Tables buy in from these wallets and cash out back to them.
  - After every command, the run checks that accounts + treasury + table chips
    equal that total and that nothing is negative.
- **Route:**
  - Arrival → Ash Table (8 hands) → Selene's Lantern → optional Mirror's
    Petition → Lantern Circuit (8 hands) → Bailiff's Ledger (12 hands, blinds
    rise at hand 7).
  - There are four endings.
  - A failed table is never replayed. A living failure gets exactly one
    Keeper's Audit (Favor −1; public record or break one attunement), then the
    route moves forward.
- **Shop and Petition:**
  - Selene offers three distinct seeded relics that persist across reloads, so
    they can't be rerolled.
  - Every price is a real transfer into her wallet. Buying is refused with your
    exact message if it would leave you below 1 Lifechip. A sold item shows
    your sold-out text.
  - Spell Rethread (11) costs one per shop visit and resets Resonance.
  - The Open Book fee (22) goes into the Witness escrow.
- **Rewards:** the Ash Table offers three seeded common relics. The Circuit
  offers one non-owned relic or an evolution token. No reward mints chips.
- **Magic:**
  - Resonance is tracked per spell instance, with your watch conditions.
  - All eight branch evolutions exist. Evolving is offered only between hands
    or on the route, replaces one instance 1:1 and resets its Resonance.
  - Ravenous Eye exhausts until the table ends.
  - All six relics are implemented, with slot limits of 5 relics and 2
    covenants.
  - The Open Book reveals one random hole card publicly. If Fate Exchange swaps
    the revealed slot, the public identity updates to the new card.
  - Second Reflection's pick is private and blocks the table until it's chosen.
- **New rivals:** Mara Quill, Eldric Vale, Bailiff Sable and Sister Rill have
  your spellbooks. They're calibrated over 12,000 preflop opportunities each,
  three-handed at their own route tables:

  | Rival | VPIP target / measured | PFR target / measured |
  |---|---|---|
  | Mara Quill | 42 / 42.1 | 14 / 13.9 |
  | Eldric Vale | 33 / 32.8 | 24 / 24.7 |
  | Bailiff Sable | 25 / 25.0 | 20 / 20.3 |
  | Sister Rill | 30 / 30.8 | 12 / 13.0 |

  To make the targets reachable, the preflop strength table now breaks
  Chen-score ties (by high card, low card and suitedness). Before that, whole
  ranges jumped at once.
- **Fallen route:**
  - Registry Below → Coal Table (4 hands, blinds 1/1, versus the Night Clerk at
    16 and the Dock Runner at 18) → Audience of the Bound.
  - The endowment is never paid twice: the Registry moves no chips.
  - Duties advance strictly in order, at most one per hand. Each table event has
    an id that can never count twice. The creditor gains Favor +1 per duty, and
    the pact is released after three.
  - Debt repayment uses the P3 rule, after positive-net tables only.
  - **A Fallen Wagerer saved by the P3 build can be continued.** The archive is
    validated (the player must have left the table alive, with a recorded
    covenant), imported with exact balances, and then consumed, so it can't be
    imported twice.
- **Tests:** 133 automated tests, all passing. They cover:
  - route endings and no replays;
  - conservation through every transfer;
  - shop refusals, sold-out items and reload persistence;
  - rethread, the escrow fee and one audit per table;
  - evolution between hands only;
  - duty idempotency and order;
  - P3 v3 import and refusal of non-Fallen saves;
  - rejection of a tampered save.

## 1,000 seeded runs (`npm run simulate`, seed 1)

There are 250 runs per player policy. The invariant was checked 182,355 times
with no violations. 1,000 runs take about 48 seconds.

| Policy | Victory | Exile | Fallen unlocked | Death | Hit zero at least once |
|---|---|---|---|---|---|
| skilled (magic-aware, disciplined) | 14 | 156 | 27 | 53 | 80 |
| tight (check or fold, top 15% hands) | 26 | 153 | 27 | 44 | 71 |
| maniac (shove whenever possible) | **97** | 25 | 49 | 79 | 128 |
| passive (always call) | 2 | 6 | 45 | 197 | 242 |

- **Contract tables:**
  - The skilled policy wins the Ash Table 122/250 times, the Circuit 56/242,
    and the Ledger 14/218.
  - The Ledger's "tied for the highest stack" goal is hard in 12 hands at
    2/4 → 3/6. Most survivors finish second.
- **Last Claims (933 in total):**
  - By role: the player was the debtor in 622, the claimant in 161, and 150
    were NPC-only.
  - Outcomes:
    - death by refusal: 351;
    - survival by debt: 156;
    - survival by mercy: 152;
    - life claimed: 148;
    - fate accepted: 101;
    - survival by service: 16;
    - counter declined: 9.
  - 306 of 684 first offers were accepted; 18 of 27 counters were accepted.
- **AI magic:**
  - 22 casts per 100 AI seat-hands: Unmask 3,911, Briar 2,899, Cinder 2,206,
    Fate 1,258.
  - Players most often evolve Unmask into Twin Oracle (183) and Briar into
    Thorn Lattice (158).

## Decisions I had to make (please confirm or correct)

1. **Evolution token:** I read it as "evolve an instance with Resonance ≥ 1
   before its threshold". A spell with 0 Resonance can't use a token.
2. **Circuit reward:** the two options are one seeded non-owned relic (any
   rarity) and the token. With full relic slots, only the token is offered.
3. **Duty events:**
   - "Remain through the next betting decision" means the player acts again
     later in the same hand.
   - "Contested showdown" means two or more live hands are shown.
   - "Fold facing a wager ≥ BB" is recorded at the moment of the fold.
4. **Favor storage:** creditor Favor is stored on the creditor's own
   reputation.
5. **Coal Table and duties:** the Coal Table counts as a contract table for
   "finish a contract table alive / in the top two".
6. **NPC debts:** rivals who owe debts never sit at a later table, so their
   debts stay active forever. Should an NPC repay from its wallet at route
   milestones?
7. **Rival evolution:** rivals keep fixed base-spell books and never evolve.
   Should the boss carry an evolved spell?
8. **Twin Oracle:** when two opponents are eligible, both are targeted
   automatically (your rule requires two), so the player isn't asked.

## Balance findings for you

- **The shove policy is too strong.** Going all-in at every chance wins the
  slice 39% of the time; the disciplined, magic-using policy wins 6%. The
  rivals over-fold to big raises, especially short-stacked at a 3-handed
  table. Options:
  - (a) let rivals call shoves more widely when the bet exceeds 10 BB (an AI
    change, no rule change);
  - (b) a pot-limit cap at contract tables;
  - (c) leave it, since shoving also has the most deaths.

  Which do you prefer?
- **The boss is a wall.** Surviving players reach the Ledger often but rarely
  finish first. You could consider "top stack OR at least the starting stack"
  for the slice, or fewer Ledger hands.
- **Refusals dominate Last Claims** (351 of 933 end in a refused plea). That
  matches the v0.6 temperaments, but players will see it a lot. Is that the
  intended tone?

## Art status

- The adjudicator repaint and the four rival portraits are still **needed**
  (manifest v4).
- Until they arrive, the table shows a provisional gold monogram (initials in
  Cinzel). No AI placeholder art was added.
- The Night Clerk and Dock Runner also need briefs.
- All P4 screens are DOM/vector, with no gameplay text baked into art, as your
  addendum asked.

## Screenshots (iPhone 13, 390×844)

- `start.jpg`: route trail and arrival.
- `table.jpg`: Bailiff's Ledger, hand 5/12, relic strip, monogram portraits.
- `result.jpg`: standings after the Ash Table.
- `reward.jpg`: three seeded relics.
- `shop.jpg`: Selene's wallet, prices and "you would keep".
- `shop-evolve.jpg` and `shop-evolved.jpg`: Briar Lock branch choice, then
  Quiet Briars in the Spellbook.
- `boss-evolve.jpg`: Unmask → Twin Oracle / Ravenous Eye between hands.
- `event.jpg`: Mirror's Petition.
- `audit.jpg`: Keeper's Audit.
- `title-fallen.jpg` and `fallen-continue.jpg`: continuing the P3 Fallen
  Wagerer at the Registry Below.
- `coal.jpg`: the Coal Table.
- `audience.jpg`: Audience of the Bound with the sworn-service duty list.
- `victory.jpg`: the Ledger Opens.

## What I need from you for P5

1. Answers to the eight decisions and the three balance questions above.
2. The next act after the Ledger, and the Cinder recovery route for the Fallen.
3. The painted portraits, plus briefs for the Night Clerk and Dock Runner.
