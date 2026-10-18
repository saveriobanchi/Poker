import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import Phaser from 'phaser';
import './style.css';
import { getMagicView } from './game/magic/table';
import { SPELLS } from './game/magic/spells';
import { getPublicView } from './game/rules/engine';
import {
  applyClaim,
  applyHumanCommand,
  createDefaultSession,
  humanSeat,
  type HumanCommand,
  type KeyValueStore,
  loadSession,
  saveSession,
  sessionStatus,
  startNextHand,
  stepAi,
  tableStacks,
  type TableSession,
} from './game/table/session';
import { type ClaimCommand, roles } from './game/world';
import { ClaimScreen } from './ui/claimScreen';
import { claimantName, pactNoun } from './ui/claimText';
import { Controls } from './ui/controls';
import { describeAction } from './ui/format';
import { Sound } from './ui/sound';
import { RENDER_ZOOM, TABLE_HEIGHT, TABLE_WIDTH, TableScene } from './ui/TableScene';

const PREFS_KEY = 'lastWager.prefs.v1';
/** A Fallen character is archived here when a new run starts, for the Cinder Warrens (P4). */
const FALLEN_KEY = 'lastWager.fallen.v1';
const PORTRAITS: Record<string, string> = { you: 'wagerer', vesper: 'vesper', oracle: 'oracle', corvin: 'corvin' };

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
}

class Game {
  private session: TableSession;
  private readonly store = safeStore();
  private readonly controls: Controls;
  private readonly sound = new Sound();
  private readonly ticker = document.getElementById('ticker')!;
  private readonly handInfo = document.getElementById('hand-info')!;
  private readonly overlay = document.getElementById('overlay')!;
  private readonly claimScreen = new ClaimScreen((cmd) => this.claim(cmd));
  private timer: number | undefined;
  private prefs: Prefs = { fast: false, muted: false };
  private animatedEvents = 0;

  constructor(private readonly scene: TableScene) {
    try {
      this.prefs = { ...this.prefs, ...JSON.parse(this.store.getItem(PREFS_KEY) ?? '{}') };
    } catch {
      /* keep defaults */
    }
    this.sound.muted = this.prefs.muted;
    this.controls = new Controls({
      onAction: (action) => this.human({ kind: 'act', action }),
      onCast: (uid, params) => this.human({ kind: 'cast', uid, params }),
      onPass: () => this.human({ kind: 'pass' }),
      onNextHand: () => this.nextHand(),
    });
    const restored = loadSession(this.store);
    this.session = restored ?? createDefaultSession(randomSeed());
    this.animatedEvents = this.session.table.magic.events.length;
    if (restored) this.flash('Your table was restored exactly where you left it.');
    document.getElementById('btn-speed')!.addEventListener('click', () => this.toggleSpeed());
    document.getElementById('btn-sound')!.addEventListener('click', () => this.toggleSound());
    document.getElementById('btn-new')!.addEventListener('click', () => this.confirmNewTable());
    window.addEventListener('pointerdown', () => this.sound.unlock(), { passive: true });
    this.updateHudButtons();
    this.save();
    this.refresh();
  }

  private save(): void {
    saveSession(this.store, this.session);
  }

  private savePrefs(): void {
    this.store.setItem(PREFS_KEY, JSON.stringify(this.prefs));
  }

  private set(next: TableSession): void {
    this.playSounds(this.session, next);
    this.session = next;
    this.save();
    this.refresh();
  }

  private playSounds(prev: TableSession, next: TableSession): void {
    const a = prev.table;
    const b = next.table;
    if (next.handNumber !== prev.handNumber) {
      this.sound.shuffle();
      for (let i = 0; i < 4; i++) this.sound.card(0.35 + i * 0.09);
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

  private refresh(): void {
    window.clearTimeout(this.timer);
    const s = this.session;
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
      portraits: s.seats.map((x) => PORTRAITS[x.id] ?? 'wagerer'),
      humanSeat: me,
      handNumber: s.handNumber,
      freshEvents,
      seatStatus: s.world.characters.map((c) => c.status),
      stacks: tableStacks(s),
    });
    this.handInfo.textContent = `Hand ${s.handNumber} · Blinds ${t.hand.setup.smallBlind}/${t.hand.setup.bigBlind}`;

    const last = t.hand.log.at(-1);
    const lastText = last ? describeAction(last, names[last.seat]) : '';
    const lastSpell = t.magic.events.at(-1);
    const spellText = freshEvents.length && lastSpell ? `${names[lastSpell.seat]}: “${SPELLS[lastSpell.spell].tell}”` : '';
    const status = sessionStatus(s);
    if (status === 'humanClaim' || status === 'claimResolved') this.claimScreen.show(s);
    else this.claimScreen.hide();
    switch (status) {
      case 'humanWindow':
        this.ticker.textContent = `${spellText ? spellText + ' ' : ''}The ${t.hand.street} opens. Cast an opening spell?`;
        this.controls.showWindow(view, magic, names);
        break;
      case 'humanToAct':
        this.ticker.textContent = `${spellText || lastText} Your move.`.trim();
        this.controls.showTurn(view, magic, names);
        break;
      case 'aiToAct': {
        this.controls.showWaiting(view, magic);
        this.ticker.textContent = spellText || lastText || 'The cards are dealt.';
        const delay = this.prefs.fast ? 200 : 700 + Math.random() * 500 + (freshEvents.length ? 900 : 0);
        this.timer = window.setTimeout(() => this.set(stepAi(this.session)), delay);
        break;
      }
      case 'handComplete':
        this.ticker.textContent = this.summaryText();
        this.controls.showHandComplete('Deal next hand', magic);
        if (this.prefs.fast) this.timer = window.setTimeout(() => this.nextHand(), 1800);
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
        this.ticker.textContent = 'You have left the table, Fallen.';
        this.controls.showHandComplete('Begin a new run', null);
        this.showEnd('The Cinder Warrens — to be continued', this.fallenLines(), 'Begin a new run');
        break;
      case 'dead':
        this.ticker.textContent = 'Your run has ended.';
        this.controls.showHandComplete('Begin a new run', null);
        this.showEnd('The run has ended', this.deathLines(), 'Begin a new run');
        break;
      case 'tableWon':
        this.ticker.textContent = this.summaryText();
        this.controls.showHandComplete('Table cleared', null);
        this.showEnd('The table is yours', [
          'Every rival at this table has been claimed or has departed.',
          `You hold ${tableStacks(s)[me]} Lifechips.`,
          this.reputationLine(),
        ]);
        break;
    }
  }

