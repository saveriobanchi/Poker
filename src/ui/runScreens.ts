/**
 * DOM screens for the P4 run between tables: the route trail, Selene's shop,
 * Mirror's Petition, rewards, the Keeper's Audit, spell evolution, the Fallen
 * route and the endings (art bible v0.3 P4: vector/DOM first, text never baked
 * into art). Every button maps to exactly one RunCommand.
 */
import { allCards, type SpellCard } from '../game/magic/spellbook';
import { COVENANTS, type RelicId, RELICS, SLOT_LIMITS } from '../game/magic/relics';
import { type BaseSpellId, EVOLUTIONS, isBaseSpell, SPELLS, type SpellId } from '../game/magic/spells';
import { PROFILES } from '../game/ai/profiles';
import {
  activeDuty,
  ACT2_LEDGER,
  attuneOptions,
  BROKER_ID,
  brokerPrice,
  CINDER_LEDGER,
  DUTIES,
  evolutionOffers,
  mirrorCandidates,
  mirrorChoice,
  PETITION_FAVOR_FLOOR,
  playerIsFree,
  OPEN_BOOK_FEE,
  PLAYER_ID,
  playerBook,
  playerChips,
  RETHREAD_PRICE,
  type NodeId,
  type RunCommand,
  type RunState,
  TABLE_NODES,
} from '../game/run/run';
import { DISCIPLINE_COLOR, DISCIPLINE_GLYPH } from './theme';

export interface ScreenHandlers {
  command(cmd: RunCommand): void;
  newRun(): void;
  continueFallen(): void;
  /** Re-renders after a purely local UI choice (no game state change). */
  rerender(): void;
}

type Child = Node | string | null | false | undefined;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== false && c !== undefined) e.append(c);
  return e;
}

