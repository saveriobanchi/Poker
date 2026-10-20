/**
 * The P4 roguelike slice (design v0.6 §03–§07): a finite route of contract
 * tables, a shop, an optional event and a boss, plus the Fallen recovery route.
 *
 * Every Lifechip lives in a named account (characters, the merchant, the
 * Witness escrow) or the Ledger relief treasury, or sits at the table in play.
 * Tables buy in from and cash out to those accounts; shops and events are
 * transfers. Nothing is minted: `assertRunInvariants` checks the total after
 * every command. All randomness is seeded from the run seed.
 */
import { type Dossier, publicDossier } from '../ai/calibration';
import { PROFILES } from '../ai/profiles';
import {
  adjustResonance,
  allCards,
  createSeatMagic,
  createSpellbook,
  EVOLUTIONS,
  isBaseSpell,
  RELIC_IDS,
  RELICS,
  type RelicId,
  replaceInstance,
  resetForTable,
  type SeatMagic,
  SLOT_LIMITS,
  type SpellCard,
  type SpellId,
  SPELLS,
  BEGINNER_SPELLBOOK,
  AETHER,
} from '../magic';
import { Rng } from '../rules/rng';
import {
  applyClaim,
  applyHumanCommand,
  createSession,
  deriveSeed,
  type HumanCommand,
  humanSeat,
  type SeatConfig,
  sessionStatus,
  startNextHand,
  stepAi,
  type TableConfig,
  tableStacks,
  type TableSession,
} from '../table/session';
import {
  type Character,
  type ClaimCommand,
  type Contract,
  createCharacter,
  repayAfterTable,
  type SeatStatus,
  type Transfer,
} from '../world';
import { LEDGER_TREASURY_INITIAL } from '../world/rules';
import dutiesData from './data/p4-service-duties.json';
import fallenData from './data/p4-fallen-route.json';
import routeData from './data/p4-route.json';
import shopData from './data/p4-shop.json';
import relicData from './data/p4-relics-and-covenants.json';
import act2Data from './data/p5-act2-route.json';
import cinderData from './data/p5-fallen-continuation.json';

export type TableNodeId =
  | 'contract_1'
  | 'contract_2'
  | 'boss_ledger'
  | 'fallen_low_table'
  | 'cinder_low_table'
  | 'masked_salon'
  | 'velvet_arena'
  | 'crown_inquest';
export type NodeId =
  | 'start'
  | TableNodeId
  | 'table_result'
  | 'reward'
  | 'lantern_shop'
  | 'optional_event'
  | 'setback_audience'
  | 'fallen_registry'
  | 'fallen_audience'
  | 'slice_victory'
  | 'slice_exile'
  | 'fallen_unlocked'
  // P5 (design v0.7 §09–§10)
  | 'act2_petition'
  | 'gilded_gate'
  | 'velvet_exchange'
  | 'mirror_audience'
  | 'secret_bargain'
  | 'act2_victory'
  | 'act2_living_exile'
  | 'cinder_broker'
  | 'oath_hearing'
  | 'undercircuit_entry'
  | 'death';

/** Final endings of the current build. */
export const ENDINGS: NodeId[] = ['act2_victory', 'act2_living_exile', 'undercircuit_entry', 'death'];
/** Act I chapter ends: a summary screen, then the story continues (design v0.7 §09–§10). */
export const CHAPTER_ENDS: NodeId[] = ['slice_victory', 'slice_exile', 'fallen_unlocked'];

export interface Standing {
  id: string;
  name: string;
  stack: number;
  status: SeatStatus;
  rank: number;
}

export type TableOutcome = 'win' | 'alive_failure' | 'fallen' | 'dead';

export interface TableResult {
  node: TableNodeId;
  outcome: TableOutcome;
  standings: Standing[];
  /** Player's net Lifechips at this table. */
  net: number;
  hands: number;
  /** Debt repaid to a creditor after this table, if any. */
  repayment: number;
}

export type RewardOption =
  | { kind: 'relic'; relic: RelicId }
  | { kind: 'evolution_token' }
  /** +1 Resonance to one owned unevolved instance, capped at 2 (design v0.8 §05). */
  | { kind: 'resonance' };

export interface ShopOffer {
  relic: RelicId;
  price: number;
  sold: boolean;
}

export interface DutyState {
  contractId: string;
  giver: string;
  completed: string[];
  /** Event ids already used, so a replayed hand can never complete a duty twice. */
  usedEvents: string[];
}

/** Public, table-observed play of one character (for the Court of Mirrors). */
export interface PublicStats {
  hands: number;
  vpip: number;
  pfr: number;
  shoves: number;
}

/** A recorded expansion of the accounting perimeter: external funds entering the local world once. */
export interface PerimeterExpansion {
  key: string;
  account: string;
  amount: number;
}

export interface ShopState {
  id: 'lantern_shop' | 'velvet_exchange';
  merchant: string;
  offers: ShopOffer[];
  rethreadSold: boolean;
}

export interface RunState {
  version: 2;
  seed: number;
  node: NodeId;
  /** Main-route node that follows the current result, reward or audit. */
  next: NodeId | null;
  accounts: Record<string, number>;
  treasury: number;
  totalLifechips: number;
  characters: Record<string, Character>;
  contracts: Contract[];
  journal: Transfer[];
  player: { magic: SeatMagic; evolutionTokens: number };
  table: TableSession | null;
  tableNode: TableNodeId | null;
  /** Player's stack when the current table began (for net results and debt repayment). */
  entryStack: number;
  results: TableResult[];
  shop: ShopState | null;
  reward: RewardOption[] | null;
  duties: DutyState | null;
  eventResolved: boolean;
  auditedTables: TableNodeId[];
  log: string[];
  /** Applied one-time migrations and ingress keys (design v0.7 §11). */
  migrations: string[];
  /** The original local total (1,009 in P4) plus every audited external ingress. */
  perimeter: { base: number; expansions: PerimeterExpansion[] };
  /** Act I chapter ends reached, in order. */
  chapters: NodeId[];
  /** One-shot route flags (events heard, items sold, pending tells). */
  flags: string[];
  /** Public play observed at tables, per character. */
  observed: Record<string, PublicStats>;
  /** Court of Mirrors / Silver Archive dossier, shown at the next table only (design v0.8 §02). */
  dossier?: (Dossier & { witnessed: PublicStats | null }) | null;
}

export class RunError extends Error {}

// ───────────────────────────── data ─────────────────────────────

interface SeatData {
  id: string;
  stack?: string;
  /** P4 local wallet funded at world creation. */
  initial?: number;
  /** P5 actor funded once from an external ledger at first appearance (design v0.7 §11). */
  external?: number;
  /** Cinder: replaces `id` when that character is dead or has no Lifechips. */
  substitute?: { id: string; external: number };
}

interface TableNodeData {
  id: TableNodeId;
  label: string;
  seats: SeatData[];
  small_blind: number;
  big_blind: number;
  max_hands?: number;
  hand_cap?: number;
  blind_schedule?: { hands: string; sb: number; bb: number }[];
}

const P4_TABLES = Object.fromEntries(
  [...routeData.nodes, ...fallenData.nodes]
    .filter((n) => n.id in { contract_1: 1, contract_2: 1, boss_ledger: 1, fallen_low_table: 1 })
    .map((n) => [n.id, { ...n, label: 'label' in n ? n.label : (n as { title: string }).title } as TableNodeData]),
) as Record<string, TableNodeData>;

