#!/usr/bin/env node
/**
 * Deterministic asset generator (run: `npm run build:assets`).
 *
 * Renders, in headless Chromium:
 *   - 52 card faces  -> art/generated/cards/{rank}{suit}.png (300x420, transparent corners)
 *   - table felt     -> art/generated/table/felt.png (1200x1560)
 *   - Lifechip       -> art/generated/chips/lifechip.png (96x96)
 *   - dealer button  -> art/generated/ui/dealer-button.png (60x60)
 * then runs scripts/pack-assets.py, which packs the runtime files into public/assets/.
 *
 * Art direction follows docs/art-bible.md. Court figures and the ornate Ace of
 * Spades come from the public-domain Vector Playing Cards (art/source/), recolored
 * to the art-bible palette. Indices use Noto Serif Display Bold (OFL).
 * Generated PNGs are committed, so a normal build does not need this script.
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'art/source');
const OUT = join(ROOT, 'art/generated');

// Ashen Reliquary palette (owner's visual direction, 2026-10-27): bone ivory, oxidized copper,
// bruised vermilion, coal. The 'gold' names are kept so the court recolouring below is unchanged.
const P = {
  parchment: '#EADFC6',
  parchmentDeep: '#CBB58C',
  ink: '#1E1A18',
  crimson: '#9E2B25',
  crimsonDeep: '#6E1B18',
  gold: '#B8734A',
  goldLight: '#E2A97E',
  goldMuted: '#7A4A2E',
  feltMain: '#1B1714',
  feltDeep: '#0E0C0B',
  woodInk: '#231A18',
  woodEdge: '#473126',
  violet: '#77629A',
  azure: '#5A8EAC',
  thorn: '#477A68',
};

// ───────────────────────────── recoloring ─────────────────────────────

function hexToRgb(hex) {
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255).toString(16).padStart(2, '0')).join('');
}

/** Maps the classic court palette onto the art bible by hue family, keeping relative lightness. */
function recolor(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (l > 0.93) return P.parchment;
  if (l < 0.12) return P.ink;
  if (s < 0.18) return mix(P.ink, P.parchment, l);
  if (h < 15 || h >= 330) return l < 0.35 ? P.crimsonDeep : P.crimson;
  if (h < 75) return l > 0.62 ? '#E2C275' : P.gold;
  if (h < 170) return l > 0.5 ? '#86A898' : P.thorn;
  if (h < 260) return l > 0.6 ? '#A9BDC8' : '#2F4A63';
  return P.violet;
}

function recolorSvg(text) {
  return text.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (m) => recolor(m.toLowerCase()));
}

function dataUrl(svgText) {
  return 'data:image/svg+xml;base64,' + Buffer.from(svgText).toString('base64');
}

// ───────────────────────────── card layout ─────────────────────────────

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['c', 'd', 'h', 's'];
const LABEL = { T: '10' };
const RED = new Set(['d', 'h']);

