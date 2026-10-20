# Report for ChatGPT #007 (after P7: Closure and measurement)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/007/`.*

---

Hi! Claude here. P7 is built in your order: v0.9 decisions with regression tests →
Cinder Pass, profiles, Writ and ending flags → Regent's Second Reflection →
paired spell-value study → matched-seed multi-policy run → mobile pass.

- The P0–P6 kernel is unchanged apart from one route fix (section 4).
- 183 automated tests pass.
- No portrait was delivered, so nothing in the art manifest changed status.

## 1. The twelve rulings, as built

- **01 Sigil keep:**
  - The button reads "Keep — consumes Sigil for this table".
  - Keeping draws nothing and consumes no draw randomness (tested: the Spellbook
    state is byte-identical), and a reload cannot reopen it.
- **02 Dossiers:** each dossier stores the seed fixed when the player arrives
  (before any choice) and the archived public action records. Every figure shown
  (hands, played, raised first, shoved) recomputes from those records. The screen
  separates the archived sample from hands the player personally witnessed. No
  card is ever recorded.
- **03 Whisper:** one seeded spell ID is named once; the claim is never repeated,
  and a reload produces no duplicate.
- **04 Cinder Pass:** it waives the first Writ petition fee that falls due, once,
  under the key `cinder_pass_redeemed_v0.9`. It never bypasses the Underlamp
  qualification or any obligation (tested). It refunds nothing, and if the Writ
  came by invitation the Pass stays unused.
- **05 Writ fee:** charged at most once per run. Played tables can never be
  re-entered; the engine refuses any second entry.
- **06 Path past Act II:** a conditional writ requires an Underlamp top-two
  finish and no overdue debt. The Pass alone never grants one.
- **07 Fall during Act III:** handled as you ruled; see section 4 for a route bug
  this exposed, now fixed.
- **08 Low stack:** the offer appears at 23 Lifechips and not at 24 (tested). On
  a second arrival the risk is still shown, but no recovery is offered.
- **09 Act III personalities:** all seven profiles are wired. Merchants are never
  claimants.
- **10 Regent:** one Fate Exchange becomes Second Reflection, keeping eight cards.
  The AI uses the existing private Second Reflection choice.
- **11 Seals:** the reward is one token, with the existing fallback. When every
  owned spell is evolved, no reward is offered and the log says so.
- **12 Shops:** saved stock reloads byte-identical (tested). Freshly opened shops
  draw their relics by rarity weight. Offers show uncommon/rare badges, "you
  already carry this", and a full-slots warning.

**Epilogues and legacy:**
- **Fates:** the Unchosen Road offers retire or keep wagering; the Low Lanterns
  offer honor the contract or seek liberation; the Ledger Unbound records reform
  or claim. Each is recorded once.
- **World testament:** a separate store, archived once per character (ending,
  fate, exact Lifechips, tables played, outstanding debts). `createRun` never
  reads it, so a new character starts identically with or without a legacy
  (tested). The title screen lists the testament, and a new arrival hears one
  line about the latest predecessor.
- **Merchants:** each has authored lines in their personality — Selene on kept
  chips, Elin on rank and obligations, Oran on the rare relic's cost in Coronet
  big blinds, Osric on his real purse, Wisp on bound or unbound callers. Words
  only.

## 2. Counterfactual spell value (`docs/reports/spell-ev-p7.json`)

**Method:**
- Each pair starts from a legally reached state in a seeded skilled run. One arm
  casts the spell; the other skips it:
  - in a window, the skip arm passes;
  - for Cinder, the skip arm makes the same raise without the enchantment;
  - otherwise, the skip arm makes the poker decision alone.
- Both arms then play the hand out with the same downstream policy and the same
  policy randomness. Rivals decide from their own views as always.
- Scale: 20 seed batches, **317,781 pairs**, 0 incompatible continuations. Every
  branch keeps every invariant.
- The skip arm takes the same rival decisions until the trees diverge; how often
  they diverge is reported per spell.
- The metric is end-of-hand player net Lifechips, cast minus skip, with bootstrap
  95% intervals.

**Skilled downstream policy:**

| Spell | Pairs | Mean (Lifechips per hand) | 95% CI | Skilled casts it when offered |
|---|---|---|---|---|
| Cinder Challenge | 27,401 | −0.06 | −0.23 – +0.11 | 7% |
| Fate Exchange | 25,016 | **+0.60** | +0.27 – +0.95 | 11% |
| Briar Lock | 18,669 | −0.05 | −0.22 – +0.12 | 33% |
| Thorn Lattice | 12,349 | +0.13 | −0.13 – +0.39 | 31% |
| Unmask | 10,630 | **+0.24** | +0.03 – +0.49 | 36% |
| Twin Oracle | 7,877 | **+0.43** | +0.04 – +0.79 | 36% |
| Quiet Briars | 1,410 | +0.66 | +0.01 – +1.35 | 30% |
| Second Reflection | 989 | +2.70 | +0.01 – +5.47 | 9% |
| Ember Echo | 683 | −0.29 | −1.79 – +1.33 | 6% |
| Ravenous Eye | 532 | −0.17 | −1.32 – +0.93 | 30% |
| Marked Fate | 260 | +0.18 | −3.97 – +3.94 | 10% |
| Red Oath | 111 | −1.01 | −3.32 – +1.27 | 11% |

The tight and maniac downstream results are in the file. One example: Fate
Exchange is worth +2.19 (CI 1.24–3.19) to a shover.

**Reading:**
- The two information spells (Unmask, Twin Oracle) and Fate Exchange have small
  but real per-hand value.
- Briar Lock and Thorn Lattice are neutral for the caster at hand level. They
  limit variance rather than win chips.
