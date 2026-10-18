# The Last Wager

A mobile-first, single-player, dark-fantasy poker roguelike built on real
three- or four-handed No-limit Texas Hold'em, where Lifechips are both wealth and life.

- Design baseline: [`docs/design-bible.md`](docs/design-bible.md) (v0.3)
- Rule departures: [`docs/poker-rules-exceptions.md`](docs/poker-rules-exceptions.md)
- History: [`docs/change-log.md`](docs/change-log.md)

## Status

**P0 — Poker kernel** is done: a pure TypeScript rules engine (`src/game/rules/`)
with tests. It has no UI and no graphics dependency yet.

```sh
npm install
npm test           # unit tests + 10,000-hand randomized simulation
npm run typecheck
```

## Using the engine

```ts
import { startHand, getLegalActions, applyAction, getPublicView, nextHandSetup } from './src/game/rules';

let hand = startHand({
  seed: 1234,
  players: [{ id: 'you', stack: 100 }, { id: 'vesper', stack: 100 }, { id: 'oracle', stack: 100 }, { id: 'corvin', stack: 100 }],
  button: 0,
  smallBlind: 1,
  bigBlind: 2,
});

while (hand.phase === 'betting') {
  const legal = getLegalActions(hand)!;          // whose turn, call amount, min/max raise
  const view = getPublicView(hand, hand.toAct!);  // the only data an AI may decide from
  hand = applyAction(hand, hand.toAct!, legal.canCheck ? { type: 'check' } : { type: 'call' });
}

hand.result; // pots, winners, showdown, net change, zero-chip seats (Last Claim triggers)
const next = nextHandSetup(hand, 1235);
```

Every state is plain JSON (`serializeHand` / `deserializeHand`) and fully
reproducible from `setup` plus `log` (`replayHand`).

## Next: P1

One playable 4-seat table: the player plus three distinct local AI agents, on
Phaser + Vite, playable in a phone browser with immediate save/resume.
