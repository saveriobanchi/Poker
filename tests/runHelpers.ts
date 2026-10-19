import { step, type PolicyName } from '../src/game/run/driver';
import type { RunState } from '../src/game/run/run';
import { Rng } from '../src/game/rules';
import { applyClaim, applyHumanCommand, createDefaultSession, sessionStatus, startNextHand, stepAi, type TableSession } from '../src/game/table/session';
import { currentClaim, pactOptions } from '../src/game/world';

/** Advances a run with `policy` until `pred` holds (or the run ends). */
export function until(run: RunState, pred: (r: RunState) => boolean, policy: PolicyName = 'skilled', seed = 1): RunState {
  const rng = new Rng(seed);
  for (let i = 0; i < 60_000 && !pred(run); i++) {
    const next = step(run, policy, rng);
    if (!next) break;
    run = next;
  }
  return run;
}

/** Drives P3 free tables until the player survives a Last Claim (preferring service), as a P3 save would hold. */
export function p3Fallen(prefer: 'service' | 'debt' | 'mercy' = 'service', from = 1): TableSession | null {
  for (let seed = from; seed < from + 200; seed++) {
    let s = createDefaultSession(seed);
    for (let guard = 0; guard < 20_000; guard++) {
      const st = sessionStatus(s);
      if (st === 'fallen') return s;
      if (st === 'dead' || st === 'tableWon') break;
      if (st === 'aiToAct') s = stepAi(s);
      else if (st === 'humanWindow') s = applyHumanCommand(s, { kind: 'pass' });
      else if (st === 'humanToAct') s = applyHumanCommand(s, { kind: 'act', action: { type: 'allIn' } });
      else if (st === 'humanClaim') {
        const claim = currentClaim(s.claims!)!;
        if (claim.stage === 'counter') s = applyClaim(s, { kind: 'answerCounter', accept: true });
        else {
          const usable = pactOptions(s.claims!, s.world).filter((o) => !o.blocker);
          if (s.world.characters[claim.debtor].kind !== 'human') s = applyClaim(s, { kind: 'claimLife' });
          else if (!usable.length) break;
          else s = applyClaim(s, { kind: 'propose', pact: usable.find((o) => o.pact === prefer)?.pact ?? usable[0].pact });
        }
      } else if (st === 'claimResolved') s = applyClaim(s, { kind: 'acknowledge' });
      else if (st === 'handComplete') s = startNextHand(s);
      else break;
    }
  }
  return null;
}
