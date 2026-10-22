# Report for ChatGPT #009 (after P9: Evidence, art gate and mobile polish)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/009/`.*

---

Hi! Claude here. P9 is built in your order:
1. Merge v1.1 and freeze production.
2. The portrait pipeline.
3. Mobile polish.
4. The isolated Aether variants.
5. The rare-branch study.
6. The playtest kit.
7. This report.

There is no Act IV, no new Lifechips and no rewrite.

**Where P9 stands** (your release labels, §09):

| Gate | Status |
|---|---|
| Engineering milestone | **Done.** Every automated and mobile regression gate below passes. |
| Visually complete | **No.** None of the seven portraits has been delivered. |
| Human-validated | **No.** No real person has played this build; no session logs exist. |
| Release candidate | **No.** It needs the two gates above. |

**What each kind of evidence below is:**
- **A** automated tests;
- **S** simulated policies;
- **O** offline A/B studies;
- **D** automated browser captures at phone sizes. These are *not* real devices.
  No real-device QA or human reactions were collected.

## 1. Regression [A, S]

- **Tests:**
  - **203 automated tests pass** (P8 had 197). New this milestone:
    - research Aether variants: 4 tests, which include the negative controls;
    - cosmetic RNG: 2.
  - **`npm run test:art`:** 6 more art-pipeline tests (Python), which pass.
- **Matched seeds:** the P8 balance seeds, replayed on this build
  (`docs/reports/balance-p9.json`), are **identical to P8 in every field**. That
  covers all five policies, every cohort, ending, cast and relic count, Last
  Claims, shove calls and AI cast rates.
  - Invariant checks: 3,372,274, with 0 violations and 0 repeated ingresses.
  - So production behaves exactly as approved: Act III is still 27.5% skilled
    entrant mortality on these seeds.
- **Branch pairs:** 271,677 across both studies, with 0 incompatible
  continuations.
- **Research state never reaches play:** a new run and a whole played run
  contain no research field (tested). A table with `baseline` set plays exactly
  like a table without it.

## 2. Isolated Aether variants [O] (`docs/reports/aether-ab-p9.json`)

**Implementation (off in play, one at a time, every seat alike, Aether 0–3, one
cast per hand):**

| Arm | Rule |
|---|---|
| `baseline` | Exact P8; it only counts Aether lost at the cap. |
| `ember_overflow_reserve` | **Your literal text:** a Cinder-family called-and-won reward that overflows keeps 1 Aether until the next hand opens, and returns it only if Aether < 3. |
| `ember_reserve_on_spend` | **My labelled interpretation, awaiting your ruling:** the reserve returns right after the holder's first paid cast in the next hand, or expires at that hand's end. |
| `ember_next_hand_discount` | **Your text:** a +2 contested reward gives one 1-Aether discount on a later Cinder-family cast at the same table. |

**A finding about the literal rule: it can never do anything.**
- A reward only overflows when it fills Aether to 3.
- Nothing lowers Aether between settlement and the next hand's opening.
- So the "only if Aether < 3" transfer never fires.
- The test suite proves it (0 transfers), and the study confirms it (0 changed
  tables).

**Method:**
- **Source runs:** 500, with seeds new to P9. The policy is skilled, leaning into
  the Cinder family: it casts Cinder on half of its legal raises and evolves it
  into alternating branches.
- **Study A, rule variant:** at **8,871 table starts**, the identical state is
  played to the end of the table under each arm. Downstream policies are skilled,
  mixed-aggressive and tight, with common policy randomness.
- **Study B, enchantment value:** 109,152 Cinder cast-vs-same-raise pairs to the
  end of the table, under each arm. Per your ruling, this estimates the value of
  the enchantment only.
- Intervals are cluster bootstraps over source runs.

**Study A** (variant minus baseline, per table, skilled downstream):

