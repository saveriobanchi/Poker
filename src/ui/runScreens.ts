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
import type { LegacyEntry } from '../game/run/legacy';
import { MERCHANTS, merchantLine } from '../game/run/merchants';
import {
  activeDuty,
  ACT2_LEDGER,
  ARCHIVE_RIVALS,
  canRecover,
  CROWN_LEDGER,
  EPILOGUE_FATES,
  playerOverdue,
  resonanceTargets,
  UNDER_LEDGER,
  WISP_ID,
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
import { DISCIPLINE_COLOR } from './theme';
import { aetherGems, DISCIPLINE_ICON, eclipseMark, icon, type IconName, MERCHANT_ICON } from './icons';
import { COVENANT_PLAIN, RELIC_PLAIN, SPELL_PLAIN } from './plain';

export interface ScreenHandlers {
  command(cmd: RunCommand): void;
  newRun(): void;
  continueFallen(): void;
  /** Re-renders after a purely local UI choice (no game state change). */
  rerender(): void;
  /** Story from the presentation layer (background, one prose variant); never chips or odds. */
  story(): { title: string; intro: string; echo: string | null; gossip: string | null };
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

const ACT3_TRAIL: { id: NodeId; label: string; short: string }[] = [
  { id: 'crown_writ', label: 'The Crown Writ', short: 'Writ' },
  { id: 'coronet_table', label: 'The Ashen Coronet', short: 'Coronet' },
  { id: 'crown_archive', label: 'The Silver Archive', short: 'Archive' },
  { id: 'royal_exchange', label: 'The Royal Exchange', short: 'Exchange' },
  { id: 'seals_table', label: 'The Table of Seals', short: 'Seals' },
  { id: 'crown_table', label: 'The Crown Table', short: 'Crown' },
];
const UNDER_TRAIL: { id: NodeId; label: string; short: string }[] = [
  { id: 'under_declaration', label: 'The Underledger', short: 'Underledger' },
  { id: 'under_broker', label: 'Matron Wisp', short: 'Wisp' },
  { id: 'underlamp_table', label: 'The Underlamp Table', short: 'Underlamp' },
  { id: 'under_hearing', label: 'The Petition of Cinders', short: 'Petition' },
];
const ACT3_NODES = new Set<NodeId>(['the_ledger_unbound', 'the_unchosen_road', ...ACT3_TRAIL.map((n) => n.id)]);
const UNDER_NODES = new Set<NodeId>(['under_living_end', 'undercircuit_entry', ...UNDER_TRAIL.map((n) => n.id)]);

const ACT2_NODES = new Set<NodeId>(['act2_petition', 'act2_victory', 'act2_living_exile', ...ACT2_TRAIL.map((n) => n.id), 'secret_bargain']);
const FALLEN_NODES = new Set<NodeId>(['fallen_unlocked', ...FALLEN_TRAIL.map((n) => n.id)]);
/** Screens that share a trail slot with another node. */
const SLOT_ALIAS: Partial<Record<NodeId, NodeId>> = {
  secret_bargain: 'mirror_audience',
  act2_petition: 'gilded_gate',
  fallen_unlocked: 'fallen_audience',
  undercircuit_entry: 'under_declaration',
  act2_victory: 'crown_inquest',
  act2_living_exile: 'crown_inquest',
  the_ledger_unbound: 'crown_table',
  the_unchosen_road: 'crown_table',
  under_living_end: 'under_hearing',
};


/** Node the trail should highlight: result/reward/audit screens belong to the table just played. */
function trailPosition(run: RunState): NodeId {
  const at = run.node === 'table_result' || run.node === 'reward' || run.node === 'setback_audience' ? (run.results.at(-1)?.node ?? run.node) : run.node;
  return SLOT_ALIAS[at] ?? at;
}

function trailFor(run: RunState) {
  const at = trailPosition(run);
  if (ACT3_NODES.has(at) || ACT3_NODES.has(run.node)) return ACT3_TRAIL;
  if (UNDER_NODES.has(at) || UNDER_NODES.has(run.node)) return UNDER_TRAIL;
  if (ACT2_NODES.has(at) || ACT2_NODES.has(run.node)) return ACT2_TRAIL;
  if (FALLEN_NODES.has(at) || FALLEN_NODES.has(run.node)) return FALLEN_TRAIL;
  return MAIN_TRAIL;
}

/** One line for the expanded top bar: which road, where on it, and what comes next. */
export function routeLine(run: RunState): string {
  const nodes = trailFor(run);
  const idx = nodes.findIndex((n) => n.id === trailPosition(run));
  const road = nodes === ACT3_TRAIL ? 'Act III' : nodes === ACT2_TRAIL ? 'Act II' : nodes === UNDER_TRAIL ? 'The Undercircuit' : nodes === FALLEN_TRAIL ? 'The Fallen road' : 'Act I';
  if (idx < 0) return road;
  const next = nodes[idx + 1];
  return `${road} · step ${idx + 1} of ${nodes.length}${next ? ` · next: ${next.label}` : ' · final step'}`;
}

function trail(run: RunState): HTMLElement {
  const nodes = trailFor(run);
  const at = trailPosition(run);
  const idx = nodes.findIndex((n) => n.id === at);
  const ended = ['slice_victory', 'slice_exile', 'fallen_unlocked', 'act2_victory', 'act2_living_exile', 'the_ledger_unbound', 'the_unchosen_road', 'under_living_end', 'death'].includes(run.node);
  const played = new Set<NodeId>(run.results.map((r) => r.node as NodeId));
  const outcome = new Map<NodeId, string>(run.results.map((r) => [r.node, r.outcome]));
  const list = h('ol', { class: 'trail', 'aria-label': 'Route' });
  nodes.forEach((n, i) => {
    let state = i < idx || (ended && i <= idx) ? 'done' : i === idx ? 'here' : 'ahead';
    if (n.id === 'optional_event' && run.eventResolved === false && idx > i) state = 'skipped';
    if (n.id === 'start' && idx === -1 && ended) state = 'done';
    const o = outcome.get(n.id);
    const table = n.id in TABLE_NODES;
    const mark: IconName = o === 'win' ? 'check' : o === 'alive_failure' ? 'cross' : o === 'fallen' ? 'moon' : o === 'dead' ? 'grave' : table ? 'table' : 'node';
    list.append(
      h(
        'li',
        { class: `trail-node ${state}${played.has(n.id) ? ' played' : ''}`, 'aria-current': state === 'here' ? 'step' : 'false' },
        h('span', { class: 'trail-dot' }, icon(mark, mark === 'node' ? 9 : 13)),
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
      ...relics.map((id) => h('span', { class: 'relic', title: RELIC_PLAIN[id] }, icon('relic', 14), RELICS[id].name)),
      ...covenants.map((id) => h('span', { class: 'relic covenant', title: COVENANT_PLAIN[id] }, icon('covenant', 14), COVENANTS[id].name)),
      run.player.evolutionTokens ? h('span', { class: 'relic token' }, icon('evolve', 14), `Evolution token ×${run.player.evolutionTokens}`) : null,
      !relics.length && !covenants.length && !run.player.evolutionTokens ? h('span', { class: 'muted' }, `No relics yet · ${SLOT_LIMITS.relics} slots`) : null,
    ),
  );
}

function resonancePips(card: SpellCard): HTMLElement {
  const r = card.resonance ?? 0;
  if (!isBaseSpell(card.spell)) return h('span', { class: 'res evolved' }, 'evolved');
  const t = EVOLUTIONS[card.spell].threshold;
  return h('span', { class: 'res', 'aria-label': `Resonance ${r} of ${t}`, title: `Resonance ${r} of ${t}` }, ...Array.from({ length: t }, (_, i) => h('i', { class: i < r ? 'on' : '' })));
}

function spellChip(spell: SpellId, extra?: Child): HTMLElement {
  const def = SPELLS[spell];
  const chip = h('span', { class: 'spell-chip', title: SPELL_PLAIN[spell].does }, h('span', {}, icon(DISCIPLINE_ICON[def.discipline], 15), def.name), extra);
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
    h('h3', {}, icon('evolve', 16), 'A spell is ready to evolve'),
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
              h('span', { class: 'branch-name' }, icon(DISCIPLINE_ICON[def.discipline], 15), def.name),
              h('span', { class: 'branch-cost' }, def.cost ? aetherGems(def.cost, def.cost, 11) : 'free'),
              h('span', { class: 'branch-text' }, SPELL_PLAIN[b].does),
            );
            card.style.setProperty('--disc', DISCIPLINE_COLOR[def.discipline]);
            card.dataset.disc = def.discipline;
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
    h('h3', {}, icon('evolve', 16), 'Spend your evolution token'),
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
/** Exact transfer, current stack and what remains (design v1.0 §10): every sale and buyback says all three. */
function transferLine(run: RunState, amount: number, counterparty: string, direction: 'pay' | 'receive'): HTMLElement {
  const chips = playerChips(run);
  const name = MERCHANTS[counterparty]?.name ?? counterparty;
  const after = direction === 'pay' ? chips - amount : chips + amount;
  const text =
    direction === 'pay'
      ? after < 0
        ? `You pay ${amount} to ${name}. You hold ${chips}: not enough.`
        : `You pay ${amount} to ${name}. You hold ${chips} → ${after} remain.`
      : (run.accounts[counterparty] ?? 0) < amount
        ? `${name} cannot pay ${amount}: their purse holds ${run.accounts[counterparty] ?? 0}.`
        : `${name} pays you ${amount} from their own purse. You hold ${chips} → ${after}.`;
  return h('span', { class: `transfer${after < 0 ? ' short' : ''}` }, text);
}

let currentHandlers: ScreenHandlers;

/** A merchant speaking, under their own mark. */
function merchantVoice(id: string, line: string): HTMLElement {
  return h('div', { class: 'merchant' }, h('span', { class: 'merchant-mark' }, icon(MERCHANT_ICON[id] ?? 'relic', 22)), h('p', { class: 'merchant-line' }, line));
}

/** The exact rules text, folded away under the plain description. */
function rules(text: string): HTMLElement {
  return h('details', { class: 'rules' }, h('summary', {}, 'Full rules'), h('p', {}, text));
}

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
      h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, icon('relic', 15), def.name, def.rarity !== 'common' ? h('span', { class: `rarity ${def.rarity}` }, def.rarity) : null), h('span', { class: 'price' }, `${o.price}`)),
      h('p', { class: 'offer-text' }, RELIC_PLAIN[o.relic]),
      rules(def.effect),
      owned ? h('p', { class: 'warning-text' }, 'You already carry this relic.') : relics.length >= SLOT_LIMITS.relics && !o.sold ? h('p', { class: 'warning-text' }, `Your ${SLOT_LIMITS.relics} relic slots are full: a purchase is refused.`) : null,
      o.sold
        ? h('span', { class: 'muted' }, 'Sold')
        : h('div', { class: 'offer-foot' }, transferLine(run, o.price, s.merchant, 'pay'), btn('Buy', () => cb.command({ kind: 'buy', offer: i }), 'primary small', owned || chips < o.price)),
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
      h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, icon('rethread', 15), 'Spell Rethread'), h('span', { class: 'price' }, String(RETHREAD_PRICE))),
      h('p', { class: 'offer-text' }, 'Replace one owned base spell with a different starter spell. Its Resonance resets.'),
      h('div', { class: 'offer-foot' }, transferLine(run, RETHREAD_PRICE, s.merchant, 'pay')),
      h('div', { class: 'choice-row' }, ...uniqueBySpell(base).map((c) => btn(SPELLS[c.spell].name, () => ((rethreadUid = c.uid), cb.rerender()), 'small'))),
    );
  }
  const velvet = s.id === 'velvet_exchange';
  const royal = s.id === 'royal_exchange';
  const exits = royal
    ? h('div', { class: 'actions' }, btn(`Go to ${TABLE_NODES.seals_table.label}`, () => cb.command({ kind: 'leaveShop', to: 'seals_table' }), 'primary'))
    : velvet
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
    royal ? 'The Royal Exchange' : velvet ? 'The Velvet Exchange' : 'Selene’s Lantern',
    merchantVoice(s.merchant, merchantLine(run, s.merchant)),
    h(
      'p',
      { class: 'lede' },
      royal
        ? `Oran of the Royal Exchange keeps ${run.accounts[s.merchant]} Lifechips from the Crown Ledger. Rare relics appear only rarely. Every price is a real transfer.`
        : velvet
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
            h('td', {}, s.name, s.status === 'dead' ? icon('grave', 13) : s.status === 'exited' ? icon('moon', 13) : null),
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
        h('li', { class: run.duties!.completed.includes(d.id) ? 'done' : d.id === active?.id ? 'active' : '' }, run.duties!.completed.includes(d.id) ? icon('check', 15) : d.id === active?.id ? icon('arrow', 15) : icon('node', 15), d.text),
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
  act2_victory: ['A Crown of Brass', ['You won the Crown Inquest. Act Two is cleared, and your Wagerer keeps every Lifechip, debt and favor.', 'A Crown Writ invites you to the Crown Table — no fee, no chips.'], 'Answer the Writ'],
  act2_living_exile: ['The Mask Falls', ['You leave the Gilded Circuit alive but unhonored, with every Lifechip you still hold.', 'A Crown Writ can still be had — by petition, for one point of Favor.'], 'Petition for a Writ'],
};