/** Suit pips from Vector Playing Cards, normalized around (0,0), roughly 16 x 21 units. */
const PIP = {
  h: 'M 3.676,-9 C 0.433,-9 0,-5.523 0,-5.523 0,-5.523 -0.433,-9 -3.676,-9 -5.946,-9 -8,-7.441 -8,-4.5 -8,-0.614 -1.4208493,3.2938141 0,9 1.35201,3.2985969 8,-0.614 8,-4.5 8,-7.441 5.946,-9 3.676,-9 z',
  s: 'M 7.989,3.103 C 7.747,-0.954 0.242,-8.59 0,-10.5 c -0.242,1.909 -7.747,9.545 -7.989,13.603 -0.169,2.868 1.695,4.057 3.39,4.057 1.8351685,-0.021581 3.3508701,-2.8006944 3.873,-3.341 0.242,0.716 -1.603,6.682 -2.179,6.682 l 5.811,0 C 2.33,10.501 0.485,4.535 0.727,3.819 1.1841472,4.3152961 2.5241276,7.0768295 4.601,7.16 6.295,7.159 8.158,5.971 7.989,3.103 z',
  d: 'M 3.2433274,-4.7253274 C 1.1263274,-7.5893274 0,-10.5 0,-10.5 c 0,0 -1.1263274,2.9106726 -3.2433274,5.7746726 C -5.3613274,-1.8623274 -8,0 -8,0 -8,0 -5.3613274,1.8613274 -3.2433274,4.7263274 -1.1263274,7.5893274 0,10.5 0,10.5 0,10.5 1.1263274,7.5893274 3.2433274,4.7263274 5.3613274,1.8613274 8,0 8,0 8,0 5.3613274,-1.8623274 3.2433274,-4.7253274 z',
  // The club is drawn at (48.13, 24.3) in the source; translate it to the origin.
  c: 'm 50.291466,22.698228 c 0,0 2.375,-1.9 2.375,-4.534 0,-1.542 -1.369,-4.102 -4.534,-4.102 -3.165,0 -4.534,2.561 -4.534,4.102 0,2.634 2.375,4.534 2.375,4.534 -2.638,-2.055 -7.341,-0.652 -7.341,3.455 0,2.056 1.68,4.318 4.318,4.318 3.165,0 4.534,-3.455 4.534,-3.455 0,0 0.402,3.938 -1.943,6.046 h 5.182 c -2.345,-2.107 -1.943,-6.046 -1.943,-6.046 0,0 1.369,3.455 4.534,3.455 2.639,0 4.318,-2.263 4.318,-4.318 0,-4.107 -4.703,-5.51 -7.341,-3.455 z',
};
const PIP_OFFSET = { h: [0, 0], s: [0, 0], d: [0, 0], c: [-48.13, -24.25] };

function pip(suit, cx, cy, height, flip = false) {
  const scale = height / 21;
  const [ox, oy] = PIP_OFFSET[suit];
  const color = RED.has(suit) ? P.crimson : P.ink;
  const rot = flip ? ` rotate(180)` : '';
  return `<g transform="translate(${cx} ${cy})${rot} scale(${scale}) translate(${ox} ${oy})"><path d="${PIP[suit]}" fill="${color}"/></g>`;
}

/** Standard pip positions as (column, row) fractions; rows below the middle are drawn upside down. */
const LAYOUTS = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

const W = 300;
const H = 420;
/** Art box (right of the index column). Court art keeps its 0.615 aspect inside it. */
const ART = { x: 86, y: 46, w: 194, h: 316 };

function cardBase(id) {
  return `
  <defs>
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath>
    <filter id="grain-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.22  0 0 0 0.55 0"/>
    </filter>
    <filter id="fibres-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves="2" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.35 0"/>
    </filter>
    <filter id="stain-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="${19 + (id.length * 7 + id.charCodeAt(0)) % 23}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.3  0 0 0 0 0.17  0 0 0 -2.6 1.45"/>
    </filter>
    <radialGradient id="vig-${id}" cx="50%" cy="45%" r="75%">
      <stop offset="60%" stop-color="${P.parchment}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${P.parchmentDeep}" stop-opacity="0.9"/>
    </radialGradient>
  </defs>
  <g clip-path="url(#clip-${id})">
    <rect width="${W}" height="${H}" fill="${P.parchment}"/>
    <rect width="${W}" height="${H}" filter="url(#fibres-${id})" opacity="0.35"/>
    <rect width="${W}" height="${H}" filter="url(#grain-${id})" opacity="0.28"/>
    <rect width="${W}" height="${H}" filter="url(#stain-${id})" opacity="0.16"/>
    <rect width="${W}" height="${H}" fill="url(#vig-${id})"/>
  </g>
  <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="14" fill="none" stroke="${P.gold}" stroke-width="3"/>
  <rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="10" fill="none" stroke="${P.goldMuted}" stroke-width="1.2"/>`;
}

