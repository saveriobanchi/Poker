/**
 * DOM action bar and spell tray under the canvas: native buttons and a range
 * slider give reliable 44px tap targets and accessibility on phones.
 */
import type { CastParams, MagicView } from '../game/magic/table';
import { SPELLS, type SpellId } from '../game/magic/spells';
import type { LegalActions, PlayerAction, PublicView } from '../game/rules/engine';
import { rankLabel, suitGlyph } from './format';
import { pt } from './playtest';
import { DISCIPLINE_COLOR } from './theme';
import { aetherGems, DISCIPLINE_ICON, icon } from './icons';
import { SPELL_PLAIN } from './plain';

export interface ControlsCallbacks {
  onAction(action: PlayerAction): void;
  onCast(uid: string, params: CastParams): void;
  onPass(): void;
  onNextHand(): void;
  /** Second Reflection: keep candidate 0 or 1. */
  onChoose(pick: 0 | 1): void;
  /** Fateweaver's Sigil: rearrange one drawn spell (uid) or keep the draw (null). */
  onSigil(uid: string | null): void;
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
  private readonly odds = el<HTMLParagraphElement>('odds');
  private readonly info = el<HTMLDivElement>('spell-info');
  private readonly reason = el<HTMLParagraphElement>('spell-reason');
  private readonly custom = el<HTMLButtonElement>('btn-custom');
  /** What the spell tray is offering: nothing, a street-opening window, or the player's betting turn. */
  private mode: 'waiting' | 'window' | 'turn' = 'waiting';
  private canRaise = false;
  private reasonTimer: number | undefined;
  private infoOpen = false;
  private lastInfo: { magic: MagicView; deciding: boolean } | null = null;
  private readonly infoToggle = button('', () => {
    this.infoOpen = !this.infoOpen;
    if (this.infoOpen) pt()?.record('spell_info_open');
    if (this.lastInfo) this.renderInfo(this.lastInfo.magic, this.lastInfo.deciding);
  }, 'spell-info-toggle');

  private legal: LegalActions | null = null;
  private view: PublicView | null = null;
  private raiseTo = 0;
  private cinderUid: string | null = null;
  private cinderSpell: 'cinder_challenge' | 'ember_echo' | 'red_oath' = 'cinder_challenge';
  private confirming: 'call' | 'raise' | null = null;
  private confirmTimer: number | undefined;

