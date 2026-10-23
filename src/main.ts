import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/alegreya-sans/latin-500-italic.css';
import Phaser from 'phaser';
import './style.css';
import { getMagicView } from './game/magic/table';
import { SPELLS } from './game/magic/spells';
import { RELICS } from './game/magic/relics';
import { PROFILES } from './game/ai/profiles';
import { getPublicView } from './game/rules/engine';
import {
  createRun,
  ENDINGS,
  attuneOptions,
  evolutionOffers,
  fallenFromSave,
  loadRun,
  runAi,
  runClaim,
  type RunCommand,
  runCommand,
  runHuman,
  runNextHand,
  type RunState,
  saveRun,
} from './game/run/run';
import { humanSeat, type HumanCommand, type KeyValueStore, sessionStatus, tableStacks, type TableSession } from './game/table/session';
import { type ClaimCommand, roles } from './game/world';
import { ClaimScreen } from './ui/claimScreen';
import { Controls } from './ui/controls';
import { legacyIntro, loadLegacy, recordEnding, saveLegacy } from './game/run/legacy';
import { describeAction } from './ui/format';
import { attunePanel, evolutionPanel, renderNewRunPicker, renderRunScreen, renderTitle, routeLine, type ScreenHandlers } from './ui/runScreens';
import { type BackId, type BackgroundId, BACKGROUNDS, backgroundIntro, backStates, choosePresentation, cinderGossip, loadPresentation, savePresentation, unlockedBackgrounds } from './game/run/presentation';
import { loadPlaytestLog, Playtest, playtestEnabled, pt, setPlaytest, summarizePlaytest } from './ui/playtest';
import { icon, iconSvg } from './ui/icons';
import { Sound } from './ui/sound';
import { BACK_FILES, PORTRAIT_FILES, portraitFor, RENDER_ZOOM, TABLE_HEIGHT, TABLE_WIDTH, TableScene } from './ui/TableScene';

const PREFS_KEY = 'lastWager.prefs.v1';
/** P3 archives of a Fallen Wagerer (kept by the previous build), importable once into a P4 run. */
const P3_FALLEN_KEYS = ['lastWager.fallen.v1', 'lastWager.table.v3', 'lastWager.table.v4'];

/** localStorage can throw (private mode, blocked storage): fall back to memory. */
function safeStore(): KeyValueStore {
  const memory = new Map<string, string>();
  return {
    getItem(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return memory.get(k) ?? null;
      }
    },
    setItem(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        memory.set(k, v);
      }
    },
    removeItem(k) {
      try {
        localStorage.removeItem(k);
      } catch {
        memory.delete(k);
      }
    },
  };
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

interface Prefs {
  fast: boolean;
  muted: boolean;
  /** Undefined until the player chooses: follows the system's reduced-motion setting. */
  reduceMotion?: boolean;
}

class Game {
  private run: RunState | null;
  private readonly store = safeStore();
  private readonly controls: Controls;
  private readonly sound = new Sound();
  private readonly ticker = document.getElementById('ticker')!;
  private readonly handInfo = document.getElementById('hand-info')!;
  private readonly screen = document.getElementById('screen')!;
  private readonly relicStrip = document.getElementById('relic-strip')!;
  private readonly evolveButton = document.getElementById('btn-evolve') as HTMLButtonElement;
  private readonly claimScreen = new ClaimScreen((cmd) => this.claim(cmd));
  private readonly screens: ScreenHandlers = {
    command: (cmd) => this.command(cmd),
    newRun: () => this.newRun(),
    continueFallen: () => this.continueFallen(),
    rerender: () => this.refresh(),
    story: () => {
      const legacy = loadLegacy(this.store);
      const p = this.run ? loadPresentation(this.store, this.run.seed) : null;
      const bg = backgroundIntro(p);
      return { ...bg, echo: p?.variant === 'arrival_echo' ? legacyIntro(legacy) : null, gossip: cinderGossip(p, legacy) };
    },
  };
  private timer: number | undefined;
  private prefs: Prefs = { fast: false, muted: false };
  private animatedEvents = 0;
  private evolveOpen = false;

