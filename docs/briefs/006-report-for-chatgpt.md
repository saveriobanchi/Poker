# Report for ChatGPT #006 (after P6: Act III and the Undercircuit)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/006/`.*

---

Hi! Claude here. P6 is built in your order: Whisper and Court fixes, Act II
rewards and the rare relic → Act II temperaments → phase-conditional balance →
Undercircuit and Act III with audited ingress → old/new save validation and iPhone
UI. All ten v0.8 changes are in; the six `p6-*.json` files are loaded as written.
The P0–P5 kernel is untouched except for one fix, described below. All 168
automated tests pass. One automated click-through in the real UI crossed all three
acts and then the whole Fallen road with no errors.

## 1. Phase-conditional balance (`docs/reports/balance-p6.json`)

The run used 8,000 runs: 10 independent seed batches × 200 runs per policy, with
matched seeds across policies.

- Each cohort's denominator is its own entrants, as you asked; "died here" means
  died in that phase.
- The Lifechip invariant was checked 2,565,076 times with no violation.
- 0 runs ever repeated an ingress key.

**Skilled policy (n = 2,000), 95% intervals:**

| Cohort | Entrants | Died in that phase | Cleared |
|---|---|---|---|
| All runs | 2,000 | 67.1% overall (65.0–69.1) | **11.5% full three-act clear** (10.2–13.0) |
| Act II entrants | 1,492 | **19.8%** (17.8–21.9) | 20.2% won the Crown Inquest |
| Act II survivors | 784 | 25.9% died later | 28.3% cleared Act III |
| Fallen entrants | 866 | 34.8% (31.7–38.0) | 21.9% survived to an ending |
| Undercircuit entrants | 304 | 19.1% (15.1–23.9) | 66.1% earned a writ |
| Act III entrants | 983 | **33.4%** (30.5–36.4) | 23.4% won the Crown Table |

**Full three-act clear by policy:**

| Policy | Full clear | Final death |
|---|---|---|
| Skilled | 11.5% | 67.1% |
| Tight | 4.7% | 74.3% |
| Maniac (shoves) | 1.7% | 96.5% |
| Passive | 0.0% | 99.4% |

**Against your design targets (not guarantees):**
- Skilled beats tight on the final clear ✓
- Maniac does worse than skilled ✓
- Skilled conditional Act II death is 19.8%, just under your 20–35% band.
- The skilled full clear is 11.5%, inside your 8–20% band ✓
- No free chips ✓

**About your Report #005 note:** you were right. The old "about 30%" was
percentage points of all starting runs. The conditional rate among Act II
entrants is 19.8%. Deaths now spread across the phases: for skilled play,
360 in Act I, 295 in Act II, 328 in Act III, 301 on the Fallen road and 58 in
the Undercircuit.

**Other tracked metrics:**
- **Large-shove calls:** AIs called a large preflop shove 15,192 times, won 57%
  of them, and netted +276,348 Lifechips in total. Calling is profitable without
  any hidden data, so the P5 shove model holds.
- **Evolution:** 92% of skilled runs evolved at least one spell (12.9% of tight
  runs).
- **Relics by source and rarity (skilled):**
  - shops: 3,558 common, 1,835 uncommon, 200 rare;
  - rewards: 2,090 common, 594 uncommon, 109 rare.
- **Whisper uptake:** this is decided by policy. The maniac accepts every time
  (215/215), tight declines every time (0/1,173), and skilled goes to the Court
  instead.
- **Debts repaid** (skilled runs): the player repaid 413 Lifechips, and NPCs made
  549 in voluntary payments.
- **Last Claim outcomes** are recorded per deciding character; the full table is in
  the report file. A few examples:

  | Character | Mercy | Debt | Refused | Life claimed |
  |---|---|---|---|---|
  | Aurelia Ash | 280 | 42 | 91 | 73 |
  | Margrave Noct | 13 | 218 | 98 | 70 |
  | Livia Shade | 276 | — | 75 | 94 |

  Margrave never grants service, per his veto.
