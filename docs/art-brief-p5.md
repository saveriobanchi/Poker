# THE LAST WAGER — P5 Art Direction Brief

**Status:** Art specification only; painted PNGs not included. Preserve `docs/art-bible.md` (Gilded Eclipse), existing symmetric vector 300×420 playing-card back, and 52 consistent source faces.

**Composition:** Every new character is an independent, recognizable bust, not a crop of a multi-person illustration. PNG 512×512, sRGB RGBA, background alpha=0, chest-up centered, eyes upper third, enough shoulder mass that circular crops at 64px distinguish silhouettes. Soft warm key from camera-left, cool rim from camera-right, gouache/engraved fantasy oil finish, matte material rather than photorealism; burgundy, charcoal, verdigris, antique brass. No fonts, captions, poker cards, watermarks, or baked game UI.

## Character portraits
| Exact source file | Silhouette / character art direction |
|---|---|
| `art/incoming/p4/adjudicator.png` | An ageless adult Ledger adjudicator; carved half-mask of dull obsidian, parchment mantle, severe straight posture, antique chains, emotionally unreadable; not an armored warrior. |
| `art/incoming/p4/mara-quill.png` | Alert adult bookmaker; short russet hair, worn burgundy trader vest, ink stains and brass ledger clasp; nimble sharp expression, asymmetric shoulders. |
| `art/incoming/p4/eldric-vale.png` | Adult aggressive gambler; dark unruly hair, oxblood cloak, narrow gold epaulet, mischievous yet calculating eyes and ember-trimmed cuffs. |
| `art/incoming/p4/bailiff-sable.png` | Implacable adult court bailiff, scarred mature face, bone-stiff collar, charcoal uniform with thorn-engraved brass insignia; bold heavy silhouette readable at tiny scale. |
| `art/incoming/p4/sister-rill.png` | Adult silver-haired ascetic in moss green and pale linen, calm gaze, slender profile, subtle no-nonsense sanctity; no halo or glowing particle clutter. |
| `art/incoming/p5/night-clerk.png` | Thin exhausted adult municipal records keeper with soot-shadowed eyes, faded teal scarf, charcoal uniform and little copper abacus pendant; observant, not villainous. |
| `art/incoming/p5/dock-runner.png` | Athletic adult harbor courier with cropped dark hair, rough indigo-canvas coat, worn scarf and a single Lifechip on cord; weathered skin and wary watchfulness. |

**Production requirement:** Do not use one shared template that produces seven near-identical faces. Review full 512px and 64px preview, revise anything ambiguous, then update `docs/asset-manifest.json` status `needed` → `delivered` → `integrated` only after actual source asset exists and mobile verification succeeds.

**Additional Act II portraits:** Defer until P5 runtime is balanced and characters confirmed. Use named monogram placeholders transparently in P5 if necessary; do not claim generated art exists.
