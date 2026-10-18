# THE LAST WAGER — ART BIBLE v0.2 / P3 ADDENDUM

Companion to canonical art bible v0.1. No change to the eight-color Gilded Eclipse palette, Cinzel/Cormorant Garamond/Inter type system, or the portrait-lighting vocabulary.

## Stakes and moral visual vocabulary
Last Claim must feel like a severe legal and supernatural consequence, not a sensational defeat animation. Suspend table ambience; use dark walnut margins and warm parchment for the binding contract. Show the named claimant and chip source visibly. No explicit or suggestive scene art for optional personal-patronage themes. No CGI gore, animated punishment, or erotic reward framing.

## 300x420 poker back
`public/assets/cards/back.png`: engraving on black-green enamel with burgundy silk, antique-gold inner coin/eclipse insignia; exact 180° rotational symmetry, including transparency. Uniform circular details, no ranks/letters, no readable directional tell. Same silhouette as 52 canonical card faces. Prefer crisp, subpixel-clean edge under atlas compression.

## Last Claim contract parchment
`public/assets/ui/last-claim-contract.png`: 960×1200 RGBA. Warm parchment and fine gilded border, deliberately generous quiet space inside x100–860, y180–1040. UI code overlays claimant portrait, bargain headings, chip source/endowment, terms, willingness, buttons and confirmation. Nine-slicing should avoid stretching corner ornaments; static aspect-preserving use is preferred. Keep dark ink text contrast.

## Ledger seal
`public/assets/ui/ledger-seal.png`: 256×256 RGBA. Deep crimson wax seal with gold eclipse impression and ragged natural silhouette; readable at 48px. Can animate short embossed flash; no numeric state baked in.

## Ledger title card
`public/assets/ui/ledger-title-card.png`: 1200×630 RGBA. Black-green lacquer plaque, engraved antique-gold double frame, central crest and quiet title placement below it. The words 'THE LEDGER OF SOULS' and 'LAST CLAIM' must be overlay text, not image pixels.

## Neutral adjudicator
`public/assets/portraits/adjudicator.png`: 512×512 RGBA. Neutral porcelain-masked Ledger official, soot-navy hood, weathered gold clasp and collar, faint asymmetrical candlelight. Emotionless, neither Oracle nor Corvin; gender intentionally ambiguous, no threatening erotic overtones. At 64px circle, mask and hood must remain recognizable. **Current file is a stylized vector concept prototype and requires painterly approval before P5 final polish.**

## Export/tests
All source PNGs sRGB RGBA with transparent exteriors. Verify exact sizes, back rotation symmetry, no illegible text generated into assets. Measure contract screen on 400x520 logical canvas within iPhone safe areas: actionable choices implemented as separate accessible buttons; avoid label sizes below 13 CSS px. Use manifest additions and do not silently overwrite existing `docs/asset-manifest.json` without merging.
