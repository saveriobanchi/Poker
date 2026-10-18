# How the team works: you × ChatGPT × Claude

ChatGPT and Claude cannot talk to each other. **You are the bridge**: you carry
decisions and files between them, and you are the final judge of every design
call. The repository is the single source of truth. If it isn't in the repo, it
hasn't happened yet.

## Who owns what (design bible §10)

| | ChatGPT — *the designer* | Claude — *the engineer* | You — *the director* |
|---|---|---|---|
| Owns | Design decisions, balance math, lore, characters, dialogue, art bible, image assets | Code, rules engine, AI players, save/resume, UI, tests, builds, deployment | Final approval, playtesting, carrying files between the two |
| Writes | `docs/design-bible.md`, `docs/art-bible.md`, lore, PNG assets | `src/`, `tests/`, `docs/poker-rules-exceptions.md`, `docs/change-log.md` | Approvals, playtest notes |
| Never does | Writes production code | Silently changes a design rule | Merges anything untested |

Shared: `docs/asset-manifest.json` (Claude lists what is needed; ChatGPT fills
it), `docs/economy-balance.csv` (ChatGPT sets the targets; Claude's simulations
measure them).

## The loop, one milestone at a time

```
 ┌──────────────┐   design brief / change     ┌──────────────┐
 │   ChatGPT    │ ──────────────────────────▶ │     You      │
 │  (designer)  │ ◀────────────────────────── │  (director)  │
 └──────────────┘   questions, sim results,   └──────┬───────┘
                    asset requests                   │ paste or upload
                                                     ▼
                                              ┌──────────────┐
                                              │    Claude    │──▶ code + tests + playable build
                                              │  (engineer)  │──▶ "Report for ChatGPT"
                                              └──────────────┘
```

1. **Claude delivers** a milestone and ends with a short *Report for ChatGPT*
   covering what changed, what was measured, and which design questions are now open.
2. **You paste that report into ChatGPT** and ask it to answer the open questions
   and to produce any assets that were requested.
3. **ChatGPT answers** using the formats below. Bring its answers back here.
4. **Claude implements**, tests, pushes, and starts the next report.

Each milestone gives you a playable build on your phone, so you can playtest
and feed your own impressions into step 2.

## Getting things from ChatGPT into the repo

- **Text** (design decisions, lore, spell lists, balance numbers): paste it
  straight into the Claude chat. Claude commits it to the right file.
- **Images:** on github.com, open the repo, then *Add file → Upload files*, and
  drop them into `art/incoming/`. Then tell Claude: "integrate the new assets". Claude
  checks sizes and transparency against the manifest, wires them in, and marks
  them `integrated`.
- **Updated design bible:** ask ChatGPT for the **complete** file with the version
  bumped (v0.3 → v0.4) and a change-log entry. Paste it to Claude, who commits it
  and flags anything that conflicts with code already built.

## Formats to ask ChatGPT for

**Design change**, so Claude can build it without guessing:

```
DESIGN CHANGE — bible v0.3 → v0.4
What: <one sentence>
Rule text: <the exact rule as it should read in the bible>
Numbers: <every value, with "prototype" where untested>
Invariants touched: <none | which one, and why it is safe>
Acceptance test: <how we can tell it works>
```

**Content data** (spells, relics, rivals): a table with one row per item and
every field filled in, never prose alone. Example for spells: `id, name,
discipline, cost, timing, target, public tell, effect, conflict priority`.

**Image assets:** exact pixel size, PNG with transparency where the manifest
says `alpha: true`, and the file name from the manifest.

## Ground rules that keep this working

- **The invariants come first.** If ChatGPT proposes something that breaks a
  rule in the design bible (conservation of chips, no rigged cards, AI fairness),
  Claude pushes back instead of building it. Per the bible, either the idea
  changes, or the rule is explicitly re-versioned with a justification.
- **One source of truth.** If a ChatGPT chat and the repo disagree, the repo wins
  until you approve the change.
- **Numbers are guesses until simulated.** ChatGPT sets targets; Claude's
  simulations report the real values; ChatGPT re-tunes.
- **Nothing ships as a fake.** Mockups never stand in for working controls.
  Until real art lands, the build uses clearly placeholder vector art.