/** External ledger accounts of P5 (design v0.7 §11): who funds whom, once. */
export const ACT2_LEDGER = act2Data.actor_migration.external_origin_account;
export const ACT2_INGRESS_KEY = act2Data.actor_migration.exactly_once_key;
export const CINDER_LEDGER = cinderData.external_origin_account;
export const CINDER_INGRESS_KEY = 'cinder_ingress_v0.7';

interface Act2Table {
  id: string;
  name: string;
  seats: string[];
  new_opponent_opening_wallets: Record<string, number>;
  small_blind?: number;
  big_blind?: number;
  max_hands: number;
  blind_schedule?: { hands: string; sb: number; bb: number }[];
}

const P5_TABLES: Record<string, TableNodeData> = Object.fromEntries(
  (act2Data.nodes as unknown as (Act2Table & { kind: string })[])
    .filter((n) => n.kind === 'contract_table' || n.kind === 'boss_table')
    .map((n) => [
      n.id,
      {
        id: n.id as TableNodeId,
        label: n.name,
        seats: n.seats.map((id) => (id === 'player' ? { id, stack: 'carry' } : { id, external: n.new_opponent_opening_wallets[id] })),
        small_blind: n.small_blind ?? n.blind_schedule![0].sb,
        big_blind: n.big_blind ?? n.blind_schedule![0].bb,
        max_hands: n.max_hands,
        blind_schedule: n.blind_schedule,
      } satisfies TableNodeData,
    ]),
);
{
  const ember = cinderData.nodes.find((n) => n.id === 'cinder_low_table')!;
  const subs = ember.alternative_rival_external_opening_wallets!;
  P5_TABLES.cinder_low_table = {
    id: 'cinder_low_table',
    label: ember.title,
    seats: [
      { id: 'player', stack: 'carry' },
      { id: 'night_clerk', substitute: { id: 'ash_porter', external: subs.ash_porter } },
      { id: 'dock_runner', substitute: { id: 'cinder_mason', external: subs.cinder_mason } },
    ],
    small_blind: ember.small_blind!,
    big_blind: ember.big_blind!,
    max_hands: ember.max_hands!,
  };
}

const TABLE_NODES = { ...P4_TABLES, ...P5_TABLES } as Record<TableNodeId, TableNodeData>;

/** Main-route successor of each table when the player continues alive. */
const AFTER: Record<TableNodeId, NodeId> = {
  contract_1: 'lantern_shop',
  contract_2: 'boss_ledger',
  boss_ledger: 'slice_victory',
  fallen_low_table: 'fallen_audience',
  cinder_low_table: 'oath_hearing',
  masked_salon: 'velvet_exchange',
  velvet_arena: 'crown_inquest',
  crown_inquest: 'act2_victory',
};

/** Initial world accounts (design v0.6: every wallet funded from named accounts at world creation). */
function initialAccounts(): Record<string, number> {
  const accounts: Record<string, number> = { you: 100 };
  for (const node of Object.values(P4_TABLES)) {
    for (const s of node.seats) if (s.id !== 'player' && s.initial !== undefined) accounts[s.id] = s.initial;
  }
  accounts[shopData.merchant.id] = shopData.merchant.initial_actual_lifechips;
  accounts.patron_witness_escrow = 0;
  return accounts;
}

export const PLAYER_ID = 'you';
const COMMON_RELICS = relicData.relics.filter((r) => r.rarity === 'common').map((r) => r.id as RelicId);

function characterFor(id: string): Character {
  if (id === PLAYER_ID) return createCharacter(PLAYER_ID, 'You', 'human', 'player');
  return createCharacter(id, PROFILES[id]?.name ?? id, 'ai', id);
}

// ───────────────────────────── creation ─────────────────────────────

export function createRun(seed: number): RunState {
  const accounts = initialAccounts();
  const characters = Object.fromEntries(Object.keys(accounts).filter((id) => PROFILES[id] || id === PLAYER_ID).map((id) => [id, characterFor(id)]));
  const sum = Object.values(accounts).reduce((a, b) => a + b, 0);
  const run: RunState = {
    version: 2,
    seed: seed >>> 0,
    node: 'start',
    next: null,
    accounts,
    treasury: LEDGER_TREASURY_INITIAL,
    totalLifechips: sum + LEDGER_TREASURY_INITIAL,
    characters,
    contracts: [],
    journal: [],
    player: { magic: createSeatMagic(createSpellbook(PLAYER_ID, BEGINNER_SPELLBOOK, deriveSeed(seed, 0x5b))), evolutionTokens: 0 },
    table: null,
    tableNode: null,
    entryStack: 0,
    results: [],
    shop: null,
    reward: null,
    duties: null,
    eventResolved: false,
    auditedTables: [],
    log: ['The Wagerer arrives in the Lantern district with 100 Lifechips.'],
    migrations: [],
    perimeter: { base: sum + LEDGER_TREASURY_INITIAL, expansions: [] },
    chapters: [],
    flags: [],
    observed: {},
  };
  assertRunInvariants(run);
  return run;
}

// ───────────────────────────── accounting ─────────────────────────────

function transfer(run: RunState, from: string, to: string, amount: number, reason: string): void {
  if (!Number.isInteger(amount) || amount < 0) throw new RunError('Invalid transfer amount');
  if (amount === 0) return;
  if ((run.accounts[from] ?? 0) < amount) throw new RunError(`${from} cannot pay ${amount}`);
  run.accounts[from] -= amount;
  run.accounts[to] = (run.accounts[to] ?? 0) + amount;
  run.journal.push({ id: run.journal.length + 1, from, to, amount, reason });
}

/** Lifechips currently at the table (stacks, survivors' endowments, and the treasury brought along). */
function tableChips(t: TableSession): number {
  const stacks = t.table.hand.phase === 'betting' ? t.table.hand.chipTotal : tableStacks(t).reduce((a, b) => a + b, 0);
  return stacks + t.world.characters.reduce((s, c) => s + c.offTable, 0) + t.world.treasury;
}

export function assertRunInvariants(run: RunState): void {
  const accounts = Object.values(run.accounts).reduce((a, b) => a + b, 0);
  const sum = accounts + run.treasury + (run.table ? tableChips(run.table) : 0);
  if (sum !== run.totalLifechips) throw new Error(`Run invariant: ${sum} Lifechips, expected ${run.totalLifechips}`);
  const perimeter = run.perimeter.base + run.perimeter.expansions.reduce((a, e) => a + e.amount, 0);
  if (perimeter !== run.totalLifechips) throw new Error(`Run invariant: perimeter ${perimeter} ≠ total ${run.totalLifechips}`);
  if (Object.values(run.accounts).some((v) => !Number.isInteger(v) || v < 0) || run.treasury < 0) {
    throw new Error('Run invariant: negative or invalid balance');
  }
  const relics = run.player.magic.relics ?? [];
  if (new Set(relics).size !== relics.length || relics.length > SLOT_LIMITS.relics) throw new Error('Run invariant: relic slots');
  if ((run.player.magic.covenants ?? []).length > SLOT_LIMITS.covenants) throw new Error('Run invariant: covenant slots');
}

/** The player's Lifechips right now (at the table, or in their account). */
export function playerChips(run: RunState): number {
  if (run.table) return tableStacks(run.table)[humanSeat(run.table)];
  return run.accounts[PLAYER_ID];
}

/** The player's live Spellbook (the table's copy while seated). */
export function playerBook(run: RunState) {
  return run.table ? run.table.table.seats[humanSeat(run.table)].book : run.player.magic.book;
}

// ───────────────────────────── external ingress (design v0.7 §11) ─────────────────────────────

/**
 * Expands the accounting perimeter exactly once per key: an external ledger
 * account is opened with `amount`, recorded as a journal entry and as a
 * perimeter expansion. The original local total stays auditable as `base`.
 */