  constructor(private readonly cb: ControlsCallbacks) {
    this.infoToggle.setAttribute('aria-label', 'Spell details');
    this.infoToggle.append(icon('info', 22));
    this.custom.replaceChildren(icon('scales', 22));
    this.spellRow.append(this.infoToggle);
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
      if (this.cinderUid) this.cb.onCast(this.cinderUid, { spell: this.cinderSpell, raiseTo: this.raiseTo });
      else this.cb.onAction({ type: r.isBet ? 'bet' : 'raise', to: this.raiseTo });
    });
    this.next.addEventListener('click', () => this.cb.onNextHand());
    this.pass.addEventListener('click', () => this.cb.onPass());
    this.slider.addEventListener('input', () => this.setRaise(Number(this.slider.value)));
    // Compact phones: the slider sits behind ± so presets and actions keep 44px without shrinking the table.
    this.custom.addEventListener('click', () => {
      const open = !this.raiseRow.classList.contains('custom');
      this.raiseRow.classList.toggle('custom', open);
      this.custom.setAttribute('aria-expanded', String(open));
      this.custom.replaceChildren(icon(open ? 'close' : 'scales', 22));
      this.custom.setAttribute('aria-label', open ? 'Back to preset amounts' : 'Choose a custom amount');
    });
    this.presets.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-to]');
      if (target) this.setRaise(Number(target.dataset.to));
    });
  }

  /** Second-tap confirmation for irreversible all-ins (art bible §8). Returns true when confirmed. */
  private confirm(kind: 'call' | 'raise', b: HTMLButtonElement, prompt: string): boolean {
    if (this.confirming === kind) {
      this.clearConfirm(false);
      return true;
    }
    this.clearConfirm();
    this.confirming = kind;
    pt()?.record('allin_confirm_shown', { kind });
    b.dataset.label = b.textContent ?? '';
    b.textContent = prompt;
    b.classList.add('confirm');
    this.confirmTimer = window.setTimeout(() => this.clearConfirm(), CONFIRM_MS);
    return false;
  }

  /** `abandoned`: the prompt lapsed or another control was used instead of the second tap. */
  private clearConfirm(abandoned = true): void {
    window.clearTimeout(this.confirmTimer);
    if (abandoned && this.confirming) pt()?.record('allin_confirm_cancelled', { kind: this.confirming });
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
    this.mode = 'waiting';
    this.canRaise = false;
    this.reason.hidden = true;
    this.raiseRow.classList.remove('custom');
    this.custom.setAttribute('aria-expanded', 'false');
    this.custom.replaceChildren(icon('scales', 22));
    this.legal = null;
    this.cinderUid = null;
    this.choice.hidden = true;
    this.odds.hidden = true;
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
    this.mode = 'window';
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

    // Pot odds, stated plainly (mobile QA v0.9): what the call costs against what it can win.
    if (!legal.canCheck) {
      const pot = view.seats.reduce((sum, p) => sum + p.totalCommitted, 0);
      const call = Math.min(legal.callAmount, me.stack);
      const need = Math.round((100 * call) / (pot + call));
      this.odds.innerHTML = `Pot <b>${pot}</b> · to call <b>${call}</b> · you need <b>${need}%</b> equity to break even`;
      this.odds.hidden = false;
    }
    const r = legal.raise;
    this.raise.disabled = !r;
    this.raiseRow.hidden = !r;
    this.mode = 'turn';
    this.canRaise = !!r;
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
    this.raise.textContent = `${this.cinderUid ? `${SPELLS[this.cinderSpell].name} · ` : ''}${verb} ${this.raiseTo}`;
    this.raise.classList.toggle('enchanted', this.cinderUid !== null);
  }

  // ─────────────────────────── spell tray ───────────────────────────

  private renderSpells(magic: MagicView, names: string[] | null): void {
    const me = magic.viewer;
    const a = magic.aether[me];
    this.aether.replaceChildren(aetherGems(a, 3, 15));
    this.aether.setAttribute('aria-label', `Aether ${a} of 3`);
    this.spellRow.hidden = magic.myHand.length === 0 && !magic.castThisHand[me];
    this.renderInfo(magic, names !== null);
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
        b.dataset.disc = def.discipline;
        const title = document.createElement('span');
        title.className = 'spell-name';
        title.append(icon(DISCIPLINE_ICON[def.discipline], 14), def.name);
        const cost = document.createElement('span');
        cost.className = 'spell-cost';
        cost.append(def.cost ? aetherGems(def.cost, def.cost, 10) : 'free');
        b.append(title, cost);
        b.title = SPELL_PLAIN[card.spell].does;
        // A spell that cannot be cast stays focusable and says why when tapped (design v1.1 §08).
        const why = usable ? '' : this.whyNot(magic, card.uid, card.spell);
        b.setAttribute('aria-label', `${def.name}, costs ${def.cost} Aether${why ? `. Not castable: ${why}` : ''}`);
        b.setAttribute('aria-disabled', String(!usable));
        b.classList.toggle('unusable', !usable);
        if (card.uid === this.cinderUid) b.classList.add('armed');
        if (usable) b.addEventListener('click', () => this.onSpell(card.uid, card.spell, option!.targets ?? [], names!));
        else b.addEventListener('click', () => this.showReason(`${def.name}: ${why}`));
        return b;
      }),
    );
  }

  /** Tap-to-read spell list (phones have no hover): cost, effect and whether it can be cast now. */
  private renderInfo(magic: MagicView, deciding: boolean): void {
    this.lastInfo = { magic, deciding };
    const castable = new Set(magic.options.map((o) => o.uid));
    this.infoToggle.setAttribute('aria-expanded', String(this.infoOpen));
    this.infoToggle.classList.toggle('open', this.infoOpen);
    this.info.replaceChildren(
      ...magic.myHand.map((c) => {
        const def = SPELLS[c.spell];
        const plain = SPELL_PLAIN[c.spell];
        const row = document.createElement('div');
        row.className = 'info-entry';
        row.style.setProperty('--disc', DISCIPLINE_COLOR[def.discipline]);
        const name = document.createElement('span');
        name.className = 'info-name';
        name.textContent = `${def.name} · ${def.cost ? `${def.cost} Aether` : 'free'}`;
        const meta = document.createElement('span');
        const now = castable.has(c.uid);
        meta.className = `info-meta${now ? ' now' : ''}`;
        meta.textContent = now ? 'You can cast it now' : `${plain.when} — not now: ${this.whyNot(magic, c.uid, c.spell)}`;
        const does = document.createElement('span');
        does.className = 'info-does';
        does.textContent = plain.does;
        row.append(icon(DISCIPLINE_ICON[def.discipline], 18), name, meta, does);
        return row;
      }),
    );
    this.info.hidden = !this.infoOpen || magic.myHand.length === 0;
  }

  /** Why a drawn spell cannot be cast at this moment, from the player's own view only. */
  private whyNot(magic: MagicView, uid: string, spell: SpellId): string {
    const def = SPELLS[spell];
    const me = magic.viewer;
    if (magic.castThisHand[me]) return 'you have already cast a spell this hand (one per hand).';
    if (this.mode === 'waiting') return def.family === 'cinder_challenge' ? 'cast it with a raise on your turn.' : 'cast it when a street opens, before the betting.';
    if (def.family === 'cinder_challenge') {
      if (this.mode === 'window') return 'it enchants a raise: cast it on your betting turn.';
      if (!this.canRaise) return 'no raise is legal for you right now.';
    } else if (this.mode === 'turn') return 'it is cast when a street opens, before the betting.';
    if (magic.aether[me] < def.cost) return `needs ${def.cost} Aether; you have ${magic.aether[me]}.`;
    if (def.family === 'briar_lock' && magic.streetLocked) return 'this street is already locked.';
    if (def.family === 'unmask') return 'no opponent can be targeted now (folded, all-in or already revealed).';
    void uid;
    return 'not castable at this moment.';
  }

  private showReason(text: string): void {
    this.reason.textContent = text;
    this.reason.hidden = false;
    window.clearTimeout(this.reasonTimer);
    this.reasonTimer = window.setTimeout(() => (this.reason.hidden = true), 3500);
  }

  private onSpell(uid: string, spell: SpellId, targets: number[], names: string[]): void {
    switch (SPELLS[spell].family) {
      case 'briar_lock':
        return this.cb.onCast(uid, { spell: spell as 'briar_lock' });
      case 'cinder_challenge':
        this.cinderUid = this.cinderUid === uid ? null : uid;
        this.cinderSpell = spell as typeof this.cinderSpell;
        this.spells.querySelectorAll<HTMLElement>('.spell').forEach((b) => b.classList.toggle('armed', b.dataset.uid === this.cinderUid));
        this.setRaise(this.raiseTo);
        return;
      case 'unmask':
        // Twin Oracle (design v0.7 §08): one or exactly two eligible are targeted automatically; with three or more, choose two.
        if (spell === 'twin_oracle' && targets.length <= 2) return this.cb.onCast(uid, { spell, targets });
        if (spell === 'twin_oracle') {
          return this.showChoice(
            'Twin Oracle: first opponent?',
            targets.map((a) => [
              names[a],
              () =>
                this.showChoice(
                  'Twin Oracle: second opponent?',
                  targets.filter((b) => b !== a).map((b) => [names[b], () => this.cb.onCast(uid, { spell: 'twin_oracle', targets: [a, b] })]),
                ),
            ]),
          );
        }
        return this.showChoice(
          `${SPELLS[spell].name}: whom?`,
          targets.map((t) => [names[t], () => this.cb.onCast(uid, { spell: spell as 'unmask', target: t })]),
        );
      case 'fate_exchange': {
        const hole = this.view!.seats[this.view!.viewer].hole!;
        return this.showChoice(
          `${SPELLS[spell].name}: which card?`,
          hole.map((c, i) => [`${rankLabel(c)}${suitGlyph(c)}`, () => this.cb.onCast(uid, { spell: spell as 'fate_exchange', holeIndex: i as 0 | 1 })]),
        );
      }
    }
  }

  /** Fateweaver's Sigil: once per table, before any window. */
  showSigil(view: PublicView, magic: MagicView): void {
    this.reset();
    this.view = view;
    this.actionRow.hidden = true;
    this.renderSpells(magic, null);
    const label = document.createElement('span');
    label.textContent = 'Sigil: rearrange which spell?';
    this.choice.replaceChildren(
      label,
      ...magic.myHand.map((c) => button(SPELLS[c.spell].name, () => this.cb.onSigil(c.uid), 'choice')),
      button('Keep — consumes Sigil for this table', () => this.cb.onSigil(null), 'choice ghost'),
    );
    this.choice.hidden = false;
  }

  /** Second Reflection's private pick: the table waits until the player chooses. */
  showPick(view: PublicView, magic: MagicView): void {
    this.reset();
    this.view = view;
    this.actionRow.hidden = true;
    this.renderSpells(magic, null);
    const c = magic.choice!;
    const label = document.createElement('span');
    label.textContent = 'Second Reflection: keep which card?';
    this.choice.replaceChildren(label, ...c.candidates.map((card, i) => button(`${rankLabel(card)}${suitGlyph(card)}`, () => this.cb.onChoose(i as 0 | 1), 'choice')));
    this.choice.hidden = false;
  }

  private showChoice(prompt: string, options: [string, () => void][]): void {
    const label = document.createElement('span');
    label.textContent = prompt;
    this.choice.replaceChildren(
      label,
      ...options.map(([text, fn]) => button(text, fn, 'choice')),
      button('Cancel', () => {
        pt()?.record('cancel_choice', { prompt });
        this.choice.hidden = true;
      }, 'choice ghost'),
    );
    this.choice.hidden = false;
  }
}
