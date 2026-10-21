/**
 * The Last Claim scene: a parchment contract over the suspended table.
 * Decorative art is text-free; every word, amount and choice is real DOM
 * (art bible addendum v0.2). Irreversible choices need a review/confirm step.
 */
import { PROFILES } from '../game/ai/profiles';
import { portraitFor } from './TableScene';
import type { TableSession } from '../game/table/session';
import { type Claim, type ClaimCommand, currentClaim, pactOptions, type Pact, roles } from '../game/world';
import { outlook } from '../game/world/rules';
import { claimantWillingness, debtorAcceptance } from '../game/world/claims';
import {
  ADJUDICATOR_NAME,
  claimFactors,
  claimantName,
  counterLine,
  outcomeLines,
  outlookLine,
  pactLabel,
  pactSummary,
  termsLines,
} from './claimText';

type Review = { kind: 'pact'; pact: Pact } | { kind: 'fate' } | { kind: 'claimLife' } | { kind: 'declineCounter' } | null;


function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function btn(label: string, onClick: () => void, cls = '', detail = ''): HTMLButtonElement {
  const b = h('button', cls);
  b.type = 'button';
  b.append(h('span', 'choice-label', label));
  if (detail) b.append(h('span', 'choice-detail', detail));
  b.addEventListener('click', onClick);
  return b;
}

export class ClaimScreen {
  private readonly layer = document.getElementById('claim')!;
  private review: Review = null;
  private key = '';

  constructor(private readonly onCommand: (cmd: ClaimCommand) => void) {}

  hide(): void {
    this.layer.hidden = true;
    this.review = null;
    this.key = '';
  }

