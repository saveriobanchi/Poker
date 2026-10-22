/**
 * Player-facing wording for spells, relics and covenants: what it does for you,
 * in one or two plain sentences, plus when you can use it. The exact rules text
 * from the design data (SPELLS[id].effect, RELICS[id].effect) stays available on
 * demand; this file never changes a rule.
 */
import type { CovenantId, RelicId } from '../game/magic/relics';
import type { SpellId } from '../game/magic/spells';

export const SPELL_PLAIN: Record<SpellId, { when: string; does: string }> = {
  cinder_challenge: {
    when: 'With a raise, on your turn',
    does: 'Enchants your raise. If someone matches it and you then win the showdown outright, you gain 2 Aether; if everyone folds to it, you gain 1.',
  },
  ember_echo: {
    when: 'With a raise, on your turn',
    does: 'As Cinder Challenge. A matched showdown win also lets you draw one extra spell next hand.',
  },
  red_oath: {
    when: 'With a raise, on your turn · free',
    does: 'A free Cinder Challenge, but one of your hole cards is shown to the table. A matched win gives 1 Aether, not 2.',
  },
  unmask: {
    when: 'On your turn',
    does: 'Look at one random hole card of an opponent. Only you see it; the table sees whom you targeted.',
  },
  twin_oracle: {
    when: 'On your turn',
    does: 'Look at one random hole card of each of two opponents. Only you see them.',
  },
  ravenous_eye: {
    when: 'On your turn · once per table',
    does: "See both of an opponent's hole cards. The spell is spent for the rest of the table.",
  },
  briar_lock: {
    when: 'When a street opens, before betting',
    does: 'For this street, nobody can bet more than the pot. It protects your stack from big shoves.',
  },
  thorn_lattice: {
    when: 'When a street opens, before betting',
    does: 'Pot-limit for this street and the next one too.',
  },
  quiet_briars: {
    when: 'When a street opens, before betting',
    does: 'As Briar Lock. If nobody bets or raises on that street, your Aether is refunded.',
  },
  fate_exchange: {
    when: 'Before the preflop betting',
    does: 'Swap one of your hole cards for a random card from the deck. Nobody else learns either card.',
  },
  second_reflection: {
    when: 'Before the preflop betting',
    does: 'Draw two candidate cards and keep the one you like, replacing one of your hole cards. Your choice stays private.',
  },
  marked_fate: {
    when: 'Before the preflop betting',
    does: 'A cheap Fate Exchange, but the table hears the rank of the card you threw away.',
  },
};

export const RELIC_PLAIN: Record<RelicId, string> = {
  ashen_signet: 'Once per table: win a contested showdown after raising preflop and gain 1 Aether.',
  veiled_monocle: 'Your first Unmask-family spell at each table costs 1 Aether less.',
  thorn_anchor: 'Your first Briar-family spell at each table costs 1 Aether less.',
  lantern_reservoir: 'You start every table with 1 extra Aether (never above 3).',
  mirror_prism: 'Your first Fate Exchange-family spell at each table costs 1 Aether less.',
  gambler_knot: 'Once per table: fold to a bet and gain 1 Aether.',
  fateweavers_sigil: 'Once per table, before any spell window: send one drawn spell to the bottom and draw another.',
};

export const COVENANT_PLAIN: Record<CovenantId, string> = {
  covenant_open_book: 'Every hand you gain 1 Aether, but one of your hole cards is shown to the whole table.',
};
