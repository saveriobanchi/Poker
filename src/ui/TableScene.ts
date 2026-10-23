/**
 * Renders the table from the human seat's PublicView and MagicView only, so
 * the screen can never show more than the player may legally know.
 */
import Phaser from 'phaser';
import type { Card } from '../game/rules/cards';
import type { PublicView } from '../game/rules/engine';
import { CATEGORY_NAMES } from '../game/rules/evaluator';
import type { MagicEvent, MagicView } from '../game/magic/table';
import { SPELLS } from '../game/magic/spells';
import { actionLabel } from './format';
import { DISCIPLINE_COLOR } from './theme';

export const TABLE_WIDTH = 400;
export const TABLE_HEIGHT = 520;

/** Render scale for crisp text and vectors on high-DPI phone screens. */
export const RENDER_ZOOM = Math.min(Math.ceil(globalThis.devicePixelRatio || 1), 3);

const CARD_BACK_FRAME = 52;
const CARD_W = 50;
const CARD_H = 70;
const DISPLAY = 'Cinzel, Georgia, serif';
const UI = '"Alegreya Sans", "Gill Sans", sans-serif';
/** Palette shared with src/style.css. */
const C = {
  plate: 0x16120f,
  brass: 0xc4a052,
  brassHi: 0xead39a,
  brassLo: 0x6f5934,
  arcane: 0xa28ecc,
  arcaneDim: 0x3a3247,
};

export interface TableModel {
  view: PublicView;
  magic: MagicView;
  names: string[];
  portraits: string[];
  /** Seat index rendered at the bottom of the screen. */
  humanSeat: number;
  handNumber: number;
  /** Spell events not yet animated. */
  freshEvents: MagicEvent[];
  /** Per seat: still seated, departed (survived a Last Claim) or dead. */
  seatStatus: ('seated' | 'exited' | 'dead')[];
  /** Table stacks after settlement and any Last Claim transfers. */
  stacks: number[];
  /** Cosmetic back for every face-down card at the table (never per seat). */
  back?: string;
}

interface SeatLayout {
  plate: [number, number];
  cards: [number, number];
  bet: [number, number];
  button: [number, number];
  cardScale: number;
  plateWidth: number;
  /** Where the action/result pill goes. */
  label: [number, number];
}

/** Layouts by position relative to the human (0 = bottom, then clockwise). */
const LAYOUT_4: SeatLayout[] = [
  { plate: [200, 494], cards: [200, 418], bet: [200, 362], button: [300, 478], cardScale: 1.3, plateWidth: 168, label: [82, 418] },
  { plate: [70, 166], cards: [70, 226], bet: [132, 254], button: [152, 146], cardScale: 0.82, plateWidth: 134, label: [70, 134] },
  { plate: [200, 40], cards: [200, 100], bet: [200, 150], button: [300, 30], cardScale: 0.82, plateWidth: 172, label: [272, 100] },
  { plate: [330, 166], cards: [330, 226], bet: [268, 254], button: [248, 146], cardScale: 0.82, plateWidth: 134, label: [330, 134] },
];
const LAYOUT_3 = [LAYOUT_4[0], LAYOUT_4[1], LAYOUT_4[3]];
const LAYOUT_2 = [LAYOUT_4[0], LAYOUT_4[2]];

/** Runtime portrait files available (public/assets/portraits/index.json), set before the game boots. */
export const PORTRAIT_FILES: string[] = ['wagerer', 'vesper', 'oracle', 'corvin', 'adjudicator'];
/** Cosmetic card backs that passed the art gate (public/assets/backs/index.json). */
export const BACK_FILES: string[] = [];

/** Portrait file for a character id, or null for a monogram. */
export function portraitFor(id: string): string | null {
  const file = id === 'you' ? 'wagerer' : id.replace(/_/g, '-');
  return PORTRAIT_FILES.includes(file) ? file : null;
}

export class TableScene extends Phaser.Scene {
  private root?: Phaser.GameObjects.Container;
  private fx?: Phaser.GameObjects.Container;
  private pending?: TableModel;
  private lastHand = -1;
  private shownBoard = 0;
  private ready = false;
  private masks: Phaser.GameObjects.Graphics[] = [];
  /** Hand whose pot has already been sent to its winners (the chips travel once). */
  private potHand = -1;
  /** Texture for face-down cards when a cosmetic back is chosen; null = the standard back (frame 52). */
  private backKey: string | null = null;
  /** Reduce motion (system setting or the HUD toggle): no pulses, flips or slides; tells stay readable. */
  reduceMotion = false;

