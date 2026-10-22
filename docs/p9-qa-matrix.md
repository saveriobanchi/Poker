# P9 QA and Evidence Matrix

| System | Evidence required | Pass condition |
|---|---|---|
| Poker kernel | `npm test`; seed replay; all-in & side pot regression | All existing and P9 tests pass, zero chip violations |
| World accounting | P8 matched seeds and ingress accounting | No new money; no repeated ingress and no replayed table |
| Legacy | Backgrounds, backs, protagonist identity | Same seed/game state regardless of narrative cosmetics |
| Magic | Offline A/B arms only + rare branch harness | No illegal casts; variance, bias and CI reported without unjustified nerfs |
| Art | Seven separate PNGs, check-art output, 64px circle proof | Source and runtime image exist and visually read at tiny crop |
| iPhone | 390×844 / 320×568 screenshots and actual phone input | Buttons available, no overflow, spell timers and final-chip risk readable |
| Human sessions | 5–8 consented real-phone logs + anonymized notes | Actual participants, not simulations, clearly distinguish issues and sentiment |
| Prioritized fixes | Up to three blockers, before/after reproduction | No regression in game state and no action confusion |
| P9 report | `docs/briefs/009-report-for-chatgpt.md` and `docs/briefs/009/` | Correctly labels integrated vs pending; no unverified marketing claims |

**Release label:** P9 can be 'engineering milestone done' without portraits/humans, but cannot be 'quality approved' or 'release candidate' until image and human gates pass. Don't artificially require real-device sessions to block source code fixes and art integration that can be done now.
