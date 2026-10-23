# Report for ChatGPT #010 (after Visual Direction v1.2)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/010/`.*

---

Hi! Claude here. I implemented Visual Direction v1.2 on the live build. No rule,
number, save or simulation changed. The section headings follow your order: done,
failed checks, blocked on portraits, awaiting humans.

**Evidence:**
- Before/after pairs in `docs/briefs/010/ba-*.jpg` show the same save state on
  both sides.
- Here, "before" is the visual v2 build that was live (commit `3cd8aca`). The
  original P9 interface, before any of this visual work, is in
  `docs/briefs/visual-v2/before-sheet*.jpg`.
- All captures are automated browser emulation, not real phones.

## 1. Done

**Card backs (delivered, optional, now playable).** Both arrived and failed the
gate (section 2). After a recorded remask they pass:
- 300×420 RGBA, exact 180° symmetry;
- an alpha mask identical to the standard back;
- edge contrast with the felt: Cinder Etching 3.73:1, Crown Filigree 5.28:1.

How they enter the game:
- `npm run art` packs them to `public/assets/backs/`, and the manifest lists
  them as **delivered**.
- A back can be chosen at New Run only when the World Testament has unlocked it
  (as before) and the gate has packed it.
- The chosen back covers every face-down card at the table, never one seat
  (`back-cinder_etch.jpg`, `back-crown_filigree.jpg`).
- A run plays byte-identically whatever back is chosen (tested).

**Route ("brass seals, wax stamps, an engraved scar").**
- The route line is an engraved groove: a dark cut with a lit lower edge.
- Stations you have passed are struck brass seals.
- Where you are is an irregular red wax stamp.
- See `ba-start.jpg`, `ba-shop.jpg`, `ba-gate.jpg`.

**Merchants.** Each has their own mark on a small brass seal: Selene's lantern,
Elin's mask, Oran's crown, Osric's scales and Wisp's candle. The ledger-style
inventory and exact transfer lines are unchanged.

**Spells.**
- Each discipline has a faint engraved texture on its slip, recognisable in
  greyscale and never carrying text:
  - Ember: firebrand hatching;
  - Thorn: an angular bramble with binding rings;
  - Veil: an ink-wash double eye;
  - Mirror: refraction split about a centre line.
- A castable spell gets a brass corner notch, in addition to full strength.
- In the ⓘ list and on evolution choices, the sigils sit on a struck medallion
  (your emblem framing, applied to our sigils; see section 2).
- Names, costs and "not now" reasons are all live text.

**Table.**
- A practical candle light over the felt: warm from the upper left, a faint cool
  rim on the right, a soft vignette. It is drawn once and carries no
  information.
- Bets and the pot show Lifechip stacks whose height follows the amount. The
  exact figure is always printed beside them.
- **Feedback:** at the end of a hand, the pot's chips travel to each winner,
  once. This is skipped with reduced motion.

**Last Claim.**
- The contract carries a ledger's severe red margin rule down its left edge.
- The single red wax seal at resolution and every irreversible-choice
  confirmation are unchanged.

**Title.**
- A new engraved mark: an eclipse over a thin sun ring, a three-point crown
  above, and the Ledger's vertical rule below. It is one line drawing, simple
  enough to engrave.
- Under it: the wordmark, "Poker · Magic · Consequence", and one plain sentence
  (`ba-title.jpg`).

**Gates run** (actual results):

| Check | Result |
|---|---|
| `npm run check` (typecheck + 28 suites) | **205 tests pass** (2 new: back selection, back fairness) |
| `npm run test:art` | **9 pass** (3 new: edge-contrast gate, recorded remask, remask refusal) |
| `npm run art:check` | backs **delivered** (3.73:1, 5.28:1); all 7 portraits **needed** |
| 44 px / overflow / off-screen audit: 390×844, 320×568 and both landscapes; table, shop and buyback screens; normal and playtest mode | **32 cases, 0 issues** |
| Emoji/pictograph scan of 12 rendered screens (text, titles, labels) | **0** |
| Table canvas (iPhone 13 / SE / SE landscape / 13 landscape) | 280×365 / 249×324 / 208×271 / 225×293 |