function ensureIngress(run: RunState, key: string, account: string, amount: number): void {
  if (run.migrations.includes(key)) return;
  run.migrations.push(key);
  run.accounts[account] = (run.accounts[account] ?? 0) + amount;
  run.totalLifechips += amount;
  run.perimeter.expansions.push({ key, account, amount });
  run.journal.push({ id: run.journal.length + 1, from: 'external_jurisdiction', to: account, amount, reason: `perimeter expansion ${key}` });
}

/** Funds a new actor's opening wallet from an external ledger at its first appearance (never twice). */
function fundActor(run: RunState, ledger: string, id: string, amount: number, person = true): void {
  const key = `ingress:${id}`;
  if (run.migrations.includes(key)) return;
  run.migrations.push(key);
  transfer(run, ledger, id, amount, `opening wallet of ${id} from ${ledger}`);
  if (person && !run.characters[id]) run.characters[id] = characterFor(id);
}

/** Seat ids for a table, with Cinder substitutes for dead or penniless regulars. */
function seatIds(run: RunState, node: TableNodeData): string[] {
  return node.seats.map((s) => {
    if (s.id === 'player') return PLAYER_ID;
    if (s.substitute && (!run.characters[s.id]?.alive || (run.accounts[s.id] ?? 0) < 1)) return s.substitute.id;
    return s.id;
  });
}

// ───────────────────────────── tables ─────────────────────────────

function tableConfig(node: TableNodeData): TableConfig {
  const blinds = node.blind_schedule
    ? node.blind_schedule.map((b) => ({ fromHand: Number(b.hands.split('-')[0]), smallBlind: b.sb, bigBlind: b.bb }))
    : [{ fromHand: 1, smallBlind: node.small_blind, bigBlind: node.big_blind }];
  return { label: node.label, maxHands: node.max_hands ?? node.hand_cap ?? null, blinds };
}

function enterTable(run: RunState, nodeId: TableNodeId): void {
  const node = TABLE_NODES[nodeId];
  const ids = seatIds(run, node);
  for (const s of node.seats) {
    if (s.external !== undefined) fundActor(run, ACT2_LEDGER, s.id, s.external);
    if (s.substitute && ids.includes(s.substitute.id)) fundActor(run, CINDER_LEDGER, s.substitute.id, s.substitute.external);
  }
  const seats: SeatConfig[] = ids.map((id) =>
    id === PLAYER_ID ? { id, name: 'You', kind: 'human' } : { id, name: PROFILES[id].name, kind: 'ai', profileId: id },
  );
  const stacks = ids.map((id) => run.accounts[id]);
  if (stacks[0] < 1) throw new RunError('The player has no Lifechips to bring to the table');
  ids.forEach((id, i) => {
    run.accounts[id] = 0;
    run.journal.push({ id: run.journal.length + 1, from: id, to: `table:${nodeId}`, amount: stacks[i], reason: 'buy-in' });
  });
  const characters = ids.map((id) => ({ ...structuredClone(run.characters[id]), status: 'seated' as const, offTable: 0 }));
  const pm = run.player.magic;
  const whisperAether = run.flags.includes('whisper_aether') ? 1 : 0;
  run.flags = run.flags.filter((f) => f !== 'whisper_aether');
  const entryAether = Math.min(AETHER.max, AETHER.initial + ((pm.relics ?? []).includes('lantern_reservoir') ? 1 : 0) + whisperAether);
  const playerMagic: SeatMagic = { ...structuredClone(pm), book: resetForTable(pm.book), aether: entryAether, tableFlags: [], extraDraw: 0 };
  const seed = deriveSeed(run.seed, 0x7a, Object.keys(TABLE_NODES).indexOf(nodeId), run.results.length);
  const session = createSession({
    seed,
    seats,
    stacks,
    config: tableConfig(node),
    characters,
    treasury: run.treasury,
    seatMagic: ids.map((id) => (id === PLAYER_ID ? playerMagic : null)),
  });
  // The table carries the run's covenant records and journal so ids stay unique.
  session.world.contracts = structuredClone(run.contracts);
  session.world.journal = structuredClone(run.journal);
  run.treasury = 0;
  run.table = session;
  run.tableNode = nodeId;
  run.entryStack = stacks[0];
  run.node = nodeId;
  run.log.push(`${node.label} begins.`);
  // The Whispered Contract: one spell of the player's opening hand is named publicly (never a poker card).
  if (run.flags.includes('whispered_tell')) {
    run.flags = run.flags.filter((f) => f !== 'whispered_tell');
    const drawn = session.table.magic.hands[0];
    if (drawn.length) {
      const named = drawn[new Rng(deriveSeed(run.seed, 0x3a15)).nextInt(drawn.length)];
      session.table.magic.notices.push({ seat: 0, text: `A whisper names one of your spells: ${SPELLS[named.spell].name}.` });
      run.flags.push(`whisper_named:${named.spell}`);
    }
  }
}

function standingsOf(t: TableSession): Standing[] {
  const stacks = tableStacks(t);
  const rows = t.seats.map((s, i) => {
    const c = t.world.characters[i];
    const alive = c.status === 'seated' && stacks[i] > 0;
    return { id: s.id, name: s.name, stack: alive ? stacks[i] : 0, status: c.status, alive };
  });
  // Bankrupt or departed entrants rank below every surviving entrant; ties share a rank.
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stack: r.stack,
    status: r.status,
    rank: 1 + rows.filter((o) => (o.alive && !r.alive) || (o.alive === r.alive && o.stack > r.stack)).length,
  }));
}

/** Boss tables: the minimum net profit for a top-two finish to count (design v0.7 §02). */
export const BOSS_PROFIT_FLOOR: Partial<Record<TableNodeId, number>> = { boss_ledger: 12, crown_inquest: 16 };

/**
 * Contract and boss objectives (design v0.6 §03, v0.7 §02). A boss is won by
 * tying for first, or by a top-two finish with net profit of at least
 * max(floor, ⌈20% of the entry stack⌉). `entry` is the snapshot taken when the
 * player sat down, so reloading cannot move it.
 */
export function judge(nodeId: TableNodeId, standings: Standing[], net: number, entry: number): 'win' | 'alive_failure' {
  const me = standings.find((s) => s.id === PLAYER_ID)!;
  if (me.stack < 1) return 'alive_failure';
  if (nodeId === 'fallen_low_table') return 'win';
  // The Ember Steps: survival continues either way; a top-two finish avoids the Favor penalty.
  const floor = BOSS_PROFIT_FLOOR[nodeId];
  if (floor !== undefined) {
    if (me.rank === 1) return 'win';
    return me.rank <= 2 && net >= Math.max(floor, Math.ceil(0.2 * entry)) ? 'win' : 'alive_failure';
  }
  return me.rank <= 2 ? 'win' : 'alive_failure';
}