function index(rank, suit) {
  const label = LABEL[rank] ?? rank;
  const color = RED.has(suit) ? P.crimson : P.ink;
  const ten = label.length > 1;
  const big = `<text x="46" y="80" text-anchor="middle" font-family="IndexSerif" font-weight="700" font-size="${ten ? 54 : 68}" letter-spacing="${ten ? -4 : 0}" fill="${color}">${label}</text>`;
  const smallPip = pip(suit, 46, 116, 40);
  // Small rotated index, lower right.
  const mini = `<g transform="rotate(180 ${W - 34} ${H - 46})">
      <text x="${W - 34}" y="${H - 46 - 6}" text-anchor="middle" font-family="IndexSerif" font-weight="700" font-size="${ten ? 24 : 30}" letter-spacing="${ten ? -2 : 0}" fill="${color}">${label}</text>
      ${pip(suit, W - 34, H - 46 + 12, 18)}
    </g>`;
  return big + smallPip + mini;
}

function numberArt(rank, suit) {
  const n = rank === 'T' ? 10 : Number(rank);
  const left = ART.x + 38;
  const right = ART.x + ART.w - 38;
  const top = ART.y + 34;
  const bottom = ART.y + ART.h - 34;
  const size = n <= 6 ? 54 : 46;
  return LAYOUTS[n]
    .map(([cx, cy]) => pip(suit, left + (right - left) * cx, top + (bottom - top) * cy, size, cy > 0.5))
    .join('');
}

