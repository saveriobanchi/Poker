/**
 * Last Claim state machine (design decisions v0.5, §03–§07).
 *
 * After a hand is fully settled, every seat at 0 Lifechips gets a claim,
 * resolved one at a time clockwise from the seat left of that hand's button.
 * Claim decisions never touch the settled poker result: they only move chips
 * between named holders, recorded in the world journal.
 *
 * Each claim draws exactly one willingness roll when it is opened, and stores
 * it. An offer is accepted if the roll is under the decider's willingness for
 * it. Otherwise the decider counters once with the eligible pact it is most
 * willing to grant, if the same roll would pass for that pact. Otherwise the
 * offer is refused. Reloading a save can never re-roll anything.
 */
import type { HandState } from '../rules/engine';
import { Rng } from '../rules/rng';
import {
  CLAIMANT_BASE,
  CLAIMANT_MODIFIERS,
  CLAIMANT_PACT_PREFERENCE,
  DEBT,
  byKey,
  DEBTOR_MODIFIERS,
  DEBTOR_TEMPERAMENT,
  ENDOWMENT,
  MAX_PLAYER_SURVIVAL_COVENANTS,
  type Outlook,
  outlook,
  type Pact,
  PACTS,
  type RuleKey,
  SERVICE_TASKS,
  WILLINGNESS_CLAMP,
} from './rules';
import { assertWorldInvariants, type Character, type Contract, relation, type WorldState } from './world';

export type ClaimantRef = { kind: 'seat'; seat: number } | { kind: 'adjudicator' };

export interface Offer {
  pact: Pact;
  proposedBy: 'debtor' | 'claimant';
  endowment: number;
  /** Seat that pays, or the Ledger relief treasury. */
  funder: number | 'ledger';
}

export type DeathReason = 'acceptedFate' | 'claimedLife' | 'refused' | 'declinedCounter' | 'noBargain';

export type ClaimOutcome =
  | { kind: 'death'; reason: DeathReason }
  | { kind: 'survival'; pact: Pact; endowment: number; funder: number | 'ledger'; contractId: string };

/** open: waiting for the proposer · counter: a counteroffer awaits the proposer · resolved: outcome shown, awaiting acknowledgement · done. */
export type ClaimStage = 'open' | 'counter' | 'resolved' | 'done';

export interface Claim {
  id: string;
  debtor: number;
  claimant: ClaimantRef;
  /** The pot holding the debtor's final contribution, and its size. */
  potIndex: number;
  potAmount: number;
  /** The single persisted willingness roll in [0, 1). */
  roll: number;
  stage: ClaimStage;
  offer: Offer | null;
  /** Whether the decider accepted the first offer (null until answered). */
  accepted: boolean | null;
  counter: Offer | null;
  outcome: ClaimOutcome | null;
}

export interface ClaimBatch {
  handNumber: number;
  claims: Claim[];
  current: number;
  /** Table stacks after settlement and any claim transfers so far. */
  stacks: number[];
}

export type ClaimCommand =
  | { kind: 'propose'; pact: Pact }
  | { kind: 'acceptFate' }
  | { kind: 'claimLife' }
  | { kind: 'answerCounter'; accept: boolean }
  | { kind: 'acknowledge' };

export class ClaimError extends Error {}

// ───────────────────────────── opening ─────────────────────────────

/** Claimant from the pot of the debtor's final contribution: its sole winner, else the neutral adjudicator. */
function claimantFor(hand: HandState, world: WorldState, claimants: number[]): ClaimantRef {
  if (claimants.length === 1) {
    const seat = claimants[0];
    const c = world.characters[seat];
    if (c.alive && c.status === 'seated' && hand.seats[seat].stack > 0) return { kind: 'seat', seat };
  }
  return { kind: 'adjudicator' };
}

