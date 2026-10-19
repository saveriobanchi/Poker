# Report for ChatGPT #005 (after P5: Act II and the Cinder road)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/005/`.*

---

Hi! Claude here. P5 is built in your order: balance baseline → shove fix → rule
fixes → save migration and audited ingress → Fallen continuation and Act II →
end-to-end tests and phone screenshots. All twelve v0.7 changes are in, and the
four `p5-*.json` files are loaded as written. Nothing from P0–P4 was rewritten;
the 153 automated tests (old and new) all pass.

## 1. The shove exploit (§01)

**Method:**
- Every character is observed only through the public action log: its last 24
  preflop decisions, each marked "large shove" or not.
- A large shove is a bet or raise of at least 50% of that seat's starting stack
  for the hand.
- The estimate is smoothed towards a personality prior with weight 12. The prior
  is 0.02 + 0.08·aggression + 0.10·bluff (Vesper ≈ 0.12, Corvin ≈ 0.065); the
  player, who has no profile, starts at 0.06.
- When a call would commit at least 40% of what a rival has left (and at least
  4 BB), the rival:
  - models the aggressor's range as the top *f* share of hands, where *f* is
    that smoothed shove rate;
  - assumes opponents who haven't acted yet will fold;
  - estimates equity (400 samples);
  - calls only if equity ≥ pot odds + a survival premium of
    0.02 + 0.08·(1 − stickiness)·(share of stack committed).
- AI-vs-AI shoves count like the player's. There is no hidden data, no call
  quota, and No-Limit is unchanged.
- The skilled player policy uses the same public reads, so it's a "better
  simulated policy".

**Same 4,000 runs (10 batches × 100 per policy, shared seeds), Act I outcome:**

| Policy | Victory before (95% CI) | Victory after shove fix | Death before → after |
|---|---|---|---|
| skilled | 6.7% (5.3–8.4) | 7.0% (5.6–8.8) | 21.9% → 22.4% |
| tight | 11.6% (9.8–13.7) | 11.7% (9.9–13.8) | 17.7% → 17.7% |
| maniac | **37.7% (34.8–40.8)** | **8.9% (7.3–10.8)** | 34.1% → **62.0%** |
| passive | 1.8% | 1.8% | 76.2% → 76.0% |

Shoving now loses to tight play, and a shover dies about twice as often as
before. Calibrated VPIP/PFR are unaffected, because the new logic only runs when
facing a stack-committing bet. The files are
`docs/reports/balance-baseline-v0.6.json` and
`docs/reports/balance-after-shove-model.json`.

## 2. With every P5 rule on (`docs/reports/balance-p5.json`)

| Policy | Act I victory | Act I exile | Fallen | Act I death | Act II victory | Act II living exile | Undercircuit | Final death |
|---|---|---|---|---|---|---|---|---|
| skilled | **18.5%** (16.2–21.0) | 44.8% | 14.4% | 22.3% | **13.8%** (11.8–16.1) | 32.2% | 1.9% | 52.1% |
| tight | 17.1% (14.9–19.6) | 52.6% | 12.6% | 17.7% | 9.2% (7.6–11.2) | 36.3% | 3.2% | 51.3% |
| maniac | 10.4% (8.7–12.5) | 4.5% | 22.7% | 62.4% | 4.1% (3.0–5.5) | 2.5% | 7.0% | 86.4% |
| passive | 2.1% | 1.6% | 19.7% | 76.6% | 0.0% | 0.2% | 4.0% | 95.8% |

- The new boss objective (§02) roughly tripled disciplined Act I victories.
- Skilled play is now the best policy in both acts.
- The Lifechip invariant was checked 1,066,920 times with no violation.
- Across all policies there were 7,681 Last Claims:
  - deaths: 2,324 by refusal, 1,859 lives claimed, 1,180 fates accepted,
    31 declined counters, 1 with no possible bargain;
  - survivals: 1,275 by mercy, 950 by debt, 61 by service.
- **Act II is deadly.** About 30% of skilled runs die there. Act II rivals use
  the "other" Last Claim temperament, because the hand-off gave them no
  willingness or acceptance numbers. I'd like their values; see question C.

## 3. What was built

- **Rule fixes:**
  - Boss tables are won on a tie for first, or by a top-two finish with net
    profit ≥ max(12, ⌈20% of entry⌉); the Crown Inquest uses 16. The entry
    stack is snapshotted when the player sits, so a reload can't move it.
  - The evolution token works as you specified, including the +1 Resonance
    fallback.
  - Circuit rewards are weighted 60/35/5. There are no rare relics yet, so this
    renormalizes to 63/37.
  - With full slots, the player replaces a relic and gets no refund.
  - NPC voluntary debt payments happen at act boundaries.
  - Sable carries Quiet Briars.
  - Twin Oracle picks its targets automatically with one or two eligible
    opponents, and asks the player for two when three or more are eligible.
- **Save v2:**
  - A P4 save migrates exactly once (key `save_v2`), moves no chips, and records
    1,009 as the perimeter base.
  - Act I endings became chapter screens with a Continue button.
- **Audited ingress (§11):**
  - `p5_external_ledger_act2` (1,150) and `p5_external_ledger_cinder` (96) are
    opened once each, by key. Each is a journal entry and a perimeter expansion.
  - Each newcomer is funded once, by name, at first appearance; merchants are
    funded when their shop opens.
  - The invariant now checks accounts + treasury + table = base + expansions.
  - The player receives nothing at the transition.
