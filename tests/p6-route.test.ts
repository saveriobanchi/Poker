import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_RIVALS,
  assertRunInvariants,
  canRecover,
  createRun,
  CROWN_INGRESS_KEY,
  CROWN_LEDGER,
  importFallenSession,
  judge,
  loadRun,
  ORAN_ID,
  playerChips,
  runCommand,
  type RunState,
  type Standing,
  UNDER_LEDGER,
  WISP_ID,
  WRIT_LOW_STACK,
} from '../src/game/run/run';
import { p3Fallen, until } from './runHelpers';

function reach(pred: (r: RunState) => boolean, policy: 'tight' | 'skilled' | 'maniac' | 'passive' = 'tight', from?: (seed: number) => RunState): RunState {
  for (let seed = 1; seed < 150; seed++) {
    const r = until(from ? from(seed) : createRun(seed), (x) => pred(x) || x.node === 'death', policy, seed);
    if (pred(r)) return r;
  }
  throw new Error('state not reached');
}

const asV2 = (run: RunState) => {
  const v2 = structuredClone(run) as unknown as Record<string, unknown>;
  v2.version = 2;
  v2.migrations = (v2.migrations as string[]).filter((m) => m !== 'save_v3');
  delete v2.dossier;
  return v2;
};

describe('Act III, the Crown Table (design v0.8 §08)', () => {
  it('a P5 save at A Crown of Brass migrates to v3 and reaches the Writ with one ingress and no chip change', () => {
    const v = reach((x) => x.node === 'act2_victory');
    const m = new Map([['lastWager.run.v1', JSON.stringify(asV2(v))]]);
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => void m.set(k, x), removeItem: (k: string) => void m.delete(k) };
    const run = loadRun(store)!;
    expect(run.version).toBe(3);
    expect(run.migrations.filter((k) => k === 'save_v3')).toHaveLength(1);
    expect(run.chapters).toContain('act2_victory');
    const before = run.totalLifechips;
    const writ = runCommand(run, { kind: 'advance' });
    expect(writ.node).toBe('crown_writ');
    expect(writ.accounts.you).toBe(run.accounts.you);
    expect(writ.characters.you.reputation.favor).toBe(run.characters.you.reputation.favor); // invitation: no fee
    expect(writ.totalLifechips).toBe(before + 1280);
    expect(writ.perimeter.expansions.filter((e) => e.key === CROWN_INGRESS_KEY)).toHaveLength(1);
    expect(writ.perimeter.base).toBe(1009);
    assertRunInvariants(writ);
    // Debts and duties carry over untouched.
    expect(writ.contracts.filter((k) => k.debtor === 'you')).toEqual(run.contracts.filter((k) => k.debtor === 'you'));
  }, 240_000);

  it('a living exile enters by petition (Favor −1, floored at −3)', () => {
    const e = reach((x) => x.node === 'act2_living_exile');
    const writ = runCommand(e, { kind: 'advance' });
    expect(writ.node).toBe('crown_writ');
    expect(writ.characters.you.reputation.favor).toBe(Math.max(-3, e.characters.you.reputation.favor - 1));
  }, 240_000);

  it('the Undercircuit recovery is offered only below 24 Lifechips, once', () => {
    const w = reach((x) => x.node === 'crown_writ');
    const poor = structuredClone(w);
    const give = poor.accounts.you - (WRIT_LOW_STACK - 1);
    if (give > 0) {
      poor.accounts.you -= give;
      poor.accounts[CROWN_LEDGER] += give;
    }
    expect(canRecover(poor)).toBe(playerChips(poor) < WRIT_LOW_STACK);
    const rich = structuredClone(w);
    rich.accounts.you += 30;
    rich.accounts[CROWN_LEDGER] -= 30;
    expect(canRecover(rich)).toBe(false);
    if (canRecover(poor)) {
      const under = runCommand(poor, { kind: 'recover' });
      expect(under.node).toBe('under_declaration');
      expect(under.flags).toContain('writ_granted');
    }
  }, 240_000);

  it('the Silver Archive gives one dossier or one attunement, then Oran trades from his own funded wallet', () => {
    const a = reach((x) => x.node === 'crown_archive');
    const studied = runCommand(a, { kind: 'archive', choice: 'study', rival: ARCHIVE_RIVALS[1] });
    expect(studied.dossier).toMatchObject({ rival: ARCHIVE_RIVALS[1], hands: 12 });
    expect(() => runCommand(studied, { kind: 'archive', choice: 'study', rival: ARCHIVE_RIVALS[0] })).toThrow();
    const shop = runCommand(studied, { kind: 'advance' });
    expect(shop.node).toBe('royal_exchange');
    expect(shop.accounts[ORAN_ID]).toBe(90);
    expect(new Set(shop.shop!.offers.map((o) => o.relic)).size).toBe(shop.shop!.offers.length);
    const seals = runCommand(shop, { kind: 'leaveShop', to: 'seals_table' });
    expect(seals.dossier!.rival).toBe(ARCHIVE_RIVALS[1]);
  }, 240_000);

  it('the Crown Table is won tied first, or second with profit >= max(20, 20% of entry)', () => {
    const row = (id: string, stack: number, rank: number): Standing => ({ id, name: id, stack, status: 'seated', rank });
    const second = [row('ledger_regent', 300, 1), row('you', 200, 2), row('the_uncrowned', 50, 3)];
    expect(judge('crown_table', second, 40, 200)).toBe('win');
    expect(judge('crown_table', second, 39, 200)).toBe('alive_failure');
    expect(judge('crown_table', second, 20, 60)).toBe('win');
    expect(judge('crown_table', second, 19, 60)).toBe('alive_failure');
  });
});

