# THE LAST WAGER — P9 Art Production Contract

Preserve `docs/art-bible.md` / **The Gilded Eclipse** aesthetic: painterly gouache/engraved fantasy oil, warm camera-left light, cool right rim, gold and burgundy accents, believable textiles, no overly glossy generic AI UI.

## The seven exact overdue files

| Character | Exact PNG path | Silhouette |
|---|---|---|
| Ledger Adjudicator | `art/incoming/p4/adjudicator.png` | Ageless adult, carved obsidian half-mask, parchment mantle, ancient chained insignia, severe frontal posture. |
| Mara Quill | `art/incoming/p4/mara-quill.png` | Alert russet-haired bookmaker, burgundy trader vest, ink-stained hands and brass clasp; asymmetric shoulders. |
| Eldric Vale | `art/incoming/p4/eldric-vale.png` | Unruly dark hair, oxblood cloak, asymmetrical gold epaulet and calculating grin. |
| Bailiff Sable | `art/incoming/p4/bailiff-sable.png` | Heavy charcoal uniform, scarred mature face, rigid collar and thorn-engraved insignia. |
| Sister Rill | `art/incoming/p4/sister-rill.png` | Silver-haired ascetic, moss green and pale linen, reserved eyes, delicate but decisive silhouette. |
| Night Clerk | `art/incoming/p5/night-clerk.png` | Exhausted soot-eyed records keeper, faded teal scarf, copper abacus pendant, narrow shoulders. |
| Dock Runner | `art/incoming/p5/dock-runner.png` | Weathered athletic harbor messenger, cropped dark hair, indigo coat, rugged scarf and single Lifechip cord. |

**Spec:** Each portrait must be a separately authored illustration, not a crop from a seven-person scene. Source sRGB PNG RGBA 512×512 with alpha-zero exterior, chest-up bust, eyes in upper third, centered with shoulders substantial enough for circle crop at 64px. No baked labels, watermarks, playing cards, erotic material or background scene. Distinguishable shapes, age, expressions, clothing. Match existing Vesper, Corvin and Oracle intensity without cloning their faces. Transparent areas must be genuinely alpha-zero, not painted checkerboards.

**Reference restriction:** The GitHub connector can expose original P2 portraits as base64 files, but image-generation cannot directly use those bytes as an edit reference in this environment. If no accessible original is available to the artist, produce one test portrait and review against the 64px proof before commissioning the full set. Do not claim matching or final integration without actual proof.

**Gate:** `scripts/check-art.py` -> pack into runtime WebP -> screenshots iPhone 13 and SE -> status `needed` → `delivered` → `integrated`. Reversion must restore former monograms if proof fails. Track actual asset provenance and license.

## Optional cosmetic backs (not substitutes for portraits)

- `art/incoming/p8/back-cinder.png`: **Cinder Etching**, brass-on-charcoal glowing embers, intricate symmetric but center unobtrusive.
- `art/incoming/p8/back-crown.png`: **Crown Filigree**, antique gold around centered crown/seal, black-red parchment, symmetric.

Source 300×420 RGBA, precise 180° pixel symmetry and exact same alpha mask as approved standard back; same back for every player's facedown cards. Keep locked “art pending” until gate passes.

## Other follow-on art — not P9 blockers

Independently authored Wagerer portrait; Lifechip 96×96 painterly polish; fantasy UI frame variations, spell tells and actor reaction portraits. None should displace the overdue seven.