function btn(label: string, onClick: () => void, cls = '', disabled = false): HTMLButtonElement {
  const b = h('button', { type: 'button', class: cls }, label);
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

const MAIN_TRAIL: { id: NodeId; label: string; short: string }[] = [
  { id: 'start', label: 'Wagerer’s Arrival', short: 'Arrival' },
  { id: 'contract_1', label: 'The Ash Table', short: 'Ash Table' },
  { id: 'lantern_shop', label: 'Selene’s Lantern', short: 'Lantern' },
  { id: 'optional_event', label: 'Mirror’s Petition', short: 'Petition' },
  { id: 'contract_2', label: 'The Lantern Circuit', short: 'Circuit' },
  { id: 'boss_ledger', label: 'The Bailiff’s Ledger', short: 'Ledger' },
];
const FALLEN_TRAIL: { id: NodeId; label: string; short: string }[] = [
  { id: 'fallen_registry', label: 'The Registry Below', short: 'Registry' },
  { id: 'fallen_low_table', label: 'The Coal Table', short: 'Coal' },
  { id: 'fallen_audience', label: 'Audience of the Bound', short: 'Audience' },
  { id: 'cinder_broker', label: 'The Broker Understairs', short: 'Broker' },
  { id: 'cinder_low_table', label: 'The Ember Steps', short: 'Ember' },
  { id: 'oath_hearing', label: 'The Oathbreaker Hearing', short: 'Hearing' },
];
const ACT2_TRAIL: { id: NodeId; label: string; short: string }[] = [
  { id: 'gilded_gate', label: 'The Gilded Gate', short: 'Gate' },
  { id: 'masked_salon', label: 'The Masked Salon', short: 'Salon' },
  { id: 'velvet_exchange', label: 'The Velvet Exchange', short: 'Exchange' },
  { id: 'mirror_audience', label: 'Court or Contract', short: 'Court' },
  { id: 'velvet_arena', label: 'The Velvet Arena', short: 'Arena' },
  { id: 'crown_inquest', label: 'The Crown Inquest', short: 'Inquest' },
];

const ACT2_NODES = new Set<NodeId>(['act2_petition', 'act2_victory', 'act2_living_exile', ...ACT2_TRAIL.map((n) => n.id), 'secret_bargain']);
const FALLEN_NODES = new Set<NodeId>(['fallen_unlocked', 'undercircuit_entry', ...FALLEN_TRAIL.map((n) => n.id)]);
/** Screens that share a trail slot with another node. */
const SLOT_ALIAS: Partial<Record<NodeId, NodeId>> = { secret_bargain: 'mirror_audience', act2_petition: 'gilded_gate', fallen_unlocked: 'fallen_audience', undercircuit_entry: 'oath_hearing' };


/** Node the trail should highlight: result/reward/audit screens belong to the table just played. */
function trailPosition(run: RunState): NodeId {
  const at = run.node === 'table_result' || run.node === 'reward' || run.node === 'setback_audience' ? (run.results.at(-1)?.node ?? run.node) : run.node;
  return SLOT_ALIAS[at] ?? at;
}

function trailFor(run: RunState) {
  const at = trailPosition(run);
  if (ACT2_NODES.has(at) || ACT2_NODES.has(run.node)) return ACT2_TRAIL;
  if (FALLEN_NODES.has(at) || FALLEN_NODES.has(run.node)) return FALLEN_TRAIL;
  return MAIN_TRAIL;
}

function trail(run: RunState): HTMLElement {
  const nodes = trailFor(run);
  const at = trailPosition(run);
  const idx = nodes.findIndex((n) => n.id === at);
  const ended = ['slice_victory', 'slice_exile', 'fallen_unlocked', 'act2_victory', 'act2_living_exile', 'undercircuit_entry', 'death'].includes(run.node);
  const played = new Set<NodeId>(run.results.map((r) => r.node as NodeId));
  const outcome = new Map<NodeId, string>(run.results.map((r) => [r.node, r.outcome]));
  const list = h('ol', { class: 'trail', 'aria-label': 'Route' });
  nodes.forEach((n, i) => {
    let state = i < idx || (ended && i <= idx) ? 'done' : i === idx ? 'here' : 'ahead';
    if (n.id === 'optional_event' && run.eventResolved === false && idx > i) state = 'skipped';
    if (n.id === 'start' && idx === -1 && ended) state = 'done';
    const o = outcome.get(n.id);
    const table = n.id in TABLE_NODES;
    const mark = o === 'win' ? '✓' : o === 'alive_failure' ? '✗' : o === 'fallen' ? '☾' : o === 'dead' ? '✝' : table ? '♠' : '◆';
    list.append(
      h(
        'li',
        { class: `trail-node ${state}${played.has(n.id) ? ' played' : ''}`, 'aria-current': state === 'here' ? 'step' : 'false' },
        h('span', { class: 'trail-dot' }, mark),
        h('span', { class: 'trail-label' }, n.short),
      ),
    );
  });
  return list;
}

function purse(run: RunState): HTMLElement {
  const you = run.characters[PLAYER_ID];
  const r = you.reputation;
  const relics = run.player.magic.relics ?? [];
  const covenants = run.player.magic.covenants ?? [];
  return h(
    'div',
    { class: 'purse' },
    h('div', { class: 'purse-chips' }, h('img', { src: 'assets/lifechip.png', alt: '' }), h('strong', {}, String(playerChips(run))), ' Lifechips'),
    h('div', { class: 'purse-rep' }, `Honor ${r.honor} · Dread ${r.dread} · Favor ${r.favor}${r.notoriety ? ` · Notoriety ${r.notoriety}` : ''}${run.characters[PLAYER_ID].socialRank === 'FALLEN' ? ' · Fallen' : run.characters[PLAYER_ID].socialRank === 'UNBOUND_FALLEN' ? ' · Unbound Fallen' : ''}`),
    h(
      'div',
      { class: 'purse-items' },
      ...relics.map((id) => h('span', { class: 'relic', title: RELICS[id].effect }, `◈ ${RELICS[id].name}`)),
      ...covenants.map((id) => h('span', { class: 'relic covenant', title: COVENANTS[id].effect }, `✠ ${COVENANTS[id].name}`)),
      run.player.evolutionTokens ? h('span', { class: 'relic token' }, `✦ Evolution token ×${run.player.evolutionTokens}`) : null,
      !relics.length && !covenants.length && !run.player.evolutionTokens ? h('span', { class: 'muted' }, `No relics yet · ${SLOT_LIMITS.relics} slots`) : null,
    ),
  );
}

function resonancePips(card: SpellCard): HTMLElement {
  const r = card.resonance ?? 0;
  if (!isBaseSpell(card.spell)) return h('span', { class: 'res evolved' }, 'evolved');
  const t = EVOLUTIONS[card.spell].threshold;
  return h('span', { class: 'res', 'aria-label': `Resonance ${r} of ${t}` }, '●'.repeat(Math.min(r, t)) + '○'.repeat(Math.max(0, t - r)));
}

function spellChip(spell: SpellId, extra?: Child): HTMLElement {
  const def = SPELLS[spell];
  const chip = h('span', { class: 'spell-chip', title: def.effect }, `${DISCIPLINE_GLYPH[def.discipline]} ${def.name}`, extra);
  chip.style.setProperty('--disc', DISCIPLINE_COLOR[def.discipline]);
  return chip;
}

/** The player's eight owned instances with Resonance. */
export function spellbookPanel(run: RunState): HTMLElement {
  const cards = allCards(playerBook(run));
  return h(
    'details',
    { class: 'book' },
    h('summary', {}, `Spellbook · ${cards.length} spells`),
    h('div', { class: 'book-grid' }, ...cards.map((c) => spellChip(c.spell, resonancePips(c)))),
  );
}

/** Branch evolution choices for every qualified instance (between hands or on the route). */
export function evolutionPanel(run: RunState, cb: ScreenHandlers): HTMLElement | null {
  const offers = evolutionOffers(run);
  if (!offers.length) return null;
  const seen = new Set<string>();
  const unique = offers.filter((o) => {
    const key = `${o.card.spell}:${o.needsToken}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return h(
    'section',
    { class: 'evolve' },
    h('h3', {}, '✦ A spell is ready to evolve'),
    h('p', { class: 'note' }, 'Evolution replaces this one instance; its Resonance resets. You may also wait.'),
    ...unique.map((o) =>
      h(
        'div',
        { class: 'evolve-row' },
        h('div', { class: 'evolve-from' }, spellChip(o.card.spell, resonancePips(o.card)), o.needsToken ? h('span', { class: 'muted' }, ' uses a token') : null),
        h(
          'div',
          { class: 'branches' },
          ...o.branches.map((b) => {
            const def = SPELLS[b];
            const card = h(
              'button',
              { type: 'button', class: 'branch' },
              h('span', { class: 'branch-name' }, `${DISCIPLINE_GLYPH[def.discipline]} ${def.name}`),
              h('span', { class: 'branch-cost' }, '◆'.repeat(def.cost)),
              h('span', { class: 'branch-text' }, def.effect),
            );
            card.style.setProperty('--disc', DISCIPLINE_COLOR[def.discipline]);
            card.addEventListener('click', () => cb.command({ kind: 'evolve', uid: o.card.uid, branch: b, useToken: o.needsToken }));
            return card;
          }),
        ),
      ),
    ),
  );
}

/** An evolution token with no qualified spell attunes one unevolved instance instead (design v0.7 §04). */
export function attunePanel(run: RunState, cb: ScreenHandlers): HTMLElement | null {
  const options = attuneOptions(run);
  if (!options.length) return null;
  return h(
    'section',
    { class: 'evolve' },
    h('h3', {}, '✦ Spend your evolution token'),
    h('p', { class: 'note' }, 'No spell has Resonance yet, so the token attunes one instead: +1 Resonance, no evolution this time.'),
    h('div', { class: 'choice-row' }, ...uniqueBySpell(options).map((c) => btn(SPELLS[c.spell].name, () => cb.command({ kind: 'attune', uid: c.uid }), 'small'))),
  );
}

function screen(run: RunState, title: string, ...body: Child[]): HTMLElement {
  return h('div', { class: 'screen-inner' }, trail(run), h('h2', {}, title), purse(run), ...body, attunePanel(run, currentHandlers));
}

let rethreadUid: string | null = null;
let replaceRelic: RelicId | null = null;
/** Handlers of the screen being rendered (set by renderRunScreen). */
let currentHandlers: ScreenHandlers;

function shop(run: RunState, cb: ScreenHandlers): HTMLElement {
  const s = run.shop!;
  const chips = playerChips(run);
  const relics = run.player.magic.relics ?? [];
  const offers = s.offers.map((o, i) => {
    const def = RELICS[o.relic];
    const owned = relics.includes(o.relic);
    return h(
      'div',
      { class: `offer${o.sold ? ' sold' : ''}` },
      h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, `◈ ${def.name}`), h('span', { class: 'price' }, `${o.price}`)),
      h('p', { class: 'offer-text' }, def.effect),
      o.sold
        ? h('span', { class: 'muted' }, 'Sold')
        : h('div', { class: 'offer-foot' }, h('span', { class: 'muted' }, `You would keep ${chips - o.price}`), btn('Buy', () => cb.command({ kind: 'buy', offer: i }), 'primary small', owned)),
    );
  });
  const base = allCards(playerBook(run)).filter((c) => isBaseSpell(c.spell));
  let rethread: HTMLElement;
  if (s.rethreadSold) rethread = h('p', { class: 'muted' }, 'Spell Rethread: sold.');
  else if (rethreadUid && base.some((c) => c.uid === rethreadUid)) {
    const card = base.find((c) => c.uid === rethreadUid)!;
    const others = (Object.keys(EVOLUTIONS) as BaseSpellId[]).filter((x) => x !== card.spell);
    rethread = h(
      'div',
      { class: 'rethread' },
      h('p', {}, `Rethread ${SPELLS[card.spell].name} into…`),
      h('div', { class: 'choice-row' }, ...others.map((x) => btn(SPELLS[x].name, () => ((rethreadUid = null), cb.command({ kind: 'rethread', uid: card.uid, spell: x })), 'small')), btn('Cancel', () => ((rethreadUid = null), cb.rerender()), 'small ghost')),
    );
  } else {
    rethread = h(
      'div',
      { class: 'rethread' },
      h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, '⟲ Spell Rethread'), h('span', { class: 'price' }, String(RETHREAD_PRICE))),
      h('p', { class: 'offer-text' }, 'Replace one owned base spell with a different starter spell. Its Resonance resets.'),
      h('div', { class: 'choice-row' }, ...uniqueBySpell(base).map((c) => btn(SPELLS[c.spell].name, () => ((rethreadUid = c.uid), cb.rerender()), 'small'))),
    );
  }
  const velvet = s.id === 'velvet_exchange';
  const exits = velvet
    ? h(
        'div',
        { class: 'actions' },
        btn('Visit the Court of Mirrors', () => cb.command({ kind: 'leaveShop', to: 'mirror_audience' }), 'primary'),
        btn('Hear the Whispered Contract', () => cb.command({ kind: 'leaveShop', to: 'secret_bargain' })),
      )
    : h(
        'div',
        { class: 'actions' },
        run.eventResolved ? null : btn('Hear the Mirror’s Petition', () => cb.command({ kind: 'leaveShop', to: 'optional_event' })),
        btn(`Go to ${TABLE_NODES.contract_2.label}`, () => cb.command({ kind: 'leaveShop', to: 'contract_2' }), 'primary'),
      );
  return screen(
    run,
    velvet ? 'The Velvet Exchange' : 'Selene’s Lantern',
    h(
      'p',
      { class: 'lede' },
      velvet
        ? `Elin of the Velvet Exchange keeps ${run.accounts[s.merchant]} Lifechips, newly arrived from the outer Ledger. Every price is a real transfer.`
        : `Selene of the Lantern Market keeps ${run.accounts.selene} Lifechips in her strongbox. Every price is a real transfer.`,
    ),
    h('div', { class: 'offers' }, ...offers),
    rethread,
    evolutionPanel(run, cb),
    spellbookPanel(run),
    exits,
  );
}

function uniqueBySpell(cards: SpellCard[]): SpellCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => (seen.has(c.spell) ? false : (seen.add(c.spell), true)));
}

function standingsTable(run: RunState): HTMLElement {
  const r = run.results.at(-1)!;
  return h(
    'table',
    { class: 'standings' },
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Entrant'), h('th', {}, 'Lifechips'))),
    h(
      'tbody',
      {},
      ...[...r.standings]
        .sort((a, b) => a.rank - b.rank)
        .map((s) =>
          h(
            'tr',
            { class: s.id === PLAYER_ID ? 'me' : '' },
            h('td', {}, String(s.rank)),
            h('td', {}, s.name, s.status === 'dead' ? ' ✝' : s.status === 'exited' ? ' ☾' : ''),
            h('td', {}, String(s.stack)),
          ),
        ),
    ),
  );
}

const OUTCOME_TEXT: Record<string, string> = {
  win: 'Contract fulfilled.',
  alive_failure: 'You live, but the contract is lost.',
  fallen: 'You survived your Last Claim and left the table as one of the Fallen.',
  dead: 'The Ledger closed your account.',
};

function dutyLines(run: RunState): HTMLElement | null {
  if (!run.duties) return null;
  const giver = run.characters[run.duties.giver]?.name ?? run.duties.giver;
  const mine = DUTIES.filter((d) => d.giver === run.duties!.giver);
  const active = activeDuty(run);
  return h(
    'section',
    { class: 'duties' },
    h('h3', {}, `Sworn service to ${giver}`),
    h(
      'ol',
      {},
      ...mine.map((d) =>
        h('li', { class: run.duties!.completed.includes(d.id) ? 'done' : d.id === active?.id ? 'active' : '' }, run.duties!.completed.includes(d.id) ? '✓ ' : d.id === active?.id ? '▸ ' : '', d.text),
      ),
    ),
  );
}

function debtLines(run: RunState): HTMLElement | null {
  const debts = run.contracts.filter((k) => k.debtor === PLAYER_ID && k.pact === 'debt');
  if (!debts.length) return null;
  return h(
    'section',
    { class: 'duties' },
    h('h3', {}, 'Debts'),
    ...debts.map((k) => {
      const who = k.creditor === 'ledger' ? 'the Ledger' : run.characters[k.creditor]?.name ?? k.creditor;
      return h('p', {}, `${who}: ${k.repaid} of ${k.obligation} repaid · ${k.status}. Repayments come only from positive-net tables.`);
    }),
  );
}

function covenantRecord(run: RunState): HTMLElement | null {
  const k = [...run.contracts].reverse().find((c) => c.debtor === PLAYER_ID);
  if (!k) return null;
  const who = k.creditor === 'ledger' ? 'the Ledger’s relief treasury' : run.characters[k.creditor]?.name ?? k.creditor;
  const pact = k.pact === 'mercy' ? 'Mercy' : k.pact === 'debt' ? 'Debt' : 'Sworn Service';
  return h(
    'section',
    { class: 'record' },
    h('h3', {}, 'Recorded covenant'),
    h('p', {}, `${pact}, granted by ${who}. Endowment ${k.principal} Lifechips${k.pact === 'debt' ? `, ${k.obligation} owed` : ''}${k.pact === 'service' ? `, ${k.servicesOwed} duties owed` : ''}.`),
  );
}

/** Act I chapter ends: a summary, then the story continues. */
const CHAPTER_TEXT: Record<string, [string, string[], string]> = {
  slice_victory: ['The Ledger Opens', ['You took the Bailiff’s Ledger. Act One is cleared and your survivor keeps every Lifechip won.', 'A published invitation awaits you at the Gilded Gate: Favor +1, no chips.'], 'Accept the invitation'],
  slice_exile: ['Exiled from the Circuit', ['You survived the Bailiff’s Ledger but did not take it. You leave the Circuit alive, with every Lifechip you still hold.', 'The Gilded Circuit can still be entered — by petition.'], 'Petition the Ledger'],
  fallen_unlocked: ['The Fallen Road Opens', ['You survived the Coal Table and stood before the Audience of the Bound.', 'The Cinder road goes on, down the stairs to the Broker Understairs.'], 'Take the stairs down'],
};

const ENDING_TEXT: Record<string, [string, string[]]> = {
  act2_victory: ['A Crown of Brass', ['You won the Crown Inquest. Act Two is cleared; your Wagerer is preserved with every Lifechip, debt and favor they hold.']],
  act2_living_exile: ['The Mask Falls', ['You leave the Gilded Circuit alive but unhonored. Your Wagerer is preserved with every Lifechip they still hold.']],
  undercircuit_entry: ['The Undercircuit', ['Still bound by your covenant, you descend into the Undercircuit with your obligations intact.', 'The low-tier road below opens in a later expansion. No Lifechips are given and no prestige returns on its own.']],
  death: ['The Run Has Ended', ['The Ledger closed your account. Death concludes this character’s story; a new Wagerer may take up the cards.']],
};

function mirrorReport(run: RunState, id: string): HTMLElement {
  const o = run.observed[id];
  const pct = (k: number) => `${Math.round((100 * k) / Math.max(1, o.hands))}%`;
  return h(
    'section',
    { class: 'record' },
    h('h3', {}, `The reflection of ${run.characters[id].name}`),
    h('p', {}, `Over ${o.hands} hands you watched: played ${pct(o.vpip)} of hands, raised first ${pct(o.pfr)}, shoved ${o.shoves} time${o.shoves === 1 ? '' : 's'}.`),
    h('p', {}, PROFILES[id] ? `The Court calls them “${PROFILES[id].title.toLowerCase()}”.` : ''),
  );
}

/** Renders the screen for the run's current (non-table) node. */
export function renderRunScreen(root: HTMLElement, run: RunState, cb: ScreenHandlers): void {
  currentHandlers = cb;
  let content: HTMLElement;
  switch (run.node) {
    case 'start':
      content = screen(
        run,
        'Wagerer’s Arrival',
        h('p', { class: 'lede' }, 'You arrive in the Lantern district with 100 Lifechips and a beginner’s Spellbook. Three tables stand between you and the Ledger. Chips are life: lose them all and a Last Claim decides your fate.'),
        h('ol', { class: 'plan' }, h('li', {}, 'The Ash Table — finish in the top two within 8 hands.'), h('li', {}, 'Selene’s Lantern — relics for real Lifechips.'), h('li', {}, 'The Lantern Circuit — top two within 8 hands.'), h('li', {}, 'The Bailiff’s Ledger — first after 12 hands, or second with a real profit.')),
        spellbookPanel(run),
        h('div', { class: 'actions' }, btn(`Sit at ${TABLE_NODES.contract_1.label}`, () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    case 'table_result': {
      const r = run.results.at(-1)!;
      content = screen(
        run,
        TABLE_NODES[r.node].label,
        h('p', { class: `lede outcome-${r.outcome}` }, OUTCOME_TEXT[r.outcome]),
        standingsTable(run),
        h('p', { class: 'muted' }, `${r.hands} hands · net ${r.net >= 0 ? '+' : ''}${r.net} Lifechips${r.repayment ? ` · ${r.repayment} repaid to your creditor` : ''}`),
        dutyLines(run),
        evolutionPanel(run, cb),
        h('div', { class: 'actions' }, btn('Continue', () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'reward': {
      const owned = run.player.magic.relics ?? [];
      const full = owned.length >= SLOT_LIMITS.relics;
      content = screen(
        run,
        'Spoils of the Contract',
        h('p', { class: 'lede' }, 'Choose one. Rewards never mint Lifechips.'),
        full
          ? h(
              'section',
              { class: 'record' },
              h('h3', {}, 'Your relic slots are full'),
              h('p', {}, 'To take a relic, choose one to give up first. It is lost, not sold.'),
              h('div', { class: 'choice-row' }, ...owned.map((r) => btn(`${replaceRelic === r ? '✓ ' : ''}${RELICS[r].name}`, () => ((replaceRelic = r), cb.rerender()), 'small'))),
            )
          : null,
        h(
          'div',
          { class: 'offers' },
          ...run.reward!.map((o, i) =>
            o.kind === 'relic'
              ? h('button', { type: 'button', class: 'offer pick', 'data-i': String(i) }, h('span', { class: 'offer-name' }, `◈ ${RELICS[o.relic].name}`), h('span', { class: 'offer-text' }, RELICS[o.relic].effect))
              : h('button', { type: 'button', class: 'offer pick', 'data-i': String(i) }, h('span', { class: 'offer-name' }, '✦ Evolution token'), h('span', { class: 'offer-text' }, 'Evolve one base spell that has at least 1 Resonance early; if none has any, attune one (+1 Resonance) instead.')),
          ),
        ),
        spellbookPanel(run),
        h('div', { class: 'actions' }, btn('Take nothing', () => cb.command({ kind: 'reward', index: null }))),
      );
      content.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) => {
        const i = Number(b.dataset.i);
        if (full && run.reward![i].kind === 'relic' && !replaceRelic) b.disabled = true;
        b.addEventListener('click', () => {
          const replace = full && run.reward![i].kind === 'relic' ? replaceRelic ?? undefined : undefined;
          replaceRelic = null;
          cb.command({ kind: 'reward', index: i, replace });
        });
      });
      break;
    }
    case 'lantern_shop':
    case 'velvet_exchange':
      content = shop(run, cb);
      break;
    case 'slice_victory':
    case 'slice_exile':
    case 'fallen_unlocked': {
      const [title, lines, go] = CHAPTER_TEXT[run.node];
      content = screen(
        run,
        title,
        ...lines.map((l) => h('p', { class: 'lede' }, l)),
        h('ol', { class: 'plan' }, ...run.results.map((r) => h('li', {}, `${TABLE_NODES[r.node].label}: ${r.outcome.replace('_', ' ')} (${r.net >= 0 ? '+' : ''}${r.net})`))),
        debtLines(run),
        h('div', { class: 'actions' }, btn(go, () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'act2_petition': {
      const relics = run.player.magic.relics ?? [];
      const favor = run.characters[PLAYER_ID].reputation.favor;
      content = screen(
        run,
        'A Petition to the Ledger',
        h('p', { class: 'lede' }, 'An exile may still enter the Gilded Circuit, but the Ledger wants a price that is not paid in Lifechips.'),
        h(
          'div',
          { class: 'offers' },
          h('button', { type: 'button', class: 'offer pick', id: 'pet-favor' }, h('span', { class: 'offer-name' }, 'Spend your standing'), h('span', { class: 'offer-text' }, `Favor ${favor} → ${Math.max(PETITION_FAVOR_FLOOR, favor - 1)} (never below ${PETITION_FAVOR_FLOOR}).`)),
          ...relics.map((r) => h('button', { type: 'button', class: 'offer pick', 'data-relic': r }, h('span', { class: 'offer-name' }, `Surrender ${RELICS[r].name}`), h('span', { class: 'offer-text' }, 'The relic is taken; nothing is paid for it.'))),
        ),
      );
      content.querySelector('#pet-favor')!.addEventListener('click', () => cb.command({ kind: 'petition', choice: 'favor' }));
      content.querySelectorAll<HTMLButtonElement>('[data-relic]').forEach((b) => b.addEventListener('click', () => cb.command({ kind: 'petition', choice: 'relic', relic: b.dataset.relic as RelicId })));
      break;
    }
    case 'gilded_gate': {
      const ingress = run.perimeter.expansions.find((e) => e.account === ACT2_LEDGER);
      content = screen(
        run,
        'The Gilded Gate',
        h('p', { class: 'lede' }, 'Beyond the gate the Circuit glitters: masked salons, velvet arenas and the Crown Inquest. Its players bring their own fortunes from the outer Ledger.'),
        ingress
          ? h('section', { class: 'record' }, h('h3', {}, 'The Ledger’s audit'), h('p', {}, `The lands you knew held ${run.perimeter.base} Lifechips. ${ingress.amount} more enter now from the outer Ledger, once, recorded by name as each newcomer sits. You receive none of them.`))
          : null,
        h('ol', { class: 'plan' }, h('li', {}, 'The Masked Salon — top two within 10 hands.'), h('li', {}, 'The Velvet Exchange — relics for real Lifechips.'), h('li', {}, 'The Velvet Arena — top two within 10 hands.'), h('li', {}, 'The Crown Inquest — first, or second with a real profit, after 12 hands.')),
        h('div', { class: 'actions' }, btn(`Sit at ${TABLE_NODES.masked_salon.label}`, () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'mirror_audience': {
      const chosen = mirrorChoice(run);
      const candidates = mirrorCandidates(run);
      content = screen(
        run,
        'The Court of Mirrors',
        h('p', { class: 'lede' }, 'The mirrors replay what you have already seen at the tables — one rival only. They show habits, never hidden cards.'),
        chosen
          ? mirrorReport(run, chosen)
          : h('div', { class: 'choice-row' }, ...candidates.map((id) => btn(run.characters[id].name, () => cb.command({ kind: 'event', take: true, rival: id }), 'small'))),
        h(
          'div',
          { class: 'actions' },
          chosen
            ? btn(`Go to ${TABLE_NODES.velvet_arena.label}`, () => cb.command({ kind: 'advance' }), 'primary')
            : btn('Leave without looking', () => cb.command({ kind: 'event', take: false })),
        ),
      );
      break;
    }
    case 'secret_bargain':
      content = screen(
        run,
        'The Whispered Contract',
        h('p', { class: 'lede' }, 'A masked broker offers a contract in a whisper. Its mark shows: Notoriety +1, and a public tell glows on your sleeve in the first hand of the next table. No Lifechips change hands.'),
        h(
          'div',
          { class: 'actions' },
          btn('Accept the whisper', () => cb.command({ kind: 'event', take: true }), 'primary'),
          btn('Decline', () => cb.command({ kind: 'event', take: false })),
        ),
      );
      break;
    case 'cinder_broker': {
      const relics = run.player.magic.relics ?? [];
      const sold = run.flags.includes('broker_sold');
      const wallet = run.accounts[BROKER_ID] ?? 0;
      content = screen(
        run,
        'The Broker Understairs',
        h('p', { class: 'lede' }, `Broker Osric buys one relic at half its shop value, from his own purse of ${wallet} Lifechips. He lends nothing and rescues no one.`),
        h('p', { class: 'muted' }, `His purse came once from the Cinder ledger (${run.accounts[CINDER_LEDGER] ?? 0} held back for replacements at the Ember Steps).`),
        sold || !relics.length
          ? h('p', { class: 'muted' }, sold ? 'You have already sold to the Broker.' : 'You carry no relic he would buy.')
          : h(
              'div',
              { class: 'offers' },
              ...relics.map((r) =>
                h(
                  'div',
                  { class: 'offer' },
                  h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, `◈ ${RELICS[r].name}`), h('span', { class: 'price' }, String(brokerPrice(r)))),
                  h('div', { class: 'offer-foot' }, h('span', { class: 'muted' }, `Shop value ${RELICS[r].price}`), btn('Sell', () => cb.command({ kind: 'sell', relic: r }), 'primary small', brokerPrice(r) > wallet)),
                ),
              ),
            ),
        spellbookPanel(run),
        h('div', { class: 'actions' }, btn(`Go down to ${TABLE_NODES.cinder_low_table.label}`, () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'oath_hearing': {
      const free = playerIsFree(run);
      content = screen(
        run,
        'The Oathbreaker Hearing',
        h('p', { class: 'lede' }, 'The Hearing reviews your funding and your debts. Nothing is forgiven here.'),
        covenantRecord(run),
        dutyLines(run),
        debtLines(run),
        h(
          'p',
          { class: `lede ${free ? 'outcome-win' : ''}` },
          free
            ? run.flags.includes('act2_entered')
              ? 'Your covenant is discharged. Unbound, you may leave — but the Circuit you once walked will not take you back.'
              : 'Your covenant is discharged. You may climb the Stairs Above to the Gilded Gate as one of the Unbound Fallen.'
            : 'You are still bound. The stairs lead down, to the Undercircuit, with every obligation intact.',
        ),
        h('div', { class: 'actions' }, btn(free ? 'Climb the Stairs Above' : 'Descend to the Undercircuit', () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'optional_event': {
      const chips = playerChips(run);
      const full = (run.player.magic.covenants ?? []).length >= SLOT_LIMITS.covenants;
      content = screen(
        run,
        'Mirror’s Petition',
        h('p', { class: 'lede' }, 'A Witness of the Mirror offers the Covenant of the Open Book. Your fee goes into the Witness’s escrow, not the void.'),
        h('section', { class: 'record' }, h('h3', {}, `✠ ${COVENANTS.covenant_open_book.name}`), h('p', {}, COVENANTS.covenant_open_book.effect)),
        h(
          'div',
          { class: 'actions' },
          btn(`Bind yourself · ${OPEN_BOOK_FEE} Lifechips`, () => cb.command({ kind: 'event', take: true }), 'primary', chips - OPEN_BOOK_FEE < 1 || full),
          btn('Decline the petition', () => cb.command({ kind: 'event', take: false })),
        ),
      );
      break;
    }
    case 'setback_audience': {
      const attuned = allCards(run.player.magic.book).filter((c) => (c.resonance ?? 0) > 0);
      content = screen(
        run,
        'A Keeper’s Audit',
        h('p', { class: 'lede' }, 'You failed the contract but kept your life. A Keeper audits the failure once, then the road goes on; a lost table is never replayed. Favor −1 either way.'),
        h(
          'div',
          { class: 'offers' },
          h('button', { type: 'button', class: 'offer pick', id: 'audit-public' }, h('span', { class: 'offer-name' }, 'Enter the public record'), h('span', { class: 'offer-text' }, 'Notoriety +1.')),
          ...attuned.map((c) =>
            h('button', { type: 'button', class: 'offer pick', 'data-uid': c.uid }, h('span', { class: 'offer-name' }, `Break attunement: ${SPELLS[c.spell].name}`), h('span', { class: 'offer-text' }, `Resonance ${c.resonance} → ${(c.resonance ?? 1) - 1}.`)),
          ),
        ),
      );
      content.querySelector('#audit-public')!.addEventListener('click', () => cb.command({ kind: 'setback', choice: 'public_record' }));
      content.querySelectorAll<HTMLButtonElement>('[data-uid]').forEach((b) => b.addEventListener('click', () => cb.command({ kind: 'setback', choice: 'break_attunement', uid: b.dataset.uid })));
      break;
    }
    case 'fallen_registry':
      content = screen(
        run,
        'The Registry Below',
        h('p', { class: 'lede' }, 'Beneath the Lantern Market the Registry binds your rank to Fallen. Nothing is given here; your rescue was recorded once, at the Last Claim.'),
        covenantRecord(run),
        dutyLines(run),
        debtLines(run),
        spellbookPanel(run),
        h('div', { class: 'actions' }, btn(`Sit at ${TABLE_NODES.fallen_low_table.label}`, () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    case 'fallen_audience':
      content = screen(
        run,
        'Audience of the Bound',
        h('p', { class: 'lede' }, 'You survived the Coal Table. Your covenant is reviewed before the bound.'),
        covenantRecord(run),
        dutyLines(run),
        debtLines(run),
        evolutionPanel(run, cb),
        h('div', { class: 'actions' }, btn('Leave the Audience', () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    default: {
      const [title, lines] = ENDING_TEXT[run.node] ?? ['The road goes on', []];
      content = screen(
        run,
        title,
        ...lines.map((l) => h('p', { class: 'lede' }, l)),
        run.results.length ? h('ol', { class: 'plan' }, ...run.results.map((r) => h('li', {}, `${TABLE_NODES[r.node].label}: ${r.outcome.replace('_', ' ')} (${r.net >= 0 ? '+' : ''}${r.net})`))) : null,
        h('div', { class: 'actions' }, btn('Begin a new run', () => cb.newRun(), 'primary')),
      );
    }
  }
  root.replaceChildren(content);
  root.scrollTop = 0;
}

/** Title screen when no run is saved; offers a P3 Fallen continuation when one exists. */
export function renderTitle(root: HTMLElement, hasFallen: boolean, cb: ScreenHandlers): void {
  root.replaceChildren(
    h(
      'div',
      { class: 'screen-inner title' },
      h('img', { src: 'assets/ui/ledger-seal.webp', alt: '', class: 'title-seal' }),
      h('h1', {}, 'The Last Wager'),
      h('p', { class: 'lede' }, 'A dark-fantasy poker roguelike where chips are life. Fictional Lifechips only.'),
      h(
        'div',
        { class: 'actions' },
        btn('Begin a new run', () => cb.newRun(), 'primary'),
        hasFallen ? btn('Continue your Fallen Wagerer', () => cb.continueFallen()) : null,
      ),
      hasFallen ? h('p', { class: 'muted' }, 'A Wagerer who survived a Last Claim in the previous build waits at the Registry Below, with the exact Lifechips and covenant they left with.') : null,
    ),
  );
}
