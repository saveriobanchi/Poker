# P9 playtest kit (design v1.1 §02, §03; `docs/research/p9-player-test-gates.json`)

This is for the director's 5–8 moderated sessions on real phones. It adds to the
protocol in [`playtest-protocol-p8.md`](playtest-protocol-p8.md). It contains no
findings. Human testing is **not performed** until real sessions are run and their
exports are supplied.

## 1. Recruiting

- **Participants:** 5–8 adult volunteers.
  - At least **two** play on a narrow phone (320 px wide, iPhone SE class).
  - Include poker novices and experienced players where practical.
- **No personal data:** no names in any file. Each person gets a participant code:
  P1, P2 and so on.

## 2. Consent (read aloud, then ask "Is that OK?")

> This is a test of a poker game, not a test of you. It uses fictional chips only,
> with no real money. I'll watch and take notes on what is confusing. The game
> keeps a log of taps and timings on this phone. The log never records your cards
> or any personal details. You can stop at any moment, for any reason. At the end,
> I'll ask whether I may keep the log, and you can say no.

Record the following in the notes:
- the consent given (yes/no);
- whether the log export was allowed (yes/no);
- any early exit, with the minute it happened.

## 3. Setup per session

1. Open the game with `?playtest=1`. Tap 📋 → **Clear log**.
2. Start a **New run**. Say only: "This is a poker game. Please think aloud."
3. Do not explain the rules unless the participant is stuck for more than 2
   minutes. If you do, note the minute and what you said.
4. The game asks the 15- and 45-minute check-in questions by itself. Ask them
   aloud too if they are skipped.

## 4. What to watch for (severity scale from the gates file)

| Severity | Examples to record |
|---|---|
| **P0** irreversible harm | an unintended fold or all-in; a legal action the player could not take; a wrong amount, or lost chips or save; an all-in or final-chip risk the player did not see; a Last Claim the player misread |
| **P1** comprehension / access | Lifechips read as "HP"; a spell window not noticed; pot or call odds unclear; missed 40/44 px taps; a sheet or panel that cannot be reached |
| **P2** presentation / pacing | repetitive sound or effects; art that feels generic; too many taps; unclear story pacing |

For every issue, note:
- what happened;
- the screen and the minute;
- whether you could make it happen again on the same build (reproducible yes/no);
- the participant's exact words, if any.

## 5. Notes file (one per session, `notes-P1.json` and so on)

```json
{
  "participant": "P1",
  "device": "iPhone SE (320x568)",
  "pokerExperience": "novice | some | experienced",
  "consent": true,
  "exportAllowed": true,
  "stoppedAtMinute": null,
  "explanationsGiven": [{ "minute": 4, "what": "where the raise slider is" }],
  "issues": [
    { "severity": "P0", "minute": 12, "screen": "table", "what": "folded when meaning to check", "reproducible": true, "quote": "I didn't mean that" }
  ],
  "lifechipComprehension": "their own words",
  "lastClaimComprehension": "their own words",
  "funQuote": "their own words"
}
```

## 6. After all sessions

```sh
npm run playtest-summary -- path/to/exports path/to/all-notes.json   # all-notes.json: a JSON array of the notes files
```

- **What it does:** it validates each export and refuses any file with a card or
  personal-identifier field. It then pools the sessions and writes
  `docs/reports/playtest-summary.json`.
- **Denominators:** every figure states how many sessions it rests on: sessions,
  narrow-screen sessions, sessions that reached 15 and 45 minutes, early exits.
- **What happens next:** the three highest-severity *reproducible* issues (by
  severity, then frequency) become the P9 fix list. Each fix gets a before/after
  reproduction and screenshots at 390×844 and 320×568.