  constructor() {
    super('table');
  }

  preload(): void {
    this.load.spritesheet('cards', 'assets/cards.webp', { frameWidth: 300, frameHeight: 420 });
    this.load.image('felt', 'assets/felt.webp');
    this.load.image('chip', 'assets/lifechip.png');
    this.load.image('dealer', 'assets/dealer-button.png');
    // Only portraits packed by scripts/check-art.py are listed; everyone else keeps a gold monogram.
    for (const id of PORTRAIT_FILES) this.load.image(`portrait-${id}`, `assets/portraits/${id}.webp`);
    for (const id of BACK_FILES) this.load.image(`back-${id}`, `assets/backs/${id}.webp`);
  }

  create(): void {
    // The canvas is RENDER_ZOOM times the logical size; the camera maps logical coordinates onto it.
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
    this.add.image(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 'felt').setDisplaySize(TABLE_WIDTH, TABLE_HEIGHT);
    this.add.image(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, this.candleLight()).setDisplaySize(TABLE_WIDTH, TABLE_HEIGHT);
    this.ready = true;
    if (this.pending) this.renderModel(this.pending);
  }

  /**
   * Practical light over the felt (visual direction v1.2): a warm candle key from the upper left,
   * a faint cool rim from the right and a soft vignette. Drawn once; it carries no information.
   */
  private candleLight(): string {
    const key = 'candle-light';
    if (this.textures.exists(key)) return key;
    const w = TABLE_WIDTH * 2;
    const h = TABLE_HEIGHT * 2;
    const tex = this.textures.createCanvas(key, w, h)!;
    const ctx = tex.getContext();
    const glow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    glow(w * 0.16, h * 0.04, w * 0.95, 'rgba(255, 186, 104, 0.16)');
    glow(w * 1.04, h * 0.62, w * 0.62, 'rgba(120, 170, 200, 0.07)');
    const v = ctx.createRadialGradient(w / 2, h * 0.52, h * 0.28, w / 2, h * 0.52, h * 0.78);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
    return key;
  }

  /** A small stack of Lifechips whose height follows the amount; the exact figure is always printed beside it. */
  private chipStack(x: number, y: number, amount: number, bigBlind: number, max = 5): Phaser.GameObjects.Container {
    const n = Math.max(1, Math.min(max, Math.ceil(amount / Math.max(1, bigBlind * 2))));
    const c = this.add.container(x, y);
    for (let i = 0; i < n; i++) {
      const shade = this.add.ellipse(0.6, 3 - i * 2.6, 17, 6, 0x000000, 0.35);
      const chip = this.add.image(0, -i * 2.6, 'chip').setDisplaySize(17, 17);
      c.add([shade, chip]);
    }
    return c;
  }

  renderModel(model: TableModel): void {
    this.pending = model;
    if (!this.ready) return;
    this.backKey = model.back && model.back !== 'standard' && this.textures.exists(`back-${model.back}`) ? `back-${model.back}` : null;
    this.root?.destroy();
    for (const m of this.masks) m.destroy();
    this.masks = [];
    this.root = this.add.container(0, 0);
    if (!this.fx) this.fx = this.add.container(0, 0).setDepth(10);
    const { view } = model;
    const n = view.seats.length;
    const layout = n === 4 ? LAYOUT_4 : n === 3 ? LAYOUT_3 : LAYOUT_2;
    if (model.handNumber !== this.lastHand) {
      this.lastHand = model.handNumber;
      this.shownBoard = 0;
    }

    this.drawPot(model);
    this.drawBoard(view.board);
    for (let seat = 0; seat < n; seat++) {
      const rel = (seat - model.humanSeat + n) % n;
      this.drawSeat(model, seat, layout[rel], rel === 0);
    }
    for (const e of model.freshEvents) {
      const rel = (e.seat - model.humanSeat + n) % n;
      this.animateTell(model, e, layout[rel]);
    }
    // Feedback: the pot's chips travel to each winner once per hand (skipped with reduced motion).
    if (view.phase === 'complete' && view.result && this.potHand !== model.handNumber) {
      this.potHand = model.handNumber;
      if (!this.reduceMotion) {
        view.result.netChange.forEach((net, seat) => {
          if (net <= 0) return;
          const [tx, ty] = layout[(seat - model.humanSeat + n) % n].plate;
          const stack = this.chipStack(200, 207, net, view.bigBlind, 6);
          this.fx!.add(stack);
          this.tweens.add({ targets: stack, x: tx - 30, y: ty, duration: 620, ease: 'Cubic.InOut', onComplete: () => this.tweens.add({ targets: stack, alpha: 0, duration: 260, onComplete: () => stack.destroy() }) });
        });
      }
    }
  }

