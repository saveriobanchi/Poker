# THE LAST WAGER — Art Bible v0.1

**Source of truth for visual production** · Companion to game design bible v0.4 · 18 October 2026  
**Project format:** portrait-first mobile PWA, 400 × 520 logical reference viewport; UI vector/text at device pixel ratio; source images at 3× display resolution.  
**Scope:** card backs/faces, Lifechips, character portraits, panels, typography and effects. All design and implementation must be legible on a phone, not only in enlarged mockups.

## 1. Art direction — *The Gilded Eclipse*

A luxurious, dangerous, lived-in dark-fantasy gambling world: black-green baize, soot-dark walnut, aged brass, burgundy silk, parchment, and ritual gold. Aesthetic keywords: **engraved, lacquered, candlelit, ceremonial, restrained, tactile**. Avoid fluorescent glows, bright casino neon, flat modern glassmorphism, generic beveled RPG loot panels and ultra-small ornate typography. The table must remain readable even as spell effects intensify.

**Hierarchy:** cards > legal action and pot > player stacks > magic tells > portrait flair > background decoration. Don't put text in AI artwork; render player-facing labels with code.

## 2. Color palette (hex)

| Token | Hex | Usage |
|---|---|---|
| `bg.void` | `#0B1013` | app exterior, extreme negative space |
| `wood.ink` | `#231A18` | dark lacquered wood |
| `wood.edge` | `#473126` | warm carved edge |
| `felt.main` | `#132E29` | table surface |
| `felt.deep` | `#0D201D` | table interior shadow |
| `gold.antique` | `#C9A24A` | borders, icon accents |
| `gold.light` | `#F3D27A` | special focus, foil reflections |
| `gold.muted` | `#856B3E` | quiet filigree |
| `crimson` | `#8E1B2A` | hearts/diamonds, risks, Vesper accent |
| `crimson.legible` | `#A92C3C` | red suit glyph on parchment |
| `parchment` | `#F2E8D0` | card stock, dialogue scrolls |
| `ink` | `#201E22` | spades/clubs, card indices |
| `text.main` | `#EFE7D5` | dark-surface primary labels |
| `text.muted` | `#B8AE99` | dark-surface secondary labels |
| `arcane.violet` | `#77629A` | Veil, Oracle |
| `arcane.azure` | `#5A8EAC` | Mirror |
| `thorn` | `#477A68` | Thorn, Corvin |

Maintain WCAG-style high readability for important text, especially stack sizes and bets; never convey suit identity with color alone (glyph also required).

## 3. Typography

- **Display / act titles:** Cinzel Semibold (or a suitable licensed high-contrast Roman-inscription serif); uppercase, selective tracking; use only at large sizes.
- **Narrative & secondary headings:** Cormorant Garamond Semibold, comfortable line spacing. Fallback Georgia.
- **Game controls, balances, tooltips and spell text:** Inter Medium / Semibold or system sans-serif. No decorative type for critical decisions. Use tabular figures for chip amounts.
- **Card rank characters:** Noto Serif Display Bold or DejaVu Serif Bold (baked into texture only if font license permits). Suit glyphs should be typographically large and unmistakable.
- Mobile: critical numerals at least 16px CSS when practical; no essential tappable control label below 13px. Target 44px CSS for tap areas, with 8px spacing.
- Avoid bundling unlicensed fonts. Don't distribute font source files in the art pack; developer may install proper OSS typefaces separately.

## 4. Playing card faces

- **Sprite path:** `public/assets/cards/{rank}{suit}.png`, where ranks `2..9,T,J,Q,K,A`; suits `c,d,h,s`.
- **Dimensions:** **150×210 RGBA PNG**, alpha=0 at rounded exterior corners (radius roughly 10 px). All 52 share pixel-identical framing, margins and visual weight.
- Parchment stock (not flat white); restrained corner foil; dark ink spades/clubs; crimson hearts/diamonds. Do not substitute AI-drawn imperfect rank glyphs for actual font-rendered indices.
- Big index upper-left, clear small suit below it; second lower-right index optional but must also be correct. Clear 50×70 logical size test on device. Indices outrank illustration.
- Middle pips on number cards should match rank exactly; an Ace can have one special engraved spade. Face cards (J/Q/K) may use restrained unique portraits while preserving the indices.
- Symbols must remain visually distinguishable in monochrome and color-blind settings.

## 5. Card backs

