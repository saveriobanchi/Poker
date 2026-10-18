/**
 * Renders the table from the human seat's PublicView. Placeholder vector art
 * only; P5 swaps in the real card, chip and portrait assets listed in
 * docs/asset-manifest.json.
 */
import Phaser from 'phaser';
import type { PublicView } from '../game/rules/engine';
import type { Card } from '../game/rules/cards';
import { CATEGORY_NAMES } from '../game/rules/evaluator';
import { actionLabel, isRed, rankLabel, suitGlyph } from './format';

export const TABLE_WIDTH = 400;
export const TABLE_HEIGHT = 520;

const C = {
  felt: 0x10241d,
  feltEdge: 0x2a1a12,
  rail: 0x5a3a1e,
  gold: 0xc9a24a,
  goldBright: 0xf3d27a,
  plate: 0x14100d,
  parchment: 0xf2e8d0,
  ink: 0x1d1a17,
  crimson: 0xa3202f,
  back: 0x5b1420,
};
const SERIF = 'Georgia, "Times New Roman", serif';

export interface TableModel {
  view: PublicView;
  names: string[];
  /** Seat index rendered at the bottom of the screen. */
  humanSeat: number;
  handNumber: number;
}

interface SeatLayout {
  plate: [number, number];
  cards: [number, number];
  bet: [number, number];
  button: [number, number];
  cardScale: number;
}

/** Layouts by position relative to the human (0 = bottom, then clockwise). */
const LAYOUT_4: SeatLayout[] = [
  { plate: [200, 492], cards: [200, 420], bet: [200, 362], button: [292, 468], cardScale: 1.25 },
  { plate: [60, 168], cards: [60, 226], bet: [128, 252], button: [112, 140], cardScale: 0.8 },
  { plate: [200, 40], cards: [200, 98], bet: [200, 150], button: [262, 22], cardScale: 0.8 },
  { plate: [340, 168], cards: [340, 226], bet: [272, 252], button: [288, 140], cardScale: 0.8 },
];
const LAYOUT_3 = [LAYOUT_4[0], LAYOUT_4[1], LAYOUT_4[3]];
const LAYOUT_2 = [LAYOUT_4[0], LAYOUT_4[2]];

/** Render scale for crisp text and vectors on high-DPI phone screens. */
export const RENDER_ZOOM = Math.min(Math.ceil(globalThis.devicePixelRatio || 1), 3);

const CARD_W = 50;
const CARD_H = 70;

export class TableScene extends Phaser.Scene {
  private root?: Phaser.GameObjects.Container;
  private pending?: TableModel;
  private lastKey = '';
  private shownBoard = 0;

  constructor() {
    super('table');
  }

  create(): void {
    // The canvas is RENDER_ZOOM times the logical size; the camera maps logical coordinates onto it.
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
    this.drawFelt();
    if (this.pending) this.renderModel(this.pending);
  }

  renderModel(model: TableModel): void {
    this.pending = model;
    if (!this.sys.isActive()) return;
    this.root?.destroy();
    this.root = this.add.container(0, 0);
    const { view } = model;
    const n = view.seats.length;
    const layout = n === 4 ? LAYOUT_4 : n === 3 ? LAYOUT_3 : LAYOUT_2;
    const handKey = `${model.handNumber}`;
    if (handKey !== this.lastKey) {
      this.lastKey = handKey;
      this.shownBoard = 0;
    }

    this.drawPot(view);
    this.drawBoard(view.board);

    for (let seat = 0; seat < n; seat++) {
      const rel = (seat - model.humanSeat + n) % n;
      this.drawSeat(model, seat, layout[rel], rel === 0);
    }
  }

  // ─────────────────────────── drawing ───────────────────────────

  private drawFelt(): void {
    const g = this.add.graphics();
    g.fillStyle(C.feltEdge, 1).fillRoundedRect(8, 120, TABLE_WIDTH - 16, 300, 150);
    g.lineStyle(6, C.rail, 1).strokeRoundedRect(8, 120, TABLE_WIDTH - 16, 300, 150);
    g.fillStyle(C.felt, 1).fillRoundedRect(20, 132, TABLE_WIDTH - 40, 276, 138);
    g.lineStyle(1, C.gold, 0.35).strokeRoundedRect(34, 146, TABLE_WIDTH - 68, 248, 124);
  }

  private drawPot(view: PublicView): void {
    const pot = view.seats.reduce((s, p) => s + p.totalCommitted, 0);
    const inFront = view.seats.reduce((s, p) => s + p.streetCommitted, 0);
    const collected = pot - inFront;
    if (view.phase === 'complete' || pot === 0) return;
    const label = collected > 0 ? `Pot ${collected}` : '';
    const total = this.txt(200, 196, label, { fontFamily: SERIF, fontSize: '17px', color: '#f3d27a' })
      .setOrigin(0.5);
    const sub = this.txt(200, 216, `Total ${pot}`, { fontFamily: SERIF, fontSize: '12px', color: '#b8a77e' })
      .setOrigin(0.5);
    this.root!.add([total, sub]);
  }

