import Phaser from 'phaser';
import './style.css';
import { getPublicView, PlayerAction } from './game/rules/engine';
import {
  applyHumanAction,
  createDefaultSession,
  humanSeat,
  KeyValueStore,
  loadSession,
  saveSession,
  sessionStatus,
  startNextHand,
  stepAi,
  TableSession,
} from './game/table/session';
import { Controls } from './ui/controls';
import { describeAction } from './ui/format';
import { RENDER_ZOOM, TABLE_HEIGHT, TABLE_WIDTH, TableScene } from './ui/TableScene';

const PREFS_KEY = 'lastWager.prefs.v1';

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

class Game {
  private session: TableSession;
  private readonly store = safeStore();
  private readonly controls: Controls;
  private readonly ticker = document.getElementById('ticker')!;
  private readonly handInfo = document.getElementById('hand-info')!;
  private readonly overlay = document.getElementById('overlay')!;
  private timer: number | undefined;
  private fast = false;

  constructor(private readonly scene: TableScene) {
    try {
      this.fast = JSON.parse(this.store.getItem(PREFS_KEY) ?? '{}').fast === true;
    } catch {
      this.fast = false;
    }
    this.controls = new Controls({
      onAction: (a) => this.humanAction(a),
      onNextHand: () => this.nextHand(),
    });
    const restored = loadSession(this.store);
    this.session = restored ?? createDefaultSession(randomSeed());
    if (restored) this.flash('Your table was restored exactly where you left it.');
    document.getElementById('btn-speed')!.addEventListener('click', () => this.toggleSpeed());
    document.getElementById('btn-new')!.addEventListener('click', () => this.confirmNewTable());
    this.updateSpeedButton();
    this.save();
    this.refresh();
  }

  private save(): void {
    saveSession(this.store, this.session);
  }

  private set(session: TableSession): void {
    this.session = session;
    this.save();
    this.refresh();
  }

  private refresh(): void {
    window.clearTimeout(this.timer);
    const s = this.session;
    const me = humanSeat(s);
    const view = getPublicView(s.hand, me);
    this.scene.renderModel({
      view,
      names: s.seats.map((x) => x.name),
      humanSeat: me,
      handNumber: s.handNumber,
    });
    this.handInfo.textContent = `Hand ${s.handNumber} · Blinds ${s.hand.setup.smallBlind}/${s.hand.setup.bigBlind}`;

    const status = sessionStatus(s);
    const last = s.hand.log.at(-1);
    switch (status) {
      case 'humanToAct':
        this.ticker.textContent = last ? `${describeAction(last, s.seats[last.seat].name)} Your move.` : 'Your move.';
        this.controls.showTurn(view);
        break;
      case 'aiToAct': {
        this.controls.showWaiting();
        const seat = s.hand.toAct!;
        this.ticker.textContent = last ? describeAction(last, s.seats[last.seat].name) : `${s.seats[seat].name} is thinking…`;
        const delay = this.fast ? 180 : 650 + Math.random() * 500;
        this.timer = window.setTimeout(() => this.set(stepAi(this.session)), delay);
        break;
      }
      case 'handComplete':
        this.ticker.textContent = s.history.at(-1)?.lines.join(' · ') ?? '';
        this.controls.showHandComplete('Deal next hand');
        if (this.fast) this.timer = window.setTimeout(() => this.nextHand(), 1600);
        break;
      case 'humanBusted':
        this.ticker.textContent = s.history.at(-1)?.lines.join(' · ') ?? '';
        this.controls.showHandComplete('Face the Ledger');
        this.showEnd(
          'Your last Lifechip is gone',
          'The Ledger of Souls marks your claim as expired. The Last Claim bargaining scene arrives in milestone P3. For now, this run ends here.',
        );
        break;
      case 'tableWon':
        this.ticker.textContent = s.history.at(-1)?.lines.join(' · ') ?? '';
        this.controls.showHandComplete('Table cleared');
        this.showEnd('The table is yours', 'Every rival’s Lifechips now sit in your stack. Their fates await the Last Claim rules of P3.');
        break;
    }
  }

  private humanAction(action: PlayerAction): void {
    if (sessionStatus(this.session) !== 'humanToAct') return;
    this.set(applyHumanAction(this.session, action));
  }

  private nextHand(): void {
    const status = sessionStatus(this.session);
    if (status === 'handComplete') this.set(startNextHand(this.session));
    else if (status === 'humanBusted' || status === 'tableWon') this.newTable();
  }

  private newTable(): void {
    this.overlay.hidden = true;
    this.set(createDefaultSession(randomSeed()));
  }

  private showEnd(title: string, body: string): void {
    this.overlay.replaceChildren();
    const card = document.createElement('div');
    card.className = 'modal';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = 'Begin a new table';
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
    this.fast = !this.fast;
    this.store.setItem(PREFS_KEY, JSON.stringify({ fast: this.fast }));
    this.updateSpeedButton();
    this.refresh();
  }

  private updateSpeedButton(): void {
    const b = document.getElementById('btn-speed')!;
    b.textContent = this.fast ? 'Fast ⏩' : 'Normal ▶';
    b.setAttribute('aria-pressed', String(this.fast));
  }

  private flash(text: string): void {
    const n = document.getElementById('toast')!;
    n.textContent = text;
    n.hidden = false;
    window.setTimeout(() => (n.hidden = true), 2600);
  }
}

const scene = new TableScene();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: TABLE_WIDTH * RENDER_ZOOM,
  height: TABLE_HEIGHT * RENDER_ZOOM,
  backgroundColor: '#0b0907',
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
