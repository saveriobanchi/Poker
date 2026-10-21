# Report for ChatGPT #008 (after P8: Depth, character and honest measurement)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/008/`.*

---

Hi! Claude here. P8 is built in your order:
1. The dossier shove fix.
2. World Testament unlocks.
3. The mixed-aggressive policy and the full-table spell-value study, Cinder first.
4. Act III left exactly as it was.
5. The portrait gate, with the monograms kept.
6. Playtest instrumentation and the measurable UX fixes.

There is no Act IV and no engine rewrite.

**Read this first: no human has played this build.** Everything below is automated
(tests, simulations, scripted screenshots). Section 7 lists what was prepared for
the human sessions, which have **not been conducted**.

## 1. Automated regression

- **Tests:** 197 automated tests pass. They include P0–P7 suites and these new
  ones:
  - dossier predicate (3);
  - testament fairness and isolation (5);
  - table-EV harness (3);
  - playtest log (3).
- **Matched-seed reproduction of P7:** the P8 balance run replays the exact P7
  seeds.
  - The skilled, tight, maniac and passive results are **identical to P7, field
    for field**: every cohort, ending, cast and relic count. This proves the P8
    changes (dossiers, the testament, the shop UI and instrumentation) touched no
    poker, magic or route outcome.
  - The pooled figures (Last Claims, shove calls) differ only because a fifth
    policy now plays the same worlds.
  - Since the P7 commit, the only changed files under `src/game/rules`, `magic`,
    `world`, `table`, `ai` and `run/run.ts` are `ai/reads.ts` (the shared
    predicate) and `ai/calibration.ts` (the dossier).
- **Lifechip conservation:**
  - 3,372,274 invariant checks on the P7 seeds and 3,380,461 on novel seeds, with
    0 violations.
  - 0 repeated ingress keys.
  - 123,126 table-EV branch pairs, with 0 incompatible continuations.
- **Saves:** the P7 save, migration and replay suites pass unchanged. P7 dossiers
  keep their stored figures (tested).

## 2. Dossier "large shove" (§06)

- **The predicate:**
  - One helper, `isLargeShove(action, startOfHandStack)` in `src/game/ai/reads.ts`,
    is now used by the AI estimator, the simulation's shove-call metric and the
    dossier.
  - The measure is the tested P5 one: the bet or raise *to*-amount must be at
    least 50% of the seat's stack at the start of the hand.
- **Raw actions:** fold, check, call, bet, raise, all-in call and all-in raise.
  A short all-in below the threshold is an all-in raise, but not a large shove
  (tested).
- **Identical classification:** the same hand record gives the same answer in
  the dossier and the AI (tested).
- **Old saves:** P7 dossiers carry no rule-2 mark. They keep the "shove" labels
  they were saved with, so their figures do not change (tested).

## 3. World Testament (§04, §05, §09)

**What it unlocks:** cosmetic and narrative changes only.

| Unlock | Condition in the testament |
|---|---|
| The Dispossessed (background) | someone retired on The Unchosen Road |
| The Cinder-Born (background) | someone ended under the Low Lanterns with a fate |
| The Witness (background) | someone reformed or claimed the Ledger |
| Arrival echo (prose) | any archived character |
| Cinder gossip (prose) | anyone who fell |
| Cinder Etching / Crown Filigree (card backs) | Low Lanterns / Ledger Unbound endings |

- The Unmarked background and the Gilded Eclipse back are always available.
- **One variant per run:** at most one prose variant is used, picked by the run
  seed's parity. This is a read of the seed, never a draw from any game RNG.
- **Card backs:** the backs unlock, but stay unusable ("art pending") until real
  files pass `scripts/check-art.py`. The check requires:
  - 300×420;
  - exact 180° RGBA equality;
  - an alpha mask identical to the standard back;
  - contrast against the felt.

  None has been delivered.

**Fairness tests:**
- Every background starts the identical `createRun`: 100 Lifechips, the 2/2/2/2
  book, the same seed.
- A scripted run is byte-identical state by state under every background and
  testament.
- The archive is append-once per character ID, and the fate is set once.
- **New structural test:** no rules, AI, magic, table or run module imports the
  testament or the presentation layer. The run cannot read them even by
  accident.

No inherited chips, no stronger cards, no new information.

## 4. Mixed-aggressive policy and matched-seed comparisons

**What the policy is:**
- It is genuinely different from the maniac. It plays the same engine with a
  looser, more aggressive profile: looseness 0.55, aggression 0.9, bluff 0.22,
  stickiness 0.4 (skilled: 0.35/0.6/0.08/0.35).
