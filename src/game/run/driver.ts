/**
 * Headless run driver: plays a whole P4 slice with a scripted player policy.
 * Used by tests and by scripts/simulate-runs.ts (design v0.6 acceptance:
 * 1,000 seeded runs across contrasting skill policies).
 */
import { decideChoice, decideOpening, decideTurn } from '../ai/magic';
import { preflopPercentile } from '../ai/preflop';
import { shovePrior, shoveRate } from '../ai/reads';
import { type AiProfile, PROFILES } from '../ai/profiles';
import { getMagicView, isBaseSpell, SLOT_LIMITS } from '../magic';
import { getLegalActions, getPublicView, type PlayerAction } from '../rules/engine';
import { Rng } from '../rules/rng';
import { humanSeat, sessionStatus } from '../table/session';
import { currentClaim, pactOptions, roles } from '../world';
import {
  attuneOptions,
  ENDINGS,
  mirrorCandidates,
  mirrorChoice,
  evolutionOffers,
  playerChips,
  runAi,
  runClaim,
  type RunCommand,
  runCommand,
  runHuman,
  runNextHand,
  type RunState,
} from './run';

export type PolicyName = 'skilled' | 'passive' | 'maniac' | 'tight';
export const POLICIES: PolicyName[] = ['skilled', 'passive', 'maniac', 'tight'];

/** The skilled policy plays like a disciplined, magic-using rival. */
const SKILLED: AiProfile = { ...PROFILES.corvin, id: 'skilled', looseness: 0.35, aggression: 0.6, bluff: 0.08, stickiness: 0.35 };

function pokerAction(run: RunState, policy: PolicyName, rng: Rng): PlayerAction {
  const t = run.table!;
  const me = humanSeat(t);
  const legal = getLegalActions(t.table.hand)!;
  const free: PlayerAction = legal.canCheck ? { type: 'check' } : { type: 'fold' };
  switch (policy) {
    case 'passive':
      return legal.canCheck ? { type: 'check' } : { type: 'call' };
    case 'maniac':
      return legal.raise ? { type: 'allIn' } : legal.canCheck ? { type: 'check' } : { type: 'call' };
    case 'tight': {
      const hole = t.table.hand.seats[me].hole;
      const strong = preflopPercentile(hole[0], hole[1]) > 0.85;
      return strong ? (legal.canCheck ? { type: 'check' } : { type: 'call' }) : free;
    }
    case 'skilled':
      throw new Error('skilled uses the magic-aware path');
  }
  return free;
  void rng;
}

/** One step of the run under `policy`. Returns null when the run has ended. */
export function step(run: RunState, policy: PolicyName, rng: Rng): RunState | null {
  if (ENDINGS.includes(run.node)) return null;
  const t = run.table;
  if (t) {
    const status = sessionStatus(t);
    const me = humanSeat(t);
    switch (status) {
      case 'aiToAct':
        return runAi(run);
      case 'humanChoice':
        return runHuman(run, { kind: 'choose', pick: decideChoice(getPublicView(t.table.hand, me), getMagicView(t.table, me)) });
      case 'humanWindow': {
        if (policy !== 'skilled') return runHuman(run, { kind: 'pass' });
        const c = decideOpening(getPublicView(t.table.hand, me), getMagicView(t.table, me), SKILLED, rng);
        return runHuman(run, c.kind === 'pass' ? { kind: 'pass' } : { kind: 'cast', uid: c.uid, params: c.params });
      }
      case 'humanToAct': {
        if (policy !== 'skilled') return runHuman(run, { kind: 'act', action: pokerAction(run, policy, rng) });
        const reads = t.reads ?? {};
        const rates = t.seats.map((s) => shoveRate(reads[s.id], shovePrior(s.profileId ? PROFILES[s.profileId] : undefined)));
        const c = decideTurn(getPublicView(t.table.hand, me), getMagicView(t.table, me), SKILLED, rng, rates);
        return runHuman(run, c.kind === 'act' ? { kind: 'act', action: c.action } : { kind: 'cast', uid: c.uid, params: c.params });
      }
      case 'humanClaim': {
        const claim = currentClaim(t.claims!)!;
        if (claim.stage === 'counter') return runClaim(run, { kind: 'answerCounter', accept: true });
        const usable = pactOptions(t.claims!, t.world).filter((o) => !o.blocker);
        const debtor = roles(t.world, claim).proposer === 'debtor';
        if (!usable.length) return runClaim(run, { kind: debtor ? 'acceptFate' : 'claimLife' });
        // Debtors plead for the best outlook; claimants grant mercy (skilled) or claim the life.
        if (!debtor && policy !== 'skilled') return runClaim(run, { kind: 'claimLife' });
        const rank = { HIGH: 0, FAIR: 1, LOW: 2 } as const;
        const best = [...usable].sort((a, b) => rank[a.outlook!] - rank[b.outlook!])[0];
        return runClaim(run, { kind: 'propose', pact: debtor ? best.pact : 'mercy' });
      }
      case 'claimResolved':
        return runClaim(run, { kind: 'acknowledge' });
      case 'handComplete': {
        const att = attuneOptions(run)[0];
        if (att) return runCommand(run, { kind: 'attune', uid: att.uid });
        const evo = evolutionOffers(run).find((o) => !o.needsToken);
        if (evo) return runCommand(run, { kind: 'evolve', uid: evo.card.uid, branch: evo.branches[0] });
        return runNextHand(run);
      }
      default:
        return runCommand(run, { kind: 'advance' });
    }
  }
  return runCommand(run, routeChoice(run, policy));
}

