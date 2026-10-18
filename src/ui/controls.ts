/**
 * DOM action bar and spell tray under the canvas: native buttons and a range
 * slider give reliable 44px tap targets and accessibility on phones.
 */
import type { CastParams, MagicView } from '../game/magic/table';
import { SPELLS, type SpellId } from '../game/magic/spells';
import type { LegalActions, PlayerAction, PublicView } from '../game/rules/engine';
import { rankLabel, suitGlyph } from './format';
import { DISCIPLINE_COLOR, DISCIPLINE_GLYPH } from './theme';

export interface ControlsCallbacks {
  onAction(action: PlayerAction): void;
  onCast(uid: string, params: CastParams): void;
  onPass(): void;
  onNextHand(): void;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (className) b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

const CONFIRM_MS = 2500;

export class Controls {
  private readonly fold = el<HTMLButtonElement>('btn-fold');
  private readonly call = el<HTMLButtonElement>('btn-call');
  private readonly raise = el<HTMLButtonElement>('btn-raise');
  private readonly next = el<HTMLButtonElement>('btn-next');
  private readonly pass = el<HTMLButtonElement>('btn-pass');
  private readonly raiseRow = el<HTMLDivElement>('raise-row');
  private readonly slider = el<HTMLInputElement>('raise-slider');
  private readonly presets = el<HTMLDivElement>('raise-presets');
  private readonly actionRow = el<HTMLDivElement>('action-row');
  private readonly spells = el<HTMLDivElement>('spells');
  private readonly aether = el<HTMLSpanElement>('aether');
  private readonly spellRow = el<HTMLDivElement>('spell-row');
  private readonly choice = el<HTMLDivElement>('spell-choice');

  private legal: LegalActions | null = null;
  private view: PublicView | null = null;
  private raiseTo = 0;
  private cinderUid: string | null = null;
  private confirming: 'call' | 'raise' | null = null;
  private confirmTimer: number | undefined;