const FATE_LABEL: Record<string, string> = {
  retire: 'Retire from the tables',
  keep_wagering_in_future_content: 'Keep wagering, somewhere else',
  honor_contract: 'Honor the contract',
  seek_liberation_in_future_content: 'Seek liberation, in time',
  reform: 'Reform the Ledger’s law',
  claim: 'Claim the Ledger’s authority',
};
const FATE_TEXT: Record<string, string> = {
  retire: 'You retire. Your Lifechips and debts are archived exactly as they stand.',
  keep_wagering_in_future_content: 'You mean to keep wagering. A later road may open; this character is archived, alive.',
  honor_contract: 'You honor your contract under the low lanterns.',
  seek_liberation_in_future_content: 'You will seek liberation. A later, finite Cinder sequel may tell how.',
};

const ENDING_TEXT: Record<string, [string, string[]]> = {
  the_ledger_unbound: ['The Ledger Unbound', ['You won the Crown Table. The Ledger itself waits on your word.', 'Your Wagerer keeps exactly the Lifechips, debts and favors they hold. Nothing here is minted.']],
  the_unchosen_road: ['The Unchosen Road', ['High society closes its doors, but you walk away alive with every Lifechip and every debt you carry.', 'A later road of prestige may open in time. This is not death.']],
  under_living_end: ['The Low Lanterns Remain', ['You live on under the low lanterns with your exact Lifechips and obligations, archived for a later continuation.', 'No funds are given and no status resets.']],
  death: ['The Run Has Ended', ['The Ledger closed your account. Death concludes this character’s story; a new Wagerer may take up the cards.']],
};

