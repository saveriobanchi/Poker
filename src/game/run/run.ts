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

export type TableNodeId = 'contract_1' | 'contract_2' | 'boss_ledger' | 'fallen_low_table';
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
  | 'death';

export const ENDINGS: NodeId[] = ['slice_victory', 'slice_exile', 'fallen_unlocked', 'death'];

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

export type RewardOption = { kind: 'relic'; relic: RelicId } | { kind: 'evolution_token' };

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

export interface RunState {
  version: 1;
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
  shop: { offers: ShopOffer[]; rethreadSold: boolean } | null;
  reward: RewardOption[] | null;
  duties: DutyState | null;
  eventResolved: boolean;
  auditedTables: TableNodeId[];
  log: string[];
}

export class RunError extends Error {}

// ───────────────────────────── data ─────────────────────────────

interface TableNodeData {
  id: TableNodeId;
  label: string;
  seats: { id: string; stack?: string; initial?: number }[];
  small_blind: number;
  big_blind: number;
  max_hands?: number;
  hand_cap?: number;
  blind_schedule?: { hands: string; sb: number; bb: number }[];
}

const TABLE_NODES: Record<TableNodeId, TableNodeData> = Object.fromEntries(
  [...routeData.nodes, ...fallenData.nodes]
    .filter((n) => n.id in { contract_1: 1, contract_2: 1, boss_ledger: 1, fallen_low_table: 1 })
    .map((n) => [n.id, { ...n, label: 'label' in n ? n.label : (n as { title: string }).title } as TableNodeData]),
) as Record<TableNodeId, TableNodeData>;

/** Main-route successor of each table when the player continues alive. */
const AFTER: Record<TableNodeId, NodeId> = {
  contract_1: 'lantern_shop',
  contract_2: 'boss_ledger',
  boss_ledger: 'slice_victory',
  fallen_low_table: 'fallen_audience',
};