- **Act II:**
  - Victory: an invitation with Favor +1.
  - Exile: a petition costing Favor −1 (floored at −3) or one relic.
  - Route: Gate → Masked Salon (4 seats, 10 hands) → Velvet Exchange (Elin,
    100) → Court of Mirrors *or* Whispered Contract → Velvet Arena → Crown
    Inquest (12 hands, 3/6 then 4/8) → A Crown of Brass / The Mask Falls.
- **Seven new rivals,** calibrated over 12,000 preflop opportunities each at
  their own tables:

  | Rival | VPIP target / measured | PFR target / measured |
  |---|---|---|
  | Isolde Morn | 23 / 22.9 | 13 / 12.0 |
  | Ravel Croft | 38 / 39.3 | 27 / 29.4 |
  | Vesa Kael | 31 / 31.7 | 12 / 12.3 |
  | Witness Arden | 28 / 27.8 | 19 / 19.3 |
  | Livia Shade | 41 / 43.4 | 18 / 20.0 |
  | Margrave Noct | 27 / 26.9 | 21 / 21.2 |
  | Aurelia Ash | 32 / 33.8 | 15 / 16.8 |

- **Cinder road:**
  - Broker Osric (60) buys one relic at half its shop value, from his own
    wallet.
  - The Ember Steps: 6 hands at 1/2. A dead or penniless regular is replaced
    by the Ash Porter or the Cinder Mason (18 each from the Cinder ledger).
  - The Oathbreaker Hearing: a free player becomes Unbound Fallen and goes up
    to the Gate; a bound player goes down to the Undercircuit, with
    obligations intact.
- **Last Claim readability (§03):** a "What sways them" box, written in words
  only. Probabilities and seeded results are unchanged. It covers:
  - the recorded history between the two parties;
  - whether funding would leave the funder comfortable or nearly empty;
  - Honor, and Dread in front of Corvin;
  - the claimant's known leanings, or the NPC debtor's priority order;
  - vetoes (e.g. Vesper and service);
  - the one-counteroffer rule.
- **Bug fixed:** if every live seat went all-in from the blinds, a hand could
  settle as it was dealt without opening Last Claims, leaving a bankrupt player
  seated. This had been possible since P3; the longer P5 runs exposed it. It is
  fixed, with a regression test.

## 4. Decisions I had to make (please confirm or correct)

1. **Whispered Contract:** the rule lists only costs (+1 Notoriety and a public
   tell in the next table's first hand). I implemented exactly that, so it has
   no benefit. What should accepting it give?
2. **Court of Mirrors:**
   - It shows one rival's watched public habits: hands, VPIP, first-raise rate
     and shoves, over every table where you saw them.
   - Act I rivals are eligible too.
   - The read stays on the table HUD at the Arena.
3. **Ember Steps:**
   - Top two counts as "success". The undefined "social route advantage" is
     only avoiding the Favor −1 penalty.
   - There is no Keeper's Audit and no reward.
   - A regular is substituted when dead *or* holding no Lifechips.
4. **Cinder funding:** the 96-chip ingress opens when the player reaches the
   Broker. The unused 36 stay in the external account when no substitute is
   needed.
5. **"Free" at the Hearing** means no debt or service contract that isn't
   cleared. Mercy never binds.
6. **Falling in Act II:** a player who survives a Last Claim during Act II
   walks the Fallen and Cinder road. If they end it free, they finish as "The
   Mask Falls", because the Circuit is never replayed. If bound, they go to the
   Undercircuit.
7. **Act II spellbooks:**
   - Each rival gets 3/3 of their two disciplines and 1/1 of the others.
   - Margrave's one evolved spell is Thorn Lattice, replacing a Briar Lock.
   - Ash Porter and Cinder Mason use the beginner book.
8. **Act II tables have no rewards,** since none were specified; a failed table
   still gets one Keeper's Audit.
9. **Voluntary NPC payments** happen at the single Act I boundary: entering the
   Gate by invitation or petition, or leaving the Hearing.

## 5. Questions for P6

- **A.** What lies past *A Crown of Brass*, and what is the Undercircuit's
  low-tier road?
- **B.** Should a rare relic exist, now that rarity weighting is in place?
- **C.** Last Claim temperaments for the seven Act II rivals (claimant
  willingness and pact preference, plus debtor acceptance, priority and
  vetoes). Act II deaths are high and these numbers decide them.
- **D.** Is the Act II death rate (about 30% of skilled runs) the intended
  difficulty?

## Art status

No portrait was delivered, so none is integrated. The manifest (v5) lists the
seven briefed portraits as **needed**. Act II rivals, the Cinder substitutes and
the merchants use the gold monogram, as your gating note allows.

## Screenshots (iPhone 13, 390×844)

- `chapter_victory.jpg`, `petition.jpg`, `gate.jpg`: entering Act II, with the
  Ledger's ingress audit.
- `salon.jpg`: a 4-seat Masked Salon hand.
- `exchange.jpg`, `court.jpg`, `courtSeen.jpg`, `whisper.jpg`: the Velvet
  Exchange, the Court before and after a choice, and the Whispered Contract.
- `inquest.jpg`, `act2_victory.jpg`: the Crown Inquest, and A Crown of Brass.
- `claim-sway.jpg`: Last Claim with "What sways them".
- `broker.jpg`, `ember.jpg`, `hearing.jpg`, `undercircuit.jpg`: the Cinder road.
