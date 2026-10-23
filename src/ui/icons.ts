/**
 * The game's own engraved line icons (art bible §8): 24×24, drawn with a single
 * 1.5px stroke in `currentColor`, so they take the colour of the text around
 * them. They replace every emoji and pictographic glyph in the interface.
 */

const P = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
  /** Hand bell: sound on. */
  bell: `<path ${P} d="M12 3.5v1.6M7 16.5c0-6.2 1.8-10 5-10s5 3.8 5 10M5.5 16.5h13M10.5 19a1.6 1.6 0 0 0 3 0"/>`,
  /** Bell with a stroke through it: sound off. */
  bellOff: `<path ${P} d="M12 3.5v1.6M7 16.5c0-6.2 1.8-10 5-10s5 3.8 5 10M5.5 16.5h13M10.5 19a1.6 1.6 0 0 0 3 0M4.5 4.5l15 15"/>`,
  /** A pendulum at rest: reduce motion. */
  pendulum: `<path ${P} d="M5 4h14M12 4v10.5"/><circle ${P} cx="12" cy="17" r="2.5"/><path ${P} d="M7.5 8.5c-1 1.2-1.5 2.6-1.5 4M16.5 8.5c1 1.2 1.5 2.6 1.5 4"/>`,
  /** Hourglass: normal pace. */
  hourglass: `<path ${P} d="M7 3.5h10M7 20.5h10M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5M10 18.5h4"/>`,
  /** Two spurs: fast play. */
  fast: `<path ${P} d="M5 6l6 6-6 6M12 6l6 6-6 6"/>`,
  /** Quill over a ruled leaf: the playtest log. */
  quill: `<path ${P} d="M5 20.5h9M5 16.5h6M19.5 3.5c-5 1-9 5-10.5 10.5l1.5 1.5C16 14 19 9 19.5 3.5zM9 14l-2.5 2.5"/>`,
  /** Lozenge with a dot: details. */
  info: `<path ${P} d="M12 3l9 9-9 9-9-9z"/><path ${P} d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor"/>`,
  close: `<path ${P} d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
  /** Balance beam with two weights: choose a custom amount. */
  scales: `<path ${P} d="M4 8h16M12 5v14M8 19h8M7 8l-3 6h6zM17 8l-3 6h6z"/>`,
  check: `<path ${P} d="M5 12.5l4.5 4.5L19 7.5"/>`,
  cross: `<path ${P} d="M7 7l10 10M17 7L7 17"/>`,
  /** Crescent: fell and survived. */
  moon: `<path ${P} d="M15.5 4.5a8 8 0 1 0 4 12.5 6.5 6.5 0 0 1-4-12.5z"/>`,
  /** Grave marker: claimed. */
  grave: `<path ${P} d="M7 20.5V10a5 5 0 0 1 10 0v10.5M5 20.5h14M12 10v6M9.5 12.5h5"/>`,
  /** Table (spade lozenge). */
  table: `<path ${P} d="M12 4c3 3.5 6.5 5.5 6.5 9a3.5 3.5 0 0 1-6.5 1.8A3.5 3.5 0 0 1 5.5 13c0-3.5 3.5-5.5 6.5-9zM12 15v5M9.5 20h5"/>`,
  /** Plain waypoint lozenge. */
  node: `<path ${P} d="M12 5l7 7-7 7-7-7z"/>`,
  /** Relic: faceted gem. */
  relic: `<path ${P} d="M7 4.5h10l3 4.5-8 11-8-11zM4 9h16M10 4.5L8.5 9l3.5 11 3.5-11L14 4.5"/>`,
  /** Covenant: cross pattée. */
  covenant: `<path ${P} d="M10 4h4l-1 6 6-1v4l-6-1 1 6h-4l1-6-6 1V9l6 1z"/>`,
  /** Dossier: an eye. */
  eye: `<path ${P} d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle ${P} cx="12" cy="12" r="2.5"/>`,
  /** A cast spell: four-pointed spark. */
  spark: `<path ${P} d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/>`,
  /** Evolve: a sprouting stem. */
  evolve: `<path ${P} d="M12 21V10M12 13c-3 0-5.5-2-6-5.5 3.5 0 6 2 6 5.5zM12 10c0-3.5 2.5-6 6.5-6.5-.3 4-2.8 6.5-6.5 6.5z"/>`,
  /** Rethread: a looped thread. */
  rethread: `<path ${P} d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3.5v3.2h-3.2M6 20.5v-3.2h3.2"/>`,
  arrow: `<path ${P} d="M5 12h13M13 7l5 5-5 5"/>`,
  // Merchant marks (visual direction v1.2: a small distinct symbol per merchant).
  /** Selene: a hanging lantern. */
  lantern: `<path ${P} d="M12 2.5v2M9 4.5h6M8 7h8l-1 10H9zM8 7l1-2.5h6L16 7M9.5 17h5v2.5h-5zM12 10.5c-1 1.2-1 2.6 0 3.5 1-.9 1-2.3 0-3.5z"/>`,
  /** Elin: a half mask. */
  mask: `<path ${P} d="M3 9c3-1.5 6-1.5 9 0 3-1.5 6-1.5 9 0-.3 4-2.6 6.5-5.5 6.5-1.6 0-2.8-.9-3.5-2.2-.7 1.3-1.9 2.2-3.5 2.2C5.6 15.5 3.3 13 3 9z"/><path ${P} d="M6.5 10.8c.8-.6 2-.6 2.8 0M14.7 10.8c.8-.6 2-.6 2.8 0"/>`,
  /** Oran: a crown. */
  crown: `<path ${P} d="M4 17.5L3 7.5l5 4 4-6.5 4 6.5 5-4-1 10zM4 20h16"/>`,
  /** Wisp: a guttering candle. */
  candle: `<path ${P} d="M9 10.5h6v10H9zM12 10.5V8.5M12 3.5c1.6 1.6 1.8 3.3 0 5-1.8-1.7-1.6-3.4 0-5zM7 20.5h10"/>`,
  // Discipline sigils (replace the suit glyphs once used for spell families).
  /** Ember: a flame. */
  ember: `<path ${P} d="M12 3c1 3.5 5.5 5.8 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.5 1.4-4 2.6-5.2.3 1.8 1 2.8 2.2 3.2C10.6 9 11 6 12 3z"/>`,
  /** Veil: a hooded eye. */
  veil: `<path ${P} d="M3 13c2.5-4 5.6-6 9-6s6.5 2 9 6M5.5 12.5C7.3 15 9.5 16.5 12 16.5s4.7-1.5 6.5-4"/><circle cx="12" cy="12.5" r="1.8" fill="currentColor"/>`,
  /** Thorn: a briar stem. */
  thorn: `<path ${P} d="M6 20C9 15 15 9 19 4M9.5 15.5l-3-.5M12 12.5l.5-3M14.5 9.5l3 .5M16.8 6.8l-.3-2.8"/>`,
  /** Mirror: an oval glass. */
  mirror: `<ellipse ${P} cx="12" cy="10" rx="5" ry="6.5"/><path ${P} d="M12 16.5v4M9 20.5h6M10 7.5c-.8.8-1.2 1.8-1.2 3"/>`,
  /** Aether gem, filled or empty (fill set by the caller). */
  gem: `<path d="M12 3.5l6 8.5-6 8.5-6-8.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
} as const;

export type IconName = keyof typeof PATHS;

/** Markup for an icon; decorative by default (hidden from screen readers). */
export function iconSvg(name: IconName, size = 20, extra = ''): string {
  const fill = name === 'gem' ? ' fill="var(--gem-fill, none)"' : '';
  return `<svg class="icon icon-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${fill} ${extra}>${PATHS[name]}</svg>`;
}