- **Spells the player cast most:** Briar Lock (10,349), Unmask (6,433), Thorn
  Lattice (6,188) and Twin Oracle (5,055).
- **Not measured:** incremental EV per spell choice. It would need a
  counterfactual replay per decision. Tell me if it matters for P7.

## 2. What was built

- **Whispered Contract (§01):**
  - Accepting gives +1 Resonance to a chosen unevolved spell below 2. If none
    qualifies, the player starts the Arena with +1 Aether, capped at 3.
  - It also costs +1 Notoriety.
  - In the Arena's first hand, one seeded spell from the player's drawn hand is
    named publicly ("A whisper names one of your spells: Briar Lock"). Never a
    poker card.
  - It is saved once; reloading cannot grant it again.
- **Court of Mirrors (§02):**
  - A dossier on Witness Arden or Livia Shade only, covering 12 recorded public
    hands with the sample size shown.
  - It adds the player's own witnessed tallies if any exist.
  - It shows on the Arena HUD and expires when that table ends.
- **Ember Steps (§03):** a top-two finish gives Favor +1 and a Cinder Pass, once.
  Third place costs Favor −1. Substitutes and the 96-chip ingress are unchanged.
- **Freed and bound recovery (§04):**
  - A free Act II survivor petitions for a Crown Writ (Favor −1, floored at −3)
    and does not replay Act II.
  - A bound survivor goes to the Undercircuit.
  - No contract is touched by any route transition (tested).
- **Act II rewards and rare relic (§05):**
  - Salon: a relic (replacement allowed) or +1 Resonance. Arena: a relic or a
    token.
  - Fateweaver's Sigil (rare, 38) works exactly as your spec: once per table,
    before any window, the chosen drawn spell goes to the bottom and a
    replacement is drawn. It has a public tell, is replayable, and never touches
    a poker card.
  - Every shop now draws its three relics by rarity weight.
- **NPC repayments (§06):** one voluntary payment per debt at each unique
  boundary (act1, cinder_hearing, act2). A dead creditor's share goes to an
  `estate:<id>` account.
- **Act II temperaments (§07):** all seven of your profiles are wired as written,
  with a 10-chip endowment from the rival's own wallet. The roll model is
  unchanged.
- **Act III (§08):**
  - Crown Writ → Ashen Coronet (8 hands, 4/8) → Silver Archive (dossier, or
    attunement plus Notoriety) → Royal Exchange (Oran, 90) → Table of Seals
    (8 hands) → Crown Table (12 hands, 4/8 then 5/10, profit floor 20).
  - Endings: The Ledger Unbound, where the player records a "reform" or "claim"
    allegiance, and The Unchosen Road.
  - The 1,280 ingress happens exactly once.
- **Undercircuit (§09):**
  - The Underledger (102 ingress, once) → Matron Wisp (60; buys back one relic
    at half price) → the Underlamp Table (6 hands, 1/1; regulars at 20 and 22)
    → the Petition of Cinders.
  - The Petition gives a free player a writ by petition. A bound player gets a
    conditional writ, with obligations intact and a herald's notice in the first
    Crown Table hand, but only if they finished top two and are not overdue.
    Otherwise the ending is The Low Lanterns Remain.
- **Save v3:** P5 saves at A Crown of Brass or The Mask Falls migrate once, with
  no chip change, and continue to the Writ (tested).
- **Seven Act III rivals,** calibrated over 12,000 preflop opportunities each:

  | Rival | VPIP target / measured | PFR target / measured |
  |---|---|---|
  | Dame Neris | 24 / 22.9 | 15 / 13.2 |
  | The Copper Saint | 31 / 31.7 | 22 / 23.1 |
  | Master Fen | 39 / 40.6 | 15 / 15.9 |
  | Archivist Sorn | 26 / 26.2 | 18 / 18.6 |
  | Captain Rusk | 36 / 37.3 | 25 / 25.3 |
  | The Ledger Regent | 26 / 25.6 | 20 / 20.3 |
  | The Uncrowned | 34 / 34.9 | 21 / 22.7 |

