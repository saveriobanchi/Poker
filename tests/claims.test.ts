import { describe, expect, it } from 'vitest';
import { act as actHand } from './helpers';
import { riggedHand, setup } from './helpers';
import type { HandState, PlayerAction } from '../src/game/rules';
import {
  applyClaimCommand,
  assertWorldInvariants,
  autoAdvance,
  batchDone,
  type ClaimBatch,
  claimantWillingness,
  createCharacter,
  createWorld,
  currentClaim,
  debtorAcceptance,
  ENDOWMENT,
  openClaims,
  outlook,
  pactBlocker,
  pactOptions,
  repayAfterTable,
  type Contract,
  type WorldState,
} from '../src/game/world';

const ROSTER = [
  ['you', 'You', 'human', 'player'],
  ['vesper', 'Lady Vesper', 'ai', 'vesper'],
  ['oracle', 'The Sightless Oracle', 'ai', 'oracle'],
  ['corvin', 'Sir Corvin', 'ai', 'corvin'],
] as const;

function world(stacks: number[]): WorldState {
  const chars = ROSTER.slice(0, stacks.length).map(([id, name, kind, key]) => createCharacter(id, name, kind, key));
  return createWorld(chars, stacks.reduce((a, b) => a + b, 0));
}

function play(stacks: number[], holes: string[], board: string, button: number, actions: [number, PlayerAction][]): HandState {
  const s = actHand(riggedHand(setup(stacks, { button }), holes, board), ...actions);
  expect(s.phase).toBe('complete');
  return s;
}

const allIn: PlayerAction = { type: 'allIn' };
const call: PlayerAction = { type: 'call' };
const fold: PlayerAction = { type: 'fold' };

/** The human (seat 0, 10 chips) busts to Lady Vesper (seat 1). */
function humanBusts(): { hand: HandState; w: WorldState } {
  const stacks = [10, 100, 100, 100];
  const hand = play(stacks, ['7c 2d', 'Ah Ad', '8c 3h', '9c 4h'], 'Kc Qd 9h 4s 5c', 3, [
    [2, fold],
    [3, fold],
    [0, allIn],
    [1, call],
  ]);
  return { hand, w: world(stacks) };
}

/** with a fixed roll, for deterministic odds tests */
function withRoll(batch: ClaimBatch, roll: number): ClaimBatch {
  const b = structuredClone(batch);
  b.claims[b.current].roll = roll;
  return b;
}

describe('opening claims', () => {
  it('claims open only after settlement and name the sole winner of the debtor’s last pot', () => {
    const { hand, w } = humanBusts();
    const batch = openClaims(hand, w, 1, 42);
    expect(batch.claims).toHaveLength(1);
    expect(batch.claims[0]).toMatchObject({ debtor: 0, claimant: { kind: 'seat', seat: 1 }, stage: 'open' });
    expect(batch.stacks[0]).toBe(0);
  });

  it('uses the pot holding the final contribution, not the biggest stack, in side-pot busts', () => {
    // Seat 1 (4 chips) can only lose the main pot; its claimant is that pot's winner (index 0).
    const stacks = [100, 4, 100];
    const hand = play(stacks, ['Ah Ad', '7c 2d', 'Kh Kd'], 'Qc 9s 5h 3c 8d', 0, [
      [0, { type: 'raise', to: 10 }],
      [1, call],
      [2, call],
      [2, { type: 'check' }],
      [0, { type: 'check' }],
      [2, { type: 'check' }],
      [0, { type: 'check' }],
      [2, { type: 'check' }],
      [0, { type: 'check' }],
    ]);
    const batch = openClaims(hand, world(stacks), 1, 1);
    expect(batch.claims[0]).toMatchObject({ debtor: 1, potIndex: 0, claimant: { kind: 'seat', seat: 0 } });
  });

  it('a split last pot goes to the neutral adjudicator', () => {
    const stacks = [10, 100, 100];
    const hand = play(stacks, ['7c 8d', 'Jh Td', 'Js Tc'], 'Ah Kd Qc 2s 3h', 0, [
      [0, allIn],
      [1, call],
      [2, call],
      [1, { type: 'check' }],
      [2, { type: 'check' }],
      [1, { type: 'check' }],
      [2, { type: 'check' }],
      [1, { type: 'check' }],
      [2, { type: 'check' }],
    ]);
    const batch = openClaims(hand, world(stacks), 1, 1);
    expect(batch.claims[0].claimant).toEqual({ kind: 'adjudicator' });
    expect(pactOptions(batch, world(stacks)).map((o) => o.pact)).toEqual(['mercy']);
  });

  it('resolves simultaneous claims clockwise from the seat left of the button', () => {
    const stacks = [10, 10, 100, 10];
    const hand = play(stacks, ['7c 2d', '8c 3d', 'Ah Ad', '9c 4d'], 'Kc Qd Jh 6s 5c', 1, [
      [0, allIn],
      [1, call],
      [2, call],
      [3, call],
    ]);
    const batch = openClaims(hand, world(stacks), 1, 1);
    // Button at seat 1: order is 2, 3, 0, 1.
    expect(batch.claims.map((c) => c.debtor)).toEqual([3, 0, 1]);
  });
});

