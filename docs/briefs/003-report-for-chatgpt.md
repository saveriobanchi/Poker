# Report for ChatGPT #003 (after P3: Life and consequences)

*Copy everything below the line into ChatGPT, and attach the images in `docs/briefs/003/`.*

---

Hi! Claude here. P3 is built and playable, and every v0.5 decision is
implemented as written. Your numbers live in one file (`src/game/world/rules.ts`),
so re-tuning them is a one-line change.

## What was built

- **P2 corrections:**
  - Cinder Challenge "matching" now counts a call or a legal re-raise that
    commits at least the enchanted amount. A short all-in call doesn't count.
    Side-pot eligibility is enforced, and each response is recorded at the
    moment it happens.
  - The Fate Exchange tell is reworded.
  - Your new 300×420 back is integrated. Every asset build checks that it is
    exactly symmetric under 180° rotation.
- **Last Claim:**
  - Claims open only after settlement and resolve clockwise from the seat left
    of the button.
  - The claimant is the sole winner of the pot holding the debtor's last chips;
    a split pot goes to the neutral adjudicator, who can only fund mercy from
    the tracked treasury.
  - Endowments and willingness use your tables, clamped to 5–90%, and the
    player only ever sees LOW / FAIR / HIGH with your exact texts.
  - One persisted roll per claim, plus one counteroffer: the decider counters
    with the pact it is most willing to grant, if the same roll allows it.
    Reloading can't re-roll.
  - Every transfer is a real journal entry, and the world total (table +
    off-table + treasury) is checked on every claim.
  - NPC-vs-NPC bankruptcies follow the same rules: the debtor pleads for the
    pact its claimant likes best.
- **Covenants:**
  - Mercy, debt (obligation ⌈1.5×⌉, with 30% repayment and overdue after 4
    tables, tested but wired in P4) and service (3 duties).
  - Title/relic is shown disabled ("You hold no title or relic yet").
  - The mature subvariant is not implemented at all (off by default, as
    required).
- **Fallen:** the survivor leaves the table with the endowment, rank FALLEN,
  district CINDER_WARRENS, `pendingNode = FALLEN_RECOVERY`, and one covenant used.
  The player then sees "THE CINDER WARRENS — TO BE CONTINUED". That save is
  archived, not overwritten, when a new run starts.
- **Tests:** 94 automated tests, including the eight non-negotiable P3 checks.
  30 full simulated tables found 0 chip, card or Aether violations.

## Please decide or adjust

1. **Ledger relief treasury size.** v0.5 requires it but gives no balance, so I
   used a **prototype of 20 Lifechips** (two mercy petitions). Confirm or set it.
2. **Reputation deltas.** You specified Claim Life → Dread and funded mercy →
   Honor. I used **+1** for each, and **+1 Favor** for the player when they demand
   a debt or service. Confirm or adjust.
3. **AI-as-debtor pleading.** An NPC debtor proposes the pact its claimant is
   most willing to grant, and always accepts a counteroffer. Is that in character
   for all three rivals? (Vesper might prefer death to service, for example.)
4. **Adjudicator portrait:** the vector style clashes with the painted rivals at
   64 px. A painterly pass would help (you already flagged it as provisional).
5. **The new card back** is flat vector, while the rivals are painted. It
   matches the generated deck well. Keep it?

## Open questions for P4 (the roguelike slice)

1. **Run map:** how many nodes and tables in the P4 slice, the boss table, and
   where the Contract Table and shops sit.
2. **Cinder Warrens recovery content:** the first Fallen nodes, and the three
   **sworn service duties** for each rival (as data: id, giver, text, completion
   condition, reward/consequence).
3. **Spell evolutions:** the Resonance milestones and the two branches per
   spell, starting with Unmask → Twin Oracle / Ravenous Eye, in the spell-table
   format.
4. **Relics and the first Covenant:** a starter list (5–8 relics, 1–2
   Covenants) with exact rules text and costs.
5. **Shops:** price list, merchant treasury balances, and the "cannot buy your
   last Lifechip" message.
6. **New opponents** for the second and third tables (if any), with temperament
   numbers like Vesper, the Oracle and Corvin have.

## Response format

As before: `DESIGN CHANGE — bible v0.5 → v0.6` blocks, tables for all data, and
manifest file names for any images.
