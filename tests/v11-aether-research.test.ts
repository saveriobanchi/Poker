import { describe, expect, it } from 'vitest';
import { type AetherVariant } from '../src/game/magic/table';
import { SPELLS } from '../src/game/magic/spells';
import { humanDecision, playRun } from '../src/game/run/driver';
import { createRun } from '../src/game/run/run';
import { playTable, withVariant } from '../src/game/run/tableEv';
import { Rng } from '../src/game/rules/rng';
import { applyHumanCommand, createDefaultSession, humanSeat, sessionStatus, startNextHand, stepAi, type TableSession } from '../src/game/table/session';
import { until } from './runHelpers';

/** Plays default tables with every seat under `variant` (or none), returning each hand's final state. */
function hands(seed: number, variant: AetherVariant | undefined, max = 60): TableSession[] {
  let s = createDefaultSession(seed);
  if (variant) for (const x of s.table.seats) x.research = variant;
  const rng = new Rng(seed);
  const out: TableSession[] = [];
  for (let guard = 0; guard < 5000 && out.length < max; guard++) {
    const st = sessionStatus(s);
    if (st === 'aiToAct') s = stepAi(s);
    else if (['humanToAct', 'humanWindow', 'humanChoice', 'humanSigil'].includes(st)) s = applyHumanCommand(s, humanDecision(s, 'mixed_aggressive', rng));
    else if (st === 'handComplete') {
      out.push(s);
      s = startNextHand(s);
    } else {
      out.push(s);
      break;
    }
  }
  return out;
}

describe('research-only Aether variants (design v1.1 §04)', () => {
  it('are off in play: a new run and a played run never carry any research state', () => {
    const end = playRun(createRun(3), 'skilled', 3);
    const json = JSON.stringify([createRun(3), end]);
    expect(json).not.toMatch(/research|emberReserve|emberDiscount|capWaste/);
  });

  it("the 'baseline' arm is exact P8 rules: same table outcome as no flag", () => {
    const run = until(createRun(21), (r) => !!r.table && r.table.handNumber === 1, 'skilled', 21);
    for (const policy of ['skilled', 'tight', 'mixed_aggressive'] as const) {
      const plain = playTable(structuredClone(run), policy, new Rng(9), 1);
      const base = playTable(withVariant(run, 'baseline'), policy, new Rng(9), 1);
      expect({ ...base, capWaste: 0 }).toEqual({ ...plain, capWaste: 0 });
    }
  });

  it('flag off reproduces the P8 hand sequence exactly, flag on stays within 0–3 Aether, ≤1 reserve, ≤1 token, one cast per hand', () => {
    let reserves = 0;
    let transfers = 0;
    let spendReturns = 0;
    let tokens = 0;
    let discounted = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const plain = hands(seed, undefined);
      const base = hands(seed, 'baseline');
      expect(base.map((h) => h.table.hand.log)).toEqual(plain.map((h) => h.table.hand.log));
      for (const v of ['ember_overflow_reserve', 'ember_reserve_on_spend', 'ember_next_hand_discount'] as const) {
        const hs = hands(seed, v);
        hs.forEach((h, i) => {
          h.table.seats.forEach((s, seat) => {
            expect(s.aether).toBeGreaterThanOrEqual(0);
            expect(s.aether).toBeLessThanOrEqual(3);
            expect(s.emberReserve ?? 0).toBeLessThanOrEqual(1);
            expect(s.emberDiscount ?? 0).toBeLessThanOrEqual(1);
            expect(h.table.magic.events.filter((e) => e.seat === seat).length).toBeLessThanOrEqual(1);
            const called = h.table.magic.gains.find((g) => g.seat === seat && g.reason === 'cinder_called');
            const mark = h.table.magic.cinder.find((m) => m.seat === seat);
            if (v === 'ember_overflow_reserve') {
              if (s.emberReserve) {
                reserves++;
                expect(mark).toBeTruthy();
                // The next hand returns it only if below the cap, then it is gone.
                const next = hs[i + 1];
                if (next && next.table.hand.seats[seat].inHand) {
                  const got = next.table.magic.gains.some((g) => g.seat === seat && g.reason === 'ember_reserve');
                  expect(got).toBe(s.aether < 3);
                  if (got) transfers++;
                }
              }
              if (called && mark && mark.spell !== 'red_oath' && called.amount === 1) expect(s.emberReserve).toBe(1);
              expect(s.emberDiscount ?? 0).toBe(0);
            } else if (v === 'ember_reserve_on_spend') {
              const prev = i > 0 ? hs[i - 1].table.seats[seat].emberReserve ?? 0 : 0;
              const back = h.table.magic.gains.filter((g) => g.seat === seat && g.reason === 'ember_reserve');
              // Only a carried reserve can come back, at most once, and only after the holder cast this hand.
              expect(back.length).toBeLessThanOrEqual(prev);
              if (back.length) {
                spendReturns++;
                expect(h.table.magic.events.some((e) => e.seat === seat)).toBe(true);
              }
              if (s.emberReserve) expect(mark).toBeTruthy();
              expect(s.emberDiscount ?? 0).toBe(0);
            } else {
              if (called && mark && mark.spell !== 'red_oath') {
                expect(s.emberDiscount).toBe(1);
                tokens++;
              }
              if (!called && !h.table.magic.events.some((e) => e.seat === seat)) expect(s.emberDiscount ?? 0).toBe(i === 0 ? 0 : hs[i - 1].table.seats[seat].emberDiscount ?? 0);
              const cast = h.table.magic.events.find((e) => e.seat === seat && SPELLS[e.spell].family === 'cinder_challenge');
              if (cast && i > 0 && hs[i - 1].table.seats[seat].emberDiscount) {
                discounted++;
                if (!called) expect(s.emberDiscount ?? 0).toBe(0);
              }
              expect(s.emberReserve ?? 0).toBe(0);
            }
          });
        });
      }
    }
    // Every mechanic was actually exercised by these tables.
    expect(reserves).toBeGreaterThan(0);
    // The literal rule is inert: an overflow leaves Aether at the cap, and nothing lowers it before the next hand opens.
    expect(transfers).toBe(0);
    expect(spendReturns).toBeGreaterThan(0);
    expect(tokens).toBeGreaterThan(0);
    expect(discounted).toBeGreaterThan(0);
  }, 120_000);

  it('a pending reserve or token survives a save/reload unchanged (negative control: reload during pending reward)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      for (const v of ['ember_reserve_on_spend', 'ember_next_hand_discount'] as const) {
        const hs = hands(seed, v);
        for (const h of hs) {
          if (sessionStatus(h) !== 'handComplete' || !h.table.seats.some((x) => x.emberReserve || x.emberDiscount)) continue;
          const reloaded = JSON.parse(JSON.stringify(h)) as TableSession;
          expect(startNextHand(reloaded)).toEqual(startNextHand(h));
          checked++;
          break;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 120_000);
});