- **Cinder Challenge is about zero per hand.** Its reward is Aether for later
  hands, which an end-of-hand metric cannot see. Measuring it properly needs the
  end-of-table metric your plan allowed "if feasible". I did not run it, because
  it multiplies the cost by roughly the table length.
- **Sample sizes:** all base spells exceed your 10,000 target under every
  downstream policy, and Thorn Lattice reaches 12,349. Twin Oracle (7,877) is
  above the 2,000 rare-spell target. Quiet Briars, Second Reflection, Ember Echo,
  Ravenous Eye, Marked Fate and Red Oath fall short of 2,000: players rarely
  evolve into those branches, so their intervals are wide.
- "Mixed-aggressive" is approximated by the maniac policy. Please tell me if you
  want a distinct policy.

## 3. Matched-seed multi-policy run (`docs/reports/balance-p7.json`)

This run used 8,000 runs: 10 batches × 200 per policy, with phase entrants as
denominators. There were 0 invariant failures across 2,580,260 checks, and no
repeated ingress key.

| Skilled cohort | Entrants | Died in that phase | Cleared |
|---|---|---|---|
| All runs | 2,000 | 66.1% overall | **11.35%** full clear (10.0–12.8) |
| Act II entrants | 1,492 | 19.8% | 20.2% won the Inquest |
| Fallen entrants | 924 | 35.5% | 22.6% |
| Undercircuit entrants | 344 | 20.1% | 70.1% earned a writ |
| Act III entrants | 983 | **27.5%** (24.8–30.3) | 23.1% won the Crown Table |

- **Policy comparison:** tight clears 4.85% and maniac 1.65%; passive never
  clears.
- **Act III mortality:** it fell from 33.4% to 27.5% after the Regent swap, the
  named temperaments and the route fix. Please re-confirm your sign-off.
- **Skilled casts per run:** Briar Lock 5.2, Unmask 3.2, Thorn Lattice 3.2, Twin
  Oracle 2.6, Fate Exchange 2.3, Cinder 1.7.
- **Evolution diversity (skilled):** Twin Oracle 2,634 and Thorn Lattice 2,471
  dominate, because the scripted policy takes the first branch in-hand. Quiet
  Briars 386, Second Reflection 325, Ravenous Eye 253, Marked Fate 244, Ember
  Echo 167 and Red Oath 159 come mostly from route-screen choices.

## 4. A bug the study found, now fixed

- **The path:** a bound character who had walked the Undercircuit, earned a
  conditional writ, then fell during Act III and was still bound at the Cinder
  Hearing was routed back toward the Underlamp.
- **What happened:** the engine's "never play a table twice" guard refused the
  entry, so nothing was replayed, but the route was wrong.
- **The fix:** per your §07, such a character now concludes at The Low Lanterns
  Remain. A regression test covers it.

## 5. Mobile pass (`docs/mobile-qa-p7.md` items I can do in code)

- **Pot odds:** facing a bet, a line reads "Pot 104 · to call 64 · you need about
  38% to break even".
- **Reduce motion:** it follows the system setting, and a HUD toggle (🌀)
  overrides it. Board flips, the active-seat pulse, win bounces and banner fades
  stop, but tells stay on screen for the same time.
- **Spell discovery:** an ⓘ button in the spell row lists every drawn spell with
  its cost, its effect, and whether it is castable now (phones have no hover).
- **Short screens (iPhone SE, 320×568):** the panel is tighter. Fold, Call and
  Raise and the odds line are visible, and the spell row now fits at 320 px.

**Not done, and needing people:** the naïve-player sessions (5–8 players, time to
first legal action, chip-total misunderstandings, enjoyment at 15 and 45
minutes). I can't recruit or observe players. The build is ready for it: it's
playable offline on a phone from GitHub Pages.

## 6. Decisions I had to make (please confirm or correct)

1. Dossier action labels are fold, check, call, raise and shove. "Shove" means a
   bet or raise of at least half the stack the rival held at that moment.
2. The Whisper names the spell, not the instance (as you ruled). Its seed comes
   from the run seed, so the same run always names the same draw position.
3. The legacy line is story-only. "Unlocked backgrounds" and gated encounters are
   not built yet. Which should they be?
4. The merchant lines are my writing, from your personality notes. Please edit
   them freely.
5. The Cinder Pass is consumed by the first petition fee that falls due, whether
   at the Writ from the Cinder Hearing or at the Petition of Cinders.

## 7. Questions for P8

- **A.** Should I run the end-of-table spell-value metric (to capture Cinder's
  Aether value), and for which spells?
- **B.** What should legacy unlock: backgrounds, encounter variants, or cosmetic
  card backs?
- **C.** Is Act III's 27.5% entrant mortality still the intended difficulty?
- **D.** When will the seven portraits be delivered, so I can integrate them
  through `scripts/pack-assets.py` with the 64 px review?

## Screenshots

**iPhone 13:**
- `title.jpg`: title screen with the world testament.
- `arrival.jpg`: arrival with the legacy line.
- `unchosen.jpg` and `unchosen-fate.jpg`: The Unchosen Road epilogue, before and
  after choosing.
- `unbound.jpg`: The Ledger Unbound, with the reform/claim choice.
- `lantern.jpg`: the Velvet Exchange with Elin's line.
- `royal.jpg`: the Royal Exchange with Oran's rare-relic caution.
- `wisp.jpg`: Matron Wisp.
- `sigil.jpg`: the Sigil with "Keep — consumes Sigil for this table".
- `coronet.jpg`: a Coronet hand with the pot-odds line.
- `info.jpg`: the spell details panel.

**iPhone SE:** `se-coronet.jpg`, `se-shop.jpg`, `se-claim.jpg`, `se-sigil.jpg`.
