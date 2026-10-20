# THE LAST WAGER — P7 original art production brief

**Not delivered**: portraits remain `needed`, because the existing painted Vesper/Oracle/Corvin reference files were not supplied as usable image inputs to this art pass. Do not replace them with AI monograms and call that completed artwork. The image-generator could not perform the reference-based pass without an identified accessible source image; this document is production-ready direction only.

## Requirements (all seven)
- 512×512 PNG, sRGB RGBA with alpha=0 outside isolated bust silhouette; separate independent artwork for each character (no crop from a shared multi-person sheet).
- Consistent Gilded Eclipse gouache/engraved dark-fantasy realism with matte materials, gold/burgundy/charcoal/verdigris palette; warm key camera-left, cool rim camera-right. Eyes in upper third, head and shoulders centered.
- Silhouette and face readable in a 64px circular frame on the iPhone 13 target; keep significant shape diversity; no baked labels, frames, poker cards, watermarks or UI text.

| Exact manifest source | Character identity / silhouette |
|---|---|
| `art/incoming/p4/adjudicator.png` | Severe ancient adult Ledger mediator, dull obsidian half-mask, parchment mantle, hanging weights and seal chains; noncombat silhouette |
| `art/incoming/p4/mara-quill.png` | Alert adult bookmaker, short russet hair, burgundy trader vest, brass ledger clasp, uneven shoulder line |
| `art/incoming/p4/eldric-vale.png` | Mischievous adult gambler, unruly dark hair, oxblood cloak, narrow golden epaulet, high contrast animated eyes |
| `art/incoming/p4/bailiff-sable.png` | Implacable mature scarred adult, charcoal court uniform, thorn-engraved insignia, angular high collar and broad shoulders |
| `art/incoming/p4/sister-rill.png` | Adult silver-haired ascetic, moss-green and pale linen wraps, understated calming gaze, slender shape |
| `art/incoming/p5/night-clerk.png` | Exhausted adult municipal keeper, narrow silhouette, soot-ringed eyes, faded teal scarf and copper abacus pendant |
| `art/incoming/p5/dock-runner.png` | Adult athletic harbor courier, cropped hair, indigo work coat, battered scarf, one lifechip on cord, rough outdoors silhouette |

Additional characters: merchants, Act II and Act III rival portraits remain monograms until budget/time permits an independent illustration batch. Don't substitute the unverified reference visuals. The player Wagerer portrait also remains provisional and requires an independent art pass.

## QA gate
1. Exact RGBA pixel size, alpha and 512×512 card-free silhouettes.
2. Each distinct at 64×64 circular crop; avoid close facial or garment redundancy.
3. Match established portrait reference lighting and brushwork.
4. Integrate through `scripts/pack-assets.py`, pack as 256×256 runtime portrait, verify iPhone 390×844 screenshots with all UI content legible.
5. Move each manifest status `needed` → `delivered` only after PNG bytes exist, then `integrated` only after in-game verification.