/** Closes a finished table: cash-out to accounts, write back characters and magic, judge the outcome. */
function finishTable(run: RunState): void {
  const t = run.table!;
  const nodeId = run.tableNode!;
  const status = sessionStatus(t);
  if (!['tableDone', 'tableWon', 'fallen', 'dead'].includes(status)) throw new RunError('The table is still in play');
  const stacks = tableStacks(t);
  const standings = standingsOf(t);
  const me = humanSeat(t);
  const final = stacks[me] + t.world.characters[me].offTable;

  run.treasury = t.world.treasury;
  run.contracts = t.world.contracts;
  run.journal = t.world.journal;
  t.seats.forEach((s, i) => {
    const amount = stacks[i] + t.world.characters[i].offTable;
    run.accounts[s.id] = (run.accounts[s.id] ?? 0) + amount;
    if (amount) run.journal.push({ id: run.journal.length + 1, from: `table:${nodeId}`, to: s.id, amount, reason: 'cash-out' });
    run.characters[s.id] = { ...t.world.characters[i], offTable: 0 };
  });
  run.player.magic = { ...run.player.magic, book: t.table.seats[me].book, extraDraw: 0 };
  for (const [id, tally] of Object.entries(t.tallies ?? {})) {
    const o = run.observed[id] ?? { hands: 0, vpip: 0, pfr: 0, shoves: 0 };
    run.observed[id] = { hands: o.hands + tally.hands, vpip: o.vpip + tally.vpip, pfr: o.pfr + tally.pfr, shoves: o.shoves + tally.shoves };
  }
  run.table = null;
  run.tableNode = null;

  const you = run.characters[PLAYER_ID];
  let outcome: TableOutcome;
  if (!you.alive) outcome = 'dead';
  else if (status === 'fallen') outcome = 'fallen';
  else outcome = judge(nodeId, standings, final - run.entryStack, run.entryStack);

  // Table-end duty events and debt repayment (P3 rules) for a living player.
  let repayment = 0;
  if (outcome === 'win' || outcome === 'alive_failure') {
    const meRow = standings.find((s) => s.id === PLAYER_ID)!;
    const events = ['contract_finish_player_alive'];
    if (meRow.rank <= 2) events.push('contract_finish_rank_top2_alive');
    progressDuties(run, events, `${nodeId}#end`);
    repayment = repayDebts(run, final - run.entryStack);
  }
  run.results.push({ node: nodeId, outcome, standings, net: final - run.entryStack, hands: t.handNumber, repayment });
  run.dossier = null; // a dossier serves one table only
  run.log.push(`${TABLE_NODES[nodeId].label}: ${outcome.replace('_', ' ')}.`);
  run.node = 'table_result';
}

function repayDebts(run: RunState, net: number): number {
  let paid = 0;
  run.contracts = run.contracts.map((k) => {
    if (k.debtor !== PLAYER_ID || k.pact !== 'debt' || k.status === 'cleared') return k;
    const r = repayAfterTable(k, net, run.accounts[PLAYER_ID]);
    if (r.payment > 0) {
      const creditor = k.creditor === 'ledger' ? null : k.creditor;
      if (creditor) transfer(run, PLAYER_ID, creditor, r.payment, `debt repayment (${k.id})`);
      else {
        run.accounts[PLAYER_ID] -= r.payment;
        run.treasury += r.payment;
        run.journal.push({ id: run.journal.length + 1, from: PLAYER_ID, to: 'ledger', amount: r.payment, reason: `debt repayment (${k.id})` });
      }
      paid += r.payment;
    }
    if (r.contract.status === 'cleared' && run.characters[k.creditor]) {
      run.characters[k.creditor].reputation.favor += 1; // v0.6 §01: once, when discharged in full
    }
    if (r.becameOverdue) run.characters[PLAYER_ID].reputation.favor -= 1;
    return r.contract;
  });
  return paid;
}

/** Voluntary NPC repayment at an act boundary: 15% of the wallet above its last chip (design v0.7 §07). */
export const VOLUNTARY_SHARE = 0.15;

/**
 * At most once per act boundary, every living NPC debtor pays
 * min(owed, ⌊15% × (wallet − 1)⌋) from its own wallet to its creditor. No chips
 * are earned or created, a debtor never pays its last chip, and the payment is
 * a visible journal entry even when the debtor never reappears.
 */
export function actBoundaryRepayments(run: RunState, actKey: string): void {
  run.contracts = run.contracts.map((k) => {
    if (k.pact !== 'debt' || k.status === 'cleared' || k.debtor === PLAYER_ID) return k;
    if ((k.voluntaryActs ?? []).includes(actKey)) return k;
    const debtor = run.characters[k.debtor];
    const next = { ...k, voluntaryActs: [...(k.voluntaryActs ?? []), actKey] };
    if (!debtor?.alive) return next;
    const wallet = run.accounts[k.debtor] ?? 0;
    const pay = Math.min(k.obligation - k.repaid, Math.floor(VOLUNTARY_SHARE * Math.max(0, wallet - 1)));
    if (wallet < 2 || pay <= 0) return next;
    if (k.creditor === 'ledger') {
      run.accounts[k.debtor] -= pay;
      run.treasury += pay;
      run.journal.push({ id: run.journal.length + 1, from: k.debtor, to: 'ledger', amount: pay, reason: `voluntary debt payment (${k.id}, ${actKey})` });
    } else {
      // A dead creditor's due goes to their named estate, never the void (design v0.8 §06).
      const to = run.characters[k.creditor]?.alive === false ? `estate:${k.creditor}` : k.creditor;
      transfer(run, k.debtor, to, pay, `voluntary debt payment (${k.id}, ${actKey})`);
    }
    next.repaid += pay;
    run.log.push(`${debtor.name} pays ${pay} Lifechips towards a debt.`);
    if (next.repaid >= next.obligation) {
      next.status = 'cleared';
      if (run.characters[k.creditor]) run.characters[k.creditor].reputation.favor += 1;
    }
    return next;
  });
}

// ───────────────────────────── sworn service ─────────────────────────────

interface DutyDef {
  id: string;
  giver: string;
  text: string;
  completion_condition: { event: string; disciplines?: string[] };
}

export const DUTIES = dutiesData.duties as DutyDef[];

export function activeDuty(run: RunState): DutyDef | null {
  if (!run.duties) return null;
  return DUTIES.find((d) => d.giver === run.duties!.giver && !run.duties!.completed.includes(d.id)) ?? null;
}

function dutyMatches(duty: DutyDef, events: string[]): boolean {
  const c = duty.completion_condition;
  if (c.event === 'owner_cast_spell') return (c.disciplines ?? []).some((d) => events.includes(`owner_cast_spell:${d}`));
  return events.includes(c.event);
}

/** At most one ordered duty completes per actionable event; each event id counts once. */
function progressDuties(run: RunState, events: string[], eventId: string): void {
  const d = run.duties;
  if (!d || d.usedEvents.includes(eventId)) return;
  const duty = activeDuty(run);
  if (!duty || !dutyMatches(duty, events)) return;
  d.usedEvents.push(eventId);
  d.completed.push(duty.id);
  run.characters[duty.giver].reputation.favor += 1;
  run.log.push(`Sworn duty fulfilled: ${duty.text}`);
  if (d.completed.length >= DUTIES.filter((x) => x.giver === d.giver).length) {
    run.contracts = run.contracts.map((k) => (k.id === d.contractId ? { ...k, servicesDone: k.servicesOwed, status: 'cleared' } : k));
    run.log.push('All three duties are done: the service pact is released.');
  } else {
    run.contracts = run.contracts.map((k) => (k.id === d.contractId ? { ...k, servicesDone: d.completed.length } : k));
  }
}

// ───────────────────────────── table play ─────────────────────────────

/** Duty events are judged when a hand settles, at most one duty per hand. */
function afterTableStep(run: RunState, before: TableSession): void {
  const t = run.table!;
  if (before.table.hand.phase === 'betting' && t.table.hand.phase === 'complete') {
    progressDuties(run, t.humanEvents, `${run.tableNode}#${t.handNumber}`);
  }
}

function withTableStep(run0: RunState, step: (t: TableSession) => TableSession): RunState {
  if (!run0.table) throw new RunError('No table in play');
  const run = structuredClone(run0);
  const before = run.table!;
  run.table = step(before);
  afterTableStep(run, before);
  assertRunInvariants(run);
  return run;
}