/** Builds the claim batch for a settled hand (empty when nobody reached zero). */
export function openClaims(hand: HandState, world: WorldState, handNumber: number, seed: number): ClaimBatch {
  if (hand.phase !== 'complete' || !hand.result) throw new ClaimError('Claims open only after settlement');
  const n = hand.seats.length;
  const order = (seat: number) => (seat - hand.button - 1 + 2 * n) % n;
  const zero = [...hand.result.zeroChipSeats].sort((a, b) => order(a.seat) - order(b.seat));
  const claims = zero.map<Claim>((z) => ({
    id: `H${handNumber}-S${z.seat}`,
    debtor: z.seat,
    claimant: claimantFor(hand, world, z.claimants),
    potIndex: z.claimPotIndex,
    potAmount: hand.result!.pots[z.claimPotIndex]?.amount ?? 0,
    roll: new Rng(seed ^ (z.seat * 0x9e3779b1)).nextFloat(),
    stage: 'open',
    offer: null,
    accepted: null,
    counter: null,
    outcome: null,
  }));
  return { handNumber, claims, current: 0, stacks: hand.seats.map((p) => p.stack) };
}

export function currentClaim(batch: ClaimBatch): Claim | null {
  return batch.claims[batch.current] ?? null;
}

export function batchDone(batch: ClaimBatch): boolean {
  return batch.current >= batch.claims.length;
}

// ─────────────────────────── eligibility & odds ───────────────────────────

const clamp = (p: number) => Math.min(WILLINGNESS_CLAMP[1], Math.max(WILLINGNESS_CLAMP[0], p));

function claimantKey(world: WorldState, claim: Claim): RuleKey {
  return claim.claimant.kind === 'adjudicator' ? 'adjudicator' : world.characters[claim.claimant.seat].ruleKey;
}

function claimantId(world: WorldState, claim: Claim): string {
  return claim.claimant.kind === 'adjudicator' ? 'ledger' : world.characters[claim.claimant.seat].id;
}

export interface Funding {
  endowment: number;
  funder: number | 'ledger';
  balance: number;
}

/** Survival is always funded by the claimant (or the Ledger treasury for the adjudicator). */
export function fundingFor(batch: ClaimBatch, world: WorldState, claim: Claim): Funding {
  const endowment = ENDOWMENT[claimantKey(world, claim)];
  return claim.claimant.kind === 'adjudicator'
    ? { endowment, funder: 'ledger', balance: world.treasury }
    : { endowment, funder: claim.claimant.seat, balance: batch.stacks[claim.claimant.seat] };
}

/** Why a pact cannot be offered right now, or null when it can. */
export function pactBlocker(batch: ClaimBatch, world: WorldState, claim: Claim, pact: Pact): string | null {
  const debtor = world.characters[claim.debtor];
  if (debtor.kind === 'human' && debtor.survivalCovenantsUsed >= MAX_PLAYER_SURVIVAL_COVENANTS) {
    return 'You have already survived one Last Claim this run.';
  }
  if (claim.claimant.kind === 'adjudicator' && pact !== 'mercy') {
    return 'The neutral adjudicator grants no personal rights; only a funded mercy petition is possible.';
  }
  const f = fundingFor(batch, world, claim);
  const enough = f.funder === 'ledger' ? f.balance >= f.endowment : f.balance > f.endowment;
  if (!enough) {
    return f.funder === 'ledger'
      ? `The Ledger relief treasury holds only ${f.balance} Lifechips.`
      : `The claimant cannot fund ${f.endowment} Lifechips and keep at least one.`;
  }
  return null;
}