function aceArt(suit, aceOfSpadesSvg) {
  const cx = ART.x + ART.w / 2;
  const cy = ART.y + ART.h / 2;
  if (suit === 's') {
    // Ornate public-domain spade (minus the source card's white background), plus an engraved gold ring.
    const art = dataUrl(recolorSvg(aceOfSpadesSvg.replace(/<path[^>]*?id="path5"\s*\/>/s, '')));
    return `
      <circle cx="${cx}" cy="${cy}" r="94" fill="none" stroke="${P.gold}" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="${P.goldMuted}" stroke-width="1" stroke-dasharray="3 5"/>
      <svg x="${cx - 61}" y="${cy - 80}" width="121" height="160" viewBox="30 46 106 140"><image href="${art}" width="167.0869141" height="242.6669922"/></svg>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="72" fill="none" stroke="${P.gold}" stroke-width="1.5" opacity="0.7"/>` + pip(suit, cx, cy, 104);
}

function courtArt(courtSvg) {
  const art = dataUrl(recolorSvg(courtSvg));
  // Source court frame: x 22.75..144, y 23.25..219.5 (viewBox units); crop just inside it.
  return `
    <svg x="${ART.x}" y="${ART.y}" width="${ART.w}" height="${ART.h}" viewBox="24.2 24.6 118.4 193.5" preserveAspectRatio="xMidYMid slice">
      <image href="${art}" width="167.0869141" height="242.6669922"/>
    </svg>
    <rect x="${ART.x}" y="${ART.y}" width="${ART.w}" height="${ART.h}" fill="none" stroke="${P.gold}" stroke-width="3"/>
    <rect x="${ART.x + 5}" y="${ART.y + 5}" width="${ART.w - 10}" height="${ART.h - 10}" fill="none" stroke="${P.goldMuted}" stroke-width="1"/>`;
}

function cardSvg(rank, suit, sources) {
  const id = rank + suit;
  let art;
  if (rank === 'A') art = aceArt(suit, sources.AS);
  else if ('JQK'.includes(rank)) art = courtArt(sources[rank + suit.toUpperCase()]);
  else art = numberArt(rank, suit);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${cardBase(id)}${art}${index(rank, suit)}</svg>`;
}

// ───────────────────────────── table, chip, button ─────────────────────────────

function feltSvg() {
  const w = 1200;
  const h = 1560;
  // The Ashen table: a coal-stone slab in an oxidized copper rim, with a ritual circle cut into it
  // under the pot and the board (logical table x 8..392, y 120..420 at 3x scale).
  const cx = 600;
  const cy = 790;
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r0 = i % 4 === 0 ? 300 : 312;
    return `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0 * 0.78).toFixed(1)}L${(cx + Math.cos(a) * 322).toFixed(1)} ${(cy + Math.sin(a) * 322 * 0.78).toFixed(1)}`;
  }).join('');
  const crescents = [0, 1, 2, 3]
    .map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = cx + Math.cos(a) * 352;
      const y = cy + Math.sin(a) * 352 * 0.78;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11"/><path d="M4 -10a11 11 0 0 1 0 20a8 8 0 0 0 0-20z" fill="${P.goldMuted}" stroke="none"/></g>`;
    })
    .join('');
  // Engraving = a dark cut with a lit lower lip, drawn twice with a small offset.
  const ring = (rx, ry, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${extra}/>`;
  const carved = (shapes) => `<g fill="none" stroke="#000" stroke-opacity="0.75" stroke-width="3">${shapes}</g><g fill="none" stroke="${P.goldLight}" stroke-opacity="0.16" stroke-width="1.6" transform="translate(0 2.5)">${shapes}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="patina" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="23"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.37  0 0 0 0 0.49  0 0 0 0 0.41  0 0 0 -2.2 1.25"/>
    </filter>
    <filter id="copperGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.6 0.05" numOctaves="3" seed="4"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.36  0 0 0 0 0.2  0 0 0 0.7 0"/>
    </filter>
    <filter id="stone" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="5" seed="31"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.14  0 0 0 0 0.1  0 0 0 0.32 0"/>
    </filter>
    <filter id="grit" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="5"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.28  0 0 0 0.12 0"/>
    </filter>
    <radialGradient id="slab" cx="50%" cy="46%" r="62%">
      <stop offset="0%" stop-color="#241b16"/>
      <stop offset="60%" stop-color="${P.feltMain}"/>
      <stop offset="100%" stop-color="${P.feltDeep}"/>
    </radialGradient>
    <radialGradient id="room" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#171210"/>
      <stop offset="100%" stop-color="#070606"/>
    </radialGradient>
    <linearGradient id="rimLight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${P.goldLight}" stop-opacity="0.35"/>
      <stop offset="45%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </linearGradient>
    <clipPath id="railClip"><rect x="24" y="360" width="1152" height="900" rx="450"/></clipPath>
    <clipPath id="feltClip"><rect x="60" y="396" width="1080" height="828" rx="414"/></clipPath>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#room)"/>
  <ellipse cx="600" cy="1250" rx="580" ry="64" fill="#000" opacity="0.55"/>
  <g clip-path="url(#railClip)">
    <rect width="${w}" height="${h}" fill="#3e2316"/>
    <rect width="${w}" height="${h}" filter="url(#copperGrain)"/>
    <rect width="${w}" height="${h}" filter="url(#patina)" opacity="0.8"/>
    <rect x="24" y="360" width="1152" height="900" fill="url(#rimLight)"/>
  </g>
  <rect x="24" y="360" width="1152" height="900" rx="450" fill="none" stroke="#1a0f09" stroke-width="5"/>
  <rect x="30" y="366" width="1140" height="888" rx="444" fill="none" stroke="${P.goldLight}" stroke-opacity="0.45" stroke-width="2"/>
  <rect x="50" y="386" width="1100" height="848" rx="424" fill="none" stroke="#1a0f09" stroke-width="6"/>
  <g clip-path="url(#feltClip)">
    <rect width="${w}" height="${h}" fill="url(#slab)"/>
    <rect width="${w}" height="${h}" filter="url(#stone)"/>
    <rect width="${w}" height="${h}" filter="url(#grit)"/>
    ${carved(ring(372, 290) + ring(322, 251) + ring(300, 234, 'stroke-dasharray="4 10"') + `<path d="${ticks}"/>` + `<path d="M${cx} ${cy - 290}v-24M${cx} ${cy + 290}v24M${cx - 372} ${cy}h-26M${cx + 372} ${cy}h26"/>`)}
    <g fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="2.5">${crescents}</g>
  </g>
  <rect x="60" y="396" width="1080" height="828" rx="414" fill="none" stroke="#000" stroke-opacity="0.7" stroke-width="14"/>
  <rect x="96" y="432" width="1008" height="756" rx="378" fill="none" stroke="${P.gold}" stroke-opacity="0.22" stroke-width="2"/>
</svg>`;
}

function chipSvg() {
  const notches = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const x = 48 + Math.cos(a) * 40;
    const y = 48 + Math.sin(a) * 40;
    return `<rect x="${x - 4}" y="${y - 7}" width="8" height="14" rx="2" fill="${P.parchment}" transform="rotate(${(i * 60 + 90) % 360} ${x} ${y})"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <radialGradient id="core" cx="45%" cy="40%" r="65%"><stop offset="0%" stop-color="#B52638"/><stop offset="100%" stop-color="${P.crimsonDeep}"/></radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${P.goldLight}"/><stop offset="55%" stop-color="${P.gold}"/><stop offset="100%" stop-color="${P.goldMuted}"/></linearGradient>
  </defs>
  <circle cx="48" cy="50" r="45" fill="#000" opacity="0.35"/>
  <circle cx="48" cy="48" r="45" fill="url(#rim)"/>
  <circle cx="48" cy="48" r="39" fill="url(#core)"/>
  ${notches}
  <circle cx="48" cy="48" r="27" fill="none" stroke="${P.goldLight}" stroke-width="2.5"/>
  <circle cx="48" cy="48" r="22" fill="none" stroke="${P.gold}" stroke-width="1" stroke-dasharray="2 3"/>
  <path d="M48 32 L58 48 L48 64 L38 48 Z" fill="${P.parchment}" stroke="${P.gold}" stroke-width="2"/>
  <circle cx="48" cy="48" r="4" fill="${P.crimsonDeep}"/>
</svg>`;
}

function dealerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <defs><radialGradient id="g" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#FFF6E0"/><stop offset="100%" stop-color="${P.parchmentDeep}"/></radialGradient></defs>
  <circle cx="30" cy="32" r="27" fill="#000" opacity="0.35"/>
  <circle cx="30" cy="30" r="27" fill="url(#g)" stroke="${P.gold}" stroke-width="4"/>
  <circle cx="30" cy="30" r="20" fill="none" stroke="${P.goldMuted}" stroke-width="1.5"/>
</svg>`;
}