export function runHuman(run: RunState, command: HumanCommand): RunState {
  return withTableStep(run, (t) => applyHumanCommand(t, command));
}

export function runClaim(run: RunState, command: ClaimCommand): RunState {
  return withTableStep(run, (t) => applyClaim(t, command));
}

export function runAi(run: RunState): RunState {
  return withTableStep(run, stepAi);
}

export function runNextHand(run: RunState): RunState {
  return withTableStep(run, startNextHand);
}

// ───────────────────────────── route commands ─────────────────────────────

export type RunCommand =
  | { kind: 'advance' }
  | { kind: 'buy'; offer: number }
  | { kind: 'rethread'; uid: string; spell: SpellId }
  | { kind: 'leaveShop'; to: 'optional_event' | 'contract_2' | 'mirror_audience' | 'secret_bargain' }
  /** Petition, Court of Mirrors (`rival`: whose dossier) or Whispered Contract (`uid`: spell to attune). */
  | { kind: 'event'; take: boolean; rival?: string; uid?: string }
  /** Act II entry after an exile (design v0.7 §09): lose Favor, or surrender one relic. */
  | { kind: 'petition'; choice: 'favor' | 'relic'; relic?: RelicId }
  /** The Broker Understairs buys one relic at half its shop value, from his own wallet. */
  | { kind: 'sell'; relic: RelicId }
  /** `replace`: with full relic slots, the owned relic given up (no refund); `uid`: spell for a Resonance reward. */
  | { kind: 'reward'; index: number | null; replace?: RelicId; uid?: string }
  | { kind: 'setback'; choice: 'public_record' | 'break_attunement'; uid?: string }
  | { kind: 'evolve'; uid: string; branch: SpellId; useToken?: boolean }
  /** Evolution token with no qualified spell: +1 Resonance to one unevolved instance (design v0.7 §04). */
  | { kind: 'attune'; uid: string };

/** Applies one route-level command. Pure: returns a new state; throws RunError when illegal. */
export function runCommand(run0: RunState, cmd: RunCommand): RunState {
  const run = structuredClone(run0);
  switch (cmd.kind) {
    case 'advance':
      advance(run);
      break;
    case 'buy':
      buy(run, cmd.offer);
      break;
    case 'rethread':
      rethread(run, cmd.uid, cmd.spell);
      break;
    case 'leaveShop': {
      const exits: Partial<Record<NodeId, NodeId[]>> = {
        lantern_shop: run.eventResolved ? ['contract_2'] : ['optional_event', 'contract_2'],
        velvet_exchange: ['mirror_audience', 'secret_bargain'],
      };
      if (!(exits[run.node] ?? []).includes(cmd.to)) throw new RunError('You cannot go that way from here');
      goTo(run, cmd.to);
      break;
    }
    case 'event':
      resolveEvent(run, cmd.take, cmd.rival, cmd.uid);
      break;
    case 'petition':
      petition(run, cmd.choice, cmd.relic);
      break;
    case 'sell':
      sellToBroker(run, cmd.relic);
      break;
    case 'reward':
      chooseReward(run, cmd.index, cmd.replace, cmd.uid);
      break;
    case 'setback':
      resolveSetback(run, cmd.choice, cmd.uid);
      break;
    case 'evolve':
      evolve(run, cmd.uid, cmd.branch, cmd.useToken ?? false);
      break;
    case 'attune':
      attune(run, cmd.uid);
      break;
  }
  assertRunInvariants(run);
  return run;
}

function goTo(run: RunState, node: NodeId): void {
  if (node in TABLE_NODES) return enterTable(run, node as TableNodeId);
  run.node = node;
  if (node === 'lantern_shop' && run.shop?.id !== 'lantern_shop') openShop(run, 'lantern_shop');
  if (node === 'velvet_exchange' && run.shop?.id !== 'velvet_exchange') openShop(run, 'velvet_exchange');
  if (node === 'gilded_gate') {
    ensureIngress(run, ACT2_INGRESS_KEY, ACT2_LEDGER, act2Data.actor_migration.external_origin_initial);
    if (!run.flags.includes('act2_entered')) run.flags.push('act2_entered');
    run.log.push('The Gilded Gate opens onto the Circuit.');
  }
  if (node === 'cinder_broker') {
    ensureIngress(run, CINDER_INGRESS_KEY, CINDER_LEDGER, cinderData.external_origin_initial);
    fundActor(run, CINDER_LEDGER, BROKER_ID, BROKER.merchant_opening_wallet, false);
  }
  if (CHAPTER_ENDS.includes(node) && !run.chapters.includes(node)) run.chapters.push(node);
}

const BROKER = cinderData.nodes.find((n) => n.id === 'cinder_broker')! as unknown as { merchant_wallet: string; merchant_opening_wallet: number };
export const BROKER_ID = BROKER.merchant_wallet;
const VELVET = act2Data.nodes.find((n) => n.id === 'velvet_exchange')! as unknown as { merchant_id: string; merchant_initial_external_wallet: number };
export const VELVET_MERCHANT = VELVET.merchant_id;

/** True when the player owes no active debt or service (design v0.7 §10: free at the Hearing). */
export function playerIsFree(run: RunState): boolean {
  return !run.contracts.some((k) => k.debtor === PLAYER_ID && k.status !== 'cleared' && k.pact !== 'mercy');
}

function advance(run: RunState): void {
  switch (run.node) {
    case 'start':
      return goTo(run, 'contract_1');
    case 'contract_1':
    case 'contract_2':
    case 'boss_ledger':
    case 'fallen_low_table':
    case 'cinder_low_table':
    case 'masked_salon':
    case 'velvet_arena':
    case 'crown_inquest':
      return finishTable(run);
    case 'table_result':
      return afterResult(run);
    case 'fallen_registry':
      return goTo(run, 'fallen_low_table');
    case 'fallen_audience':
      goTo(run, 'fallen_unlocked');
      run.log.push('Fallen route unlocked: the Cinder road continues below.');
      return;
    case 'fallen_unlocked':
      return goTo(run, 'cinder_broker');
    case 'slice_victory':
      // A published invitation: Favor +1, no chips (design v0.7 §09).
      run.characters[PLAYER_ID].reputation.favor += 1;
      actBoundaryRepayments(run, 'act1');
      return goTo(run, 'gilded_gate');
    case 'slice_exile':
      run.node = 'act2_petition';
      return;
    case 'gilded_gate':
      return goTo(run, 'masked_salon');
    case 'cinder_broker':
      return goTo(run, 'cinder_low_table');
    case 'oath_hearing':
      return leaveHearing(run);
    case 'mirror_audience':
      if (!mirrorChoice(run)) throw new RunError('Consult the Court or decline first');
      return goTo(run, 'velvet_arena');
    default:
      throw new RunError(`Nothing to advance at ${run.node}`);
  }
}

function afterResult(run: RunState): void {
  const r = run.results.at(-1)!;
  if (r.outcome === 'dead') return void (run.node = 'death');
  if (r.outcome === 'fallen') return enterFallen(run);
  if (r.node === 'fallen_low_table') return goTo(run, 'fallen_audience');
  if (r.node === 'boss_ledger') return goTo(run, r.outcome === 'win' ? 'slice_victory' : 'slice_exile');
  if (r.node === 'crown_inquest') return goTo(run, r.outcome === 'win' ? 'act2_victory' : 'act2_living_exile');
  if (r.node === 'cinder_low_table') {
    if (r.outcome === 'win' && !run.flags.includes('cinder_pass')) {
      run.characters[PLAYER_ID].reputation.favor += 1;
      run.flags.push('cinder_pass');
      run.log.push('Top two on the Ember Steps: Favor +1 and a Cinder Pass.');
    }
    if (r.outcome === 'alive_failure') {
      run.characters[PLAYER_ID].reputation.favor -= 1;
      run.log.push('You leave the Ember Steps outside the top two: Favor −1.');
    }
    return goTo(run, 'oath_hearing');
  }
  run.next = AFTER[r.node];
  if (r.outcome === 'alive_failure') {
    run.node = 'setback_audience';
    return;
  }
  const offers = rewardOffers(run, r.node);
  if (offers.length) {
    run.reward = offers;
    run.node = 'reward';
  } else goTo(run, run.next);
}

