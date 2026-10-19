import { describe, expect, it } from 'vitest';
import { playRun, POLICIES } from '../src/game/run/driver';
import {
  ACT2_INGRESS_KEY,
  ACT2_LEDGER,
  assertRunInvariants,
  BROKER_ID,
  brokerPrice,
  CINDER_LEDGER,
  createRun,
  ENDINGS,
  importFallenSession,
  loadRun,
  mirrorCandidates,
  playerChips,
  playerIsFree,
  runCommand,
  type RunState,
  saveRun,
} from '../src/game/run/run';
import { p3Fallen, until } from './runHelpers';

const memStore = () => {
  const m = new Map<string, string>();
  return { m, store: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
};

/** Turns a v2 run back into the shape a P4 build saved. */
function asV1(run: RunState): unknown {
  const v1 = structuredClone(run) as unknown as Record<string, unknown>;
  for (const k of ['migrations', 'perimeter', 'chapters', 'flags', 'observed']) delete v1[k];
  v1.version = 1;
  if (v1.shop) {
    delete (v1.shop as Record<string, unknown>).id;
    delete (v1.shop as Record<string, unknown>).merchant;
  }
  return v1;
}

function atAct1End(kind: 'slice_exile' | 'slice_victory'): RunState {
  for (let seed = 1; seed < 120; seed++) {
    const r = until(createRun(seed), (x) => x.node === kind || x.node === 'death' || x.chapters.length > 0, kind === 'slice_victory' ? 'maniac' : 'tight', seed);
    if (r.node === kind) return r;
  }
  throw new Error(`no ${kind}`);
}

describe('save migration and audited ingress (design v0.7 §09, §11)', () => {
  it('a P4 exile save migrates once with no transfer, then enters Act II through one audited ingress', () => {
    const p4 = atAct1End('slice_exile');
    const { m, store } = memStore();
    m.set('lastWager.run.v1', JSON.stringify(asV1(p4)));
    const run = loadRun(store)!;
    expect(run.version).toBe(2);
    expect(run.migrations).toEqual(['save_v2']);
    expect(run.totalLifechips).toBe(1009);
    expect(run.perimeter).toEqual({ base: 1009, expansions: [] });
    expect(run.journal).toEqual(p4.journal);
    expect(run.chapters).toEqual(['slice_exile']);

    const chips = run.accounts.you;
    const petition = runCommand(run, { kind: 'advance' });
    expect(petition.node).toBe('act2_petition');
    const gate = runCommand(petition, { kind: 'petition', choice: 'favor' });
    expect(gate.node).toBe('gilded_gate');
    expect(gate.accounts.you).toBe(chips); // no chips at the transition
    expect(gate.characters.you.reputation.favor).toBe(Math.max(-3, run.characters.you.reputation.favor - 1));
    expect(gate.totalLifechips).toBe(1009 + 1150);
    expect(gate.perimeter.expansions).toEqual([{ key: ACT2_INGRESS_KEY, account: ACT2_LEDGER, amount: 1150 }]);
    expect(gate.journal.filter((j) => j.reason.startsWith('perimeter expansion'))).toHaveLength(1);
    assertRunInvariants(gate);

    // Reloading at the gate and entering the Salon funds each newcomer exactly once.
    saveRun(store, gate);
    const salon = runCommand(loadRun(store)!, { kind: 'advance' });
    expect(salon.node).toBe('masked_salon');
    expect(salon.accounts[ACT2_LEDGER]).toBe(1150 - 140 - 125 - 135);
    const funded = salon.journal.filter((j) => j.from === ACT2_LEDGER);
    expect(funded.map((j) => [j.to, j.amount])).toEqual([
      ['isolde_morn', 140],
      ['ravel_croft', 125],
      ['vesa_kael', 135],
    ]);
    expect(salon.migrations.filter((k) => k === ACT2_INGRESS_KEY)).toHaveLength(1);
  }, 120_000);

  it('a victory enters Act II by invitation: Favor +1 and no chips', () => {
    const v = atAct1End('slice_victory');
    const gate = runCommand(v, { kind: 'advance' });
    expect(gate.node).toBe('gilded_gate');
    expect(gate.characters.you.reputation.favor).toBe(v.characters.you.reputation.favor + 1);
    expect(gate.accounts.you).toBe(v.accounts.you);
  }, 120_000);

  it('the exile petition can surrender a relic instead of Favor', () => {
    const run = atAct1End('slice_exile');
    run.player.magic.relics = ['thorn_anchor'];
    const petition = runCommand(run, { kind: 'advance' });
    const gate = runCommand(petition, { kind: 'petition', choice: 'relic', relic: 'thorn_anchor' });
    expect(gate.player.magic.relics).toEqual([]);
    expect(gate.characters.you.reputation.favor).toBe(run.characters.you.reputation.favor);
    expect(() => runCommand(petition, { kind: 'petition', choice: 'relic', relic: 'mirror_prism' })).toThrow();
  }, 120_000);
});

describe('Act II, the Gilded Circuit', () => {
  it('every policy reaches a final ending with the invariant intact and no table replayed', () => {
    const finals = new Set<string>();
    for (const policy of POLICIES) {
      for (let seed = 1; seed <= 8; seed++) {
        const end = playRun(createRun(seed * 17), policy, seed);
        expect(ENDINGS).toContain(end.node);
        const tables = end.results.map((r) => r.node);
        expect(new Set(tables).size).toBe(tables.length);
        assertRunInvariants(end);
        finals.add(end.node);
      }
    }
    expect(finals.has('act2_victory') || finals.has('act2_living_exile')).toBe(true);
  }, 240_000);

  it('the Court of Mirrors shows only rivals watched at a table; the Whispered Contract marks the next table', () => {
    let run: RunState | null = null;
    for (let seed = 1; seed < 80 && !run; seed++) {
      const r = until(createRun(seed), (x) => x.node === 'velvet_exchange' || x.node === 'death', 'tight', seed);
      if (r.node === 'velvet_exchange') run = r;
    }
    expect(run).not.toBeNull();
    const watched = mirrorCandidates(run!);
    expect(watched).toEqual(expect.arrayContaining(['isolde_morn', 'ravel_croft', 'vesa_kael']));
    expect(watched).not.toContain('margrave_noct'); // not yet seen at any table
    const court = runCommand(run!, { kind: 'leaveShop', to: 'mirror_audience' });
    expect(() => runCommand(court, { kind: 'event', take: true, rival: 'margrave_noct' })).toThrow();
    const seen = runCommand(court, { kind: 'event', take: true, rival: 'vesa_kael' });
    expect(seen.flags).toContain('mirror:vesa_kael');
    expect(seen.node).toBe('velvet_arena');
    expect(playerChips(seen)).toBe(run!.accounts.you); // now seated at the Arena with the same chips

    const bargain = runCommand(run!, { kind: 'leaveShop', to: 'secret_bargain' });
    const marked = runCommand(bargain, { kind: 'event', take: true });
    expect(marked.characters.you.reputation.notoriety).toBe(run!.characters.you.reputation.notoriety + 1);
    expect(marked.table!.table.magic.notices.some((n) => n.text.includes('whispered contract'))).toBe(true);
  }, 120_000);
});

describe('the Cinder continuation (design v0.7 §10)', () => {
  function atBroker(): RunState {
    const p3 = p3Fallen('debt') ?? p3Fallen('service')!;
    for (let seed = 1; seed < 60; seed++) {
      const r = until(importFallenSession(p3, seed), (x) => x.node === 'cinder_broker' || x.node === 'death', 'tight', seed);
      if (r.node === 'cinder_broker') return r;
    }
    throw new Error('never reached the Broker');
  }

  it('the Broker is funded once from the Cinder ledger and buys one relic at half price from his own wallet', () => {
    const run = atBroker();
    expect(run.accounts[BROKER_ID]).toBe(60);
    expect(run.accounts[CINDER_LEDGER]).toBe(36);
    run.player.magic.relics = ['mirror_prism'];
    const chips = run.accounts.you;
    const sold = runCommand(run, { kind: 'sell', relic: 'mirror_prism' });
    expect(sold.accounts.you).toBe(chips + brokerPrice('mirror_prism'));
    expect(sold.accounts[BROKER_ID]).toBe(60 - brokerPrice('mirror_prism'));
    expect(sold.player.magic.relics).toEqual([]);
    sold.player.magic.relics = ['thorn_anchor'];
    expect(() => runCommand(sold, { kind: 'sell', relic: 'thorn_anchor' })).toThrow(/once/);
  }, 120_000);

  it('dead regulars are replaced at the Ember Steps by substitutes funded from the Cinder ledger', () => {
    const run = atBroker();
    run.characters.night_clerk.alive = false;
    run.characters.night_clerk.status = 'dead';
    run.accounts.dock_runner += run.accounts.night_clerk;
    run.accounts.night_clerk = 0;
    const table = runCommand(run, { kind: 'advance' });
    expect(table.node).toBe('cinder_low_table');
    expect(table.table!.seats.map((s) => s.id)).toEqual(['you', 'ash_porter', 'dock_runner']);
    expect(table.accounts[CINDER_LEDGER]).toBe(36 - 18);
    expect(table.characters.night_clerk.alive).toBe(false);
  }, 120_000);

  it('the Hearing sends the bound below and the free up to the Gate; no rescue is ever funded twice', () => {
    const run = atBroker();
    let r = runCommand(run, { kind: 'advance' });
    r = until(r, (x) => x.node === 'oath_hearing' || x.node === 'death', 'tight', 3);
    if (r.node !== 'oath_hearing') return;
    const bound = runCommand(r, { kind: 'advance' });
    if (playerIsFree(r)) {
      expect(bound.node).toBe('gilded_gate');
      expect(bound.characters.you.socialRank).toBe('UNBOUND_FALLEN');
    } else expect(bound.node).toBe('undercircuit_entry');
    const freed = structuredClone(r);
    freed.contracts = freed.contracts.map((k) => (k.debtor === 'you' ? { ...k, status: 'cleared' as const } : k));
    expect(runCommand(freed, { kind: 'advance' }).node).toBe('gilded_gate');
    expect(bound.journal.filter((j) => j.reason.includes('endowment'))).toHaveLength(1);
  }, 120_000);
});