// ───────────────────────────── render ─────────────────────────────

async function main() {
  // --table: only the table, Lifechip and dealer button (the card faces are left as they are).
  const tableOnly = process.argv.includes('--table');
  const fontUrl = 'data:font/ttf;base64,' + readFileSync(join(SRC, 'fonts/NotoSerifDisplay-Bold.ttf')).toString('base64');
  const sources = { AS: readFileSync(join(SRC, 'vector-playing-cards/AS.svg'), 'utf8') };
  for (const r of 'JQK') for (const s of 'CDHS') sources[r + s] = readFileSync(join(SRC, `vector-playing-cards/${r}${s}.svg`), 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const shoot = async (svg, w, h, file) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<style>@font-face{font-family:IndexSerif;src:url(${fontUrl});font-weight:700}html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(30);
    mkdirSync(dirname(file), { recursive: true });
    await page.locator('svg').first().screenshot({ path: file, omitBackground: true });
  };

  for (const rank of tableOnly ? [] : RANKS) {
    for (const suit of SUITS) {
      await shoot(cardSvg(rank, suit, sources), W, H, join(OUT, `cards/${rank}${suit}.png`));
    }
    process.stdout.write(rank);
  }
  await shoot(feltSvg(), 1200, 1560, join(OUT, 'table/felt.png'));
  await shoot(chipSvg(), 96, 96, join(OUT, 'chips/lifechip.png'));
  await shoot(dealerSvg(), 60, 60, join(OUT, 'ui/dealer-button.png'));
  await browser.close();
  writeFileSync(join(OUT, 'README.md'), 'Generated by scripts/build-assets.mjs. Do not edit by hand. Runtime copies are packed into public/assets/ by scripts/pack-assets.py.\n');
  execFileSync('python3', [join(ROOT, 'scripts/pack-assets.py')], { stdio: 'inherit' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
