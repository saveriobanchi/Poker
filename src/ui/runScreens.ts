/**
 * DOM screens for the P4 run between tables: the route trail, Selene's shop,
 * Mirror's Petition, rewards, the Keeper's Audit, spell evolution, the Fallen
 * route and the endings (art bible v0.3 P4: vector/DOM first, text never baked
 * into art). Every button maps to exactly one RunCommand.
 */
import { allCards, type SpellCard } from '../game/magic/spellbook';
import { COVENANTS, RELICS, SLOT_LIMITS } from '../game/magic/relics';
import { type BaseSpellId, EVOLUTIONS, isBaseSpell, SPELLS, type SpellId } from '../game/magic/spells';
import {
  activeDuty,
  DUTIES,
  evolutionOffers,
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
  { id: 'fallen_low_table', label: 'The Coal Table', short: 'Coal Table' },
  { id: 'fallen_audience', label: 'Audience of the Bound', short: 'Audience' },
];

const isFallen = (run: RunState) => run.characters[PLAYER_ID].socialRank === 'FALLEN';

/** Node the trail should highlight: result/reward/audit screens belong to the table just played. */
function trailPosition(run: RunState): NodeId {
  if (run.node === 'table_result' || run.node === 'reward' || run.node === 'setback_audience') return run.results.at(-1)?.node ?? run.node;
  return run.node;
}

function trail(run: RunState): HTMLElement {
  const nodes = isFallen(run) ? FALLEN_TRAIL : MAIN_TRAIL;
  const at = trailPosition(run);
  const idx = nodes.findIndex((n) => n.id === at);
  const ended = ['slice_victory', 'slice_exile', 'fallen_unlocked', 'death'].includes(run.node);
  const played = new Set<NodeId>(run.results.map((r) => r.node as NodeId));
  const outcome = new Map<NodeId, string>(run.results.map((r) => [r.node, r.outcome]));
  const list = h('ol', { class: 'trail', 'aria-label': 'Route' });
  nodes.forEach((n, i) => {
    let state = i < idx || (ended && i <= idx) ? 'done' : i === idx ? 'here' : 'ahead';
    if (n.id === 'optional_event' && run.eventResolved === false && idx > i) state = 'skipped';
    if (n.id === 'start' && idx === -1 && ended) state = 'done';
    const o = outcome.get(n.id);
    const mark = o === 'win' ? '✓' : o === 'alive_failure' ? '✗' : o === 'fallen' ? '☾' : o === 'dead' ? '✝' : n.id.startsWith('contract') || n.id.includes('table') || n.id === 'boss_ledger' ? '♠' : '◆';
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
    h('div', { class: 'purse-rep' }, `Honor ${r.honor} · Dread ${r.dread} · Favor ${r.favor}${r.notoriety ? ` · Notoriety ${r.notoriety}` : ''}${isFallen(run) ? ' · Fallen' : ''}`),
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

function screen(run: RunState, title: string, ...body: Child[]): HTMLElement {
  return h('div', { class: 'screen-inner' }, trail(run), h('h2', {}, title), purse(run), ...body);
}

let rethreadUid: string | null = null;

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
  return screen(
    run,
    'Selene’s Lantern',
    h('p', { class: 'lede' }, `Selene of the Lantern Market keeps ${run.accounts.selene} Lifechips in her strongbox. Every price is a real transfer.`),
    h('div', { class: 'offers' }, ...offers),
    rethread,
    evolutionPanel(run, cb),
    spellbookPanel(run),
    h(
      'div',
      { class: 'actions' },
      run.eventResolved ? null : btn('Hear the Mirror’s Petition', () => cb.command({ kind: 'leaveShop', to: 'optional_event' })),
      btn(`Go to ${TABLE_NODES.contract_2.label}`, () => cb.command({ kind: 'leaveShop', to: 'contract_2' }), 'primary'),
    ),
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

const ENDING_TEXT: Record<string, [string, string[]]> = {
  slice_victory: ['The Ledger Opens', ['You hold the highest stack at the Bailiff’s Ledger. Act One is cleared; the next act opens in a later milestone.', 'Your survivor keeps every Lifechip won.']],
  slice_exile: ['Exiled from the Circuit', ['You survived the Bailiff’s Ledger but did not take it. You leave the Circuit alive, with every Lifechip you still hold.']],
  fallen_unlocked: ['The Fallen Road Opens', ['You survived the Coal Table and stood before the Audience of the Bound.', 'Fallen route unlocked: the P4 slice is complete. The Cinder recovery route opens in a later milestone.']],
  death: ['The Run Has Ended', ['The Ledger closed your account. Death concludes this character’s story; a new Wagerer may take up the cards.']],
};

/** Renders the screen for the run's current (non-table) node. */
export function renderRunScreen(root: HTMLElement, run: RunState, cb: ScreenHandlers): void {
  let content: HTMLElement;
  switch (run.node) {
    case 'start':
      content = screen(
        run,
        'Wagerer’s Arrival',
        h('p', { class: 'lede' }, 'You arrive in the Lantern district with 100 Lifechips and a beginner’s Spellbook. Three tables stand between you and the Ledger. Chips are life: lose them all and a Last Claim decides your fate.'),
        h('ol', { class: 'plan' }, h('li', {}, 'The Ash Table — finish in the top two within 8 hands.'), h('li', {}, 'Selene’s Lantern — relics for real Lifechips.'), h('li', {}, 'The Lantern Circuit — top two within 8 hands.'), h('li', {}, 'The Bailiff’s Ledger — hold the highest stack after 12 hands.')),
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
    case 'reward':
      content = screen(
        run,
        'Spoils of the Contract',
        h('p', { class: 'lede' }, 'Choose one. Rewards never mint Lifechips.'),
        h(
          'div',
          { class: 'offers' },
          ...run.reward!.map((o, i) =>
            o.kind === 'relic'
              ? h('button', { type: 'button', class: 'offer pick', 'data-i': String(i) }, h('span', { class: 'offer-name' }, `◈ ${RELICS[o.relic].name}`), h('span', { class: 'offer-text' }, RELICS[o.relic].effect))
              : h('button', { type: 'button', class: 'offer pick', 'data-i': String(i) }, h('span', { class: 'offer-name' }, '✦ Evolution token'), h('span', { class: 'offer-text' }, 'Evolve one base spell that has at least 1 Resonance, without waiting for its full threshold.')),
          ),
        ),
        spellbookPanel(run),
        h('div', { class: 'actions' }, btn('Take nothing', () => cb.command({ kind: 'reward', index: null }))),
      );
      content.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) => b.addEventListener('click', () => cb.command({ kind: 'reward', index: Number(b.dataset.i) })));
      break;
    case 'lantern_shop':
      content = shop(run, cb);
      break;
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