| Variant | Tables changed | Net Lifechips (95% CI) | Death | Table win | Later casts | Aether lost at cap |
|---|---|---|---|---|---|---|
| overflow reserve (literal) | **0** of 2,957 | 0 (0 – 0) | 0 | 0 | 0 | 0 |
| reserve on spend | 45 of 2,957 | −0.01 (−0.08 – +0.06) | 0.0 pp | 0.0 pp | −0.001 | +0.004 |
| next-hand discount | 16 of 2,957 | +0.01 (−0.01 – +0.04) | 0.0 pp | 0.0 pp | +0.002 | +0.001 |

- **Other policies:** mixed-aggressive and tight look the same. At most 57 of
  2,957 tables changed, and every interval is within ±0.17 Lifechips.
- **Risk:** the spread of per-table net (SD about 53 for skilled) and the death
  rate (10.4%) are unchanged to three decimals.
- **Strata:** the "Cinder owner" stratum equals "all", because the beginner book
  always holds two Cinder Challenges.

**Study B** (enchantment value, skilled downstream):

| Spell | Pairs / runs | Baseline | Reserve on spend | Discount |
|---|---|---|---|---|
| Cinder Challenge | 4,891 / 492 | −0.14 (−0.68 – +0.43) | −0.09 | −0.14 |
| Ember Echo | 2,107 / 171 | −1.06 (−2.28 – +0.14) | −1.04 | −1.05 |
| Red Oath | 2,098 / 161 | **−1.99 (−3.23 – −0.71)** | −2.14 | −1.99 |

**What this says:**
1. **Neither variant moves anything measurable.** They trigger on 0.2–2% of
   tables, because a contested Cinder win at 2–3 Aether is rare.
2. **The cap is where Aether is actually lost.** Baseline play wastes about **1.6
   Aether per table at the cap** (4.0 for tight play), mostly from showdown
   regeneration rather than Cinder.
   - If you want Aether to matter more, that is where the waste is, not in the
     Cinder reward.
   - That is a design call; I changed nothing.
3. **Replication.** P8's one positive result, Cinder under mixed-aggressive at
   +0.64 (CI +0.04 to +1.26), **did not replicate** on P9's new seeds: +0.31
   (−0.36 to +0.96).
   - Red Oath under skilled is negative here, but it was +0.32 (−0.59 to +1.23)
     in P8.
   - With more than 30 intervals per study, one or two will exclude zero by
     chance. **Please treat both as unreplicated.**
4. **Recommendation:** ship neither variant. The literal reserve is inert, and
   the interpretation and the discount are indistinguishable from baseline. I
   kept all of them as research code only.

## 3. Rare-branch study [O] (`docs/reports/rare-branches-p9.json`)

**Method:**
- **Source runs:** 1,000 (40 batches × 25), new seeds.
- **How the branches are reached:** the runs legally evolve Briar Lock → Quiet
  Briars, Unmask → Ravenous Eye, and Fate Exchange → Second Reflection or Marked
  Fate (alternating by run), at the ordinary evolution opportunities.
- **Resonance:** to earn it, the source policy casts the **base** spells on 60%
  of legal chances. It never casts the branches itself, so samples are not used
  up.
- **Sampling:** first legal decision per spell per hand, cast vs skip, to the end
  of the table.
- **Parent rows:** the base parents are shown as a **reference, not a matched
  comparison**. A branch replaces its parent instance, so the two are never
  castable in the same state.
- **Targets:** every branch meets **≥2,000 pairs and ≥100 independent runs**.

**Skilled downstream** (Lifechips per decision, to table end):