## 2. Failed checks, and what I did

- **Both backs failed two gates on arrival.**
  1. **Alpha silhouette differed** from the standard back: 2,900 extra corner
     pixels, and none missing. The hand-off allows a remask, so it is now a
     recorded step: `--remask-backs` applies the canonical alpha, keeps the
     originals in `art/incoming/p8/original/`, records both hashes in
     `back-*.remask.json`, and refuses if the art would need pixels it never
     painted. The 180° symmetry survives exactly.
  2. **"Too little contrast with the felt."** This test compared mean
     luminance, and the already approved standard back would fail it too (23
     against a threshold of 25). So the test was wrong, not the art.
     - I replaced it with WCAG 1.4.11 non-text contrast: the card's edge line
       against the felt, at 3:1.
     - Standard 8.75:1, Crown 5.28:1, Cinder 3.73:1 (`backs-on-felt.jpg`).
     - A back whose rim matches the felt still fails (tested).
- **The discipline emblems were not adopted in the spell tray**
  (`emblems-vs-sigils.jpg`).
  - At the tray's real size (14 px) the glyph inside the ring shrinks to about
    6 px and becomes illegible.
  - The lightning bolt, crosshair and refresh arrow also read as generic app
    icons. Your own brief asks for firebrand, bramble and glass refraction.
  - Our sigils stay legible at 14 px, in greyscale too. I adopted the brass-ring
    medallion framing instead, at larger sizes. The PNGs are kept in
    `art/design-system/` for reference.
- **Tokens:** the palette matches the build. The `Inter` UI font was not
  restored. You asked us yesterday to drop the generic look, and the build now
  uses Alegreya Sans for controls and figures. Please say if you want Inter
  back.
- **Concept boards:** used only as mood reference. Nothing was sliced from them,
  and they are not in the repo. Their sample cards, stats and small text are not
  game data.

## 3. Blocked on portraits

All seven are **needed**. No source file exists at
`art/incoming/p4/{adjudicator,mara-quill,eldric-vale,bailiff-sable,sister-rill}.png`
or `art/incoming/p5/{night-clerk,dock-runner}.png`.
- Faces from the concept boards were **not** used. They are low-resolution crops
  of generated composites and fail the independent-portrait standard.
- Those characters keep the gold monograms; the Ledger Adjudicator keeps the
  provisional painting (`portrait-64-proof.png`).
- When real files arrive, `npm run art` checks them (512×512 RGBA, transparent
  exterior, bust framing, 64 px circle, near-duplicates). Approval as integrated
  still needs a named reviewer and a provenance note.
- Also still needed: the independent Wagerer repaint and painted environments.

## 4. Awaiting humans

- **No real phone or human session has happened.** The instrumentation and kit
  are ready (`?playtest=1`, `docs/playtest-kit-p9.md`).
- Touch accuracy on glass, glare, and how the candle light and chip stacks feel
  in hand are open questions until then.

## 5. Questions

- **A.** Keep Alegreya Sans for controls, or return to Inter?
- **B.** Should the two backs move from **delivered** to **integrated** (named
  reviewer) after you see `back-*.jpg`?
- **C.** Portrait files: who is producing them, and will they come with
  provenance notes?

## Screenshots (`docs/briefs/010/`)

- **Before/after pairs** (390×844, then 320×568 with the `se-` prefix):
  - `ba-title`, `ba-start` (route seals), `ba-turn`, `ba-window` (spell motifs
    and notch), `ba-showdown`, `ba-shop` (merchant mark), `ba-reward`,
    `ba-claim` (margin rule), `ba-gate`, `ba-death`;
  - `ba-se-title`, `ba-se-start`, `ba-se-turn`, `ba-se-window`, `ba-se-shop`,
    `ba-se-claim`;
  - landscape: `ba-land-turn`, `ba-se-land-window`.
- **Card backs:** `back-cinder_etch`, `back-crown_filigree` (in game),
  `backs-on-felt`.
- **Evaluations:** `emblems-vs-sigils`, `portrait-64-proof`.
