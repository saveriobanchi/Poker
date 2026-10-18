/**
 * Player-facing wording for Last Claims (design v0.5 §04). Serious and
 * non-graphic; raw odds are never shown, only the banded outlook labels.
 */
import type { Claim, ClaimOutcome, Offer, Pact, PactOption } from '../game/world';
import { DEBT, OUTLOOK_TEXT, SERVICE_TASKS, type Outlook } from '../game/world/rules';
import type { WorldState } from '../game/world/world';

export const ADJUDICATOR_NAME = 'The Ledger Adjudicator';

export function claimantName(world: WorldState, claim: Claim): string {
  return claim.claimant.kind === 'adjudicator' ? ADJUDICATOR_NAME : world.characters[claim.claimant.seat].name;
}

export function funderName(world: WorldState, funder: number | 'ledger'): string {
  return funder === 'ledger' ? 'the Ledger relief treasury' : world.characters[funder].kind === 'human' ? 'you' : world.characters[funder].name;
}

/** Button label for a pact, from the side proposing it. */
export function pactLabel(pact: Pact, side: 'debtor' | 'claimant', adjudicator = false): string {
  if (side === 'debtor') {
    if (adjudicator) return 'Petition for Mercy';
    return { mercy: 'Seek Mercy', debt: 'Pledge a Debt', service: 'Swear Service' }[pact];
  }
  return { mercy: 'Grant Mercy', debt: 'Demand Debt', service: 'Demand Service' }[pact];
}

export function pactNoun(pact: Pact): string {
  return { mercy: 'unbound mercy', debt: 'a funded debt', service: 'sworn service' }[pact];
}

/** One-line summary for the option button. */
export function pactSummary(o: PactOption, world: WorldState): string {
  const from = funderName(world, o.funder);
  const base = `${o.endowment} Lifechips from ${from}`;
  if (o.pact === 'mercy') return `${base} · no obligation`;
  if (o.pact === 'debt') return `${base} · ${o.obligation} owed back`;
  return `${base} · ${SERVICE_TASKS} duties owed`;
}

/** The exact price, shown before confirmation. */
export function termsLines(pact: Pact, endowment: number, funder: number | 'ledger', world: WorldState, debtorIsYou: boolean): string[] {
  const from = funderName(world, funder);
  const who = debtorIsYou ? 'You' : 'They';
  const lines = [`Endowment: ${endowment} Lifechips, paid by ${from}.`];
  if (pact === 'mercy') lines.push('Obligation: none. The mercy is unbound.');
  if (pact === 'debt') {
    const owed = Math.ceil(DEBT.multiplier * endowment);
    lines.push(
      `Obligation: ${owed} Lifechips in total.`,
      `Repayment: ${Math.round(DEBT.repayShare * 100)}% of positive winnings after each future table, never taking the last Lifechip. Overdue after ${DEBT.overdueAfterTables} tables.`,
    );
  }
  if (pact === 'service') lines.push(`Obligation: ${SERVICE_TASKS} sworn duties, none of them personal or intimate. No chip interest.`);
  lines.push(
    `Status: ${who} leave this table at once, Fallen, bound for the Cinder Warrens.`,
    debtorIsYou ? 'This is your one survival covenant for this run.' : 'They will not return to this table.',
  );
  return lines;
}

export function outlookLine(o: Outlook): string {
  return `${o} — ${OUTLOOK_TEXT[o]}`;
}

export function counterLine(world: WorldState, claim: Claim, counter: Offer): string {
  const decider = counter.proposedBy === 'claimant' ? claimantName(world, claim) : world.characters[claim.debtor].name;
  const refused = claim.offer ? pactNoun(claim.offer.pact) : 'your offer';
  return `${decider} refuses ${refused}, but offers ${pactNoun(counter.pact)} instead.`;
}

/** Non-graphic resolution text. */
export function outcomeLines(world: WorldState, claim: Claim, outcome: ClaimOutcome): { title: string; lines: string[] } {
  const debtor = world.characters[claim.debtor];
  const you = debtor.kind === 'human';
  const claimant = claimantName(world, claim);
  const claimantIsYou = claim.claimant.kind === 'seat' && world.characters[claim.claimant.seat].kind === 'human';
  if (outcome.kind === 'survival') {
    return {
      title: you ? 'The covenant is sealed' : `${debtor.name} is spared`,
      lines: [
        `${claimantIsYou ? 'You grant' : `${claimant} grants`} ${pactNoun(outcome.pact)}.`,
        `${outcome.endowment} Lifechips pass from ${funderName(world, outcome.funder)} to ${you ? 'you' : debtor.name}.`,
        you ? 'You rise from the table as one of the Fallen.' : `${debtor.name} leaves the table, Fallen.`,
      ],
    };
  }
  const reasons: Record<string, string> = {
    acceptedFate: you ? 'You accept your fate.' : `${debtor.name} accepts their fate.`,
    claimedLife: `You claim the life the Ledger owes you.`,
    refused: you ? `${claimant} refuses your plea.` : claimantIsYou ? `${debtor.name} refuses your terms.` : `${claimant} refuses ${debtor.name}'s plea.`,
    declinedCounter: 'The counteroffer is declined.',
    noBargain: `No funded bargain was possible.`,
  };
  return {
    title: you ? 'The Ledger closes your account' : `The Ledger claims ${debtor.name}`,
    lines: [reasons[outcome.reason], you ? 'Your run ends here. The Ledger keeps its records.' : `${debtor.name} is gone from the table.`],
  };
}