  private reputationLine(): string {
    const r = this.session.world.characters[humanSeat(this.session)].reputation;
    return `Reputation — Honor ${r.honor} · Dread ${r.dread} · Favor ${r.favor}`;
  }

  private fallenLines(): string[] {
    const s = this.session;
    const you = s.world.characters[humanSeat(s)];
    const claim = s.claims?.claims.find((c) => c.debtor === humanSeat(s) && c.outcome?.kind === 'survival');
    const contract = s.world.contracts.find((k) => k.debtor === you.id);
    const lines = [
      claim ? `You survived the Last Claim through ${pactNoun(contract!.pact)} with ${claimantName(s.world, claim)}.` : 'You survived the Last Claim.',
      `You carry ${you.offTable} Lifechips into the Cinder Warrens, stripped of rank.`,
    ];
    if (contract?.pact === 'debt') lines.push(`You owe ${contract.obligation} Lifechips, repaid from future winnings.`);
    if (contract?.pact === 'service') lines.push(`You owe ${contract.servicesOwed} sworn duties.`);
    lines.push(this.reputationLine(), 'Your Fallen character is saved. The Cinder Warrens open in the next milestone.');
    return lines;
  }

  private deathLines(): string[] {
    const s = this.session;
    return [
      `Hands played: ${s.handNumber}.`,
      'The Ledger closed your account. Death concludes this character’s story; a new Wagerer may take up the cards.',
      this.reputationLine(),
    ];
  }

  private claim(cmd: ClaimCommand): void {
    this.sound.unlock();
    try {
      this.set(applyClaim(this.session, cmd));
    } catch (e) {
      this.flash((e as Error).message);
      this.refresh();
    }
  }

  private summaryText(): string {
    const h = this.session.history.at(-1);
    if (!h) return '';
    const gains = this.session.table.magic.gains
      .filter((g) => g.seat === humanSeat(this.session) && g.reason !== 'showdown')
      .map((g) => `+${g.amount} Aether from Cinder Challenge`);
    return [...h.lines, ...gains].join(' · ');
  }

  private human(command: HumanCommand): void {
    this.sound.unlock();
    const status = sessionStatus(this.session);
    if (status !== 'humanToAct' && status !== 'humanWindow') return;
    try {
      this.set(applyHumanCommand(this.session, command));
    } catch (e) {
      this.flash((e as Error).message);
      this.refresh();
    }
  }

  private nextHand(): void {
    const status = sessionStatus(this.session);
    if (status === 'handComplete') this.set(startNextHand(this.session));
    else if (status === 'dead' || status === 'fallen' || status === 'tableWon') this.newTable();
  }

  private newTable(): void {
    this.overlay.hidden = true;
    if (sessionStatus(this.session) === 'fallen') this.store.setItem(FALLEN_KEY, JSON.stringify(this.session));
    const next = createDefaultSession(randomSeed());
    this.animatedEvents = 0;
    this.set(next);
  }

  private showEnd(title: string, body: string[], action = 'Begin a new table'): void {
    this.overlay.replaceChildren();
    const card = document.createElement('div');
    card.className = 'modal';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('div');
    for (const line of body) {
      const para = document.createElement('p');
      para.textContent = line;
      p.append(para);
    }
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = action;
    btn.addEventListener('click', () => this.newTable());
    const close = document.createElement('button');
    close.textContent = 'Look at the table';
    close.addEventListener('click', () => (this.overlay.hidden = true));
    card.append(h, p, btn, close);
    this.overlay.append(card);
    this.overlay.hidden = false;
  }

  private confirmNewTable(): void {
    if (window.confirm('Abandon this table and start a new one?')) this.newTable();
  }

  private toggleSpeed(): void {
    this.prefs.fast = !this.prefs.fast;
    this.savePrefs();
    this.updateHudButtons();
    this.refresh();
  }

  private toggleSound(): void {
    this.prefs.muted = !this.prefs.muted;
    this.sound.muted = this.prefs.muted;
    this.sound.unlock();
    this.savePrefs();
    this.updateHudButtons();
  }

  private updateHudButtons(): void {
    const speed = document.getElementById('btn-speed')!;
    speed.textContent = this.prefs.fast ? 'Fast ⏩' : 'Normal ▶';
    speed.setAttribute('aria-pressed', String(this.prefs.fast));
    const sound = document.getElementById('btn-sound')!;
    sound.textContent = this.prefs.muted ? '🔇' : '🔊';
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
  ['600 16px Cinzel', '500 16px Inter', '600 16px Inter', '600 16px "Cormorant Garamond"'].map((f) => document.fonts.load(f).catch(() => undefined)),
);

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

