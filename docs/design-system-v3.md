# The Last Wager: design system v3, "Ashen Reliquary"

*Adopted on 2026-10-27 from the owner's reference set: the Ashen Reliquary board, the gameplay and title mock-ups, the Reliquary back, four discipline emblems and four portraits.*

The game is a pilgrimage of cards, will and consequence. It should feel ritualistic, tactile, refined and eerie.

**What changed from v2 ("the Ledger by candlelight"):**
- Polished brass became oxidized copper.
- Green felt became a coal-stone slab with a ritual circle cut into it.
- Painted art now carries the identity: portraits, emblems and the back.

No rule, number, save or random draw changed.

## Palette (`src/style.css` `:root`, `scripts/build-assets.mjs` `P`)

| Token | Value | Use |
|---|---|---|
| Coal black | `--void` `#0d0b0a`, `--soot`, `--lacquer` | Every surface; the table slab |
| Bone ivory | `--bone` `#e8dcc4`, `--bone-2` `#b3a68c` | Text; card stock; parchment |
| Oxidized copper | `--copper` `#b8734a`, `--copper-hi` `#e2a97e`, `--copper-lo` `#7a4a2e` | Frames, rules, figures, the table rim |
| Smoked plum | `--plum` `#4a3346`, `--arcane` `#b496b8` | Aether, Veil, magic |
| Bruised vermilion | `--vermilion` `#9e2f25`, `--oxblood` `#8e2a22` | Lifechips, the decisive plate, wax seals, red suits |
| Muted celadon | `--celadon` `#5e7e68`, `--verdigris` `#7f9e86` | Check and call, things you can do now |
| Ash grey | `--ash` `#8a857c` | Spent, disabled, fine print |

**Disciplines (`src/ui/theme.ts`):**
- Ember: vermilion `#A3392C`
- Veil: plum `#6E4F72`
- Thorn: celadon `#5E7E68`
- Mirror: ash silver `#8A9AA0`

## Type

- **Cinzel Decorative 700:** the wordmark and screen titles only.
- **Cinzel 600:** engraved labels, plates, names.
- **Spectral (400 to 700, italic):** everything people read, including spell text, figures and narration.

All three are OFL fonts bundled through `@fontsource`. Figures are lining and tabular.

## Materials

**Framed plates (`button`).** A rectangular frame (never a round pill) with:
- copper corner brackets (`--orn`);
- an inner rule;
- a brushed-metal grain (`--brushed`);
- a fill (`--fill`) that names the action.

| Fill | Action |
|---|---|
| Coal | Fold |
| Celadon enamel | Check, call |
| Copper | Raise |
| Wax red (`.primary`) | The one decisive action on a screen |
| Ember glow | A raise carried by Cinder |

**Menu plates.** An icon well, a title, one line of what the plate does, and a chevron.

**Surfaces.** Generated SVG grain and a faint mottle. Nothing is downloaded.

**The table.** Generated in `scripts/build-assets.mjs`:
- a coal-stone slab inside an oxidized copper rim with verdigris patina;
- a carved ritual circle (rings, ticks, four crescents) under the pot and the board;
- the pot sits in a copper cartouche.

**Cards.** Bone stock with generated stains, a copper frame and bruised-vermilion red suits.

**The back.** The Reliquary back is the standard back. It has a 2 px copper edge keyline so its edge reaches 3:1 against the slab.

## Painted art and its sizes

**Portraits** (256 px runtime, circular discs on the coal ground):
- The Ledger Adjudicator is the title's hero at 176 px and appears at the Last Claim.
- Lady Vesper, the Sightless Oracle and Sir Corvin sit at the tables and in the title's "At the tables" row.

**Emblems:**
- 54 px, half out of the corner of each spell slip, dimmed so the name always wins;
- 44 px in the spell list;
- 34 px on evolution choices.

Below 28 px the line sigils of `src/ui/icons.ts` stay: at 14 px the paintings turn to mud.

**Not adopted from the boards** (they are direction, not assets):
- the sample cards and their rules text;
- the characters without real files (the Acolyte, the Exiled, the Heretic, the Keeper);
- the act environments.

No board was cropped.

## Rules that do not change

- Live gameplay information is always text: figures, odds, costs and "not now" reasons.
- Every control is a native button with a 44 px minimum.
- No emoji or pictographic glyph anywhere. Icons are the game's own line drawings.
- Reduced motion turns off every pulse, slide and flip.