  constructor(private readonly scene: TableScene) {
    try {
      this.prefs = { ...this.prefs, ...JSON.parse(this.store.getItem(PREFS_KEY) ?? '{}') };
    } catch {
      /* keep defaults */
    }
    this.sound.muted = this.prefs.muted;
    this.scene.reduceMotion = this.reduceMotion();
    this.controls = new Controls({
      onAction: (action) => this.human({ kind: 'act', action }),
      onCast: (uid, params) => this.human({ kind: 'cast', uid, params }),
      onPass: () => this.human({ kind: 'pass' }),
      onChoose: (pick) => this.human({ kind: 'choose', pick }),
      onSigil: (uid) => this.human({ kind: 'sigil', uid }),
      onNextHand: () => this.nextHand(),
    });
    this.startPlaytest();
    this.run = loadRun(this.store);
    this.animatedEvents = this.run?.table?.table.magic.events.length ?? 0;
    if (this.run?.table) this.flash('Your table was restored exactly where you left it.');
    document.getElementById('btn-speed')!.addEventListener('click', () => this.toggleSpeed());
    document.getElementById('btn-sound')!.addEventListener('click', () => this.toggleSound());
    document.getElementById('btn-motion')!.addEventListener('click', () => this.toggleMotion());
    document.getElementById('btn-new')!.addEventListener('click', () => this.confirmNewRun());
    // The collapsed route bar expands to its full text on tap (design v1.1 §08).
    this.handInfo.addEventListener('click', () => {
      const open = document.getElementById('hud')!.classList.toggle('expanded');
      this.handInfo.setAttribute('aria-expanded', String(open));
      if (this.run?.table) this.renderTable(this.run, this.run.table);
    });
    this.evolveButton.prepend(icon('evolve', 18));
    this.evolveButton.addEventListener('click', () => {
      this.evolveOpen = true;
      this.refresh();
    });
    window.addEventListener('pointerdown', () => this.sound.unlock(), { passive: true });
    this.updateHudButtons();
    this.refresh();
  }

  /** Opt-in usability instrumentation (`?playtest=1`): local only, exported by hand. */
  private startPlaytest(): void {
    if (!playtestEnabled(location.search, this.store)) return;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const p = new Playtest(this.store, () => performance.now(), `${innerWidth}x${innerHeight}@${devicePixelRatio}`, nav?.type === 'reload', new Date().toISOString());
    setPlaytest(p);
    window.addEventListener('error', (e) => p.record('error', { message: String(e.message).slice(0, 200) }));
    window.addEventListener('unhandledrejection', (e) => p.record('error', { message: String(e.reason).slice(0, 200) }));
    document.addEventListener('visibilitychange', () => p.record(document.hidden ? 'hidden' : 'visible'));
    // A tap on a disabled control is a measurable "I expected that to work" moment.
    document.addEventListener(
      'pointerdown',
      (e) => {
        const b = (e.target as HTMLElement).closest?.('button');
        if (b && ((b as HTMLButtonElement).disabled || b.getAttribute('aria-disabled') === 'true')) p.record('disabled_tap', { control: (b.id || b.className || b.textContent || '').slice(0, 40) });
      },
      { capture: true, passive: true },
    );
    const btn = document.getElementById('btn-playtest')!;
    btn.innerHTML = iconSvg('quill', 22);
    btn.hidden = false;
    btn.addEventListener('click', () => this.showPlaytestPanel());
    window.setInterval(() => this.maybeFeedback(), 30_000);
  }

  private modal(build: (box: HTMLDivElement, close: () => void) => void): void {
    const overlay = document.getElementById('overlay')!;
    const box = document.createElement('div');
    box.className = 'modal playtest';
    const close = () => {
      overlay.hidden = true;
      overlay.replaceChildren();
    };
    build(box, close);
    overlay.replaceChildren(box);
    overlay.hidden = false;
  }