  // ─────────────────────────── drawing ───────────────────────────

  private drawPot(model: TableModel): void {
    const { view } = model;
    if (view.phase === 'complete') return;
    const pot = view.seats.reduce((s, p) => s + p.totalCommitted, 0);
    const inFront = view.seats.reduce((s, p) => s + p.streetCommitted, 0);
    const r = this.root!;
    // One figure: the whole pot, the same number the odds line uses. Bets still in front of seats show beside them.
    if (pot > 0) {
      const amount = this.txt(0, 0, String(pot), { fontFamily: UI, fontSize: '19px', color: '#EAD39A', fontStyle: '700' }).setOrigin(0, 0.5);
      const w = 21 + amount.width;
      r.add(this.chipStack(200 - w / 2 + 8, 207, pot, view.bigBlind, 6));
      amount.setPosition(200 - w / 2 + 21, 204);
      r.add(amount);
      r.add(this.txt(200, 223, inFront > 0 ? `POT · ${inFront} IN BETS` : 'POT', { fontFamily: UI, fontSize: '9.5px', color: '#B5A98E', fontStyle: '700', letterSpacing: 2 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5));
    }
    if (model.magic.streetLocked) {
      r.add(this.tag(200, 240, 'POT-LIMIT THIS STREET', '#477A68', '#E4F0EA'));
    }
  }

  private drawBoard(board: Card[]): void {
    for (let i = 0; i < 5; i++) {
      const x = 200 + (i - 2) * 56;
      const y = 300;
      if (i >= board.length) {
        const slot = this.add.graphics();
        slot.lineStyle(1, 0xc9a24a, 0.22).strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 5);
        this.root!.add(slot);
        continue;
      }
      const card = this.card(x, y, board[i], 1);
      this.root!.add(card);
      if (i >= this.shownBoard && !this.reduceMotion) {
        card.setAlpha(0).setScale(0.7);
        this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 280, delay: (i - this.shownBoard) * 120, ease: 'Back.Out' });
      }
    }
    this.shownBoard = board.length;
  }

  private drawSeat(model: TableModel, seat: number, L: SeatLayout, isHuman: boolean): void {
    const { view, magic } = model;
    const p = view.seats[seat];
    const status = model.seatStatus[seat];
    const stack = view.phase === 'complete' ? model.stacks[seat] : p.stack;
    const busted = status !== 'seated' || (stack === 0 && (view.phase === 'complete' || !p.allIn));
    const active =
      view.phase === 'betting' && (magic.windowSeat !== null ? magic.windowSeat === seat : view.toAct === seat);
    const r = this.root!;

    // Plate with portrait medallion.
    const [px, py] = L.plate;
    const w = L.plateWidth;
    const left = px - w / 2;
    // Engraved plate: chamfered corners, an outer brass rule and a faint inner one.
    const plate = this.add.graphics();
    const chamfer = (x: number, y: number, pw: number, ph: number, c: number) => [
      new Phaser.Math.Vector2(x + c, y),
      new Phaser.Math.Vector2(x + pw - c, y),
      new Phaser.Math.Vector2(x + pw, y + c),
      new Phaser.Math.Vector2(x + pw, y + ph - c),
      new Phaser.Math.Vector2(x + pw - c, y + ph),
      new Phaser.Math.Vector2(x + c, y + ph),
      new Phaser.Math.Vector2(x, y + ph - c),
      new Phaser.Math.Vector2(x, y + c),
    ];
    plate.fillStyle(0x000000, 0.35).fillPoints(chamfer(left + 1, py - 21, w, 46, 6), true);
    plate.fillStyle(C.plate, 0.95).fillPoints(chamfer(left, py - 23, w, 46, 6), true);
    plate.lineStyle(1, active ? C.brassHi : C.brassLo, 1).strokePoints(chamfer(left, py - 23, w, 46, 6), true);
    plate.lineStyle(1, C.brass, active ? 0.55 : 0.18).strokePoints(chamfer(left + 3, py - 20, w - 6, 40, 4), true);
    r.add(plate);
    if (active) {
      const glow = this.add.graphics();
      glow.lineStyle(3, C.brassHi, 0.22).strokePoints(chamfer(left - 2, py - 25, w + 4, 50, 7), true);
      r.add(glow);
      if (!this.reduceMotion) this.tweens.add({ targets: glow, alpha: 0.25, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    const cx = left + 24;
    const key = `portrait-${model.portraits[seat]}`;
    if (this.textures.exists(key)) {
      const portrait = this.add.image(cx, py, key).setDisplaySize(40, 40);
      const mask = this.make.graphics({}, false).fillCircle(cx, py, 19);
      this.masks.push(mask);
      portrait.setMask(mask.createGeometryMask());
      if (busted) portrait.setTint(0x555555);
      r.add(portrait);
    } else {
      // Provisional monogram until the painted portrait is delivered (asset manifest: "needed").
      const disc = this.add.graphics();
      disc.fillStyle(busted ? 0x2a2622 : 0x3a2a24, 1).fillCircle(cx, py, 19);
      r.add(disc);
      const initials = model.names[seat].split(/\s+/).filter((w) => /^[A-Z]/.test(w) && w !== 'The').map((w) => w[0]).join('').slice(0, 2);
      r.add(this.txt(cx, py, initials, { fontFamily: DISPLAY, fontSize: '15px', color: busted ? '#6d6458' : '#F3D27A', fontStyle: '600' }).setOrigin(0.5));
    }
    const ring = this.add.graphics();
    ring.lineStyle(1.5, busted ? 0x555555 : C.brass, 1).strokeCircle(cx, py, 20);
    ring.lineStyle(1, busted ? 0x333333 : C.brassLo, 1).strokeCircle(cx, py, 22.5);
    r.add(ring);

    const textX = left + 50;
    const name = this.txt(textX, py - 10, model.names[seat], {
      fontFamily: DISPLAY,
      fontSize: isHuman ? '13px' : '11px',
      color: busted ? '#6d6458' : '#ECE2C8',
      fontStyle: '600',
    }).setOrigin(0, 0.5);
    const room = left + w - 8 - textX;
    if (name.width > room) name.setScale(room / name.width);
    r.add(name);
    if (busted) {
      const gone = status === 'exited' ? 'Departed · Fallen' : status === 'dead' ? 'Claimed' : 'Last Claim';
      r.add(this.txt(textX, py + 9, gone, { fontFamily: UI, fontSize: '12px', color: status === 'exited' ? '#B5A98E' : '#D58474', fontStyle: '700' }).setOrigin(0, 0.5));
    } else {
      r.add(this.add.image(textX + 6, py + 9, 'chip').setDisplaySize(12, 12));
      r.add(
        this.txt(textX + 15, py + 9, String(stack), { fontFamily: UI, fontSize: '14px', color: '#EAD39A', fontStyle: '700' }).setOrigin(0, 0.5),
      );
      // Aether pips (public).
      const pipX = left + w - 12;
      for (let i = 0; i < 3; i++) {
        const g = this.add.graphics();
        const x = pipX - (2 - i) * 10;
        const filled = i < magic.aether[seat];
        g.fillStyle(filled ? C.arcane : C.arcaneDim, 1);
        g.fillPoints([new Phaser.Math.Vector2(x, py + 4), new Phaser.Math.Vector2(x + 4, py + 9), new Phaser.Math.Vector2(x, py + 14), new Phaser.Math.Vector2(x - 4, py + 9)], true);
        r.add(g);
      }
    }

    if (seat === view.button) {
      const [bx, by] = L.button;
      r.add(this.add.image(bx, by, 'dealer').setDisplaySize(20, 20));
      r.add(this.txt(bx, by, 'D', { fontFamily: DISPLAY, fontSize: '10px', color: '#201E22', fontStyle: '700' }).setOrigin(0.5));
    }

    // Hole cards: own, shown at showdown, or legitimately unmasked; otherwise backs.
    if (p.inHand) {
      const [cx2, cy] = L.cards;
      const s = L.cardScale;
      const gap = 28 * s;
      // Opponent cards this viewer may see: public reveals (gold) and its own Unmask reads (violet).
      const shown: { card: Card; glow: number }[] = [];
      for (const k of magic.publicKnown) if (k.seat === seat) shown.push({ card: k.card, glow: 0xf3d27a });
      for (const k of magic.known) if (k.seat === seat && !shown.some((x) => x.card === k.card)) shown.push({ card: k.card, glow: 0x9d86c9 });
      for (let i = 0; i < 2; i++) {
        const x = cx2 + (i === 0 ? -gap / 2 : gap / 2);
        let face: Card | null = p.hole ? p.hole[i] : null;
        const reveal = !p.hole ? shown[i] : undefined;
        const unmasked = reveal !== undefined;
        if (reveal) face = reveal.card;
        const obj = face !== null ? this.card(x, cy, face, s) : this.card(x, cy, CARD_BACK_FRAME, s);
        obj.setAngle(i === 0 ? -4 : 4);
        if (p.folded) obj.setAlpha(0.3);
        r.add(obj);
        if (unmasked) {
          const glow = this.add.graphics({ x, y: cy });
          glow.lineStyle(2, reveal!.glow, 1).strokeRoundedRect(-(CARD_W * s) / 2 - 2, -(CARD_H * s) / 2 - 2, CARD_W * s + 4, CARD_H * s + 4, 5);
          glow.setAngle(i === 0 ? -4 : 4);
          r.add(glow);
        }
      }
    }

    if (p.streetCommitted > 0 && view.phase === 'betting') {
      const [bx, by] = L.bet;
      r.add(this.chipStack(bx - 10, by + 2, p.streetCommitted, view.bigBlind));
      r.add(this.txt(bx + 2, by, String(p.streetCommitted), { fontFamily: UI, fontSize: '14px', color: '#EAD39A', fontStyle: '700', stroke: '#0b0d0c', strokeThickness: 3 }).setOrigin(0, 0.5));
    }

    // Spell cast this hand (public), on the plate edge.
    const cast = magic.events.find((e) => e.seat === seat);
    if (cast) {
      const def = SPELLS[cast.spell];
      const t = this.tag(0, isHuman ? py - 23 : py + 23, def.name.toUpperCase(), DISCIPLINE_COLOR[def.discipline], '#F6EEDB', 9);
      t.setX(left + w - 6 - t.width / 2);
      r.add(t);
    }

    const label = this.statusLabel(view, seat);
    if (label) {
      const [tx, ty] = L.label;
      const text = label.win ? this.tag(tx, ty, label.text.toUpperCase(), '#CBA552', '#1D140A', 11) : this.tag(tx, ty, label.text.toUpperCase(), '#15110E', '#ECE2C8', 10.5, '#6F5934');
      r.add(text);
      if (label.win && !this.reduceMotion) this.tweens.add({ targets: text, y: ty - 6, duration: 500, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
    }
  }

  private statusLabel(view: PublicView, seat: number): { text: string; win: boolean } | null {
    const p = view.seats[seat];
    if (view.phase === 'complete' && view.result) {
      const won = view.result.netChange[seat];
      const shown = view.result.showdown.find((e) => e.seat === seat);
      const hand = shown ? CATEGORY_NAMES[shown.hand.category] : '';
      if (won > 0) return { text: `+${won}${hand ? ' · ' + hand : ''}`, win: true };
      if (shown) return { text: hand, win: false };
      return p.folded ? { text: 'Fold', win: false } : null;
    }
    for (let i = view.log.length - 1; i >= 0; i--) {
      const e = view.log[i];
      if (e.street !== view.street) break;
      if (e.seat === seat) return { text: actionLabel(e.action, p.allIn), win: false };
    }
    if (p.folded) return { text: 'Fold', win: false };
    if (p.allIn) return { text: 'All-in', win: false };
    return null;
  }

  /** Public magic tell: a coloured arc at the caster plus a banner over the board. */
  private animateTell(model: TableModel, e: MagicEvent, L: SeatLayout): void {
    const def = SPELLS[e.spell];
    const color = Phaser.Display.Color.HexStringToColor(DISCIPLINE_COLOR[def.discipline]).color;
    const [px, py] = L.plate;
    const arc = this.add.graphics();
    arc.lineStyle(2, color, 1).strokeCircle(px - L.plateWidth / 2 + 24, py, 25);
    arc.lineStyle(1, color, 0.6).strokeCircle(px - L.plateWidth / 2 + 24, py, 28);
    this.fx!.add(arc);
    if (this.reduceMotion) this.time.delayedCall(900, () => arc.destroy());
    else this.tweens.add({ targets: arc, alpha: 0, scale: 1.04, duration: 900, onComplete: () => arc.destroy() });

    const who = model.names[e.seat];
    const target = e.target !== undefined ? ` → ${model.names[e.target]}` : '';
    // A cartouche over the board: lacquer, two rules in the discipline's colour, the caster and the spell.
    const label = this.txt(0, 0, `${who} · ${def.name}${target}`, { fontFamily: DISPLAY, fontSize: '12.5px', color: '#F3E9D2', fontStyle: '600' }).setOrigin(0.5);
    const bw = Math.min(380, label.width + 34);
    const bg = this.add.graphics();
    bg.fillStyle(0x120f0d, 0.94).fillRect(-bw / 2, -15, bw, 30);
    bg.lineStyle(1, color, 1).lineBetween(-bw / 2, -15, bw / 2, -15).lineBetween(-bw / 2, 15, bw / 2, 15);
    bg.lineStyle(1, color, 0.45).lineBetween(-bw / 2 + 6, -12, bw / 2 - 6, -12).lineBetween(-bw / 2 + 6, 12, bw / 2 - 6, 12);
    bg.fillStyle(color, 1).fillPoints([new Phaser.Math.Vector2(-bw / 2 - 5, 0), new Phaser.Math.Vector2(-bw / 2, -5), new Phaser.Math.Vector2(-bw / 2 + 5, 0), new Phaser.Math.Vector2(-bw / 2, 5)], true);
    bg.fillPoints([new Phaser.Math.Vector2(bw / 2 - 5, 0), new Phaser.Math.Vector2(bw / 2, -5), new Phaser.Math.Vector2(bw / 2 + 5, 0), new Phaser.Math.Vector2(bw / 2, 5)], true);
    if (label.width > bw - 34) label.setScale((bw - 34) / label.width);
    const banner = this.add.container(200, 262, [bg, label]);
    this.fx!.add(banner);
    if (this.reduceMotion) {
      this.time.delayedCall(1700, () => banner.destroy());
      return;
    }
    banner.setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 200,
      hold: 1300,
      yoyo: true,
      onComplete: () => banner.destroy(),
    });
  }

  // ─────────────────────────── primitives ───────────────────────────

  /** A small engraved tag: flat plate, optional hairline, letter-spaced caps. */
  private tag(x: number, y: number, text: string, fill: string, ink: string, size = 10, line?: string): Phaser.GameObjects.Container {
    const t = this.txt(0, 0, text, { fontFamily: UI, fontSize: `${size}px`, color: ink, fontStyle: '700', letterSpacing: 1.2 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);
    const w = t.width + 12;
    const h = size + 8;
    const g = this.add.graphics();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(fill).color, 0.95).fillRect(-w / 2, -h / 2, w, h);
    if (line) g.lineStyle(1, Phaser.Display.Color.HexStringToColor(line).color, 1).strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    return this.add.container(x, y, [g, t]).setSize(w, h);
  }

  private txt(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { ...style, resolution: RENDER_ZOOM });
  }

  /** A card face (frame = engine card number) or the back (frame 52), at logical 50x70 times `scale`. */
  private card(x: number, y: number, frame: number, scale: number): Phaser.GameObjects.Container {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35).fillRoundedRect(-CARD_W / 2 + 1.5, -CARD_H / 2 + 2.5, CARD_W, CARD_H, 5);
    const img = (frame === CARD_BACK_FRAME && this.backKey ? this.add.image(0, 0, this.backKey) : this.add.image(0, 0, 'cards', frame)).setDisplaySize(CARD_W, CARD_H);
    return this.add.container(x, y, [shadow, img]).setScale(scale);
  }
}