- **Sprite path:** `public/assets/cards/back.png`.
- **Dimensions:** **150×210 RGBA**, same silhouette as faces; **180-degree rotational symmetry** is a gameplay fairness rule (no visual orientation tells).
- Black-green enamel, antique gold engraved linework, subtle burgundy cloth inlay; central Ledger sigil (sun/spade/coin). Never resemble a face card. No readable letters or rank markings.
- Hidden cards of all AI opponents use the exact same back texture, orientation-neutral.

## 6. Lifechips

- **Target:** `public/assets/chips/lifechip.png`, **96×96 RGBA** (planned next wave; not in this first seven-asset sample).
- Heavy ceremonial coin/poker chip with soul inset, concentric engraving and six discreet rim notches; metallic gold rim, muted crimson core. Pixel silhouette must read at **18px**.
- Stack height, wager size and pot totals are expressed with code labels; never infer numerical denomination solely from decorative chip art.
- Special magical effects can briefly pulse the inlaid rune, but must never obscure stack amounts.

## 7. Portraits

- **Paths:** `public/assets/portraits/vesper.png`, `oracle.png`, `corvin.png`, `wagerer.png`.
- **Size:** **512×512 RGBA PNG**; transparent exterior, centered bust (head + shoulders), approximately head at x-center and eyes in upper third; a consistent subtle metallic circular motif works well when kept distinct from card frames.
- **Style:** painterly gouache/engraved fantasy realism, high contrast large shapes, candle key light high camera-left, cool bounce high camera-right. Not anime chibi or photography.
- **Vesper:** aristocratic black curls, crimson rose/silk, poised dangerous gaze, warm jewel accents.
- **Oracle:** pale-lavender hood, obscured eyes, luminous cool sigils; no magical tells embedded into the poker UI unless activated legitimately.
- **Corvin:** weathered dark-haired knight, emerald/steel clothing, reserved expression, broad silhouette.
- **Wagerer:** anonymous neutral masked traveler, subdued teal-green and antiqued brass; deliberately customizable later. First implementation is a **provisional treatment** of existing concept art and needs an independently illustrated replacement before shipping.
- **Phone test:** eyes, silhouette and costume must remain identifiable inside a **64px circular mask**. Do not paint thin text labels or small playing cards into the portrait.

## 8. UI panel system

- **Wood inset:** charcoal/walnut backing `#231A18`, narrow gold line `#856B3E`, subtle edge light, corner radius 12–16 logical px.
- **Parchement overlay:** `#F2E8D0` for longer narrative and contract screens; ink text `#201E22`.
- **Table plates:** dark green felt with compact brass frame, portrait medallions but no heavy chrome around every number.
- **Action hierarchy:** Fold = dark neutral outlined; Check/Call = parchment or green; Raise/All-in = antique gold with clearly legible dark text; never color-code risk without words.
- **Legal bets:** real interactive accessible controls, not raster buttons with embedded labels. Confirm all-in / irreversible Last Claim choices with a second tap.
- **Magic tell:** brief individual-color arc near the casting seat, icon and visible text label; public tell text must be accessible in hand history.
- **Animating:** 160–240ms tap/hover, 250–500ms deal/stack transfers, scalable/skippable 500–900ms special cast; reduced-motion fallback.
- **Responsive:** reserve safe areas for iPhone notch/home indicator; 3+ opponent portraits must never overlap pot, community board or legally available actions.

## 9. Export / quality gate

- All PNGs are sRGB RGBA and use manifest-exact file names. Alpha=0 outside rounded card or portrait silhouette.
- Card images always 150×210; portraits always 512×512. Do not scale nonuniformly.
- Verify **all seven files** at natural size and 50×70 / 64×64 downscales respectively, including text clarity and nonoverlapping silhouettes.
- Generated imagery is source artwork; exact card numbers/suit indices should be overlaid deterministically in vector/PIL/engine as needed.
- Assets must be committed or copied to matching manifest paths, then Claude changes status from `needed` to `integrated` only after in-engine screenshot verification.

## 10. First production pack provenance / caveats

The initial seven sprites are **proof-of-direction assets** created from generated concept art, then cropped/composited and standardized programmatically. The Wagerer uses a **provisional, derived masked variant** for early testing; it is not an independently generated portrait. Some source art was generated at concept-sheet scale, then upscaled; use these to validate proportions/colors at phone size before commissioning final-resolution unique assets. Sample cards retain a printed frame; Claude must verify card indices and number of center pips in-game. No third-party image licensing dependency is included in these source images.
