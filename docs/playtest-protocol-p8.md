# Moderated playtest protocol (design v1.0 §11)

The protocol is for 5–8 testers who have never played the game. Each tester plays
on a real phone: an iPhone SE-sized screen (320×568) or an iPhone 13-sized screen
(390×844). The director watches and says as little as possible.

## Before the session

1. On the tester's phone, open the published game with **`?playtest=1`** added to
   the address, for example `https://<user>.github.io/<repo>/?playtest=1`.
   - A 📋 button appears in the top bar. That is the only visible change.
   - The setting is remembered on that phone until the game is opened with
     `?playtest=0`.
2. If the phone has been used for an earlier session, tap 📋 and choose
   **Clear log**.
3. Start a **New run**. Tell the tester only this: "This is a poker game. Think
   aloud."

## What the log records

The log stays on the phone. Nothing is sent anywhere. It records interface events
only — never a card, a spell, or any table state.

| Event | Why it matters |
|---|---|
| `session_start` (viewport, whether it was a reload) | Screen size, and interruptions caused by reloads |
| `first_legal_action` (ms) | Onboarding: how long before the first real poker action |
| `decision` (ms, action type) | Hesitation per decision |
| `allin_confirm_shown` / `allin_confirm_cancelled` | All-ins the tester started but did not confirm (accidental or reconsidered) |
| `disabled_tap` (control) | Taps on controls that cannot be used yet: "I expected that to work" |
| `spell_info_open` | How often the tester needs to look up what a spell does |
| `claim_review_back` | Backing out of a Last Claim review: hesitation before an irreversible choice |
| `cancel_choice` | Abandoned spell-target or card choices |
| `error` | Script errors (the message only) |
| `hidden` / `visible` | The tester left the app (an interruption) |
| `screen` (route node) | A timeline of where the tester was |
| `feedback` | Answers at the 15- and 45-minute check-ins |

**Check-ins:** at 15 and 45 minutes the game asks three things:
- enjoyment, on a scale of 1–5;
- "what are your Lifechips, and what happens if they run out?" (comprehension of
  chips as life);
- "what confused or annoyed you?"

The director can also open a check-in at any time from 📋 → **Feedback now**.

## Things the director observes (the log cannot see these)

- Does the tester understand real Hold'em (hand ranks, betting order)?
- Does the tester understand the difference between Lifechips and an ordinary
  stack?
- Does the tester notice spell opportunities (the windows and the Cinder raise)?
- How does the tester read and handle the irreversible Last Claim?
- Action mistakes the tester says out loud ("I didn't mean to fold").

## After the session

1. Tap 📋 → **Download JSON**. The file has a `summary` block on top: page loads,
   reloads, first-action time per load, median decision time, cancelled all-ins,
   disabled taps, spell-info opens, review backs, errors, interruptions and
   feedback.
2. Write your notes alongside the file, in plain words.
3. Collect the defects that can be reproduced and rank them. The top three severe
   blockers are fixed before P9 (§11). Do not rebalance because of a few
   subjective scores.