  private drawBoard(board: Card[]): void {
    for (let i = 0; i < 5; i++) {
      const x = 200 + (i - 2) * 56;
      const y = 300;
      if (i >= board.length) {
        const slot = this.add.graphics();
        slot.lineStyle(1, C.gold, 0.25).strokeRoundedRect(x - CARD_W / 2, y - CARD_H / 2, CARD_W, CARD_H, 6);
        this.root!.add(slot);
        continue;
      }
      const card = this.cardFace(x, y, board[i], 1);
      this.root!.add(card);
      if (i >= this.shownBoard) {
        card.setAlpha(0).setScale(0.7);
        this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 260, delay: (i - this.shownBoard) * 110, ease: 'Back.Out' });
      }
    }
    this.shownBoard = board.length;
  }

  private drawSeat(model: TableModel, seat: number, L: SeatLayout, isHuman: boolean): void {
    const { view } = model;
    const p = view.seats[seat];
    const busted = !p.inHand && p.stack === 0;
    const active = view.toAct === seat && view.phase === 'betting';
    const r = this.root!;

    // Name plate.
    const [px, py] = L.plate;
    const plate = this.add.graphics();
    plate.fillStyle(C.plate, 0.92).fillRoundedRect(px - 58, py - 22, 116, 44, 10);
    plate.lineStyle(active ? 3 : 1, active ? C.goldBright : C.gold, active ? 1 : 0.6).strokeRoundedRect(px - 58, py - 22, 116, 44, 10);
    r.add(plate);
    if (active) {
      this.tweens.add({ targets: plate, alpha: 0.55, duration: 650, yoyo: true, repeat: -1 });
    }
    const name = this.txt(px, py - 9, model.names[seat], { fontFamily: SERIF, fontSize: '13px', color: busted ? '#6d6458' : '#efe3c4' })
      .setOrigin(0.5);
    const stackText = busted ? 'Claimed' : `◈ ${p.stack}`;
    const stack = this.txt(px, py + 10, stackText, { fontFamily: SERIF, fontSize: '14px', color: busted ? '#8b3a3a' : '#f3d27a' })
      .setOrigin(0.5);
    r.add([name, stack]);

    // Dealer button.
    if (seat === view.button) {
      const [bx, by] = L.button;
      const btn = this.add.graphics();
      btn.fillStyle(C.parchment, 1).fillCircle(bx, by, 10);
      btn.lineStyle(2, C.gold, 1).strokeCircle(bx, by, 10);
      r.add(btn);
      r.add(this.txt(bx, by, 'D', { fontFamily: SERIF, fontSize: '12px', color: '#1d1a17', fontStyle: 'bold' }).setOrigin(0.5));
    }

    // Cards.
    if (p.inHand) {
      const [cx, cy] = L.cards;
      const s = L.cardScale;
      const gap = 28 * s;
      const shown = p.hole;
      for (let i = 0; i < 2; i++) {
        const x = cx + (i === 0 ? -gap / 2 : gap / 2);
        const obj = shown ? this.cardFace(x, cy, shown[i], s) : this.cardBack(x, cy, s);
        obj.setAngle(i === 0 ? -4 : 4);
        if (p.folded) obj.setAlpha(0.3);
        r.add(obj);
      }
    }

    // Chips in front (this street).
    if (p.streetCommitted > 0 && view.phase === 'betting') {
      const [bx, by] = L.bet;
      r.add(this.chip(bx, by, p.streetCommitted));
    }

    // Status pill: last action this street, or showdown result.
    const label = this.statusLabel(view, seat);
    if (label) {
      // Above the plate for rivals; beside the cards for the human.
      const tx = isHuman ? 92 : px;
      const ty = isHuman ? 420 : py - 30;
      const text = this.txt(tx, ty, label.text, {
          fontFamily: SERIF,
          fontSize: '12px',
          color: label.win ? '#1d1a17' : '#efe3c4',
          backgroundColor: label.win ? '#f3d27a' : '#000000aa',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      r.add(text);
      if (label.win) {
        this.tweens.add({ targets: text, y: ty - 6, duration: 500, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
      }
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

  // ─────────────────────────── primitives ───────────────────────────

  private txt(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { ...style, resolution: RENDER_ZOOM });
  }

  private cardFace(x: number, y: number, card: Card, scale: number): Phaser.GameObjects.Container {
    const w = CARD_W;
    const h = CARD_H;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 6);
    g.fillStyle(C.parchment, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(1, C.gold, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    const color = isRed(card) ? '#a3202f' : '#1d1a17';
    const rank = this.txt(-w / 2 + 5, -h / 2 + 3, rankLabel(card), {
      fontFamily: SERIF,
      fontSize: '19px',
      color,
      fontStyle: 'bold',
    });
    const corner = this.txt(-w / 2 + 6, -h / 2 + 24, suitGlyph(card), { fontFamily: SERIF, fontSize: '14px', color });
    const big = this.txt(w / 2 - 6, h / 2 - 4, suitGlyph(card), { fontFamily: SERIF, fontSize: '28px', color }).setOrigin(1, 1);
    return this.add.container(x, y, [g, rank, corner, big]).setScale(scale);
  }

  private cardBack(x: number, y: number, scale: number): Phaser.GameObjects.Container {
    const w = CARD_W;
    const h = CARD_H;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 6);
    g.fillStyle(C.back, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(2, C.gold, 0.9).strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 4);
    g.lineStyle(1, C.gold, 0.5);
    g.strokePoints(
      [
        new Phaser.Math.Vector2(0, -h / 2 + 12),
        new Phaser.Math.Vector2(w / 2 - 12, 0),
        new Phaser.Math.Vector2(0, h / 2 - 12),
        new Phaser.Math.Vector2(-w / 2 + 12, 0),
      ],
      true,
    );
    g.fillStyle(C.gold, 0.8).fillCircle(0, 0, 3);
    return this.add.container(x, y, [g]).setScale(scale);
  }

  private chip(x: number, y: number, amount: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(C.crimson, 1).fillCircle(-14, 0, 9);
    g.lineStyle(2, C.goldBright, 1).strokeCircle(-14, 0, 9);
    g.lineStyle(1, C.goldBright, 0.7).strokeCircle(-14, 0, 5);
    const t = this.txt(-1, 0, String(amount), { fontFamily: SERIF, fontSize: '14px', color: '#f3d27a' }).setOrigin(0, 0.5);
    return this.add.container(x, y, [g, t]);
  }
}