  constructor(private readonly cb: ControlsCallbacks) {
    this.fold.addEventListener('click', () => this.legal && this.cb.onAction({ type: 'fold' }));
    this.call.addEventListener('click', () => {
      if (!this.legal || !this.view) return;
      if (this.legal.canCheck) return this.cb.onAction({ type: 'check' });
      const me = this.view.seats[this.view.viewer];
      if (this.legal.callAmount >= me.stack && !this.confirm('call', this.call, `Tap again: all-in ${this.legal.callAmount}`)) return;
      this.cb.onAction({ type: 'call' });
    });
    this.raise.addEventListener('click', () => {
      const r = this.legal?.raise;
      if (!r || !this.view) return;
      const me = this.view.seats[this.view.viewer];
      const allIn = this.raiseTo === me.streetCommitted + me.stack;
      if (allIn && !this.confirm('raise', this.raise, `Tap again: all-in ${this.raiseTo}`)) return;
      if (this.cinderUid) this.cb.onCast(this.cinderUid, { spell: 'cinder_challenge', raiseTo: this.raiseTo });
      else this.cb.onAction({ type: r.isBet ? 'bet' : 'raise', to: this.raiseTo });
    });
    this.next.addEventListener('click', () => this.cb.onNextHand());
    this.pass.addEventListener('click', () => this.cb.onPass());
    this.slider.addEventListener('input', () => this.setRaise(Number(this.slider.value)));
    this.presets.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-to]');
      if (target) this.setRaise(Number(target.dataset.to));
    });
  }

  /** Second-tap confirmation for irreversible all-ins (art bible §8). Returns true when confirmed. */
  private confirm(kind: 'call' | 'raise', b: HTMLButtonElement, prompt: string): boolean {
    if (this.confirming === kind) {
      this.clearConfirm();
      return true;
    }
    this.clearConfirm();
    this.confirming = kind;
    b.dataset.label = b.textContent ?? '';
    b.textContent = prompt;
    b.classList.add('confirm');
    this.confirmTimer = window.setTimeout(() => this.clearConfirm(), CONFIRM_MS);
    return false;
  }

  private clearConfirm(): void {
    window.clearTimeout(this.confirmTimer);
    for (const b of [this.call, this.raise]) {
      if (b.classList.contains('confirm')) {
        b.textContent = b.dataset.label ?? b.textContent;
        b.classList.remove('confirm');
      }
    }
    this.confirming = null;
  }

  private reset(): void {
    this.clearConfirm();
    this.legal = null;
    this.cinderUid = null;
    this.choice.hidden = true;
    this.pass.hidden = true;
    this.next.hidden = true;
    this.actionRow.hidden = false;
    this.raiseRow.hidden = true;
  }

  /** Waiting for others: everything disabled. */
  showWaiting(view: PublicView, magic: MagicView): void {
    this.reset();
    this.view = view;
    for (const b of [this.fold, this.call, this.raise]) b.disabled = true;
    this.call.textContent = 'Check';
    this.raise.textContent = 'Raise';
    this.renderSpells(magic, null);
  }

  showHandComplete(label: string, magic: MagicView | null): void {
    this.reset();
    this.actionRow.hidden = true;
    this.next.hidden = false;
    this.next.textContent = label;
    if (magic) this.renderSpells(magic, null);
  }

  /** Street-opening magic window: cast an opening spell or pass. */
  showWindow(view: PublicView, magic: MagicView, names: string[]): void {
    this.reset();
    this.view = view;
    this.actionRow.hidden = true;
    this.pass.hidden = false;
    this.renderSpells(magic, names);
  }

  showTurn(view: PublicView, magic: MagicView, names: string[]): void {
    this.reset();
    this.view = view;
    const legal = view.legal!;
    this.legal = legal;
    this.fold.disabled = legal.canCheck; // folding for free is legal but never useful: guard misclicks
    this.call.disabled = false;
    const me = view.seats[view.viewer];
    if (legal.canCheck) this.call.textContent = 'Check';
    else if (legal.callAmount >= me.stack) this.call.textContent = `All-in ${legal.callAmount}`;
    else this.call.textContent = `Call ${legal.callAmount}`;

    const r = legal.raise;
    this.raise.disabled = !r;
    this.raiseRow.hidden = !r;
    this.renderSpells(magic, names);
    if (!r) {
      this.raise.textContent = 'Raise';
      return;
    }
    this.slider.min = String(r.minTo);
    this.slider.max = String(r.maxTo);
    this.slider.step = '1';
    const pot = view.seats.reduce((s, p) => s + p.totalCommitted, 0);
    const potRaise = (frac: number) => Math.round(view.currentBet + (pot + legal.callAmount) * frac);
    const allInTo = me.streetCommitted + me.stack;
    const presets: [string, number][] = [
      ['Min', r.minTo],
      ['½ Pot', potRaise(0.5)],
      ['Pot', potRaise(1)],
      [r.maxTo === allInTo ? 'All-in' : 'Max', r.maxTo],
    ];
    this.presets.replaceChildren(
      ...presets.map(([label, to]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset.to = String(Math.max(r.minTo, Math.min(r.maxTo, to)));
        b.disabled = label !== 'Min' && label !== 'All-in' && label !== 'Max' && (to < r.minTo || to > r.maxTo);
        return b;
      }),
    );
    this.setRaise(r.minTo);
  }

  private setRaise(to: number): void {
    const r = this.legal?.raise;
    if (!r || !this.view) return;
    this.clearConfirm();
    this.raiseTo = Math.max(r.minTo, Math.min(r.maxTo, Math.round(to)));
    this.slider.value = String(this.raiseTo);
    const me = this.view.seats[this.view.viewer];
    const allIn = this.raiseTo === me.streetCommitted + me.stack;
    const verb = allIn ? 'All-in' : r.isBet ? 'Bet' : 'Raise to';
    this.raise.textContent = `${this.cinderUid ? 'Cinder · ' : ''}${verb} ${this.raiseTo}`;
    this.raise.classList.toggle('enchanted', this.cinderUid !== null);
  }

  // ─────────────────────────── spell tray ───────────────────────────

  private renderSpells(magic: MagicView, names: string[] | null): void {
    const me = magic.viewer;
    const a = magic.aether[me];
    this.aether.textContent = '◆'.repeat(a) + '◇'.repeat(Math.max(0, 3 - a));
    this.aether.setAttribute('aria-label', `Aether ${a} of 3`);
    this.spellRow.hidden = magic.myHand.length === 0 && !magic.castThisHand[me];
    const castable = new Map(magic.options.map((o) => [o.spell, o]));
    this.spells.replaceChildren(
      ...magic.myHand.map((card) => {
        const def = SPELLS[card.spell];
        const option = names ? castable.get(card.spell) : undefined;
        const usable = option && option.uid === card.uid;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'spell';
        b.dataset.uid = card.uid;
        b.style.setProperty('--disc', DISCIPLINE_COLOR[def.discipline]);
        const title = document.createElement('span');
        title.className = 'spell-name';
        title.textContent = `${DISCIPLINE_GLYPH[def.discipline]} ${def.name}`;
        const cost = document.createElement('span');
        cost.className = 'spell-cost';
        cost.textContent = '◆'.repeat(def.cost);
        b.append(title, cost);
        b.title = def.effect;
        b.setAttribute('aria-label', `${def.name}, costs ${def.cost} Aether`);
        b.disabled = !usable;
        if (card.uid === this.cinderUid) b.classList.add('armed');
        if (usable) b.addEventListener('click', () => this.onSpell(card.uid, card.spell, option!.targets ?? [], names!));
        return b;
      }),
    );
  }

  private onSpell(uid: string, spell: SpellId, targets: number[], names: string[]): void {
    switch (spell) {
      case 'briar_lock':
        return this.cb.onCast(uid, { spell });
      case 'cinder_challenge':
        this.cinderUid = this.cinderUid === uid ? null : uid;
        this.spells.querySelectorAll<HTMLElement>('.spell').forEach((b) => b.classList.toggle('armed', b.dataset.uid === this.cinderUid));
        this.setRaise(this.raiseTo);
        return;
      case 'unmask':
        return this.showChoice(
          'Unmask whom?',
          targets.map((t) => [names[t], () => this.cb.onCast(uid, { spell, target: t })]),
        );
      case 'fate_exchange': {
        const hole = this.view!.seats[this.view!.viewer].hole!;
        return this.showChoice(
          'Exchange which card?',
          hole.map((c, i) => [`${rankLabel(c)}${suitGlyph(c)}`, () => this.cb.onCast(uid, { spell, holeIndex: i as 0 | 1 })]),
        );
      }
    }
  }

  private showChoice(prompt: string, options: [string, () => void][]): void {
    const label = document.createElement('span');
    label.textContent = prompt;
    this.choice.replaceChildren(
      label,
      ...options.map(([text, fn]) => button(text, fn, 'choice')),
      button('Cancel', () => (this.choice.hidden = true), 'choice ghost'),
    );
    this.choice.hidden = false;
  }
}