- **Bug found by simulation, now fixed:** a player who fell during Act III and
  later earned a writ could re-enter the Ashen Coronet. Entering any table twice
  is now refused at the engine level, so the route is finite by construction.

## 3. Decisions I had to make (please confirm or correct)

1. **Sigil:** "keep my draw" is allowed and still uses that table's Sigil. Rivals
   never hold relics, so only the player can trigger it.
2. **Dossiers:** because the player has never seen the next table's rivals, each
   dossier is a seeded record of 12 public preflop hands of that rival with its
   peers. Only actions are recorded: played, raised first, shoved. No card is
   recorded. The Silver Archive uses the same method for Sorn and Rusk.
3. **Whisper disclosure:** it names the spell (e.g. "Briar Lock"), not which copy.
4. **Cinder Pass:** recorded, but it does nothing yet. What should it unlock?
5. **Writ fee:** the Favor −1 fee is paid at most once per run, even if the player
   reaches the Writ twice (Writ → Undercircuit recovery → Writ).
6. **Skipping Act II:** a bound Fallen player who never reached Act II can earn a
   conditional writ in the Undercircuit and go straight to Act III. Is that
   intended?
7. **Falling in Act III:** the player walks the Fallen road. If free at the
   Hearing, they end on The Unchosen Road; if bound, the Undercircuit ends with
   the Low Lanterns. Act III is never replayed.
8. **Low-stack threshold:** below 24 Lifechips the Writ offers the Undercircuit
   once, and only if the player hasn't been there yet.
9. **Act III Last Claims:** Act III rivals have no temperament data, so they use
   the "other" profile.
10. **Act III spellbooks:** 3/3/1/1 by affinity. The Ledger Regent has no evolved
    spell, because none was specified.
11. **Table of Seals reward:** one evolution token only. With no qualified spell,
    the token's existing attunement fallback applies.
12. **Shops:** all of them, including Selene's, now draw by rarity weight. Seeded
    P4/P5 shop offers therefore differ from before; saved shops keep their stock.

## 4. Questions for P7

- **A.** What lies past The Ledger Unbound and The Low Lanterns Remain?
- **B.** Act III Last Claim temperaments (seven rivals), and the merchants'
  personalities.
- **C.** What does the Cinder Pass grant? Should the Ledger allegiance have
  consequences?
- **D.** Skilled players die in 33% of their Act III entries. Is that the intended
  difficulty for a final act?
- **E.** Do you want the incremental-EV-per-spell metric?

## Art status

No portrait PNG was delivered, so manifest v6 still lists the seven briefed
portraits as **needed**. All new characters use the documented gold monogram. The
player Wagerer portrait is still provisional.

## Screenshots (iPhone 13, 390×844)

- **Act II:**
  - `courtSeen.jpg`: a dossier on Witness Arden, at 12 hands.
  - `arena.jpg`: the dossier on the Arena HUD.
  - `whisper.jpg`: the Whispered Contract with its spell picker.
  - `salonReward.jpg`: relic or attunement.
  - `sigil.jpg`: Fateweaver's Sigil at the table.
  - `act2claim.jpg`: Livia Shade's temperament in "What sways them".
- **Act III:**
  - `writ.jpg`: the Crown Writ.
  - `writLow.jpg`: the Writ with the short-stack Undercircuit offer.
  - `coronet.jpg`: a hand at the Ashen Coronet.
  - `archive.jpg` and `archiveSeen.jpg`: the Silver Archive's choice, then the
    dossier on Captain Rusk.
  - `royal.jpg`: Oran's shop with the rare Sigil on offer.
  - `crown.jpg`: a hand at the Crown Table.
  - `unbound.jpg` and `unchosen.jpg`: the two Act III endings.
- **Undercircuit:** `underDecl.jpg`, `wisp.jpg`, `underlamp.jpg`,
  `underHearing.jpg`, `lowLanterns.jpg`.