describe('the Undercircuit (design v0.8 §09)', () => {
  function atDeclaration(): RunState {
    const p3 = p3Fallen('debt') ?? p3Fallen('service')!;
    return reach((x) => x.node === 'under_declaration', 'tight', (seed) => importFallenSession(p3, seed));
  }

  it('opens one 102-chip ingress, funds Matron Wisp and the Underlamp regulars once, and forgives nothing', () => {
    const run = atDeclaration();
    expect(run.accounts[UNDER_LEDGER]).toBe(102);
    const owed = run.contracts.filter((k) => k.debtor === 'you');
    const broker = runCommand(run, { kind: 'advance' });
    expect(broker.node).toBe('under_broker');
    expect(broker.accounts[WISP_ID]).toBe(60);
    const lamp = runCommand(broker, { kind: 'advance' });
    expect(lamp.node).toBe('underlamp_table');
    expect(lamp.accounts[UNDER_LEDGER]).toBe(0);
    expect(lamp.contracts.filter((k) => k.debtor === 'you')).toEqual(owed);
    assertRunInvariants(lamp);
  }, 240_000);

  it('the Petition of Cinders: conditional writ only when top two and not overdue; otherwise the Low Lanterns', () => {
    const run = atDeclaration();
    const hearing = until(runCommand(runCommand(run, { kind: 'advance' }), { kind: 'advance' }), (x) => x.node === 'under_hearing' || x.node === 'death', 'tight', 4);
    if (hearing.node !== 'under_hearing') return;
    const bound = structuredClone(hearing);
    bound.contracts = bound.contracts.map((k) => (k.debtor === 'you' ? { ...k, pact: 'debt' as const, status: 'active' as const } : k));
    if (!bound.contracts.some((k) => k.debtor === 'you')) return;
    const eligible = structuredClone(bound);
    if (!eligible.flags.includes('under_writ_eligible')) eligible.flags.push('under_writ_eligible');
    const writ = runCommand(eligible, { kind: 'advance' });
    expect(writ.node).toBe('crown_writ');
    expect(writ.flags).toContain('bound_writ');
    expect(writ.contracts.filter((k) => k.debtor === 'you').every((k) => k.status !== 'cleared')).toBe(true);
    const overdue = structuredClone(eligible);
    overdue.contracts = overdue.contracts.map((k) => (k.debtor === 'you' ? { ...k, status: 'overdue' as const } : k));
    expect(runCommand(overdue, { kind: 'advance' }).node).toBe('under_living_end');
    const locked = structuredClone(bound);
    locked.flags = locked.flags.filter((f) => f !== 'under_writ_eligible');
    expect(runCommand(locked, { kind: 'advance' }).node).toBe('under_living_end');
  }, 240_000);
});