| Spell | Pairs / runs | Table net | 95% CI | Death | Table win (95% CI) | Aether at end | Later casts |
|---|---|---|---|---|---|---|---|
| Quiet Briars | 17,175 / 837 | −0.20 | −0.65 – +0.27 | −0.1 pp | 0.0 pp (−0.3 – +0.4) | −0.07 | −0.29 |
| Ravenous Eye | 4,647 / 630 | −0.25 | −1.44 – +0.93 | +0.4 pp | −0.6 pp (−1.4 – +0.3) | −0.29 | −0.45 |
| **Second Reflection** | 3,142 / 269 | **+2.22** | +0.17 – +4.14 | +0.4 pp | +1.3 pp (−0.1 – +2.8) | −0.42 | −0.52 |
| **Marked Fate** | 4,963 / 288 | **+1.70** | +0.12 – +3.29 | −0.3 pp | +0.5 pp (−0.4 – +1.5) | −0.13 | −0.27 |
| *Briar Lock (ref.)* | 8,468 / 992 | −0.21 | −0.67 – +0.26 | | | | |
| *Unmask (ref.)* | 3,870 / 963 | −0.42 | −1.26 – +0.39 | | | | |
| *Fate Exchange (ref.)* | 11,910 / 991 | +0.66 | −0.02 – +1.42 | | | | |

**Under mixed-aggressive:**
- Second Reflection +3.31 (+0.60 to +5.99) and Marked Fate +1.83 (+0.29 to +3.34);
  both also improve the table-win rate.
- **Ravenous Eye is −1.50 (−2.82 to −0.17).**
- Tight: everything includes zero except Fate Exchange (ref.) at −0.63.

**What this says:**
1. **The two Fate branches are the only spells in either study that are
   positive under both active policies.** They are worth about 2–3 Lifechips per
   cast decision.
2. **They are under-played, not weak.**
   - In the P8 balance, the skilled policy evolves into them often (325 and 244
     times), but casts them only about 0.08 and 0.01 times per run.
   - In this study it cast them on 9–10% of legal chances.
   - That is a policy (AI magic profile) finding, not a reason to buff them.
3. **Quiet Briars and Ravenous Eye** are neutral for disciplined play. Ravenous
   Eye looks harmful for an aggressor, but that is one interval among many and
   unreplicated.
4. **Selection bias:**
   - these runs deliberately reach the branches and cast their parents more
     often than ordinary play;
   - the run-end horizon was not measured;
   - the parent rows are not like-for-like.
5. **No rebalance is proposed.** Your rule was "do not rebalance from small
   samples", and the samples are now adequate. The question for you is whether
   the AI and skilled policies should use the Fate branches more (section 7,
   question B).

## 4. Portrait pipeline and status [A]

**`npm run art`:** one command that checks the files, packs the passing ones,
writes the runtime index and the 64 px proof (`portrait-64-proof.png`), and sets
the manifest status. The statuses:

- **needed:** no file at the manifest path. The game shows the monogram.
- **rejected:** a file exists but fails a check. It is not packed, and the
  monogram stays.
- **delivered:** every machine check passes. The file is packed and shown in the
  game for review.
- **integrated:** only via `--approve` with:
  - a **named reviewer**;
  - a **provenance note** next to the file (author, method, licence);
  - the file's **SHA-256** recorded.

  Editing the file afterwards drops it back to delivered.

`--revert` restores the monogram, or the provisional Adjudicator painting. A dry
run, `npm run art:check`, changes nothing.

**Checks:**
- PNG; 512×512; RGBA;
- alpha-zero corners and a real transparent exterior, so a painted checkerboard
  fails;
- a bust wide and high enough for the 64 px circle;
- not a near-duplicate of another portrait, which catches copies, recolours and
  re-crops.

It never draws or generates anything.

**Status of all seven:**

| Portrait | Path | Status |
|---|---|---|
| Ledger Adjudicator | `art/incoming/p4/adjudicator.png` | **needed** (the provisional painting stays) |
| Mara Quill | `art/incoming/p4/mara-quill.png` | **needed** |
| Eldric Vale | `art/incoming/p4/eldric-vale.png` | **needed** |
| Bailiff Sable | `art/incoming/p4/bailiff-sable.png` | **needed** |
| Sister Rill | `art/incoming/p4/sister-rill.png` | **needed** |
| Night Clerk | `art/incoming/p5/night-clerk.png` | **needed** |
| Dock Runner | `art/incoming/p5/dock-runner.png` | **needed** |

The cosmetic backs `art/incoming/p8/back-cinder.png` and `back-crown.png` are not
delivered either; both stay "art pending".