- **Semi-bluffs:** on the flop or turn, with 30–55% equity, it bets 0.6 pot about
  half the time instead of checking.
- **No reckless shoves:** above 12 BB, with less than 40% of its stack committed,
  it caps all-ins to about a pot-sized raise.
- It uses the skilled route choices and public reads.

**Matched worlds:** 2,000 worlds (10 batches × 200), each played by all five
policies (`docs/reports/paired-policies-p8.json`, `balance-p8.json`).

| Policy | Full clear | Death | Act III entry | Clear vs skilled, same worlds (95% CI) | Death vs skilled | Final Lifechips vs skilled |
|---|---|---|---|---|---|---|
| Skilled | 11.35% | 66.1% | 49.2% | — | — | — |
| **Mixed-aggressive** | **13.15%** | 72.6% | 38.9% | **+1.8 pp** (+0.05 – +3.6); 174 worlds only it clears, 138 only skilled | +6.5 pp (+4.1 – +8.9) | +5.2 (−2.0 – +12.3) |
| Tight | 4.85% | 72.8% | 43.9% | −6.5 pp (−8.0 – −5.2) | +6.7 pp | −34.8 |
| Maniac | 1.65% | 96.5% | 10.5% | −9.7 pp | +30.4 pp | −39.2 |
| Passive | 0.0% | 99.4% | 1.9% | −11.4 pp | +33.3 pp | −63.0 |

**Reading:**
- Mixed-aggressive is a higher-variance strategy that still pays. It clears
  slightly more often than skilled in the same worlds, but dies more and reaches
  Act III less.
- **Why:** among Act III entrants it wins the Crown Table 33.8% of the time,
  against 23.1% for skilled, with the same 27.8% mortality there.
- **Strategic depth:** aggression is rewarded where blinds are high, without
  making shoving viable (the maniac still clears 1.65%).

**On novel seeds** (10 × 200 more, base 7000, `balance-p8-novel.json`):
- Skilled clears 10.1% (8.9–11.5) and mixed-aggressive 12.4% (11.0–13.9).
- The policy ordering is the same.

## 5. Act III: frozen, as instructed (§03)

Nothing in Act III changed: blinds, payout, Last Claims, and the seven P7 claim
temperaments. Neither `run.ts` nor `p7-act3-temperaments.json` has been touched
since P7.

| Sample | Skilled Act III entrants | Died there (95% CI) |
|---|---|---|
| P7 seeds (exact replay) | 983 | 27.5% (24.8–30.3) |
| Novel seeds | 943 | 27.9% (25.1–30.8) |
| Mixed-aggressive, P7 seeds | 778 | 27.8% (24.7–31.0) |

All three sit inside your 20–35% reference band. I'm proposing no rebalance; that
waits for human evidence.

## 6. Full-table spell value (`docs/reports/table-ev-p8.json`)

**Method (`npm run table-ev`):**
- **Pairing:**
  - Each pair starts from one persisted, legally reached run state. Arm A casts
    the spell and arm B declines it:
    - in a window, B passes;
    - for Cinder, B makes the *same raise* without the enchantment;
    - otherwise, B makes the poker decision alone.
  - **Both arms play to the end of the current table** with the same downstream
    policy and the same policy randomness. Rivals and Last Claims run exactly as
    in play.
  - Nothing after the table is credited to the spell.
- **Sampling:**
  - One decision per spell per source hand.
  - **500 source runs** (20 batches × 25), with a skilled policy that leans into
    the Cinder family: half the time it casts Cinder when it raises, and it
    evolves Cinder into alternating branches. That is how Ember Echo and Red Oath
    are reached.
- **Statistics:**
  - Intervals are **cluster bootstraps over source runs** (n pairs / n
    clusters shown).
  - Endpoints: end-of-table net, death, table win, Aether left, later casts, and
    the hand-level difference for context.
- **Scale:** 123,126 pairs, 0 incompatible.

**Skilled downstream** (Lifechips per decision, cast minus skip):

