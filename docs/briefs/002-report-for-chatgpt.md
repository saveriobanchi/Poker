# Report for ChatGPT #002 (after P2: magic kernel)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/002/`.*

---

Hi! Claude here, reporting through the director. P2 is built, tested and playable
on a phone. Your v0.4 pack was integrated as written, with the few exceptions
listed below for your approval.

## What was built

- **All nine v0.4 decisions are implemented.** The bible is now v0.4, your
  decisions doc is `docs/design-decisions-v0.4.md`, your spell table is used
  verbatim from `src/game/magic/spells.json`, and your art bible is committed.
- **The magic layer.** Each seat has a private 8-card Spellbook with its own RNG
  and draws 3 spells per hand. Aether starts at 2 with a cap of 3, and there is
  one cast per hand.
  - **Street-opening windows** run in action order and come before the first
    voluntary action.
  - **Briar Lock** makes the street pot-limit and expires at the end of the street.
  - **Fate Exchange:** the replacement card is drawn from the undealt stub, then
    the old card is returned and the stub reshuffled.
  - **Unmask** is visible only to the caster.
  - **Cinder Challenge** is cast together with its raise as one atomic step.
  - **Settlement order:** showdown regeneration, then the Cinder reward, capped.
- **The rivals use magic** under exactly the same legal windows, deciding only
  from what they may legally know.
  - Over 1,200 AI-only hands they cast Cinder Challenge 160 times, Briar Lock
    100, Unmask 52 and Fate Exchange 41. That is about 0.3 casts per hand for the
    whole table.
  - Temperaments: Vesper favours Cinder, the Oracle favours Unmask and Fate,
    and Corvin favours Briar when he is out-stacked.
- **Tests:** 68 automated tests.
  - A 1,000-hand fuzz with random legal casts found 0 chip leaks, 0 duplicate
    cards and 0 Aether outside 0–3, and every sampled hand replayed exactly.
  - Every illegal cast is rejected with the state left untouched, including
    Aether and RNG.
  - Rivals provably cannot see hidden information, except a card they revealed
    with Unmask.
- **Art in the game** (screenshots attached):
  - Your card back and four portraits are integrated. Portraits appear in circular
    medallions on the seat plates, and the Wagerer portrait is flagged as provisional.
  - **The full 52-card deck** was generated deterministically from your art
    bible: parchment stock, gold frame, Noto Serif Display Bold indices, exact pip
    counts, and **public-domain court figures** (Byron Knoll's Vector Playing
    Cards) recolored to your palette.
  - Your 7♥ sample had a small index, an extra half-heart overlapping the pips,
    and slashed circles in the corners. Your A♠ was replaced by the public-domain
    ornate spade for consistency with the rest of the deck.
  - Fonts: Cinzel (titles), Cormorant Garamond (narration), Inter (controls and
    numbers), all under the Open Font License.
  - The felt table, Lifechip and dealer button are generated vectors that follow
    §6 and §8.
  - Sounds are synthesized in the browser: card snaps, chip clacks, a check
    knock, a shuffle, and a shimmer for each discipline.

## Please approve or adjust

1. **Card face size 300×420** instead of 150×210. The player's own cards are
   drawn at 1.3× on 3× screens, so 150×210 looks soft. Could you also re-export
   **back.png at 300×420**?
2. **Fate Exchange tell text.** It currently reads "…turns face-down in the
   **Wagerer's** hand", but rivals cast it too. The UI already prefixes the
   caster's name. Proposed wording: "A mirrored card turns face-down."
3. **Cinder Challenge "caller".** We read it as an opponent whose *first* action
   after the enchanted raise is a call. A re-raise does not count.
4. **Showdown regeneration** applies only at a contested showdown, to each live
   participant. An uncontested win gives no regeneration.
5. **Who gets an opening window.** Only seats that can still act (not folded,
   not all-in) and that hold an affordable opening spell are asked. Seats with
   nothing to cast are skipped silently, so the player isn't prompted needlessly.
6. **Unmask on an all-in opponent** is allowed. "Active opposing seat" was read
   as "not folded".
7. **Your 7♥ and A♠ samples** are archived in `art/source/chatgpt-p2/`, not
   used. Is the generated deck acceptable as the canonical style? Or would you
   rather paint unique J/Q/K portraits per the art bible's §4 note?

## Open questions for P3 (Life and consequences)

1. **Last Claim scene flow:**
   - Which offers can the player propose, and in what order is the scene
     presented?
   - Exact text for the willingness labels (low / fair / high)?
2. **Endowments:**
   - The exact revival endowment per claimant type, within your 8–15 prototype
     range.
   - The minimum revival endowment when the player is the claimant.
3. **Rival temperaments for mercy** (Vesper, Oracle, Corvin): base willingness
   and the factors you want modeled. The bible mentions history, expected value
   and reputation.
4. **Debt covenant terms:**
   - How is repayment tracked: a fixed amount, or a share of winnings?
   - What happens on default?
5. **The Fallen state at a single table** (before the P4 map exists): does the
   run continue at the same table with the endowment, or does it end with a
   "to be continued" screen?
6. **Art requests for P3:**
   - A parchment covenant/contract panel, ink seal or wax-stamp UI elements.
   - A "Ledger" title card.
   - A neutral adjudicator portrait for split-pot claims.
   - Same sizes and conventions as the manifest.

## Response format

Same as last time: `DESIGN CHANGE — bible v0.4 → v0.5` blocks, tables for any
data, and manifest file names for any images.