/** Seeded, non-owned reward offers: C1 three common relics; C2 one relic or an evolution token. */
export function rewardOffers(run: RunState, node: TableNodeId): RewardOption[] {
  const owned = run.player.magic.relics ?? [];
  const full = owned.length >= SLOT_LIMITS.relics;
  const rng = new Rng(deriveSeed(run.seed, 0x7e, node.length, run.results.length));
  if (node === 'contract_1') {
    return full ? [] : rng.shuffle(COMMON_RELICS.filter((r) => !owned.includes(r))).slice(0, 3).map((relic) => ({ kind: 'relic', relic }));
  }
  if (node === 'contract_2' || node === 'velvet_arena') {
    const relic = weightedRelic(rng, RELIC_IDS.filter((r) => !owned.includes(r)));
    return [...(relic ? [{ kind: 'relic' as const, relic }] : []), { kind: 'evolution_token' }];
  }
  if (node === 'masked_salon') {
    const relic = weightedRelic(rng, RELIC_IDS.filter((r) => !owned.includes(r)));
    return [...(relic ? [{ kind: 'relic' as const, relic }] : []), ...(resonanceTargets(run).length ? [{ kind: 'resonance' as const }] : [])];
  }
  return [];
}

/** Rarity weights for a seeded non-owned relic; empty tiers are dropped and the rest re-normalized. */
export const RARITY_WEIGHTS: Record<string, number> = { common: 60, uncommon: 35, rare: 5 };

function weightedRelic(rng: Rng, candidates: RelicId[]): RelicId | null {
  const tiers = Object.keys(RARITY_WEIGHTS).filter((t) => candidates.some((r) => RELICS[r].rarity === t));
  if (!tiers.length) return null;
  const total = tiers.reduce((a, t) => a + RARITY_WEIGHTS[t], 0);
  let roll = rng.nextFloat() * total;
  let tier = tiers[tiers.length - 1];
  for (const t of tiers) {
    if ((roll -= RARITY_WEIGHTS[t]) < 0) {
      tier = t;
      break;
    }
  }
  const pool = candidates.filter((r) => RELICS[r].rarity === tier);
  return pool[rng.nextInt(pool.length)];
}

function chooseReward(run: RunState, index: number | null, replace?: RelicId, uid?: string): void {
  if (run.node !== 'reward' || !run.reward) throw new RunError('No reward to choose');
  if (index !== null) {
    const choice = run.reward[index];
    if (!choice) throw new RunError('No such reward');
    if (choice.kind === 'relic') {
      let relics = run.player.magic.relics ?? [];
      if (relics.length >= SLOT_LIMITS.relics) {
        if (!replace || !relics.includes(replace)) throw new RunError('Your relic slots are full: choose one relic to give up');
        relics = relics.filter((r) => r !== replace);
        run.log.push(`${RELICS[replace].name} is surrendered; relics are never sold back for Lifechips.`);
      }
      run.player.magic.relics = [...relics, choice.relic];
      run.log.push(`Reward: ${RELICS[choice.relic].name}.`);
    } else if (choice.kind === 'resonance') {
      grantResonance(run, uid, 'Reward');
    } else {
      run.player.evolutionTokens += 1;
      run.log.push('Reward: a spell evolution token.');
    }
  }
  run.reward = null;
  goTo(run, run.next!);
}

function resolveSetback(run: RunState, choice: 'public_record' | 'break_attunement', uid?: string): void {
  if (run.node !== 'setback_audience') throw new RunError('No audit is pending');
  const failed = run.results.at(-1)!.node;
  if (run.auditedTables.includes(failed)) throw new RunError('This table has already been audited');
  run.auditedTables.push(failed);
  const you = run.characters[PLAYER_ID];
  you.reputation.favor -= 1;
  const attuned = allCards(run.player.magic.book).filter((c) => (c.resonance ?? 0) > 0);
  if (choice === 'break_attunement' && attuned.length) {
    const target = uid ?? attuned[0].uid;
    if (!attuned.some((c) => c.uid === target)) throw new RunError('That spell has no Resonance to break');
    run.player.magic.book = adjustResonance(run.player.magic.book, target, -1);
    run.log.push('Keeper’s Audit: one spell’s attunement is broken.');
  } else {
    you.reputation.notoriety += 1;
    run.log.push('Keeper’s Audit: your failure enters the public record.');
  }
  goTo(run, run.next!);
}

// ───────────────────────────── shop & event ─────────────────────────────

function openShop(run: RunState, id: ShopState['id']): void {
  const owned = run.player.magic.relics ?? [];
  const rng = new Rng(id === 'lantern_shop' ? deriveSeed(run.seed, 0x5e1e) : deriveSeed(run.seed, 0x5e1e, 2));
  const offers = rng
    .shuffle(RELIC_IDS.filter((r) => !owned.includes(r)))
    .slice(0, 3)
    .map((relic) => ({ relic, price: RELICS[relic].price, sold: false }));
  let merchant = shopData.merchant.id;
  if (id === 'velvet_exchange') {
    merchant = VELVET_MERCHANT;
    fundActor(run, ACT2_LEDGER, merchant, VELVET.merchant_initial_external_wallet, false);
  }
  run.shop = { id, merchant, offers, rethreadSold: false };
}

export const CANNOT_BUY = shopData.cannot_buy_message;
export const SOLD_OUT = shopData.sold_out_message;
export const RETHREAD_PRICE = shopData.other_offers[0].price;

function pay(run: RunState, price: number, to: string, reason: string): void {
  if (run.accounts[PLAYER_ID] - price < 1) throw new RunError(CANNOT_BUY);
  transfer(run, PLAYER_ID, to, price, reason);
}

function inShop(run: RunState): boolean {
  return !!run.shop && run.node === run.shop.id;
}

function buy(run: RunState, index: number): void {
  if (!inShop(run)) throw new RunError('Not in the shop');
  const shop = run.shop!;
  const offer = shop.offers[index];
  if (!offer) throw new RunError('No such offer');
  if (offer.sold) throw new RunError(SOLD_OUT);
  const relics = run.player.magic.relics ?? [];
  if (relics.includes(offer.relic)) throw new RunError('You already carry that relic');
  if (relics.length >= SLOT_LIMITS.relics) throw new RunError('Your relic slots are full');
  pay(run, offer.price, shop.merchant, `bought ${offer.relic}`);
  offer.sold = true;
  run.player.magic.relics = [...relics, offer.relic];
  run.log.push(`Bought ${RELICS[offer.relic].name} for ${offer.price}.`);
}