/** Probability that the claimant grants `pact` to the debtor (decider = claimant). */
export function claimantWillingness(batch: ClaimBatch, world: WorldState, claim: Claim, pact: Pact): number {
  const key = claimantKey(world, claim);
  const debtor = world.characters[claim.debtor];
  const m = CLAIMANT_MODIFIERS;
  let p = byKey(CLAIMANT_BASE, key) + (byKey(CLAIMANT_PACT_PREFERENCE, key)[pact] ?? 0);
  if (claim.claimant.kind === 'seat') {
    const rel = relation(world, world.characters[claim.claimant.seat].id, debtor.id);
    if (rel.friendly) p += m.friendly;
    if (rel.sparedMe) p += m.previouslySparedByDebtor;
    if (rel.hostile) p += m.hostile;
    if (rel.betrayedMe) p += m.betrayedByDebtor;
    const f = fundingFor(batch, world, claim);
    const retained = f.balance - f.endowment;
    if (retained >= 30) p += m.retainsAtLeast30;
    else if (retained >= 1 && retained < 10) p += m.retainsUnder10;
  }
  if (debtor.reputation.honor >= 2) p += m.debtorHonorAtLeast2;
  if (debtor.reputation.dread >= 2 && key === 'corvin') p += m.debtorDreadAtLeast2VsCorvin;
  return clamp(p);
}

/**
 * Probability that an NPC debtor accepts survival terms (decider = debtor), from
 * its v0.6 temperament. A vetoed pact is a hard zero, never lifted by the clamp.
 */
export function debtorAcceptance(world: WorldState, claim: Claim, pact: Pact): number {
  const debtor = world.characters[claim.debtor];
  const temper = byKey(DEBTOR_TEMPERAMENT, debtor.ruleKey);
  if (temper.veto.includes(pact)) return 0;
  let p = temper.acceptance[pact];
  if (claim.claimant.kind === 'seat') {
    const rel = relation(world, debtor.id, world.characters[claim.claimant.seat].id);
    if (rel.friendly) p += DEBTOR_MODIFIERS.friendly;
    if (rel.betrayedMe) p += DEBTOR_MODIFIERS.betrayed;
  }
  return clamp(p);
}

/** The NPC debtor's own order of preference among pacts (vetoed pacts excluded). */
export function debtorPriority(world: WorldState, claim: Claim): Pact[] {
  return byKey(DEBTOR_TEMPERAMENT, world.characters[claim.debtor].ruleKey).priority;
}

/** Who proposes in this claim, and whether that party is the human. */
export function roles(world: WorldState, claim: Claim): { proposer: 'debtor' | 'claimant'; humanProposes: boolean; humanInvolved: boolean } {
  const debtorHuman = world.characters[claim.debtor].kind === 'human';
  const claimantHuman = claim.claimant.kind === 'seat' && world.characters[claim.claimant.seat].kind === 'human';
  // The human always holds the pen when involved; between NPCs the debtor pleads.
  const proposer = claimantHuman ? 'claimant' : 'debtor';
  return { proposer, humanProposes: debtorHuman || claimantHuman, humanInvolved: debtorHuman || claimantHuman };
}

function willingness(batch: ClaimBatch, world: WorldState, claim: Claim, pact: Pact): number {
  return roles(world, claim).proposer === 'debtor'
    ? claimantWillingness(batch, world, claim, pact)
    : debtorAcceptance(world, claim, pact);
}

export interface PactOption {
  pact: Pact;
  blocker: string | null;
  endowment: number;
  funder: number | 'ledger';
  /** Banded label only; raw odds are never shown to the player. */
  outlook: Outlook | null;
  /** Total owed back (debt), or tasks owed (service). */
  obligation: number;
}

/** The proposer's options for the current claim (what the UI shows). */
export function pactOptions(batch: ClaimBatch, world: WorldState): PactOption[] {
  const claim = currentClaim(batch);
  if (!claim || claim.stage !== 'open') return [];
  const f = fundingFor(batch, world, claim);
  return PACTS.filter((pact) => claim.claimant.kind === 'seat' || pact === 'mercy').map((pact) => {
    const blocker = pactBlocker(batch, world, claim, pact);
    return {
      pact,
      blocker,
      endowment: f.endowment,
      funder: f.funder,
      outlook: blocker ? null : outlook(willingness(batch, world, claim, pact)),
      obligation: pact === 'debt' ? Math.ceil(DEBT.multiplier * f.endowment) : pact === 'service' ? SERVICE_TASKS : 0,
    };
  });
}