/** Initial world accounts (design v0.6: every wallet funded from named accounts at world creation). */
function initialAccounts(): Record<string, number> {
  const accounts: Record<string, number> = { you: 100 };
  for (const node of Object.values(TABLE_NODES)) {
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
    version: 1,
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

// ───────────────────────────── tables ─────────────────────────────

function tableConfig(node: TableNodeData): TableConfig {
  const blinds = node.blind_schedule
    ? node.blind_schedule.map((b) => ({ fromHand: Number(b.hands.split('-')[0]), smallBlind: b.sb, bigBlind: b.bb }))
    : [{ fromHand: 1, smallBlind: node.small_blind, bigBlind: node.big_blind }];
  return { label: node.label, maxHands: node.max_hands ?? node.hand_cap ?? null, blinds };
}

function enterTable(run: RunState, nodeId: TableNodeId): void {
  const node = TABLE_NODES[nodeId];
  const ids = node.seats.map((s) => (s.id === 'player' ? PLAYER_ID : s.id));
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
  const entryAether = Math.min(AETHER.max, AETHER.initial + ((pm.relics ?? []).includes('lantern_reservoir') ? 1 : 0));
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

/** Contract and boss objectives (design v0.6 §03, route data). */
function judge(nodeId: TableNodeId, standings: Standing[]): 'win' | 'alive_failure' {
  const me = standings.find((s) => s.id === PLAYER_ID)!;
  if (me.stack < 1) return 'alive_failure';
  if (nodeId === 'fallen_low_table') return 'win';
  if (nodeId === 'boss_ledger') return me.rank === 1 ? 'win' : 'alive_failure';
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
  run.table = null;
  run.tableNode = null;

  const you = run.characters[PLAYER_ID];
  let outcome: TableOutcome;
  if (!you.alive) outcome = 'dead';
  else if (status === 'fallen') outcome = 'fallen';
  else outcome = judge(nodeId, standings);

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
  | { kind: 'leaveShop'; to: 'optional_event' | 'contract_2' }
  | { kind: 'event'; take: boolean }
  | { kind: 'reward'; index: number | null }
  | { kind: 'setback'; choice: 'public_record' | 'break_attunement'; uid?: string }
  | { kind: 'evolve'; uid: string; branch: SpellId; useToken?: boolean };

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
    case 'leaveShop':
      if (run.node !== 'lantern_shop') throw new RunError('Not in the shop');
      if (cmd.to === 'optional_event' && run.eventResolved) throw new RunError('The petition has already been heard');
      run.node = cmd.to;
      if (cmd.to === 'contract_2') enterTable(run, 'contract_2');
      break;
    case 'event':
      resolveEvent(run, cmd.take);
      break;
    case 'reward':
      chooseReward(run, cmd.index);
      break;
    case 'setback':
      resolveSetback(run, cmd.choice, cmd.uid);
      break;
    case 'evolve':
      evolve(run, cmd.uid, cmd.branch, cmd.useToken ?? false);
      break;
  }
  assertRunInvariants(run);
  return run;
}

function goTo(run: RunState, node: NodeId): void {
  if (node === 'contract_1' || node === 'contract_2' || node === 'boss_ledger' || node === 'fallen_low_table') enterTable(run, node);
  else run.node = node;
  if (node === 'lantern_shop' && !run.shop) openShop(run);
}

function advance(run: RunState): void {
  switch (run.node) {
    case 'start':
      return goTo(run, 'contract_1');
    case 'contract_1':
    case 'contract_2':
    case 'boss_ledger':
    case 'fallen_low_table':
      return finishTable(run);
    case 'table_result':
      return afterResult(run);
    case 'fallen_registry':
      return goTo(run, 'fallen_low_table');
    case 'fallen_audience':
      run.node = 'fallen_unlocked';
      run.log.push('Fallen route unlocked: the P4 slice is complete.');
      return;
    default:
      throw new RunError(`Nothing to advance at ${run.node}`);
  }
}

function afterResult(run: RunState): void {
  const r = run.results.at(-1)!;
  if (r.outcome === 'dead') return void (run.node = 'death');
  if (r.outcome === 'fallen') return enterFallen(run);
  if (r.node === 'fallen_low_table') return goTo(run, 'fallen_audience');
  if (r.node === 'boss_ledger') return void (run.node = r.outcome === 'win' ? 'slice_victory' : 'slice_exile');
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
function rewardOffers(run: RunState, node: TableNodeId): RewardOption[] {
  const owned = run.player.magic.relics ?? [];
  const full = owned.length >= SLOT_LIMITS.relics;
  const rng = new Rng(deriveSeed(run.seed, 0x7e, node.length, run.results.length));
  if (node === 'contract_1') {
    return full ? [] : rng.shuffle(COMMON_RELICS.filter((r) => !owned.includes(r))).slice(0, 3).map((relic) => ({ kind: 'relic', relic }));
  }
  if (node === 'contract_2') {
    const relic = rng.shuffle(RELIC_IDS.filter((r) => !owned.includes(r)))[0];
    return [...(relic && !full ? [{ kind: 'relic' as const, relic }] : []), { kind: 'evolution_token' }];
  }
  return [];
}

function chooseReward(run: RunState, index: number | null): void {
  if (run.node !== 'reward' || !run.reward) throw new RunError('No reward to choose');
  if (index !== null) {
    const choice = run.reward[index];
    if (!choice) throw new RunError('No such reward');
    if (choice.kind === 'relic') {
      run.player.magic.relics = [...(run.player.magic.relics ?? []), choice.relic];
      run.log.push(`Reward: ${RELICS[choice.relic].name}.`);
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

function openShop(run: RunState): void {
  const owned = run.player.magic.relics ?? [];
  const rng = new Rng(deriveSeed(run.seed, 0x5e1e));
  const offers = rng
    .shuffle(RELIC_IDS.filter((r) => !owned.includes(r)))
    .slice(0, 3)
    .map((relic) => ({ relic, price: RELICS[relic].price, sold: false }));
  run.shop = { offers, rethreadSold: false };
}

export const CANNOT_BUY = shopData.cannot_buy_message;
export const SOLD_OUT = shopData.sold_out_message;
export const RETHREAD_PRICE = shopData.other_offers[0].price;

function pay(run: RunState, price: number, to: string, reason: string): void {
  if (run.accounts[PLAYER_ID] - price < 1) throw new RunError(CANNOT_BUY);
  transfer(run, PLAYER_ID, to, price, reason);
}

function buy(run: RunState, index: number): void {
  if (run.node !== 'lantern_shop' || !run.shop) throw new RunError('Not in the shop');
  const offer = run.shop.offers[index];
  if (!offer) throw new RunError('No such offer');
  if (offer.sold) throw new RunError(SOLD_OUT);
  const relics = run.player.magic.relics ?? [];
  if (relics.includes(offer.relic)) throw new RunError('You already carry that relic');
  if (relics.length >= SLOT_LIMITS.relics) throw new RunError('Your relic slots are full');
  pay(run, offer.price, shopData.merchant.id, `bought ${offer.relic}`);
  offer.sold = true;
  run.player.magic.relics = [...relics, offer.relic];
  run.log.push(`Bought ${RELICS[offer.relic].name} for ${offer.price}.`);
}

function rethread(run: RunState, uid: string, spell: SpellId): void {
  if (run.node !== 'lantern_shop' || !run.shop) throw new RunError('Not in the shop');
  if (run.shop.rethreadSold) throw new RunError(SOLD_OUT);
  const card = allCards(run.player.magic.book).find((c) => c.uid === uid);
  if (!card || !isBaseSpell(card.spell)) throw new RunError('Only an owned base spell can be rethreaded');
  if (!isBaseSpell(spell) || spell === card.spell) throw new RunError('Choose a different starter spell');
  pay(run, RETHREAD_PRICE, shopData.merchant.id, 'spell rethread');
  run.player.magic.book = replaceInstance(run.player.magic.book, uid, spell);
  run.shop.rethreadSold = true;
  run.log.push(`Spell Rethread: ${SPELLS[card.spell].name} becomes ${SPELLS[spell].name}.`);
}

export const OPEN_BOOK_FEE = routeData.nodes.find((n) => n.id === 'optional_event')!.entries!.find((e) => e.id === 'take_covenant')!.cost_chips!;

function resolveEvent(run: RunState, take: boolean): void {
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