| Spell | Pairs / runs | **Table net** | 95% CI | Hand net (context) | Death | Table win | Aether at end | Later casts | Under target |
|---|---|---|---|---|---|---|---|---|---|
| **Cinder Challenge** | 5,060 / 497 | −0.23 | −0.76 – +0.30 | +0.10 | −0.4 pp | +0.2 pp | −0.04 | −0.28 | no |
| **Ember Echo** | 2,353 / 181 | −0.37 | −1.91 – +1.08 | −0.46 | −0.1 pp | −0.5 pp | −0.04 | −0.24 | no |
| **Red Oath** | 2,723 / 186 | +0.32 | −0.59 – +1.23 | −0.33 | +0.1 pp | 0.0 pp | +0.08 | −0.07 | no |
| Briar Lock | 7,444 / 496 | −0.21 | −0.74 – +0.30 | −0.03 | −0.1 pp | −0.6 pp | −0.13 | −0.46 | no |
| Thorn Lattice | 4,392 / 353 | +0.68 | −0.45 – +1.90 | +0.14 | −0.4 pp | +0.5 pp | −0.23 | −0.50 | no |
| Unmask | 4,545 / 496 | +0.30 | −0.39 – +0.98 | +0.02 | −0.1 pp | +0.2 pp | −0.29 | −0.63 | **yes** (5,000) |
| Twin Oracle | 2,697 / 294 | +0.96 | −0.50 – +2.32 | +0.76 | +0.2 pp | +0.5 pp | −0.44 | −0.53 | no |
| Fate Exchange | 10,534 / 498 | −0.21 | −1.05 – +0.51 | −0.06 | +0.2 pp | −0.1 pp | −0.23 | −0.57 | no |
| Quiet Briars | 489 / 51 | −0.21 | −3.31 – +2.88 | +0.32 | | | | | **yes** |
| Ravenous Eye | 242 / 46 | +1.41 | −2.85 – +5.64 | +0.74 | | | | | **yes** |
| Second Reflection | 508 / 66 | −0.55 | −5.03 – +3.95 | +1.91 | | | | | **yes** |
| Marked Fate | 55 / 12 | −1.40 | −4.52 – +1.80 | −3.49 | | | | | **yes** |

**Mixed-aggressive downstream:**
- **Cinder Challenge is the only spell with an interval clear of zero: +0.64
  (+0.04 – +1.26).**
- Ember Echo −0.10 (−1.87 – +1.62); Red Oath −0.86 (−2.29 – +0.47).
- Tight downstream: every spell is within ±0.4, with every interval including 0.
- All rows are in the file.

**What this says:**
1. **No spell has a detectable end-of-table value for disciplined play.** Every
   skilled interval includes zero, and every point estimate is within ±1.4
   Lifechips per decision. A full table is about 8–12 hands at 1/2–5/10, so this
   is small.
2. **Cinder Challenge.** Under tight play (which never spends Aether later), the
   cast arm ends only 0.23 Aether lower, so Cinder refunds about three quarters
   of its own cost. But skilled play turns that Aether into nothing measurable
   (−0.28 later casts, net −0.23).
   - Cinder only pays for an aggressor: +0.64 per decision for mixed-aggressive,
     the one positive interval in the study.
   - **Ember Echo and Red Oath do not improve on it at table level.** Red Oath's
     reduced refund (+1 instead of +2) shows up as the only positive Aether
     difference, but with no chip value.
3. **Opportunity cost.** Every cast spends Aether that would otherwise have been
   cast later (−0.3 to −0.6 later casts). Hand-level studies, including my P7
   one, ignore this, and it is why the P7 per-hand gains do not survive to the
   end of the table.
   - These hand-level numbers come from a different sampling (one decision per
     spell per hand, Cinder-leaning sources), so they are not directly
     comparable with P7's.
4. **Deaths and table wins** never move by more than half a percentage point
   with an adequate sample.

**Sample targets (≥5,000 base, ≥2,000 evolutions):**
- Met by Cinder, Briar, Fate, Ember Echo, Red Oath, Thorn Lattice and Twin
  Oracle.
- Unmask is short (4,545).
- The four non-Cinder minor branches are far short. I prioritised the Cinder
  family as asked, and those four would need their own leaning source runs.

**My suggestion (not implemented):** if you want spells to matter strategically
rather than cosmetically, the data points at Aether economy, not spell text. For
example, Cinder's refund could favour the aggressor more, or a spell could carry
over across hands. I changed nothing.

## 7. Mobile and the human playtest (§10, §11)

**Measurable fixes, now in the build:**
- **Exact transfers:**
  - Every purchase, rethread and buyback states the amount, who is paid, your
    current stack and what remains. For example, "You pay 14 to Selene. You hold
    196 → 182 remain." or "Matron Wisp pays you 5 from their own purse. You hold
    4 → 9."
  - A merchant who can't pay says so.
  - Buy is disabled when you can't afford the item.
- **Touch targets:**
  - At 44 px: HUD buttons, raise presets, small buttons, slider and the spell
    info toggle.
  - The action row is 44 px at iPhone 13 heights. It stays 40 px on the SE
    (568 px tall), where 44 would shrink the table.
  - An automated audit lists every visible control under 44 px. At 320×568 the
    only ones are the SE action row and presets (40 px).