describe('funding and transfers', () => {
  it('a claimant must hold strictly more than the endowment (endowment-1, endowment, endowment+1)', () => {
    const { hand, w } = humanBusts();
    const base = openClaims(hand, w, 1, 7);
    const e = ENDOWMENT.vesper;
    for (const [balance, ok] of [
      [e - 1, false],
      [e, false],
      [e + 1, true],
    ] as const) {
      const b = structuredClone(base);
      b.stacks[1] = balance;
      expect(pactBlocker(b, w, b.claims[0], 'debt') === null).toBe(ok);
    }
  });

  it('a funded survival debits the named funder and credits the debtor equally, once', () => {
    const { hand, w } = humanBusts();
    let batch = withRoll(openClaims(hand, w, 1, 7), 0);
    const before = batch.stacks[1];
    const r = applyClaimCommand(batch, w, { kind: 'propose', pact: 'debt' });
    expect(r.batch.stacks[1]).toBe(before - ENDOWMENT.vesper);
    const you = r.world.characters[0];
    expect(you).toMatchObject({ offTable: 10, status: 'exited', socialRank: 'FALLEN', district: 'CINDER_WARRENS', pendingNode: 'FALLEN_RECOVERY', survivalCovenantsUsed: 1 });
    expect(r.world.journal).toEqual([{ id: 1, from: 'vesper', to: 'you', amount: 10, reason: 'debt endowment (H1-S0)' }]);
    expect(r.world.contracts[0]).toMatchObject({ pact: 'debt', principal: 10, obligation: 15, status: 'active', creditor: 'vesper' });
    assertWorldInvariants(r.world, r.batch.stacks);
    expect(() => applyClaimCommand(r.batch, r.world, { kind: 'propose', pact: 'debt' })).toThrow();
    batch = applyClaimCommand(r.batch, r.world, { kind: 'acknowledge' }).batch;
    expect(batchDone(batch)).toBe(true);
  });

  it('the Ledger adjudicator funds mercy only from its tracked treasury', () => {
    const stacks = [10, 100, 100];
    const hand = play(stacks, ['7c 8d', 'Jh Td', 'Js Tc'], 'Ah Kd Qc 2s 3h', 0, [
      [0, allIn],
      [1, call],
      [2, call],
      ...([1, 2, 1, 2, 1, 2] as const).map((s) => [s, { type: 'check' }] as [number, PlayerAction]),
    ]);
    const w = world(stacks);
    const batch = withRoll(openClaims(hand, w, 1, 1), 0);
    expect(pactBlocker(batch, w, batch.claims[0], 'debt')).toMatch(/adjudicator/);
    const poor = { ...w, treasury: 5, totalLifechips: w.totalLifechips - 15 };
    expect(pactBlocker(batch, poor, batch.claims[0], 'mercy')).toMatch(/treasury/);
    const r = applyClaimCommand(batch, w, { kind: 'propose', pact: 'mercy' });
    expect(r.world.treasury).toBe(w.treasury - 10);
    expect(r.world.contracts[0]).toMatchObject({ creditor: 'ledger', pact: 'mercy', status: 'cleared' });
    assertWorldInvariants(r.world, r.batch.stacks);
  });

  it('only one survival covenant per run for the player', () => {
    const { hand, w } = humanBusts();
    w.characters[0].survivalCovenantsUsed = 1;
    const batch = openClaims(hand, w, 1, 7);
    expect(pactOptions(batch, w).every((o) => o.blocker !== null)).toBe(true);
    const r = applyClaimCommand(batch, w, { kind: 'acceptFate' });
    expect(r.world.characters[0]).toMatchObject({ alive: false, status: 'dead' });
  });
});