function rethread(run: RunState, uid: string, spell: SpellId): void {
  if (!inShop(run)) throw new RunError('Not in the shop');
  if (run.shop!.rethreadSold) throw new RunError(SOLD_OUT);
  const card = allCards(run.player.magic.book).find((c) => c.uid === uid);
  if (!card || !isBaseSpell(card.spell)) throw new RunError('Only an owned base spell can be rethreaded');
  if (!isBaseSpell(spell) || spell === card.spell) throw new RunError('Choose a different starter spell');
  pay(run, RETHREAD_PRICE, run.shop!.merchant, 'spell rethread');
  run.player.magic.book = replaceInstance(run.player.magic.book, uid, spell);
  run.shop!.rethreadSold = true;
  run.log.push(`Spell Rethread: ${SPELLS[card.spell].name} becomes ${SPELLS[spell].name}.`);
}

export const OPEN_BOOK_FEE = routeData.nodes.find((n) => n.id === 'optional_event')!.entries!.find((e) => e.id === 'take_covenant')!.cost_chips!;

function resolveEvent(run: RunState, take: boolean, rival?: string, uid?: string): void {
  if (run.node === 'mirror_audience' || run.node === 'secret_bargain') return resolveAct2Event(run, take, rival, uid);
  if (run.node !== 'optional_event' || run.eventResolved) throw new RunError('The petition is not open');
  if (take) {
    const covenants = run.player.magic.covenants ?? [];
    if (covenants.length >= SLOT_LIMITS.covenants) throw new RunError('Your covenant slots are full');
    pay(run, OPEN_BOOK_FEE, 'patron_witness_escrow', 'Covenant of the Open Book');
    run.player.magic.covenants = [...covenants, 'covenant_open_book'];
    run.log.push('You bind yourself to the Covenant of the Open Book.');
  } else run.log.push('You decline the Mirror’s Petition.');
  run.eventResolved = true;
  goTo(run, 'contract_2');
}

/** The rival the Court of Mirrors showed, if any. */
export function mirrorChoice(run: RunState): string | null {
  return run.flags.find((f) => f.startsWith('mirror:'))?.slice('mirror:'.length) ?? null;
}

const ARENA_RIVALS = (act2Data.nodes.find((n) => n.id === 'velvet_arena')! as unknown as { seats: string[] }).seats.filter((x) => x !== 'player');

/** Court of Mirrors (design v0.8 §02): a dossier on one rival of the next table — Witness Arden or Livia Shade. */
export function mirrorCandidates(run: RunState): string[] {
  void run;
  return ARENA_RIVALS;
}

/** Records a seeded public dossier of at most 12 hands, supplemented by what the player witnessed. */
function makeDossier(run: RunState, rival: string, peers: string[], salt: number): void {
  const others = peers.filter((p) => p !== rival).map((p) => PROFILES[p]);
  const d = publicDossier(PROFILES[rival], others.length ? others : [PROFILES.corvin], DOSSIER_HANDS, deriveSeed(run.seed, salt, rival.length));
  run.dossier = { ...d, witnessed: run.observed[rival] ?? null };
}

export const DOSSIER_HANDS = 12;

/** Owned, unevolved instances below 2 Resonance (Whispered Contract, Salon reward, Silver Archive). */
export function resonanceTargets(run: RunState): SpellCard[] {
  return allCards(playerBook(run)).filter((c) => isBaseSpell(c.spell) && (c.resonance ?? 0) < 2);
}

function grantResonance(run: RunState, uid: string | undefined, why: string): void {
  const targets = resonanceTargets(run);
  if (!uid || !targets.some((c) => c.uid === uid)) throw new RunError('Choose an unevolved spell below 2 Resonance');
  if (run.table) {
    const me = humanSeat(run.table);
    run.table.table.seats[me].book = adjustResonance(run.table.table.seats[me].book, uid, 1);
  } else run.player.magic.book = adjustResonance(run.player.magic.book, uid, 1);
  run.log.push(`${why}: ${SPELLS[targets.find((c) => c.uid === uid)!.spell].name} gains 1 Resonance.`);
}

function resolveAct2Event(run: RunState, take: boolean, rival?: string, uid?: string): void {
  if (run.node === 'mirror_audience') {
    // Design v0.7 §09: study one rival's public pattern; no hidden cards, no Lifechips.
    if (mirrorChoice(run)) throw new RunError('The Court shows one rival only');
    if (take) {
      if (!rival || !mirrorCandidates(run).includes(rival)) throw new RunError('Choose Witness Arden or Livia Shade');
      run.flags.push(`mirror:${rival}`);
      makeDossier(run, rival, [...ARENA_RIVALS, 'isolde_morn'], 0xd055);
      run.log.push(`The Court of Mirrors shows a dossier on ${PROFILES[rival].name}.`);
      return; // stay to study the reflection; `advance` leaves for the Arena
    }
    run.log.push('You leave the Court of Mirrors unconsulted.');
  } else {
    // The Whispered Contract (design v0.8 §01): +1 Resonance to an unevolved spell below 2 —
    // or, if none, +1 Aether at the next table — for +1 Notoriety and one disclosed spell.
    if (take) {
      if (resonanceTargets(run).length) grantResonance(run, uid, 'The Whispered Contract');
      else run.flags.push('whisper_aether');
      run.characters[PLAYER_ID].reputation.notoriety += 1;
      run.flags.push('whispered_tell');
      run.log.push('You accept the Whispered Contract.');
    } else run.log.push('You decline the Whispered Contract.');
  }
  goTo(run, 'velvet_arena');
}

/** Act II entry after a living exile: Favor −1 (not below −3), or surrender one relic. No chips move. */
function petition(run: RunState, choice: 'favor' | 'relic', relic?: RelicId): void {
  if (run.node !== 'act2_petition') throw new RunError('No petition is open');
  const you = run.characters[PLAYER_ID];
  if (choice === 'favor') {
    you.reputation.favor = Math.max(PETITION_FAVOR_FLOOR, you.reputation.favor - 1);
    run.log.push('The Ledger accepts your petition at the cost of your standing.');
  } else {
    const relics = run.player.magic.relics ?? [];
    if (!relic || !relics.includes(relic)) throw new RunError('Choose a relic you carry');
    run.player.magic.relics = relics.filter((r) => r !== relic);
    run.log.push(`The Ledger takes ${RELICS[relic].name} as the price of entry.`);
  }
  actBoundaryRepayments(run, 'act1');
  goTo(run, 'gilded_gate');
}

export const PETITION_FAVOR_FLOOR = -3;

/** Half the documented shop value, paid from the Broker's actual wallet (design v0.7 §10). */
export function brokerPrice(relic: RelicId): number {
  return Math.floor(RELICS[relic].price * 0.5);
}

function sellToBroker(run: RunState, relic: RelicId): void {
  if (run.node !== 'cinder_broker') throw new RunError('The Broker is not here');
  if (run.flags.includes('broker_sold')) throw new RunError('The Broker buys only once');
  const relics = run.player.magic.relics ?? [];
  if (!relics.includes(relic)) throw new RunError('You do not carry that relic');
  const price = brokerPrice(relic);
  if ((run.accounts[BROKER_ID] ?? 0) < price) throw new RunError('The Broker cannot afford it');
  transfer(run, BROKER_ID, PLAYER_ID, price, `Broker buys ${relic}`);
  run.player.magic.relics = relics.filter((r) => r !== relic);
  run.flags.push('broker_sold');
  run.log.push(`The Broker pays ${price} Lifechips for ${RELICS[relic].name}.`);
}

/**
 * The Oathbreaker Hearing (design v0.7 §10): no forgiveness. A free character
 * climbs to the Gilded Gate as Unbound Fallen; a bound one goes below to the
 * Undercircuit with obligations intact. A character who already walked the
 * Circuit before falling leaves as a living exile instead of replaying it.
 */