  private showPlaytestPanel(): void {
    const p = pt();
    if (!p) return;
    this.modal((box, close) => {
      const s = summarizePlaytest(loadPlaytestLog(this.store));
      const h = document.createElement('h2');
      h.textContent = 'Playtest log';
      const info = document.createElement('p');
      info.className = 'small';
      info.textContent = `${Math.round(p.minutes())} min this session · ${s.pageLoads} page loads (${s.reloads} reloads) · ${s.decisions} decisions · ${s.errors} errors. Stored only on this device.`;
      const mk = (label: string, fn: () => void, cls = '') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.className = `wide ${cls}`;
        b.addEventListener('click', fn);
        return b;
      };
      box.append(
        h,
        info,
        mk('Download JSON', () => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([p.export()], { type: 'application/json' }));
          a.download = `last-wager-playtest-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
          a.click();
        }, 'primary'),
        mk('Feedback now', () => this.showFeedback(Math.round(p.minutes()))),
        mk('Clear log', () => {
          if (window.confirm('Delete the stored playtest log on this device?')) p.clear();
          close();
        }),
        mk('Close', close),
      );
    });
  }

  private maybeFeedback(): void {
    const m = pt()?.dueFeedback();
    if (m !== null && m !== undefined) this.showFeedback(m);
  }

  /** The 15- and 45-minute checkpoints (design v1.0 §11): enjoyment, comprehension and confusion, in the tester's words. */
  private showFeedback(minute: number): void {
    this.modal((box, close) => {
      const h = document.createElement('h2');
      h.textContent = `Check-in · ${minute} min`;
      const scale = document.createElement('div');
      scale.className = 'feedback-scale';
      let enjoyment = 0;
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = String(i);
        b.setAttribute('aria-label', `Enjoyment ${i} of 5`);
        b.addEventListener('click', () => {
          enjoyment = i;
          scale.querySelectorAll('button').forEach((x, j) => x.classList.toggle('picked', j === i - 1));
        });
        scale.append(b);
      }
      const ask = (q: string) => {
        const label = document.createElement('label');
        label.textContent = q;
        const t = document.createElement('textarea');
        t.rows = 2;
        label.append(t);
        return [label, t] as const;
      };
      const [l1, chips] = ask('In your own words: what are your Lifechips, and what happens if they run out?');
      const [l2, confused] = ask('What confused or annoyed you so far?');
      const lead = document.createElement('p');
      lead.textContent = 'How much are you enjoying it? (1 = not at all, 5 = a lot)';
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'primary wide';
      save.textContent = 'Save answers';
      save.addEventListener('click', () => {
        pt()?.record('feedback', { minute, enjoyment: enjoyment || null, lifechips: chips.value.slice(0, 500), confused: confused.value.slice(0, 500) });
        close();
      });
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'wide';
      skip.textContent = 'Skip';
      skip.addEventListener('click', () => {
        pt()?.record('feedback', { minute, skipped: true });
        close();
      });
      box.append(h, lead, scale, l1, l2, save, skip);
    });
  }

  private save(): void {
    if (this.run) saveRun(this.store, this.run);
  }

  private savePrefs(): void {
    this.store.setItem(PREFS_KEY, JSON.stringify(this.prefs));
  }

  private set(next: RunState): void {
    const prev = this.run?.table;
    if (prev && next.table && this.run!.tableNode === next.tableNode) this.playSounds(prev, next.table);
    if (next.table && (!prev || this.run!.tableNode !== next.tableNode)) {
      this.animatedEvents = 0;
      this.sound.shuffle();
    }
    if (this.run?.node !== next.node) pt()?.record('screen', { node: next.node });
    this.run = next;
    this.save();
    // Archive a finished character in the world testament (never carried into a new run).
    if (ENDINGS.includes(next.node)) saveLegacy(this.store, recordEnding(loadLegacy(this.store), next));
    this.refresh();
  }

  private playSounds(prev: TableSession, next: TableSession): void {
    const a = prev.table;
    const b = next.table;
    if (next.handNumber !== prev.handNumber) {
      this.sound.shuffle();
      for (let i = 0; i < next.seats.length; i++) this.sound.card(0.35 + i * 0.09);
      return;
    }
    for (const e of b.hand.log.slice(a.hand.log.length)) {
      if (e.action.type === 'fold') this.sound.fold();
      else if (e.action.type === 'check') this.sound.check();
      else this.sound.chips(e.action.type === 'call' ? 2 : 4);
    }
    for (let i = a.hand.board.length; i < b.hand.board.length; i++) this.sound.card(0.15 + (i - a.hand.board.length) * 0.12);
    for (const e of b.magic.events.slice(a.magic.events.length)) this.sound.spell(SPELLS[e.spell].discipline);
    const me = humanSeat(next);
    if (a.hand.phase === 'betting' && b.hand.phase === 'complete' && (b.hand.result?.netChange[me] ?? 0) > 0) this.sound.win();
  }

  private hasFallenArchive(): boolean {
    return P3_FALLEN_KEYS.some((k) => fallenFromSave(this.store.getItem(k), 1) !== null);
  }

  private refresh(): void {
    window.clearTimeout(this.timer);
    const run = this.run;
    if (!run) {
      this.handInfo.textContent = 'The Last Wager';
      this.showScreen();
      renderTitle(this.screen, this.hasFallenArchive(), this.screens, loadLegacy(this.store).entries);
      return;
    }
    if (!run.table) {
      this.handInfo.textContent = 'The Last Wager';
      this.showScreen();
      renderRunScreen(this.screen, run, this.screens);
      return;
    }
    if (this.evolveOpen) {
      const panel = evolutionPanel(run, this.screens) ?? attunePanel(run, this.screens);
      if (panel) {
        this.showScreen();
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'wide';
        back.textContent = 'Back to the table';
        back.addEventListener('click', () => {
          this.evolveOpen = false;
          this.refresh();
        });
        const inner = document.createElement('div');
        inner.className = 'screen-inner';
        inner.append(panel, back);
        this.screen.replaceChildren(inner);
        return;
      }
      this.evolveOpen = false;
    }
    this.screen.hidden = true;
    document.body.classList.add('at-table');
    this.renderTable(run, run.table);
  }

  private showScreen(): void {
    document.body.classList.remove('at-table');
    this.screen.hidden = false;
    this.claimScreen.hide();
  }

  private renderTable(run: RunState, s: TableSession): void {
    const t = s.table;
    const me = humanSeat(s);
    const view = getPublicView(t.hand, me);
    const magic = getMagicView(t, me);
    const names = s.seats.map((x) => x.name);
    const freshEvents = t.magic.events.slice(this.animatedEvents);
    this.animatedEvents = t.magic.events.length;
    this.scene.renderModel({
      view,
      magic,
      names,
      portraits: s.seats.map((x) => portraitFor(x.id) ?? x.id),
      humanSeat: me,
      handNumber: s.handNumber,
      freshEvents,
      seatStatus: s.world.characters.map((c) => c.status),
      stacks: tableStacks(s),
      back: loadPresentation(this.store, run.seed)?.back ?? 'standard',
    });
    const cap = s.config.maxHands ? `/${s.config.maxHands}` : '';
    const full = `${s.config.label}, hand ${s.handNumber}${cap}, blinds ${t.hand.setup.smallBlind}/${t.hand.setup.bigBlind} · ${routeLine(run)}`;
    const expanded = document.getElementById('hud')!.classList.contains('expanded');
    this.handInfo.textContent = expanded ? full : `${s.config.label.replace(/^The /, '')} · ${s.handNumber}${cap} · ${t.hand.setup.smallBlind}/${t.hand.setup.bigBlind}`;
    this.handInfo.title = full;
    const relics = run.player.magic.relics ?? [];
    const covenants = run.player.magic.covenants ?? [];
    const d = run.dossier;
    const read = d ? `${PROFILES[d.rival]?.name ?? d.rival}: plays ${d.vpip}/${d.hands}, raises ${d.pfr}/${d.hands}, shoves ${d.shoves}` : null;
    const tag = (name: 'relic' | 'covenant' | 'eye', text: string) => {
      const s = document.createElement('span');
      s.append(icon(name, 13), text);
      return s;
    };
    this.relicStrip.replaceChildren(...relics.map((r) => tag('relic', RELICS[r].name)), ...covenants.map(() => tag('covenant', 'Open Book')), ...(read ? [tag('eye', read)] : []));
    this.relicStrip.hidden = !relics.length && !covenants.length && !read;

    const last = t.hand.log.at(-1);
    const lastText = last ? describeAction(last, names[last.seat]) : '';
    const lastSpell = t.magic.events.at(-1);
    const spellText = freshEvents.length && lastSpell ? `${names[lastSpell.seat]}: “${SPELLS[lastSpell.spell].tell}”` : '';
    const notice = t.magic.notices.at(-1);
    const status = sessionStatus(s);
    if (status === 'humanClaim' || status === 'claimResolved') this.claimScreen.show(s);
    else this.claimScreen.hide();
    const evolvable = status === 'handComplete' && (evolutionOffers(run).length > 0 || attuneOptions(run).length > 0);
    this.evolveButton.hidden = !evolvable;
    switch (status) {
      case 'humanWindow':
        this.ticker.textContent = `${spellText ? spellText + ' ' : notice ? notice.text + ' ' : ''}The ${t.hand.street} opens. Cast an opening spell?`;
        pt()?.turnShown();
        this.controls.showWindow(view, magic, names);
        break;
      case 'humanSigil':
        this.ticker.textContent = 'Fateweaver’s Sigil: send one drawn spell to the bottom and draw another?';
        this.controls.showSigil(view, magic);
        break;
      case 'humanChoice':
        this.ticker.textContent = 'Two cards answer your reflection. Only you see them.';
        this.controls.showPick(view, magic);
        break;
      case 'humanToAct':
        this.ticker.textContent = `${spellText || lastText} Your move.`.trim();
        pt()?.turnShown();
        this.controls.showTurn(view, magic, names);
        break;
      case 'aiToAct': {
        this.controls.showWaiting(view, magic);
        this.ticker.textContent = spellText || lastText || (notice ? notice.text : 'The cards are dealt.');
        const delay = this.prefs.fast ? 200 : 700 + Math.random() * 500 + (freshEvents.length ? 900 : 0);
        this.timer = window.setTimeout(() => this.set(runAi(this.run!)), delay);
        break;
      }
      case 'handComplete':
        this.ticker.textContent = this.summaryText(s);
        this.controls.showHandComplete('Deal next hand', magic);
        if (this.prefs.fast && !evolvable) this.timer = window.setTimeout(() => this.nextHand(), 1800);
        break;
      case 'humanClaim':
        this.ticker.textContent = 'The Ledger of Souls convenes a Last Claim.';
        this.controls.showHandComplete('Last Claim in progress', null);
        break;
      case 'claimResolved': {
        this.ticker.textContent = 'The Ledger records its judgement.';
        this.controls.showHandComplete('Last Claim in progress', null);
        const npcOnly = !roles(s.world, s.claims!.claims[s.claims!.current]).humanInvolved;
        if (this.prefs.fast && npcOnly) this.timer = window.setTimeout(() => this.claim({ kind: 'acknowledge' }), 2600);
        break;
      }
      case 'fallen':
        this.ticker.textContent = 'You leave the table alive, one of the Fallen.';
        this.controls.showHandComplete('Leave the table', null);
        break;
      case 'dead':
        this.ticker.textContent = 'The Ledger has closed your account.';
        this.controls.showHandComplete('Hear the judgement', null);
        break;
      case 'tableWon':
      case 'tableDone':
        this.ticker.textContent = `${this.summaryText(s)} The table is over.`.trim();
        this.controls.showHandComplete('See the standings', null);
        break;
    }
  }

  private command(cmd: RunCommand): void {
    if (!this.run) return;
    this.sound.unlock();
    try {
      this.set(runCommand(this.run, cmd));
    } catch (e) {
      this.flash((e as Error).message);
      this.refresh();
    }
  }

  private claim(cmd: ClaimCommand): void {
    if (!this.run) return;
    this.sound.unlock();
    try {
      this.set(runClaim(this.run, cmd));
    } catch (e) {
      this.flash((e as Error).message);
      this.refresh();
    }
  }

  private summaryText(s: TableSession): string {
    const h = s.history.at(-1);
    if (!h) return '';
    const gains = s.table.magic.gains
      .filter((g) => g.seat === humanSeat(s) && g.reason !== 'showdown')
      .map((g) => `+${g.amount} Aether (${g.reason.replace(/_/g, ' ')})`);
    return [...h.lines, ...gains].join(' · ');
  }

  private human(command: HumanCommand): void {
    this.sound.unlock();
    const s = this.run?.table;
    if (!s) return;
    const status = sessionStatus(s);
    if (status !== 'humanToAct' && status !== 'humanWindow' && status !== 'humanChoice' && status !== 'humanSigil') return;
    pt()?.acted(command.kind === 'act' ? command.action.type : command.kind);
    try {
      this.set(runHuman(this.run!, command));
    } catch (e) {
      this.flash((e as Error).message);
      this.refresh();
    }
  }

  private nextHand(): void {
    const s = this.run?.table;
    if (!s) return;
    const status = sessionStatus(s);
    if (status === 'handComplete') this.set(runNextHand(this.run!));
    else if (['dead', 'fallen', 'tableWon', 'tableDone'].includes(status)) this.command({ kind: 'advance' });
  }

  private newRun(): void {
    this.evolveOpen = false;
    const legacy = loadLegacy(this.store);
    const bgs = unlockedBackgrounds(legacy);
    const backs = backStates(legacy, BACK_FILES);
    const start = (background: BackgroundId, back: BackId) => {
      // The run is created exactly as always; the presentation is stored beside it, never inside it.
      const run = createRun(randomSeed());
      savePresentation(this.store, choosePresentation(run.seed, legacy, background, back, BACK_FILES));
      this.set(run);
    };
    if (bgs.length === 1 && !backs.some((b) => b.id !== 'standard' && b.unlocked)) return start('unmarked', 'standard');
    this.showScreen();
    renderNewRunPicker(this.screen, BACKGROUNDS.filter((b) => bgs.includes(b.id)), backs, (bg, back) => start(bg as BackgroundId, back as BackId));
  }

  private continueFallen(): void {
    for (const key of P3_FALLEN_KEYS) {
      const run = fallenFromSave(this.store.getItem(key), randomSeed());
      if (!run) continue;
      // A rescue is imported exactly once: the archive is consumed.
      for (const k of P3_FALLEN_KEYS) this.store.removeItem(k);
      this.set(run);
      return;
    }
    this.flash('No Fallen Wagerer was found.');
  }

  private confirmNewRun(): void {
    if (!this.run || ENDINGS.includes(this.run.node)) return this.newRun();
    if (window.confirm('Abandon this run and begin a new one?')) this.newRun();
  }

  private toggleSpeed(): void {
    this.prefs.fast = !this.prefs.fast;
    this.savePrefs();
    this.updateHudButtons();
    this.refresh();
  }

  private reduceMotion(): boolean {
    if (this.prefs.reduceMotion !== undefined) return this.prefs.reduceMotion;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  private toggleMotion(): void {
    this.prefs.reduceMotion = !this.reduceMotion();
    this.scene.reduceMotion = this.prefs.reduceMotion;
    document.body.classList.toggle('reduce-motion', this.prefs.reduceMotion);
    this.savePrefs();
    this.updateHudButtons();
    this.flash(this.prefs.reduceMotion ? 'Reduced motion on.' : 'Reduced motion off.');
  }

  private toggleSound(): void {
    this.prefs.muted = !this.prefs.muted;
    this.sound.muted = this.prefs.muted;
    this.scene.reduceMotion = this.reduceMotion();
    this.sound.unlock();
    this.savePrefs();
    this.updateHudButtons();
  }

  private updateHudButtons(): void {
    const speed = document.getElementById('btn-speed')!;
    speed.innerHTML = iconSvg(this.prefs.fast ? 'fast' : 'hourglass', 22);
    speed.setAttribute('aria-label', this.prefs.fast ? 'Fast play' : 'Normal speed');
    speed.setAttribute('aria-pressed', String(this.prefs.fast));
    const motion = document.getElementById('btn-motion')!;
    if (!motion.firstChild) motion.innerHTML = iconSvg('pendulum', 22);
    motion.setAttribute('aria-pressed', String(this.reduceMotion()));
    document.body.classList.toggle('reduce-motion', this.reduceMotion());
    const sound = document.getElementById('btn-sound')!;
    sound.innerHTML = iconSvg(this.prefs.muted ? 'bellOff' : 'bell', 22);
    sound.setAttribute('aria-label', this.prefs.muted ? 'Sound off' : 'Sound on');
    sound.setAttribute('aria-pressed', String(!this.prefs.muted));
  }

  private flash(text: string): void {
    const n = document.getElementById('toast')!;
    n.textContent = text;
    n.hidden = false;
    window.setTimeout(() => (n.hidden = true), 2600);
  }
}

// Wait for the web fonts so canvas text renders with them from the first frame.
await document.fonts.ready;
await Promise.all(
  ['600 16px Cinzel', '500 16px "Alegreya Sans"', '700 16px "Alegreya Sans"', '600 16px "Cormorant Garamond"'].map((f) => document.fonts.load(f).catch(() => undefined)),
);

// Portraits that passed the art gate (scripts/check-art.py --pack); the built-in list is the fallback.
try {
  const list = (await (await fetch('assets/portraits/index.json')).json()) as string[];
  if (Array.isArray(list)) PORTRAIT_FILES.splice(0, PORTRAIT_FILES.length, ...list);
} catch {
  /* offline first load: keep the built-in list */
}
try {
  const backs = (await (await fetch('assets/backs/index.json')).json()) as string[];
  if (Array.isArray(backs)) BACK_FILES.splice(0, BACK_FILES.length, ...backs);
} catch {
  /* offline first load: keep the built-in list */
}

const scene = new TableScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: TABLE_WIDTH * RENDER_ZOOM,
  height: TABLE_HEIGHT * RENDER_ZOOM,
  backgroundColor: '#0b1013',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene,
  callbacks: {
    postBoot: () => {
      (window as unknown as { lastWager: Game }).lastWager = new Game(scene);
    },
  },
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

