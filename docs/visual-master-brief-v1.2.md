# THE LAST WAGER — COMPLETE VISUAL MASTER BRIEF (v1.2)

## Design thesis
An antique, dangerous world with a visual history. Each material is earned: black-green baize shows wear, lacquer shows fine scratches, antique brass is oxidized in recesses and polished on touch points; ink and wax belong to the Ledger. The hierarchy is genuine poker first; life at stake second; available magic third; decorations last. Avoid neon-fantasy gradients, generic radial glows, glassmorphism, unmotivated particle spray, over-ornamented buttons and uniform generated faces.

## The visual grammar
- Poker table: current felt and rail composition retained, now favor discreet etched hairlines, tactile Lifechip stacks, subtle practical candle edge-light and high card contrast. Preserve readable 52-card deck.
- Magic: four visually discrete disciplines. Ember = fine firebrand engraving and molten coin notch. Thorn = angular green bramble geometry and binding rings. Veil = violet eye, ink wash and faded double image. Mirror = cyan glass refraction and symmetric split lines. Every effect has a restrained silhouette recognizable in grayscale and a plain-language text tell.
- Character identity: all faces independent; distinguish by age, posture, collar silhouette, eye/face shapes, cloth, restrained accent color and a personal emblem. Painted/engraved gouache, matte, soft warm-left/cool-right lighting. At 64px their hair/headgear and collar differentiate each NPC. No borrowed copy/crop of another portrait.
- Narrative: Last Claim is parchment, dry ink, a single red wax seal and a severe margin rule. Make the debtor and claimant recognizable. Mercy, debt, service and death should be treated solemnly. Avoid sexualized imagery.
- Map: navigational line is a scar/engraving; nodes feel like physical brass seals or wax stamps. No giant fantasy map hiding node choices. Keep currently implemented routes and costs.
- Merchants: use a practical physical inventory ledger, clear Lifechip transfer descriptions, distinct small symbols per merchant. No faux online-shop giant cards.
- Relics: isolated still-life engraving on velour/black, material + worn edges, clear unique silhouette. Keep rarity markers subtle, not giant glowing borders.
- Spell cards: no text inside illustrated textures. Programmatic names, costs and legal/disabled reason below the illustration. Evolved spells should show physical mutations of parent motifs.
- Logo: eclipse over a thin sun-like ring, crown and Ledger verticality; simple enough to engrave. No imitation of existing casino/game-brand logos.

## Priority implementation by existing screens
1. Gameplay table: legibility, chips, cards, actionable magic windows, match existing 44px controls.
2. Last Claim: severity and irreversible choice clarity.
3. Spell tray/evolution: distinctive discipline motifs, cost and status.
4. Map/merchant: consistent physical material language.
5. Title/testament/ending: cinematic identity with minimal interface clutter.

## Asset specification and honest status
- `back-cinder.png`, `back-crown.png`: images generated programmatically, exact 300×420 RGBA/rotation. Must also match standard back alpha. Approved ONLY following existing asset gate and screenshot review.
- Four `discipline-*.png`: programmatic icons, exact 256×256, alpha surround. Optional design-system candidates.
- Seven pending portrait paths: `art/incoming/p4/{adjudicator,mara-quill,eldric-vale,bailiff-sable,sister-rill}.png`, `art/incoming/p5/{night-clerk,dock-runner}.png`. Must be 512×512 RGBA independent painterly busts. Still missing.
- Concept boards: broad references only, contain synthetic example UI/cards/stats, not proof of implemented features.

## Quality and acceptance gates
- Verify poker card suits/ranks/indices (do not copy generated example cards), 52-unique invariant, orientation-neutral backs and all HUD figures rendered from actual state.
- Game uses only assets existing at their manifest paths; never mark concept boards as integrated sprites.
- No horizontal overflow and every input visible at 320×568 and 390×844 in portrait and landscape. Touch >=44px.
- Check reduced-motion, color-blind legibility and private/public-information tells.
- Capture UI before/after and reject changes that obscure poker actions or pot odds.
- Run `npm run check`, `npm run test:art`, `npm run art:check` after integrating visuals.
- Preserve saves, poker, world ledger and replay deterministic state.

## Notes for commissioned artwork
No use of brand logos or copyrighted characters; preserve original lore and exact NPC names. Commercial suitability requires provenance tracking. Do not use the generated posters as final production textures because their small in-image type and sample gambling values are not authoritative.