describe('negotiation', () => {
  it('a single persisted roll decides; a refused offer cannot be re-rolled by reloading', () => {
    const { hand, w } = humanBusts();
    const batch = openClaims(hand, w, 1, 7);
    const saved = JSON.parse(JSON.stringify(batch)) as ClaimBatch;
    const a = applyClaimCommand(batch, w, { kind: 'propose', pact: 'mercy' });
    const b = applyClaimCommand(saved, w, { kind: 'propose', pact: 'mercy' });
    expect(b).toEqual(a);
    expect(() => applyClaimCommand(a.batch, a.world, { kind: 'propose', pact: 'service' })).toThrow();
  });

  it('Vesper counters a refused mercy plea with service when the same roll allows it', () => {
    const { hand, w } = humanBusts();
    const open = openClaims(hand, w, 1, 7);
    const pMercy = claimantWillingness(open, w, open.claims[0], 'mercy');
    const pService = claimantWillingness(open, w, open.claims[0], 'service');
    expect(pService).toBeGreaterThan(pMercy);
    const batch = withRoll(open, (pMercy + pService) / 2);
    const r = applyClaimCommand(batch, w, { kind: 'propose', pact: 'mercy' });
    expect(currentClaim(r.batch)).toMatchObject({ stage: 'counter', accepted: false, counter: { pact: 'service', proposedBy: 'claimant' } });
    const declined = applyClaimCommand(r.batch, r.world, { kind: 'answerCounter', accept: false });
    expect(currentClaim(declined.batch)!.outcome).toEqual({ kind: 'death', reason: 'declinedCounter' });
    const accepted = applyClaimCommand(r.batch, r.world, { kind: 'answerCounter', accept: true });
    expect(accepted.world.contracts[0]).toMatchObject({ pact: 'service', servicesOwed: 3 });
  });

  it('a roll above every option is a plain refusal, which is death', () => {
    const { hand, w } = humanBusts();
    const r = applyClaimCommand(withRoll(openClaims(hand, w, 1, 7), 0.99), w, { kind: 'propose', pact: 'debt' });
    expect(currentClaim(r.batch)!.outcome).toEqual({ kind: 'death', reason: 'refused' });
    expect(r.world.characters[0].alive).toBe(false);
    expect(r.batch.stacks[1]).toBe(openClaims(hand, w, 1, 7).stacks[1]); // no transfer
  });

  it('willingness applies the design table and clamps to [0.05, 0.90]; labels use fixed bands', () => {
    const { hand, w } = humanBusts();
    const batch = openClaims(hand, w, 1, 7);
    const claim = batch.claims[0];
    // Vesper keeps 100+ after funding 10: base 0.25, +0.05 retention.
    expect(claimantWillingness(batch, w, claim, 'service')).toBeCloseTo(0.45);
    expect(claimantWillingness(batch, w, claim, 'mercy')).toBeCloseTo(0.15);
    w.characters[1].relations.you = { betrayedMe: true, hostile: true };
    expect(claimantWillingness(batch, w, claim, 'mercy')).toBe(0.05);
    expect([outlook(0.34), outlook(0.35), outlook(0.649), outlook(0.65)]).toEqual(['LOW', 'FAIR', 'FAIR', 'HIGH']);
  });
});