  show(session: TableSession): void {
    const claim = currentClaim(session.claims!)!;
    const key = `${claim.id}:${claim.stage}`;
    if (key !== this.key) {
      this.review = null;
      this.key = key;
    }
    const body = h('div', 'contract-body');
    body.append(...this.header(session, claim));
    body.append(...this.content(session, claim));

    const title = h('div', 'ledger-title');
    title.append(h('span', 'ledger-kicker', 'The Ledger of Souls'), h('strong', '', 'Last Claim'));
    const contract = h('div', 'contract');
    contract.append(body);
    this.layer.replaceChildren(title, contract);
    this.layer.hidden = false;
    this.layer.scrollTop = 0;
    (body.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  private command(cmd: ClaimCommand): void {
    this.review = null;
    this.onCommand(cmd);
  }

  private rerender(session: TableSession, review: Review): void {
    this.review = review;
    this.show(session);
  }

  private header(session: TableSession, claim: Claim): HTMLElement[] {
    const w = session.world;
    const debtor = w.characters[claim.debtor];
    const claimantId = claim.claimant.kind === 'adjudicator' ? 'ledger' : w.characters[claim.claimant.seat].id;
    const claimant = claimantName(w, claim);
    const claimantIsYou = claimantId === 'you';
    const lead = debtor.kind === 'human'
      ? 'Your final Lifechip has been claimed.'
      : claimantIsYou
        ? `${debtor.name}’s final Lifechip is yours to claim.`
        : `${debtor.name} has lost their final Lifechip.`;

    const settlement = h('p', 'settlement', `Pot ${claim.potAmount} · ${claim.claimant.kind === 'adjudicator' ? 'split between tied winners' : `won by ${claimant}`} · ${debtor.kind === 'human' ? 'your' : `${debtor.name}’s`} stack: 0`);

    // Audience: the other party, as seen from the player's side.
    const otherId = claimantIsYou ? debtor.id : claimantId;
    const otherName = claimantIsYou ? debtor.name : claimant;
    const profile = PROFILES[otherId];
    const audience = h('div', 'audience');
    let img: HTMLElement;
    const file = otherId === 'ledger' ? 'adjudicator' : portraitFor(otherId);
    if (file) {
      const pic = h('img');
      pic.src = `assets/portraits/${file}.webp`;
      pic.alt = otherName;
      img = pic;
    } else {
      // Provisional monogram until the painted portrait exists (asset manifest: "needed").
      img = h('span', 'monogram', otherName.split(/\s+/).filter((w) => /^[A-Z]/.test(w) && w !== 'The').map((w) => w[0]).join('').slice(0, 2));
      img.setAttribute('aria-label', otherName);
    }
    const who = h('div');
    who.append(
      h('strong', '', otherName),
      h('span', '', profile ? profile.title : otherId === 'ledger' ? 'Neutral official of the Ledger. Grants no personal rights.' : ''),
    );
    audience.append(img, who);
    return [h('p', 'lead', lead), settlement, audience];
  }

  private content(session: TableSession, claim: Claim): HTMLElement[] {
    const w = session.world;
    const debtorIsYou = w.characters[claim.debtor].kind === 'human';
    const { humanProposes, proposer } = roles(w, claim);

    if (claim.stage === 'resolved' && claim.outcome) {
      const { title, lines } = outcomeLines(w, claim, claim.outcome);
      const box = h('div', 'outcome');
      const seal = h('img', 'seal');
      seal.src = 'assets/ui/ledger-seal.webp';
      seal.alt = '';
      box.append(seal, h('h3', '', title), ...lines.map((l) => h('p', '', l)));
      return [box, btn('Continue', () => this.command({ kind: 'acknowledge' }), 'primary')];
    }

    if (!humanProposes) return [h('p', 'muted', 'The Ledger deliberates…')];

    // Counteroffer awaiting the player.
    if (claim.stage === 'counter' && claim.counter) {
      const c = claim.counter;
      if (this.review?.kind === 'declineCounter') {
        return [
          h('p', 'warning', debtorIsYou ? 'Declining means accepting your fate. Your run ends.' : `Declining means ${w.characters[claim.debtor].name} is claimed by the Ledger.`),
          btn('Confirm: decline', () => this.command({ kind: 'answerCounter', accept: false }), 'danger'),
          btn('Back', () => this.rerender(session, null), 'ghost'),
        ];
      }
      return [
        h('p', 'counter', counterLine(w, claim, c)),
        this.terms(termsLines(c.pact, c.endowment, c.funder, w, debtorIsYou)),
        btn('Accept the counteroffer', () => this.command({ kind: 'answerCounter', accept: true }), 'primary'),
        btn('Decline', () => this.rerender(session, { kind: 'declineCounter' }), 'ghost'),
      ];
    }

    const options = pactOptions(session.claims!, w);
    const adjudicator = claim.claimant.kind === 'adjudicator';
    const side = proposer;

    // Review / confirm step.
    if (this.review) {
      const r = this.review;
      if (r.kind === 'fate') {
        return [
          h('p', 'warning', 'Accept Fate: the Ledger closes your account and this run ends. This cannot be undone.'),
          btn('Confirm: accept fate', () => this.command({ kind: 'acceptFate' }), 'danger'),
          btn('Back', () => this.rerender(session, null), 'ghost'),
        ];
      }
      if (r.kind === 'claimLife') {
        const name = w.characters[claim.debtor].name;
        return [
          h('p', 'warning', `Claim ${name}’s life. ${name} leaves this world’s story; your Dread will rise and others will remember.`),
          btn(`Confirm: claim ${name}’s life`, () => this.command({ kind: 'claimLife' }), 'danger'),
          btn('Back', () => this.rerender(session, null), 'ghost'),
        ];
      }
      if (r.kind === 'pact') {
        const o = options.find((x) => x.pact === r.pact)!;
        return [
          h('h3', 'review-title', `Review: ${pactLabel(o.pact, side, adjudicator)}`),
          this.terms(termsLines(o.pact, o.endowment, o.funder, w, debtorIsYou)),
          h('p', 'outlook', `Outlook: ${outlookLine(o.outlook!)}`),
          h('p', 'muted', 'They may accept, refuse, or answer once with different terms.'),
          btn('Seal the offer', () => this.command({ kind: 'propose', pact: o.pact }), 'primary'),
          btn('Back', () => this.rerender(session, null), 'ghost'),
        ];
      }
    }

    // Choose.
    const list: HTMLElement[] = [];
    if (!debtorIsYou) list.push(btn('Claim Life', () => this.rerender(session, { kind: 'claimLife' }), 'choice danger-outline', 'No transfer. Dread rises.'));
    for (const o of options) {
      const detail = o.blocker ?? `${pactSummary(o, w)} · ${o.outlook}`;
      const b = btn(pactLabel(o.pact, side, adjudicator), () => this.rerender(session, { kind: 'pact', pact: o.pact }), 'choice', detail);
      b.disabled = o.blocker !== null;
      list.push(b);
    }
    if (debtorIsYou) {
      const relic = btn('Surrender a Title or Relic', () => undefined, 'choice', 'You hold no title or relic yet.');
      relic.disabled = true;
      list.push(relic, btn('Accept Fate', () => this.rerender(session, { kind: 'fate' }), 'choice danger-outline', 'End this run.'));
    }
    const best = options.filter((o) => !o.blocker);
    const overall = best.length
      ? outlook(Math.max(...best.map((o) => (side === 'debtor' ? claimantWillingness(session.claims!, w, claim, o.pact) : debtorAcceptance(w, claim, o.pact)))))
      : null;
    const head = h('p', 'outlook', overall ? `Outlook: ${outlookLine(overall)}` : adjudicator ? `${ADJUDICATOR_NAME} can offer nothing more.` : 'No funded bargain is possible.');
    const sway = h('details', 'sway');
    sway.append(h('summary', '', 'What sways them'));
    const ul = h('ul', 'terms');
    for (const l of claimFactors(session.claims!, w, claim)) ul.append(h('li', '', l));
    sway.append(ul);
    sway.open = true;
    return [head, sway, ...list];
  }

  private terms(lines: string[]): HTMLElement {
    const ul = h('ul', 'terms');
    for (const l of lines) ul.append(h('li', '', l));
    return ul;
  }
}
