/**
 * Player-facing wording for Last Claims (design v0.5 §04). Serious and
 * non-graphic; raw odds are never shown, only the banded outlook labels.
 */
import { type Claim, type ClaimBatch, type ClaimOutcome, fundingFor, type Offer, type Pact, type PactOption } from '../game/world';
import { CLAIMANT_PACT_PREFERENCE, DEBT, DEBTOR_TEMPERAMENT, OUTLOOK_TEXT, SERVICE_TASKS, type Outlook } from '../game/world/rules';
import { relation, type WorldState } from '../game/world/world';

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

/**
 * What sways the other party (design v0.7 §03): the recorded relationship, the
 * cost to the funder, reputation, and their known leanings — in words only,
 * never a probability. Nothing here changes any outcome.
 */
export function claimFactors(batch: ClaimBatch, world: WorldState, claim: Claim): string[] {
  const debtor = world.characters[claim.debtor];
  const youAreDebtor = debtor.kind === 'human';
  const lines: string[] = [];
  if (claim.claimant.kind === 'adjudicator') {
    lines.push('The Adjudicator has no history with anyone; it can only offer Mercy from the relief treasury, while the treasury lasts.');
    if (debtor.reputation.honor >= 2) lines.push('Your Honor is on the record and counts in your favor.');
    return lines;
  }
  const claimant = world.characters[claim.claimant.seat];
  const other = youAreDebtor ? claimant : debtor;
  // Relationship as the deciding party remembers it.
  const rel = youAreDebtor ? relation(world, claimant.id, debtor.id) : relation(world, debtor.id, claimant.id);
  const history: string[] = [];
  if (rel.sparedMe) history.push(youAreDebtor ? 'you once spared them' : 'they once spared you');
  if (rel.betrayedMe) history.push(youAreDebtor ? 'you betrayed them' : 'they believe you betrayed them');
  if (rel.friendly) history.push('there is goodwill between you');
  if (rel.hostile) history.push('there is open hostility between you');
  lines.push(`History with ${other.name}: ${history.length ? history.join('; ') : 'nothing recorded yet'}.`);
  if (youAreDebtor) {
    const f = fundingFor(batch, world, claim);
    const retained = f.balance - f.endowment;
    if (retained >= 30) lines.push(`Funding you would leave ${claimant.name} comfortably stocked, which helps.`);
    else if (retained >= 1 && retained < 10) lines.push(`Funding you would leave ${claimant.name} nearly empty, which weighs against you.`);
    if (debtor.reputation.honor >= 2) lines.push('Your Honor is on the record and counts in your favor.');
    if (debtor.reputation.dread >= 2 && claimant.ruleKey === 'corvin') lines.push('Your Dread troubles Sir Corvin.');
    const pref = CLAIMANT_PACT_PREFERENCE[claimant.ruleKey] ?? {};
    const ranked = (Object.keys(pref) as Pact[]).sort((a, b) => (pref[b] ?? 0) - (pref[a] ?? 0));
    if (ranked.length) lines.push(`${claimant.name} leans towards ${ranked.map((p) => PACT_WORD[p]).join(', then ')}.`);
  } else {
    const temper = DEBTOR_TEMPERAMENT[debtor.ruleKey] ?? DEBTOR_TEMPERAMENT.other;
    lines.push(`${debtor.name} would rather owe ${temper.priority.map((p) => PACT_WORD[p]).join(', then ')}.`);
    for (const p of temper.veto) lines.push(`${debtor.name} will never accept ${PACT_WORD[p]}, whatever the odds.`);
  }
  lines.push('Each side answers once; a refusal may come with one counteroffer.');
  return lines;
}

const PACT_WORD: Record<Pact, string> = { mercy: 'Mercy', debt: 'Debt', service: 'Service' };