## 5. Mobile [D, automated captures only]

**Audit:** an automated check at 390×844, 320×568 and both phones in landscape.
It covers the table, the shop, the brokers, and playtest mode. In all of them:
- **no control smaller than 44×44 px;**
- no horizontal overflow;
- no legal action off-screen;
- no script error;
- the action row never moves when the spell info, the spell reason or the route
  bar opens.

**SE 40 px exception: resolved.** As your note suggested, I did not shrink the
table:
- The custom-amount slider now sits behind a **±** control on short phones.
- The presets and the action row reach 44 px.
- The table **grows** from 216×281 to 252×327 (`se-before-after.jpg`,
  `se-custom-amount.jpg`).

**Landscape (r7):** the panel used to squeeze the table to 63×83 on an SE. Table
and panel now sit side by side, and the table is 203×264 (`se-landscape.jpg`,
`landscape.jpg`).

**Disabled spells explain themselves (r3):** an uncastable spell stays tappable
and says why, in the player's own terms. For example:
- "you have already cast a spell this hand (one per hand)";
- "it is cast when a street opens, before the betting";
- "it enchants a raise: cast it on your betting turn";
- "needs 2 Aether; you have 1";
- "this street is already locked";
- "no opponent can be targeted now".

The ⓘ list gives the same reason (`se-spell-reason.jpg`).

**Route bar (r7):** the top title is now a 44 px control. It expands to, for
example, "The Ash Table, hand 2/8, blinds 1/2 · Act I · step 2 of 6 · next:
Selene's Lantern" (`se-route-expanded.jpg`).

**Unchanged:** the all-in second tap, pot odds, reduced motion (tells stay) and
the shops' exact transfer lines.

**Not done:** real-phone input checks. Touch accuracy on glass needs the
director's sessions.

## 6. Human playtest kit [no human data]

- **Kit:** `docs/playtest-kit-p9.md` contains:
  - recruiting (5–8 adults, at least 2 on narrow phones);
  - a consent script (free to stop, local log, export only with permission);
  - your P0/P1/P2 severity scale;
  - a per-session notes template (participant codes, no names).
- **`npm run playtest-summary`:**
  - It validates the exports and refuses files with card or personal-identifier
    fields.
  - It pools the sessions with explicit denominators: sessions, narrow-screen
    sessions, how many reached 15 and 45 minutes, early exits, and each metric.
  - With no files, it reports `NOT_PERFORMED`.
- **What I have not done:** the top-three-blocker fixes. They wait for real
  sessions, as you ordered.

## 7. Questions for the next milestone

- **A.** The literal Ember reserve is inert. Should the on-spend interpretation
  stand, or do you prefer to address cap waste where it happens (about 1.6
  Aether per table, mostly showdown regeneration)?
- **B.** The Fate branches show positive value but are rarely cast by the
  scripted policies. Should AI rivals that own them cast them more often? That
  would be a behaviour change, not a number change.
- **C.** Will the director run the 5–8 sessions before or after the portraits
  arrive? (Portraits would change the "generic art" P2 findings.)
- **D.** Are the portrait files coming, and should they go to the same paths
  with provenance notes?

## Screenshots (`docs/briefs/009/`; automated captures, not real devices)

At 390×844 (no prefix) and 320×568 (`se-`):

- **Table:**
  - `turn`: a decision.
  - `spell-reason`: tapping an uncastable spell.
  - `turn-info`: the ⓘ list with reasons.
  - `route-expanded`: the expanded route bar.
  - `se-custom-amount`: the ± slider on the SE.
- **Before and after:** `se-before-after.jpg`, the SE table in P8 (left) and P9
  (right).
- **Landscape:** `landscape.jpg` (iPhone 13), `se-landscape.jpg` (SE).
- **Other screens:** `shop`, `picker`, `playtest-panel`.
- **Portraits:** `portrait-64-proof.png`, the 64 px proof (painted cast plus
  monograms).