function leaveHearing(run: RunState): void {
  actBoundaryRepayments(run, 'cinder_hearing');
  if (!playerIsFree(run)) {
    run.log.push('Still bound, you take the stairs down to the Undercircuit.');
    return goTo(run, 'undercircuit_entry');
  }
  run.characters[PLAYER_ID].socialRank = 'UNBOUND_FALLEN';
  if (run.flags.includes('act2_entered')) {
    run.log.push('Unbound, you leave the Circuit you once walked.');
    return goTo(run, 'act2_living_exile');
  }
  run.log.push('Unbound, you climb the Stairs Above.');
  goTo(run, 'gilded_gate');
}

// ───────────────────────────── evolution ─────────────────────────────

export interface EvolutionOffer {
  card: SpellCard;
  branches: [SpellId, SpellId];
  /** True when only an evolution token makes this instance eligible. */
  needsToken: boolean;
}

/** Instances that may evolve now: Resonance at threshold, or at least 1 with a token. */
export function evolutionOffers(run: RunState): EvolutionOffer[] {
  if (run.table && run.table.table.hand.phase === 'betting') return [];
  const offers: EvolutionOffer[] = [];
  for (const card of allCards(playerBook(run))) {
    if (!isBaseSpell(card.spell)) continue;
    const evo = EVOLUTIONS[card.spell];
    const r = card.resonance ?? 0;
    if (r >= evo.threshold) offers.push({ card, branches: evo.branches, needsToken: false });
    else if (r >= 1 && run.player.evolutionTokens > 0) offers.push({ card, branches: evo.branches, needsToken: true });
  }
  return offers;
}

/** Unevolved instances a token may attune: only when no base instance has Resonance ≥ 1. */
export function attuneOptions(run: RunState): SpellCard[] {
  if (run.player.evolutionTokens < 1) return [];
  if (run.table && run.table.table.hand.phase === 'betting') return [];
  const base = allCards(playerBook(run)).filter((c) => isBaseSpell(c.spell));
  if (base.some((c) => (c.resonance ?? 0) >= 1)) return [];
  return base;
}

function attune(run: RunState, uid: string): void {
  if (!attuneOptions(run).some((c) => c.uid === uid)) throw new RunError('The token can only attune when no spell is ready to evolve');
  run.player.evolutionTokens -= 1;
  if (run.table) {
    const me = humanSeat(run.table);
    run.table.table.seats[me].book = adjustResonance(run.table.table.seats[me].book, uid, 1);
  } else run.player.magic.book = adjustResonance(run.player.magic.book, uid, 1);
  const card = allCards(playerBook(run)).find((c) => c.uid === uid)!;
  run.log.push(`The token attunes ${SPELLS[card.spell].name}: Resonance +1.`);
}

function evolve(run: RunState, uid: string, branch: SpellId, useToken: boolean): void {
  const offer = evolutionOffers(run).find((o) => o.card.uid === uid);
  if (!offer) throw new RunError('That spell cannot evolve now (only between hands, once qualified)');
  if (!offer.branches.includes(branch)) throw new RunError('Not one of this spell’s branches');
  if (offer.needsToken && !useToken) throw new RunError('This evolution needs a token');
  if (offer.needsToken) run.player.evolutionTokens -= 1;
  if (run.table) {
    const me = humanSeat(run.table);
    run.table.table.seats[me].book = replaceInstance(run.table.table.seats[me].book, uid, branch);
  } else {
    run.player.magic.book = replaceInstance(run.player.magic.book, uid, branch);
  }
  run.log.push(`${SPELLS[offer.card.spell].name} evolves into ${SPELLS[branch].name}.`);
}

// ───────────────────────────── the Fallen ─────────────────────────────

function enterFallen(run: RunState): void {
  const contract = [...run.contracts].reverse().find((k) => k.debtor === PLAYER_ID);
  if (contract?.pact === 'service' && contract.status !== 'cleared') {
    run.duties = { contractId: contract.id, giver: contract.creditor, completed: [], usedEvents: [] };
  }
  run.characters[PLAYER_ID].socialRank = 'FALLEN';
  run.node = 'fallen_registry';
  run.log.push('The Registry Below records your covenant.');
}

/**
 * Converts a P3 save whose player left the table as one of the Fallen into a run
 * at the Registry Below. Balances carry over exactly (table stacks and endowments
 * become account balances); the rest of the world is initialised as usual.
 */
export function importFallenSession(p3: TableSession, seed: number): RunState {
  const run = createRun(seed);
  const stacks = tableStacks(p3);
  p3.seats.forEach((s, i) => {
    run.accounts[s.id] = stacks[i] + p3.world.characters[i].offTable;
    run.characters[s.id] = { ...p3.world.characters[i], offTable: 0 };
  });
  run.treasury = p3.world.treasury;
  run.contracts = structuredClone(p3.world.contracts);
  run.journal = structuredClone(p3.world.journal);
  run.player.magic = { ...run.player.magic, book: p3.table.seats[humanSeat(p3)].book };
  run.totalLifechips = Object.values(run.accounts).reduce((a, b) => a + b, 0) + run.treasury;
  run.results.push({ node: 'contract_1', outcome: 'fallen', standings: [], net: 0, hands: p3.handNumber, repayment: 0 });
  enterFallen(run);
  assertRunInvariants(run);
  return run;
}

export { TABLE_NODES };

// ───────────────────────────── persistence ─────────────────────────────

export const RUN_SAVE_KEY = 'lastWager.run.v1';

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function saveRun(store: Store, run: RunState): void {
  store.setItem(RUN_SAVE_KEY, JSON.stringify(run));
}

/**
 * Upgrades a P4 (v1) run to v2 exactly once (design v0.7 §11): new fields are
 * added, no Lifechip moves, and the original total becomes the perimeter base.
 */
export function migrateRun(raw: unknown): RunState {
  const run = raw as RunState & { version: number };
  if (run.version === 2) return run;
  if (run.version !== 1) throw new RunError('Unknown run version');
  run.version = 2;
  run.migrations = ['save_v2'];
  run.perimeter = { base: run.totalLifechips, expansions: [] };
  run.chapters = CHAPTER_ENDS.includes(run.node) ? [run.node] : [];
  run.flags = [];
  run.observed = {};
  if (run.shop) run.shop = { ...run.shop, id: 'lantern_shop', merchant: shopData.merchant.id };
  run.log.push('Your chronicle is carried into the wider world (save v2).');
  return run;
}

/** Restores a saved run exactly (migrating a v1 save), or null when absent or invalid. */
export function loadRun(store: Store): RunState | null {
  const raw = store.getItem(RUN_SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: number; accounts?: unknown; player?: unknown };
    if (!parsed.accounts || !parsed.player) return null;
    const run = migrateRun(parsed);
    assertRunInvariants(run);
    return run;
  } catch {
    return null;
  }
}

/**
 * Reads a P3 save (table v3 or v4) whose player left the table alive as one of
 * the Fallen. Returns null for anything else, so a corrupt or unrelated save can
 * never mint a rescue.
 */
export function fallenFromSave(raw: string | null, seed: number): RunState | null {
  if (!raw) return null;
  try {
    const p3 = JSON.parse(raw) as TableSession;
    if ((p3.version as number) !== 3 && p3.version !== 4) return null;
    const me = humanSeat(p3);
    const you = p3.world.characters[me];
    if (!you || you.status !== 'exited' || !you.alive) return null;
    if (!p3.world.contracts.some((k) => k.debtor === you.id)) return null;
    // Older saves predate some reputation fields.
    const blank = characterFor(PLAYER_ID).reputation;
    for (const c of p3.world.characters) c.reputation = { ...blank, ...c.reputation };
    return importFallenSession(p3, seed);
  } catch {
    return null;
  }
}
