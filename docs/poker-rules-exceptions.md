# Poker rules exceptions

Baseline: No-limit Texas Hold'em following Poker TDA conventions
(<https://www.pokertda.com/view-poker-tda-rules/>). Every departure, whether a
fantasy rule or a temporary engine simplification, is listed here. If it is not
listed, it is a bug.

## Rule interpretations the engine implements

These are standard (TDA-aligned) and listed so designers and testers know exactly
what the code does.

| Topic | Engine behavior | Test |
|---|---|---|
| Short all-in blind | A seat with fewer chips than a blind posts all it has and is all-in. The amount to call stays the full big blind. Any excess goes to a side pot or is returned as uncalled. | `engine.test.ts`: "short stack posts an all-in blind" |
| Minimum bet / raise | The minimum opening bet on any street is the big blind. The minimum raise increment is the size of the last *full* bet or raise on the street. | "enforces minimum bets and raises" |
| Short all-in raise | An all-in smaller than a full raise does not change the minimum raise increment. It does not reopen betting for a seat that already acted, unless the total increase since that seat's last action is at least one full raise (short all-ins add up). | "short all-in raise does not reopen betting", "cumulative short all-ins…" |
| Short all-in bet after a check | A seat that checked an unopened street may still raise when a short all-in bet comes back to it. | "a player who checked keeps the option…" |
| No pointless raise | A seat cannot raise when no other seat can still act, because everyone else is all-in or folded. It may only call or fold. | "offers no raise when nobody could respond" |
| Folding when checking is free | Allowed (legal, though unwise). | — |
| Uncalled bet | At settlement, any part of the largest contribution that no other seat matched is returned before pots are built. | "uncalled bet is returned" |
| Odd chips | Split pots are divided equally. Leftover chips go one at a time to the tied winners in clockwise order, starting from the first seat left of the button. | `pots.test.ts` |
| Showing hands | An uncontested winner never shows. At a contested showdown, every live hand is revealed (see the simplification below). | — |

## Temporary engine simplifications (P0)

To be revisited before P4. Each one changes table behavior only in rare cases.

1. **Moving button, not dead button.** When seats are eliminated, the button moves
   to the next seat that still has chips, and the blinds follow it. TDA's dead-button
   rule (making sure every player posts the big blind exactly once) is not implemented.
2. **Heads-up transition.** When a table drops to two players, the heads-up blind
   rule applies at once. TDA's special handling of the first heads-up hand is not
   implemented.
3. **Showdown order and mucking.** Every live hand is revealed at a contested
   showdown. Showing order and the option to muck a losing hand ("reveal only
   required hands") are deferred to the UI milestone (P1/P5). The poker result
   does not change.
4. **No antes.** Antes are not supported yet.

## Fantasy deviations (magic)

None are implemented yet (P2). The first one planned:

- **Briar Lock** (Thorn): sets the current street's betting ceiling to pot-limit
  for everyone. All-in raises stay legal only within that ceiling. Chips already
  committed are unaffected.
