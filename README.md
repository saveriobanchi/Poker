# The Last Wager

A mobile-first, single-player, dark-fantasy poker roguelike built on real
three- or four-handed No-limit Texas Hold'em, where Lifechips are both wealth and life.

- Design baseline: [`docs/design-bible.md`](docs/design-bible.md) (v0.5), art: [`docs/art-bible.md`](docs/art-bible.md)
- Rule departures: [`docs/poker-rules-exceptions.md`](docs/poker-rules-exceptions.md)
- History: [`docs/change-log.md`](docs/change-log.md)

## Status

- **P0 — Poker kernel:** done. A pure TypeScript rules engine (`src/game/rules/`).
- **P1 — Playable 4-seat table:** done. You against three AI rivals in the phone
  browser (`src/game/ai/`, `src/game/table/`, `src/ui/`), with save/resume after
  every action.
- **P2 — Magic kernel:** done. Spellbooks, Aether, the four spells with legal
  windows and public tells, rivals that cast, real card art, portraits, sounds
  (`src/game/magic/`, `src/game/ai/magic.ts`).
- **P3 — Life and consequences:** done. Last Claim after every bankruptcy
  (yours or a rival's), funded covenants, negotiation with one counteroffer, the
  Fallen state and the Ledger's world accounting (`src/game/world/`).
- **P4 — The roguelike slice:** done. A route of three tables with a shop, an
  optional Covenant, rewards and a Keeper's Audit; spell Resonance and branch
  evolutions; relics; four new rivals; the Fallen route with sworn-service duties.
  Every character has a real wallet and the run checks that no Lifechip is ever
  created or lost (`src/game/run/`).
- **P5 — Act II and the Cinder road:** done. Rivals no longer fold to every shove;
  the Gilded Circuit (three tables, a merchant, two events) continues Act I; the
  Fallen continue through the Broker, the Ember Steps and the Oathbreaker Hearing.
  New actors are funded through audited external-ledger ingress; old saves migrate.

```sh
npm install
npm run dev        # play at http://localhost:5173 (also reachable from a phone on the same Wi-Fi)
npm test           # unit tests, AI tests, 10,000-hand simulation
npm run simulate   # 1,000 seeded whole runs → docs/reports/p4-simulation.json
npm run balance    # 10 seed batches × 100 runs per policy, with 95% intervals → docs/reports/balance-*.json
npm run build      # production build in dist/
npm run build:assets  # regenerate card faces/felt/chip (needs Python + Pillow and Playwright's Chromium)
```

Third-party art and fonts are listed in [`CREDITS.md`](CREDITS.md).

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

## Next: P6

To be decided with ChatGPT after `docs/briefs/005-report-for-chatgpt.md`: the
Undercircuit, what follows the Crown Inquest, and the painted portraits.
