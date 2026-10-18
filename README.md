# The Last Wager

A mobile-first, single-player, dark-fantasy poker roguelike built on real
three- or four-handed No-limit Texas Hold'em, where Lifechips are both wealth and life.

- Design baseline: [`docs/design-bible.md`](docs/design-bible.md) (v0.3)
- Rule departures: [`docs/poker-rules-exceptions.md`](docs/poker-rules-exceptions.md)
- History: [`docs/change-log.md`](docs/change-log.md)

## Status

- **P0 — Poker kernel:** done. A pure TypeScript rules engine (`src/game/rules/`).
- **P1 — Playable 4-seat table:** done. You against three AI rivals in the phone
  browser (`src/game/ai/`, `src/game/table/`, `src/ui/`), with save/resume after
  every action.

```sh
npm install
npm run dev        # play at http://localhost:5173 (also reachable from a phone on the same Wi-Fi)
npm test           # unit tests, AI tests, 10,000-hand simulation
npm run build      # production build in dist/
```

### Playing on an iPhone

Every push to the default branch is published to GitHub Pages by
`.github/workflows/deploy-pages.yml`. One-time setup: on GitHub, open
**Settings → Pages → Source** and choose **GitHub Actions**. Then open
`https://<user>.github.io/<repo>/` in Safari and use **Share → Add to Home Screen**.
The game works offline after the first visit.

## Working with ChatGPT

See [`docs/collaboration.md`](docs/collaboration.md). The latest report to paste into
ChatGPT is in [`docs/briefs/`](docs/briefs/).

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

## Next: P2

The magic kernel: separate Spellbooks, Aether, legal casting windows, the first four
spells, visible magic tells. It waits on ChatGPT's answers in `docs/briefs/001`.