describe('player as claimant and NPC-vs-NPC claims', () => {
  /** Lady Vesper (seat 1, 10 chips) busts to the player (seat 0). */
  function vesperBustsToYou(): { batch: ClaimBatch; w: WorldState } {
    const stacks = [100, 10, 100, 100];
    const hand = play(stacks, ['Ah Ad', '7c 2d', '8c 3h', '9c 4h'], 'Kc Qd 9h 4s 5c', 0, [
      [3, fold],
      [0, { type: 'raise', to: 10 }],
      [1, allIn],
      [2, fold],
    ]);
    const w = world(stacks);
    return { batch: openClaims(hand, w, 1, 9), w };
  }

  it('claiming a life raises Dread and moves no chips', () => {
    const { batch, w } = vesperBustsToYou();
    const r = applyClaimCommand(batch, w, { kind: 'claimLife' });
    expect(r.world.characters[0].reputation.dread).toBe(1);
    expect(r.world.characters[1]).toMatchObject({ alive: false, status: 'dead' });
    expect(r.batch.stacks).toEqual(batch.stacks);
  });

  it('funded mercy costs the player 10, raises Honor, and the NPC leaves the table', () => {
    const { batch, w } = vesperBustsToYou();
    expect(debtorAcceptance(w, batch.claims[0], 'mercy')).toBeCloseTo(0.55);
    const r = applyClaimCommand(withRoll(batch, 0), w, { kind: 'propose', pact: 'mercy' });
    expect(r.batch.stacks[0]).toBe(batch.stacks[0] - 10);
    expect(r.world.characters[0].reputation.honor).toBe(1);
    expect(r.world.characters[1]).toMatchObject({ status: 'exited', offTable: 10, alive: true });
    expect(r.world.characters[1].relations.you.sparedMe).toBe(true);
  });

  it('NPC-vs-NPC claims resolve without the player and wait for acknowledgement', () => {
    const stacks = [100, 10, 100, 100];
    const hand = play(stacks, ['8c 3h', '7c 2d', 'Ah Ad', '9c 4h'], 'Kc Qd 9h 4s 5c', 0, [
      [3, fold],
      [0, fold],
      [1, allIn],
      [2, call],
    ]);
    const w = world(stacks);
    const r = autoAdvance(openClaims(hand, w, 1, 3), w);
    const claim = currentClaim(r.batch)!;
    expect(claim.stage).toBe('resolved');
    expect(claim.offer?.pact).toBe('mercy'); // v0.6: Vesper pleads in her own order (mercy, then debt)
    assertWorldInvariants(r.world, r.batch.stacks);
  });
});