/** A public dossier (design v0.8 §02): counts over a small recorded sample, with the sample size shown. */
function dossierReport(run: RunState): HTMLElement | null {
  const d = run.dossier;
  if (!d) return null;
  const w = d.witnessed;
  return h(
    'section',
    { class: 'record' },
    h('h3', {}, `Dossier: ${PROFILES[d.rival]?.name ?? d.rival}`),
    h('p', {}, `In ${d.hands} recorded public hands: played ${d.vpip}, raised first ${d.pfr}, shoved ${d.shoves}. A small sample, not a lifetime record.`),
    w ? h('p', {}, `You also watched them for ${w.hands} hands: played ${w.vpip}, raised first ${w.pfr}, shoved ${w.shoves}.`) : null,
    h('p', { class: 'muted' }, 'Only public actions were recorded. No hidden card is ever shown. The dossier lasts for the next table.'),
  );
}

function spellPicker(run: RunState, onPick: (uid: string) => void): HTMLElement {
  return h('div', { class: 'choice-row' }, ...uniqueBySpell(resonanceTargets(run)).map((c) => btn(`${SPELLS[c.spell].name} (${c.resonance ?? 0}→${(c.resonance ?? 0) + 1})`, () => onPick(c.uid), 'small')));
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
        h('section', { class: 'record' }, h('h3', {}, cb.story().title), h('p', {}, cb.story().intro)),
        cb.story().echo ? h('p', { class: 'muted' }, cb.story().echo!) : null,
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
              h('div', { class: 'choice-row' }, ...owned.map((r) => { const b = btn(RELICS[r].name, () => ((replaceRelic = r), cb.rerender()), `small${replaceRelic === r ? ' primary' : ''}`); b.setAttribute('aria-pressed', String(replaceRelic === r)); return b; })),
            )
          : null,
        h(
          'div',
          { class: 'offers' },
          ...run.reward!.map((o, i) =>
            o.kind === 'relic'
              ? h('button', { type: 'button', class: 'offer pick', 'data-i': String(i), title: RELICS[o.relic].effect }, h('span', { class: 'offer-name' }, icon('relic', 15), RELICS[o.relic].name), h('span', { class: 'offer-text' }, RELIC_PLAIN[o.relic]))
              : o.kind === 'resonance'
                ? h('div', { class: 'offer' }, h('span', { class: 'offer-name' }, icon('evolve', 15), 'Attune a spell'), h('span', { class: 'offer-text' }, 'One unevolved spell gains 1 Resonance (up to 2), bringing it closer to evolving.'), spellPicker(run, (uid) => cb.command({ kind: 'reward', index: i, uid })))
                : h('button', { type: 'button', class: 'offer pick', 'data-i': String(i) }, h('span', { class: 'offer-name' }, icon('evolve', 15), 'Evolution token'), h('span', { class: 'offer-text' }, 'Evolve a spell early, as soon as it has 1 Resonance. If none has any yet, it gives one spell 1 Resonance instead.')),
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
    case 'fallen_unlocked':
    case 'act2_victory':
    case 'act2_living_exile': {
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
        h('p', { class: 'lede' }, 'The mirrors hold a dossier on one rival of the Velvet Arena — public hands only. They show habits, never hidden cards.'),
        chosen
          ? dossierReport(run)
          : h('div', { class: 'choice-row' }, ...candidates.map((id) => btn(PROFILES[id]?.name ?? id, () => cb.command({ kind: 'event', take: true, rival: id }), 'small'))),
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
        h('p', { class: 'lede' }, 'A masked broker offers a contract in a whisper: one spell grows stronger, but the Arena learns one of your spells in its first hand, and your Notoriety rises. No Lifechips change hands.'),
        resonanceTargets(run).length
          ? h('section', { class: 'record' }, h('h3', {}, 'Accept, and attune one spell (+1 Resonance, max 2)'), spellPicker(run, (uid) => cb.command({ kind: 'event', take: true, uid })))
          : h('section', { class: 'record' }, h('p', {}, 'No spell can be attuned: you would begin the Arena with +1 Aether instead (never above 3).'), btn('Accept the whisper', () => cb.command({ kind: 'event', take: true }), 'primary')),
        h('div', { class: 'actions' }, btn('Decline', () => cb.command({ kind: 'event', take: false }))),
      );
      break;
    case 'crown_writ': {
      const ingress = run.perimeter.expansions.find((e) => e.account === CROWN_LEDGER);
      const recover = canRecover(run);
      content = screen(
        run,
        'The Crown Writ',
        h('p', { class: 'lede' }, run.flags.includes('bound_writ') ? 'A conditional writ: you may sit at the Crown Table, but your obligations stand, and the herald will say so.' : 'The Writ is read aloud. Your stack, debts and spells come with you; nothing is given.'),
        ingress ? h('section', { class: 'record' }, h('h3', {}, 'The Ledger’s audit'), h('p', {}, `${ingress.amount} Lifechips enter once from the Crown Ledger, by name as each newcomer sits. You receive none of them.`)) : null,
        h('ol', { class: 'plan' }, h('li', {}, 'The Ashen Coronet — top two within 8 hands (4/8).'), h('li', {}, 'The Silver Archive — a dossier or an attunement.'), h('li', {}, 'The Royal Exchange — relics for real Lifechips.'), h('li', {}, 'The Table of Seals — top two within 8 hands.'), h('li', {}, 'The Crown Table — first, or second with a real profit, after 12 hands (4/8 then 5/10).')),
        recover
          ? h('p', { class: 'warning-text' }, `You hold fewer than 24 Lifechips. The blinds here are 4/8. You may take the Undercircuit once first.`)
          : run.accounts.you < 24
            ? h('p', { class: 'warning-text' }, `You hold fewer than 24 Lifechips against 4/8 blinds. The Undercircuit has already been walked; there is no second recovery.`)
            : null,
        debtLines(run),
        h(
          'div',
          { class: 'actions' },
          btn(`Sit at ${TABLE_NODES.coronet_table.label}`, () => cb.command({ kind: 'advance' }), 'primary'),
          recover ? btn('Take the Undercircuit first', () => cb.command({ kind: 'recover' })) : null,
        ),
      );
      break;
    }
    case 'crown_archive': {
      const done = run.flags.includes('archive_done');
      content = screen(
        run,
        'The Silver Archive',
        h('p', { class: 'lede' }, 'The Archive keeps public hands of the Table of Seals — or it can lend one spell a little of its memory.'),
        done
          ? dossierReport(run) ?? h('p', { class: 'muted' }, 'Your spell has drawn on the Archive.')
          : h(
              'div',
              { class: 'offers' },
              h('section', { class: 'record' }, h('h3', {}, 'Study a rival'), h('div', { class: 'choice-row' }, ...ARCHIVE_RIVALS.map((id) => btn(PROFILES[id]?.name ?? id, () => cb.command({ kind: 'archive', choice: 'study', rival: id }), 'small')))),
              resonanceTargets(run).length
                ? h('section', { class: 'record' }, h('h3', {}, 'Resonate (+1 Resonance, +1 Notoriety)'), spellPicker(run, (uid) => cb.command({ kind: 'archive', choice: 'resonate', uid })))
                : null,
            ),
        done ? h('div', { class: 'actions' }, btn('Go to the Royal Exchange', () => cb.command({ kind: 'advance' }), 'primary')) : null,
      );
      break;
    }
    case 'royal_exchange':
      content = shop(run, cb);
      break;
    case 'undercircuit_entry':
    case 'under_declaration': {
      content = screen(
        run,
        'The Underledger',
        h('p', { class: 'lede' }, 'Below the Cinder stairs the Underledger reads out who you owe and what you hold. Nothing is cleared here.'),
        cb.story().gossip && !run.results.some((r) => r.node === 'fallen_low_table') ? h('p', { class: 'merchant-line' }, cb.story().gossip!) : null,
        run.accounts[UNDER_LEDGER] !== undefined ? h('p', { class: 'muted' }, `The Underground Ledger brought 102 Lifechips once, for Matron Wisp and the Underlamp regulars.`) : null,
        covenantRecord(run),
        dutyLines(run),
        debtLines(run),
        h('div', { class: 'actions' }, btn('Go to Matron Wisp', () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'under_broker': {
      const relics = run.player.magic.relics ?? [];
      const sold = run.flags.includes('wisp_sold');
      const wallet = run.accounts[WISP_ID] ?? 0;
      content = screen(
        run,
        'Matron Wisp',
        merchantVoice(WISP_ID, merchantLine(run, WISP_ID)),
        h('p', { class: 'lede' }, `Matron Wisp buys one relic at half its shop value, from her own purse of ${wallet} Lifechips.`),
        sold || !relics.length
          ? h('p', { class: 'muted' }, sold ? 'You have already sold to Matron Wisp.' : 'You carry no relic she would buy.')
          : h('div', { class: 'offers' }, ...relics.map((r) => h('div', { class: 'offer' }, h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, icon('relic', 15), RELICS[r].name), h('span', { class: 'price' }, String(brokerPrice(r)))), h('p', { class: 'offer-text' }, `Shop value ${RELICS[r].price}; half is paid.`), h('div', { class: 'offer-foot' }, transferLine(run, brokerPrice(r), WISP_ID, 'receive'), btn('Sell', () => cb.command({ kind: 'sell', relic: r }), 'primary small', brokerPrice(r) > wallet))))),
        h('div', { class: 'actions' }, btn(`Sit at ${TABLE_NODES.underlamp_table.label}`, () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'under_hearing': {
      const free = playerIsFree(run);
      const eligible = run.flags.includes('under_writ_eligible');
      const overdue = playerOverdue(run);
      const done = run.flags.includes('act3_entered');
      const line = done
        ? 'High society is behind you. The low lanterns are where your story rests.'
        : free
          ? 'You owe nothing binding. You may petition for a Crown Writ.'
          : eligible && !overdue
            ? 'You finished in the top two and owe nothing overdue: a conditional writ may be granted. Your obligations stand.'
            : overdue
              ? 'An overdue debt bars any writ. The low lanterns remain.'
              : 'Without a top-two finish at the Underlamp, no writ is granted. The low lanterns remain.';
      content = screen(
        run,
        'The Petition of Cinders',
        h('p', { class: 'lede' }, 'No obligation is forgiven here.'),
        covenantRecord(run),
        dutyLines(run),
        debtLines(run),
        h('p', { class: 'lede' }, line),
        h('div', { class: 'actions' }, btn(done || (!free && !(eligible && !overdue)) ? 'Stay under the low lanterns' : 'Take the Writ', () => cb.command({ kind: 'advance' }), 'primary')),
      );
      break;
    }
    case 'the_ledger_unbound': {
      const chosen = run.flags.find((f) => f.startsWith('allegiance:'));
      const [title, lines] = ENDING_TEXT.the_ledger_unbound;
      content = screen(
        run,
        title,
        ...lines.map((l) => h('p', { class: 'lede' }, l)),
        chosen
          ? h('p', { class: 'lede outcome-win' }, chosen === 'allegiance:reform' ? 'You petition to reform the Ledger’s law.' : 'You claim the Ledger’s authority.')
          : h('div', { class: 'actions' }, btn('Petition to reform its law', () => cb.command({ kind: 'allegiance', choice: 'reform' })), btn('Claim its authority', () => cb.command({ kind: 'allegiance', choice: 'claim' }))),
        h('ol', { class: 'plan' }, ...run.results.map((r) => h('li', {}, `${TABLE_NODES[r.node].label}: ${r.outcome.replace('_', ' ')} (${r.net >= 0 ? '+' : ''}${r.net})`))),
        h('div', { class: 'actions' }, btn('Begin a new run', () => cb.newRun(), 'primary')),
      );
      break;
    }
    case 'cinder_broker': {
      const relics = run.player.magic.relics ?? [];
      const sold = run.flags.includes('broker_sold');
      const wallet = run.accounts[BROKER_ID] ?? 0;
      content = screen(
        run,
        'The Broker Understairs',
        merchantVoice(BROKER_ID, merchantLine(run, BROKER_ID)),
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
                  h('div', { class: 'offer-head' }, h('span', { class: 'offer-name' }, icon('relic', 15), RELICS[r].name), h('span', { class: 'price' }, String(brokerPrice(r)))),
                  h('p', { class: 'offer-text' }, `Shop value ${RELICS[r].price}; half is paid.`), h('div', { class: 'offer-foot' }, transferLine(run, brokerPrice(r), BROKER_ID, 'receive'), btn('Sell', () => cb.command({ kind: 'sell', relic: r }), 'primary small', brokerPrice(r) > wallet)),
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
            ? run.flags.includes('act3_entered')
              ? 'Your covenant is discharged. Unbound, you leave high society behind — alive.'
              : run.flags.includes('act2_entered')
                ? 'Your covenant is discharged. The Circuit will not take you back, but you may petition for a Crown Writ (Favor −1).'
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
        h('section', { class: 'record' }, h('h3', {}, icon('covenant', 15), COVENANTS.covenant_open_book.name), h('p', {}, COVENANT_PLAIN.covenant_open_book), rules(COVENANTS.covenant_open_book.effect)),
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
        cb.story().gossip ? h('p', { class: 'merchant-line' }, cb.story().gossip!) : null,
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
      const fates = EPILOGUE_FATES[run.node] ?? [];
      const fate = run.flags.find((f) => f.startsWith('fate:'))?.slice(5);
      content = screen(
        run,
        title,
        ...lines.map((l) => h('p', { class: 'lede' }, l)),
        fates.length
          ? fate
            ? h('p', { class: 'lede outcome-win' }, FATE_TEXT[fate] ?? fate)
            : h('section', { class: 'record' }, h('h3', {}, 'Epilogue'), h('div', { class: 'actions' }, ...fates.map((f) => btn(FATE_LABEL[f] ?? f, () => cb.command({ kind: 'fate', choice: f })))))
          : null,
        run.results.length ? h('ol', { class: 'plan' }, ...run.results.map((r) => h('li', {}, `${TABLE_NODES[r.node].label}: ${r.outcome.replace('_', ' ')} (${r.net >= 0 ? '+' : ''}${r.net})`))) : null,
        h('div', { class: 'actions' }, btn('Begin a new run', () => cb.newRun(), 'primary')),
      );
    }
  }
  root.replaceChildren(content);
  root.scrollTop = 0;
}

function titleMark(): HTMLElement {
  const m = h('div', { class: 'title-mark' });
  m.innerHTML = eclipseMark(132);
  return m;
}

/** Title screen when no run is saved; offers a P3 Fallen continuation when one exists. */
export function renderTitle(root: HTMLElement, hasFallen: boolean, cb: ScreenHandlers, testament: LegacyEntry[] = []): void {
  root.replaceChildren(
    h(
      'div',
      { class: 'screen-inner title' },
      titleMark(),
      h('h1', {}, 'The Last Wager'),
      h('p', { class: 'tagline' }, 'Poker · Magic · Consequence'),
      h('p', { class: 'lede' }, 'Real No-limit Hold’em, where the chips are your life. Fictional Lifechips only.'),
      h(
        'div',
        { class: 'actions' },
        btn('Begin a new run', () => cb.newRun(), 'primary'),
        hasFallen ? btn('Continue your Fallen Wagerer', () => cb.continueFallen()) : null,
      ),
      hasFallen ? h('p', { class: 'muted' }, 'A Wagerer who survived a Last Claim in the previous build waits at the Registry Below, with the exact Lifechips and covenant they left with.') : null,
      testament.length
        ? h(
            'section',
            { class: 'record testament' },
            h('h3', {}, 'World testament'),
            h('ol', { class: 'plan' }, ...testament.slice(-5).reverse().map((e) => h('li', {}, `${ENDING_TEXT[e.ending]?.[0] ?? e.ending}${e.fate ? ` · ${FATE_LABEL[e.fate] ?? e.fate}` : ''} · ${e.lifechips} Lifechips · ${e.tablesPlayed} tables`))),
            h('p', { class: 'muted' }, 'Archived characters keep what they hold. A new Wagerer inherits nothing but the story.'),
          )
        : null,
    ),
  );
}

/**
 * New-run setup when the testament has unlocked choices: a background (words
 * only) and a card back (only once its art exists). Starting Lifechips, cards
 * and every random draw are the same whatever is chosen.
 */
export function renderNewRunPicker(
  root: HTMLElement,
  backgrounds: { id: string; title: string; intro: string }[],
  backs: { id: string; title: string; unlocked: boolean; artReady: boolean }[],
  onStart: (background: string, back: string) => void,
): void {
  let background = backgrounds[0].id;
  let back = 'standard';
  const draw = () => {
    root.replaceChildren(
      h(
        'div',
        { class: 'screen-inner' },
        h('h2', {}, 'A New Wagerer'),
        h('p', { class: 'lede' }, 'Choose who arrives. It changes the story you are told, never your Lifechips, your cards or your odds: every Wagerer starts with 100 Lifechips and the same Spellbook.'),
        h(
          'div',
          { class: 'offers' },
          ...backgrounds.map((b) => {
            const el = h('button', { type: 'button', class: `offer pick${b.id === background ? ' chosen' : ''}`, 'aria-pressed': String(b.id === background) }, h('span', { class: 'offer-name' }, b.title), h('span', { class: 'offer-text' }, b.intro));
            el.addEventListener('click', () => ((background = b.id), draw()));
            return el;
          }),
        ),
        h(
          'section',
          { class: 'record' },
          h('h3', {}, 'Card back (every face-down card at the table)'),
          h(
            'div',
            { class: 'choice-row' },
            ...backs.map((b) => {
              const usable = b.unlocked && b.artReady;
              const label = `${b.title}${!b.unlocked ? ' · locked' : !b.artReady ? ' · art pending' : ''}`;
              const el = btn(label, () => ((back = b.id), draw()), `small${b.id === back ? ' primary' : ''}`, !usable);
              el.setAttribute('aria-pressed', String(b.id === back));
              return el;
            }),
          ),
        ),
        h('div', { class: 'actions' }, btn('Begin', () => onStart(background, back), 'primary')),
      ),
    );
  };
  draw();
}