function routeChoice(run: RunState, policy: PolicyName): RunCommand {
  switch (run.node) {
    case 'lantern_shop': {
      const chips = playerChips(run);
      const affordable = run.shop!.offers.findIndex((o) => !o.sold && chips - o.price >= 40);
      if (policy === 'skilled' && affordable >= 0) return { kind: 'buy', offer: affordable };
      return { kind: 'leaveShop', to: policy === 'skilled' && !run.eventResolved ? 'optional_event' : 'contract_2' };
    }
    case 'velvet_exchange': {
      const chips = playerChips(run);
      const affordable = run.shop!.offers.findIndex((o) => !o.sold && chips - o.price >= 60 && (run.player.magic.relics ?? []).length < SLOT_LIMITS.relics);
      if (policy === 'skilled' && affordable >= 0) return { kind: 'buy', offer: affordable };
      return { kind: 'leaveShop', to: policy === 'skilled' ? 'mirror_audience' : 'secret_bargain' };
    }
    case 'mirror_audience': {
      if (mirrorChoice(run)) return { kind: 'advance' };
      const rival = mirrorCandidates(run)[0];
      return rival ? { kind: 'event', take: true, rival } : { kind: 'event', take: false };
    }
    case 'secret_bargain':
      return { kind: 'event', take: policy === 'maniac' };
    case 'act2_petition':
      return { kind: 'petition', choice: 'favor' };
    case 'optional_event':
      return { kind: 'event', take: playerChips(run) >= 60 };
    case 'reward': {
      const offers = evolutionOffers(run);
      if (offers.length && policy === 'skilled') {
        const token = run.reward!.findIndex((r) => r.kind === 'evolution_token');
        if (token >= 0) return { kind: 'reward', index: token };
      }
      const full = (run.player.magic.relics ?? []).length >= SLOT_LIMITS.relics;
      return { kind: 'reward', index: 0, replace: full && run.reward![0].kind === 'relic' ? run.player.magic.relics![0] : undefined };
    }
    case 'setback_audience':
      return { kind: 'setback', choice: 'public_record' };
    default: {
      const att = attuneOptions(run)[0];
      if (att) return { kind: 'attune', uid: att.uid };
      const evo = evolutionOffers(run)[0];
      if (evo && isBaseSpell(evo.card.spell)) return { kind: 'evolve', uid: evo.card.uid, branch: evo.branches[1], useToken: evo.needsToken };
      return { kind: 'advance' };
    }
  }
}

/** Plays a run to its ending (bounded), returning the final state. */
export function playRun(run: RunState, policy: PolicyName, seed: number, maxSteps = 50_000): RunState {
  const rng = new Rng(seed);
  for (let i = 0; i < maxSteps; i++) {
    const next = step(run, policy, rng);
    if (!next) return run;
    run = next;
  }
  throw new Error(`Run did not finish within ${maxSteps} steps (stuck at ${run.node})`);
}