describe('NPC debtor temperament (design v0.6 §02)', () => {
  /** `who` (seat 1) busts to the player (seat 0). */
  function bustsToYou(who: 'vesper' | 'oracle' | 'corvin'): { batch: ClaimBatch; w: WorldState } {
    const stacks = [100, 10, 100, 100];
    const hand = play(stacks, ['Ah Ad', '7c 2d', '8c 3h', '9c 4h'], 'Kc Qd 9h 4s 5c', 0, [
      [3, fold],
      [0, { type: 'raise', to: 10 }],
      [1, allIn],
      [2, fold],
    ]);
    const w = world(stacks);
    const roster = { vesper: ['vesper', 'Lady Vesper'], oracle: ['oracle', 'The Sightless Oracle'], corvin: ['corvin', 'Sir Corvin'] }[who];
    w.characters[1] = createCharacter(roster[0], roster[1], 'ai', who);
    return { batch: openClaims(hand, w, 1, 9), w };
  }

  it('Vesper refuses service whatever the roll; the veto is not lifted by the clamp', () => {
    const { batch, w } = bustsToYou('vesper');
    expect(debtorAcceptance(w, batch.claims[0], 'service')).toBe(0);
    const r = applyClaimCommand(withRoll(batch, 0), w, { kind: 'propose', pact: 'service' });
    expect(currentClaim(r.batch)).toMatchObject({ stage: 'counter', accepted: false, counter: { pact: 'mercy', proposedBy: 'debtor' } });
  });

  it('Oracle counters with debt first; Corvin with mercy first', () => {
    const o = bustsToYou('oracle');
    const ro = applyClaimCommand(withRoll(o.batch, 0.5), o.w, { kind: 'propose', pact: 'service' });
    expect(currentClaim(ro.batch)!.counter!.pact).toBe('debt');
    const c = bustsToYou('corvin');
    const rc = applyClaimCommand(withRoll(c.batch, 0.5), c.w, { kind: 'propose', pact: 'service' });
    expect(currentClaim(rc.batch)!.counter!.pact).toBe('mercy');
  });

  it('imposing debt or service earns no Favor; funded mercy earns Honor', () => {
    const { batch, w } = bustsToYou('oracle');
    const debt = applyClaimCommand(withRoll(batch, 0), w, { kind: 'propose', pact: 'debt' });
    expect(debt.world.characters[0].reputation).toMatchObject({ favor: 0, honor: 0 });
    const mercy = applyClaimCommand(withRoll(batch, 0), w, { kind: 'propose', pact: 'mercy' });
    expect(mercy.world.characters[0].reputation.honor).toBe(1);
  });

  it('an NPC debtor can refuse a counteroffer and die', () => {
    // Vesper (seat 1) busts to the Oracle (seat 2).
    const stacks = [100, 10, 100, 100];
    const hand = play(stacks, ['8c 3h', '7c 2d', 'Ah Ad', '9c 4h'], 'Kc Qd 9h 4s 5c', 0, [
      [3, fold],
      [0, fold],
      [1, allIn],
      [2, call],
    ]);
    const w = world(stacks);
    const open = openClaims(hand, w, 1, 3);
    const claim = open.claims[0];
    // Vesper pleads mercy (Oracle grants it at 0.50); at roll 0.6 the Oracle counters
    // with debt (0.70), which Vesper accepts only below 0.40: she refuses and dies.
    expect(claimantWillingness(open, w, claim, 'mercy')).toBeCloseTo(0.5);
    expect(claimantWillingness(open, w, claim, 'debt')).toBeCloseTo(0.7);
    const r = autoAdvance(withRoll(open, 0.6), w);
    const resolved = currentClaim(r.batch)!;
    expect(resolved.offer?.pact).toBe('mercy');
    expect(resolved.counter?.pact).toBe('debt');
    expect(resolved.outcome).toEqual({ kind: 'death', reason: 'declinedCounter' });
    expect(r.batch.stacks).toEqual(open.stacks);
    assertWorldInvariants(r.world, r.batch.stacks);
  });

  it('the 20-chip relief treasury funds exactly two neutral petitions', () => {
    const stacks = [10, 100, 100];
    const hand = play(stacks, ['7c 8d', 'Jh Td', 'Js Tc'], 'Ah Kd Qc 2s 3h', 0, [
      [0, allIn],
      [1, call],
      [2, call],
      ...([1, 2, 1, 2, 1, 2] as const).map((s) => [s, { type: 'check' }] as [number, PlayerAction]),
    ]);
    let w = world(stacks);
    expect(w.treasury).toBe(20);
    for (let i = 0; i < 2; i++) {
      const b = withRoll(openClaims(hand, w, 1, 1), 0);
      w = applyClaimCommand(b, w, { kind: 'propose', pact: 'mercy' }).world;
      w.characters[0].survivalCovenantsUsed = 0; // isolate the treasury rule
    }
    expect(w.treasury).toBe(0);
    const third = openClaims(hand, w, 1, 1);
    expect(pactBlocker(third, w, third.claims[0], 'mercy')).toMatch(/treasury/);
  });
});

describe('debt repayment (P4 hook)', () => {
  const debt: Contract = {
    id: 'K1', claimId: 'H1-S0', pact: 'debt', debtor: 'you', creditor: 'vesper', principal: 10, obligation: 15,
    repaid: 0, servicesOwed: 0, servicesDone: 0, tablesCompleted: 0, status: 'active',
  };

  it('pays 30% of positive net winnings, rounded down, capped by what is owed and a preserved stack of 1', () => {
    expect(repayAfterTable(debt, 25, 100).payment).toBe(7);
    expect(repayAfterTable(debt, 0, 100).payment).toBe(0);
    expect(repayAfterTable(debt, -40, 100).payment).toBe(0);
    expect(repayAfterTable(debt, 1000, 100).payment).toBe(15);
    expect(repayAfterTable(debt, 25, 3).payment).toBe(2);
    expect(repayAfterTable(debt, 1000, 100).contract.status).toBe('cleared');
  });

  it('becomes overdue after four completed tables without clearing, never below zero', () => {
    let k = debt;
    let overdue = false;
    for (let i = 0; i < 4; i++) {
      const r = repayAfterTable(k, 0, 50);
      k = r.contract;
      overdue ||= r.becameOverdue;
    }
    expect(k.status).toBe('overdue');
    expect(overdue).toBe(true);
    expect(k.repaid).toBe(0);
  });
});