/** An icon element ready to append. */
export function icon(name: IconName, size = 20): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = iconSvg(name, size);
  return t.content.firstElementChild as SVGElement;
}

/** Aether shown as three gems: `n` lit, the rest dark. */
export function aetherGems(n: number, max = 3, size = 14): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'gems';
  for (let i = 0; i < max; i++) {
    const g = icon('gem', size);
    g.classList.toggle('lit', i < n);
    s.append(g);
  }
  return s;
}

/** Discipline sigil names, keyed like DISCIPLINE_COLOR. */
export const DISCIPLINE_ICON: Record<'Ember' | 'Veil' | 'Thorn' | 'Mirror', IconName> = {
  Ember: 'ember',
  Veil: 'veil',
  Thorn: 'thorn',
  Mirror: 'mirror',
};

/** Each merchant's mark, keyed by merchant id. */
export const MERCHANT_ICON: Record<string, IconName> = {
  selene: 'lantern',
  merchant_elin: 'mask',
  merchant_oran: 'crown',
  broker_osric: 'scales',
  merchant_wisp: 'candle',
};

/**
 * The game's mark (visual direction v1.2 "logo"): an eclipse over a thin
 * sun ring, a three-point crown above and the Ledger's vertical rule below.
 * Drawn as one engraving so it reads at any size.
 */
export function eclipseMark(size = 120): string {
  return `<svg class="eclipse-mark" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="em-corona" cx="50%" cy="50%" r="50%"><stop offset="62%" stop-color="#c4a052" stop-opacity="0"/><stop offset="70%" stop-color="#ead39a" stop-opacity=".55"/><stop offset="100%" stop-color="#c4a052" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="60" cy="58" r="42" fill="url(#em-corona)"/>
  <circle cx="60" cy="58" r="30.5" fill="none" stroke="#c4a052" stroke-width="1"/>
  <circle cx="60" cy="58" r="34" fill="none" stroke="#6f5934" stroke-width=".8" stroke-dasharray="1.2 3.2"/>
  <circle cx="62.5" cy="56.5" r="27" fill="#0a0c0b"/>
  <path d="M60 58m-27 0a27 27 0 0 1 27-27" fill="none" stroke="#ead39a" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M51 20l3.5-7 5.5 5 5.5-5 3.5 7z" fill="none" stroke="#c4a052" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M60 96v18M55 109h10" stroke="#6f5934" stroke-width="1" stroke-linecap="round"/>
</svg>`;
}