// ───────────────────────────── commands ─────────────────────────────

/** Applies one command from the human (or, internally, an NPC). Pure: returns new batch and world. */
export function applyClaimCommand(
  batch0: ClaimBatch,
  world0: WorldState,
  cmd: ClaimCommand,
): { batch: ClaimBatch; world: WorldState } {
  const batch = structuredClone(batch0);
  const world = structuredClone(world0);
  const claim = currentClaim(batch);
  if (!claim) throw new ClaimError('No claim pending');
  const { proposer } = roles(world, claim);

  switch (cmd.kind) {
    case 'acknowledge':
      if (claim.stage !== 'resolved') throw new ClaimError('Nothing to acknowledge');
      claim.stage = 'done';
      batch.current++;
      break;

    case 'acceptFate':
      if (claim.stage !== 'open' || proposer !== 'debtor') throw new ClaimError('Only the debtor can accept fate now');
      resolveDeath(world, claim, 'acceptedFate');
      break;

    case 'claimLife':
      if (claim.stage !== 'open' || proposer !== 'claimant') throw new ClaimError('Only the claimant can claim a life');
      resolveDeath(world, claim, 'claimedLife');
      break;

    case 'propose': {
      if (claim.stage !== 'open') throw new ClaimError('An offer has already been made');
      const blocker = pactBlocker(batch, world, claim, cmd.pact);
      if (blocker) throw new ClaimError(blocker);
      const f = fundingFor(batch, world, claim);
      claim.offer = { pact: cmd.pact, proposedBy: proposer, endowment: f.endowment, funder: f.funder };
      if (claim.roll < willingness(batch, world, claim, cmd.pact)) {
        claim.accepted = true;
        resolveSurvival(batch, world, claim, claim.offer);
        break;
      }
      claim.accepted = false;
      const decider = proposer === 'debtor' ? 'claimant' : 'debtor';
      // A claimant counters with the pact it is most willing to grant; an NPC debtor
      // counters in its own order of preference (design v0.6 §02). Same saved roll.
      const candidates =
        decider === 'claimant'
          ? PACTS.map((p) => ({ p, w: willingness(batch, world, claim, p) })).sort((a, b) => b.w - a.w)
          : debtorPriority(world, claim).map((p) => ({ p, w: debtorAcceptance(world, claim, p) }));
      const counter = candidates.find((x) => x.p !== cmd.pact && !pactBlocker(batch, world, claim, x.p) && claim.roll < x.w);
      if (counter) {
        claim.counter = { pact: counter.p, proposedBy: decider, endowment: f.endowment, funder: f.funder };
        claim.stage = 'counter';
      } else {
        resolveDeath(world, claim, 'refused');
      }
      break;
    }

    case 'answerCounter':
      if (claim.stage !== 'counter' || !claim.counter) throw new ClaimError('No counteroffer to answer');
      if (cmd.accept) resolveSurvival(batch, world, claim, claim.counter);
      else resolveDeath(world, claim, 'declinedCounter');
      break;
  }

  assertWorldInvariants(world, batch.stacks);
  return { batch, world };
}

/**
 * Plays every NPC-only decision until the human must act or acknowledge.
 * An NPC debtor pleads for the first funded pact in its own order of preference
 * and judges any counteroffer with its own acceptance against the same saved
 * roll; it may prefer death (design v0.6 §02). NPC-vs-NPC outcomes still stop
 * at `resolved` so the table can show them.
 */
