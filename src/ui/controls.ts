/**
 * DOM action bar under the canvas: native buttons and a range slider give
 * reliable 44px+ tap targets and accessibility on phones.
 */
import type { LegalActions, PlayerAction, PublicView } from '../game/rules/engine';

export interface ControlsCallbacks {
  onAction(action: PlayerAction): void;
  onNextHand(): void;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export class Controls {
  private readonly fold = el<HTMLButtonElement>('btn-fold');
  private readonly call = el<HTMLButtonElement>('btn-call');
  private readonly raise = el<HTMLButtonElement>('btn-raise');
  private readonly next = el<HTMLButtonElement>('btn-next');
  private readonly raiseRow = el<HTMLDivElement>('raise-row');
  private readonly slider = el<HTMLInputElement>('raise-slider');
  private readonly presets = el<HTMLDivElement>('raise-presets');
  private readonly actionRow = el<HTMLDivElement>('action-row');
  private legal: LegalActions | null = null;
  private raiseTo = 0;

  constructor(private readonly cb: ControlsCallbacks) {
    this.fold.addEventListener('click', () => this.legal && this.cb.onAction({ type: 'fold' }));
    this.call.addEventListener('click', () => {
      if (!this.legal) return;
      this.cb.onAction(this.legal.canCheck ? { type: 'check' } : { type: 'call' });
    });
    this.raise.addEventListener('click', () => {
      const r = this.legal?.raise;
      if (!r) return;
      this.cb.onAction({ type: r.isBet ? 'bet' : 'raise', to: this.raiseTo });
    });
    this.next.addEventListener('click', () => this.cb.onNextHand());
    this.slider.addEventListener('input', () => this.setRaise(Number(this.slider.value)));
    this.presets.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-to]');
      if (target) this.setRaise(Number(target.dataset.to));
    });
  }

  /** Waiting for others: everything disabled. */
  showWaiting(): void {
    this.legal = null;
    this.actionRow.hidden = false;
    this.next.hidden = true;
    this.raiseRow.hidden = true;
    for (const b of [this.fold, this.call, this.raise]) b.disabled = true;
    this.call.textContent = 'Check';
    this.raise.textContent = 'Raise';
  }

  showHandComplete(label: string): void {
    this.legal = null;
    this.actionRow.hidden = true;
    this.raiseRow.hidden = true;
    this.next.hidden = false;
    this.next.textContent = label;
  }

  showTurn(view: PublicView): void {
    const legal = view.legal!;
    this.legal = legal;
    this.actionRow.hidden = false;
    this.next.hidden = true;
    this.fold.disabled = legal.canCheck; // folding for free is legal but never useful: guard misclicks
    this.call.disabled = false;
    const me = view.seats[view.viewer];
    if (legal.canCheck) this.call.textContent = 'Check';
    else if (legal.callAmount >= me.stack) this.call.textContent = `All-in ${legal.callAmount}`;
    else this.call.textContent = `Call ${legal.callAmount}`;

    const r = legal.raise;
    this.raise.disabled = !r;
    this.raiseRow.hidden = !r;
    if (!r) {
      this.raise.textContent = 'Raise';
      return;
    }
    this.slider.min = String(r.minTo);
    this.slider.max = String(r.maxTo);
    this.slider.step = '1';
    const pot = view.seats.reduce((s, p) => s + p.totalCommitted, 0);
    const potRaise = (frac: number) => Math.round(view.currentBet + (pot + legal.callAmount) * frac);
    const presets: [string, number][] = [
      ['Min', r.minTo],
      ['½ Pot', potRaise(0.5)],
      ['Pot', potRaise(1)],
      ['All-in', r.maxTo],
    ];
    this.presets.replaceChildren(
      ...presets.map(([label, to]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        const clamped = Math.max(r.minTo, Math.min(r.maxTo, to));
        b.dataset.to = String(clamped);
        b.disabled = label !== 'Min' && label !== 'All-in' && (to < r.minTo || to > r.maxTo);
        return b;
      }),
    );
    this.setRaise(r.minTo);
  }

  private setRaise(to: number): void {
    const r = this.legal?.raise;
    if (!r) return;
    this.raiseTo = Math.max(r.minTo, Math.min(r.maxTo, Math.round(to)));
    this.slider.value = String(this.raiseTo);
    const verb = r.isBet ? 'Bet' : 'Raise to';
    this.raise.textContent = this.raiseTo === r.maxTo ? `All-in ${this.raiseTo}` : `${verb} ${this.raiseTo}`;
  }
}
