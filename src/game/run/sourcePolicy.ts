/**
 * Offline sampling only: source-run policies that reach rarely played magic
 * legally. Each is the skilled driver except that it (a) sometimes casts a
 * chosen family's spell when that is legal, and (b) evolves chosen base spells
 * into chosen branches at the ordinary between-hand or route opportunities.
 * Nothing here is ever used in play; it only decides which legal states the
 * studies see, and that selection bias is reported with the results.
 */
import { decide } from '../ai/agent';
import { knownCards } from '../ai/magic';
import { getMagicView } from '../magic/table';
import { type BaseSpellId, type SpellId, SPELLS } from '../magic/spells';
import { getLegalActions, getPublicView } from '../rules/engine';
import { Rng } from '../rules/rng';
import { humanSeat, sessionStatus } from '../table/session';
import { publicShoveRates, SKILLED, step } from './driver';
import { evolutionOffers, runCommand, runHuman, type RunState } from './run';

export interface Leaning {
  /** Families whose castable spells the source policy casts with probability `castRate`. */
  cast: BaseSpellId[];
  castRate: number;
  /** Cast only base spells (to earn Resonance), leaving rare branches to the skilled driver so samples are not used up. */
  baseOnly?: boolean;
  /** For each base spell, the branch to evolve into when an evolution is legally offered. */
  evolve: Partial<Record<BaseSpellId, SpellId>>;
}

/** One step of the leaning source policy. */
export function leaningStep(run: RunState, rng: Rng, lean: Leaning): RunState | null {
  const t = run.table;
  if (t) {
    const st = sessionStatus(t);
    if (st === 'humanToAct' || st === 'humanWindow') {
      const me = humanSeat(t);
      const magic = getMagicView(t.table, me);
      const o = magic.options.find((x) => lean.cast.includes(SPELLS[x.spell].family) && (!lean.baseOnly || SPELLS[x.spell].family === x.spell));
      if (o && rng.nextFloat() < lean.castRate) {
        const view = getPublicView(t.table.hand, me);
        const family = SPELLS[o.spell].family;
        try {
          if (family === 'cinder_challenge') {
            const legal = getLegalActions(t.table.hand);
            if (legal?.raise) {
              const a = decide(view, SKILLED, rng, knownCards(view, magic), publicShoveRates(t));
              const raiseTo = a.type === 'bet' || a.type === 'raise' ? a.to : legal.raise.minTo;
              return runHuman(run, { kind: 'cast', uid: o.uid, params: { spell: o.spell as 'cinder_challenge', raiseTo } });
            }
          } else if (family === 'briar_lock') return runHuman(run, { kind: 'cast', uid: o.uid, params: { spell: o.spell as 'briar_lock' } });
          else if (family === 'fate_exchange') return runHuman(run, { kind: 'cast', uid: o.uid, params: { spell: o.spell as 'fate_exchange', holeIndex: 0 } });
          else if (o.targets?.length) {
            if (o.spell === 'twin_oracle') return runHuman(run, { kind: 'cast', uid: o.uid, params: { spell: 'twin_oracle', targets: o.targets.slice(0, 2) } });
            return runHuman(run, { kind: 'cast', uid: o.uid, params: { spell: o.spell as 'unmask', target: o.targets[0] } });
          }
        } catch {
          /* fall through to the skilled step */
        }
      }
    }
  }
  const between = !t || sessionStatus(t) === 'handComplete';
  if (between) {
    const evo = evolutionOffers(run).find((e) => lean.evolve[e.card.spell as BaseSpellId] && (!e.needsToken || !t));
    if (evo) {
      try {
        return runCommand(run, { kind: 'evolve', uid: evo.card.uid, branch: lean.evolve[evo.card.spell as BaseSpellId]!, useToken: evo.needsToken });
      } catch {
        /* not allowed at this node */
      }
    }
  }
  return step(run, 'skilled', rng);
}