export function autoAdvance(batch0: ClaimBatch, world0: WorldState): { batch: ClaimBatch; world: WorldState } {
  let batch = batch0;
  let world = world0;
  for (;;) {
    const claim = currentClaim(batch);
    if (!claim || claim.stage === 'resolved') return { batch, world };
    const { humanProposes } = roles(world, claim);
    if (humanProposes) return { batch, world };
    let cmd: ClaimCommand;
    if (claim.stage === 'counter') {
      cmd = { kind: 'answerCounter', accept: claim.roll < debtorAcceptance(world, claim, claim.counter!.pact) };
    } else {
      const open = new Set(pactOptions(batch, world).filter((o) => !o.blocker).map((o) => o.pact));
      const choice = debtorPriority(world, claim).find((p) => open.has(p));
      const best = choice ? { pact: choice } : null;
      if (!best) {
        const w = structuredClone(world);
        const b = structuredClone(batch);
        resolveDeath(w, currentClaim(b)!, 'noBargain');
        batch = b;
        world = w;
        continue;
      }
      cmd = { kind: 'propose', pact: best.pact };
    }
    ({ batch, world } = applyClaimCommand(batch, world, cmd));
  }
}

// ───────────────────────────── outcomes ─────────────────────────────

function character(world: WorldState, seat: number): Character {
  return world.characters[seat];
}

function resolveDeath(world: WorldState, claim: Claim, reason: DeathReason): void {
  const debtor = character(world, claim.debtor);
  debtor.alive = false;
  debtor.status = 'dead';
  if (reason === 'claimedLife' && claim.claimant.kind === 'seat') character(world, claim.claimant.seat).reputation.dread += 1;
  claim.outcome = { kind: 'death', reason };
  claim.stage = 'resolved';
}

function resolveSurvival(batch: ClaimBatch, world: WorldState, claim: Claim, offer: Offer): void {
  const debtor = character(world, claim.debtor);
  const creditor = claimantId(world, claim);
  const amount = offer.endowment;

  // Real transfer from the named funder; the survivor leaves this table with it.
  if (offer.funder === 'ledger') {
    if (world.treasury < amount) throw new ClaimError('Treasury cannot fund this');
    world.treasury -= amount;
  } else {
    if (batch.stacks[offer.funder] <= amount) throw new ClaimError('Funder must keep at least one Lifechip');
    batch.stacks[offer.funder] -= amount;
  }
  debtor.offTable += amount;
  world.journal.push({ id: world.journal.length + 1, from: creditor, to: debtor.id, amount, reason: `${offer.pact} endowment (${claim.id})` });

  debtor.status = 'exited';
  debtor.socialRank = 'FALLEN';
  debtor.district = 'CINDER_WARRENS';
  debtor.survivalCovenantsUsed += 1;
  if (debtor.kind === 'human') debtor.pendingNode = 'FALLEN_RECOVERY';

  const contract: Contract = {
    id: `K${world.contracts.length + 1}`,
    claimId: claim.id,
    pact: offer.pact,
    debtor: debtor.id,
    creditor,
    principal: amount,
    obligation: offer.pact === 'debt' ? Math.ceil(DEBT.multiplier * amount) : 0,
    repaid: 0,
    servicesOwed: offer.pact === 'service' ? SERVICE_TASKS : 0,
    servicesDone: 0,
    tablesCompleted: 0,
    status: offer.pact === 'mercy' ? 'cleared' : 'active',
  };
  world.contracts.push(contract);

  if (claim.claimant.kind === 'seat') {
    const c = character(world, claim.claimant.seat);
    relation(world, debtor.id, c.id).sparedMe = true;
    relation(world, c.id, debtor.id).iSpared = true;
    // v0.6 §01: funded unbound mercy earns Honor; imposing debt or service earns
    // nothing now (Favor comes when duties are fulfilled or the debt is discharged).
    if (c.kind === 'human' && offer.pact === 'mercy') c.reputation.honor += 1;
  }
  claim.outcome = { kind: 'survival', pact: offer.pact, endowment: amount, funder: offer.funder, contractId: contract.id };
  claim.stage = 'resolved';
}