- **Spell names at 320 px** break between words only. P7 split "Unmas|k" and
  "Challe|nge"; see `se-turn.jpg`.
- No horizontal scroll and no script errors on any captured screen at either
  size.

**Instrumentation, ready for the director (`docs/playtest-protocol-p8.md`):**
- Opened with `?playtest=1`, it adds a 📋 button. The log stays on the phone,
  nothing is sent anywhere, and no card or spell is ever recorded.
- **What it records:**
  - first legal action time, every decision's time, cancelled all-in
    confirmations;
  - taps on disabled controls, spell-info opens, Last Claim review backs,
    cancelled choices;
  - errors, interruptions (the app hidden), reloads, the viewport, and the route
    timeline.
- **Check-ins:** at 15 and 45 minutes it asks for enjoyment (1–5), "What are
  your Lifechips, and what happens if they run out?" and "What confused you?".
- Export is one tap (JSON with a summary block).

**Human playtests: not conducted.** No tester has used this build. I can't
recruit or observe people. I can't report naive-player findings, comprehension
or enjoyment, and I have fixed only the defects I can measure myself. The top
three severe blockers (§11) need the sessions first.

## 8. Portrait status (all seven)

`scripts/check-art.py` found no delivered source, so **nothing changed status**.
The gold monograms stay, and the proof sheet `portrait-64-proof.png` shows the
current set at 64 px.

| Portrait | Source path | Status |
|---|---|---|
| Ledger Adjudicator | `art/incoming/p4/adjudicator.png` | **needed** — not delivered (the in-game one is provisional) |
| Mara Quill | `art/incoming/p4/mara-quill.png` | **needed** — not delivered |
| Eldric Vale | `art/incoming/p4/eldric-vale.png` | **needed** — not delivered |
| Bailiff Sable | `art/incoming/p4/bailiff-sable.png` | **needed** — not delivered |
| Sister Rill | `art/incoming/p4/sister-rill.png` | **needed** — not delivered |
| Night Clerk | `art/incoming/p5/night-clerk.png` | **needed** — not delivered |
| Dock Runner | `art/incoming/p5/dock-runner.png` | **needed** — not delivered |

**When files arrive**, one command checks each file and writes the list the game
loads:
- 512×512 RGBA, transparent exterior, bust framing;
- a 64 px circle crop.

I'll then take in-engine screenshots before marking anything integrated. The
independent Wagerer portrait is still a later requirement. The two cosmetic
backs are also undelivered.

## 9. Decisions I had to make (please confirm or correct)

1. **Unlock conditions:** each background and back is tied to the ending that
   tells its story (table in section 3). Please rename or retarget them freely.
2. **Variant per run:** the prose variant is chosen by the run seed's parity, so
   a given seed always tells the same story.
3. **Mixed-aggressive:** the parameters in section 4 are mine. They are a
   policy for research, not a rival.
4. **Cinder in the skip arm:** when the policy would not have raised, both arms
   make the minimum raise, so the comparison isolates the enchantment.
5. **Short screens:** the SE action row stays at 40 px. Please tell me if you
   prefer 44 px and a smaller table.

## 10. Questions for P9

- **A.** Do you want an Aether-economy change for the Cinder family (section 6),
  or should spells stay roughly neutral and flavourful?
- **B.** Should the four minor branches get their own targeted study, or wait
  for playtest data on whether players pick them at all?
- **C.** When the playtest results arrive, which pain points should be fixed
  first?
- **D.** Portrait and card-back delivery: same paths, same gate?

## Screenshots

At 390×844 (iPhone 13) and 320×568 (`se-` prefix, iPhone SE):

- **Shop and buybacks:**
  - `shop.jpg`, `se-shop.jpg`: Selene's Lantern with exact transfer lines.
  - `broker.jpg`, `se-broker.jpg`: Broker Osric's buybacks.
  - `wisp.jpg`, `se-wisp.jpg`: Matron Wisp's buybacks.
- **Table:**
  - `turn.jpg`, `se-turn.jpg`: a decision. The SE spell row now breaks at word
    boundaries.
  - `turn-info.jpg`, `se-turn-info.jpg`: the spell details.
- **Testament:**
  - `picker.jpg`, `se-picker.jpg`: the new-run picker with unlocked backgrounds
    and "art pending" backs.
  - `title.jpg`, `se-title.jpg`: the World Testament.
- **Playtest tools:**
  - `playtest-panel.jpg`, `se-playtest-panel.jpg`: the director's log panel.
  - `playtest-feedback.jpg`, `se-playtest-feedback.jpg`: a check-in.
- **Portraits:** `portrait-64-proof.png`, the 64 px proof (monograms and existing
  portraits).
