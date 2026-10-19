/**
 * Usage: npm run simulate [-- runs seed]
 * Plays seeded P4 runs headlessly and writes docs/reports/p4-simulation.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { simulateRuns } from '../src/game/run/simulate';

const runs = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 1);
const t0 = performance.now();
const report = simulateRuns(runs, seed);
mkdirSync('docs/reports', { recursive: true });
writeFileSync('docs/reports/p4-simulation.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
console.log(`${runs} runs in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
