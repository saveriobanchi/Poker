/**
 * Merchant personalities (design v0.9, p7-merchant-personalities.json): words only.
 * Dialogue never changes a price, a wallet or a Favor.
 */
import data from './data/p7-merchant-personalities.json';
import { RELICS } from '../magic/relics';
import { PLAYER_ID, playerChips, type RunState } from './run';

export const MERCHANTS = Object.fromEntries(data.merchants.map((m) => [m.id, m])) as Record<string, (typeof data.merchants)[number]>;

/** One line from the merchant at this node, reflecting their authored temperament. */
export function merchantLine(run: RunState, merchantId: string): string {
  const name = MERCHANTS[merchantId]?.name ?? merchantId;
  const chips = playerChips(run);
  const you = run.characters[PLAYER_ID];
  const owes = run.contracts.filter((k) => k.debtor === PLAYER_ID && k.status !== 'cleared' && k.pact !== 'mercy');
  switch (merchantId) {
    case 'selene':
      return `${name}: “You hold ${chips}. Buy only what you could lose twice over — a relic is not worth your last Lifechip.”`;
    case 'merchant_elin': {
      const rank = you.socialRank === 'UNRANKED' ? 'a guest of the Circuit' : you.socialRank === 'UNBOUND_FALLEN' ? 'one of the Unbound Fallen' : 'one of the Fallen';
      return `${name}: “${rank[0].toUpperCase()}${rank.slice(1)}${owes.length ? `, still owing ${owes.length === 1 ? 'a covenant' : `${owes.length} covenants`}` : ''}. The Exchange serves you all the same.”`;
    }
    case 'merchant_oran': {
      const rare = run.shop?.offers.find((o) => RELICS[o.relic].rarity === 'rare' && !o.sold);
      return rare
        ? `${name}: “The ${RELICS[rare.relic].name} asks ${rare.price} — ${Math.floor(rare.price / 8)} big blinds at the Coronet. Provenance is costly; consider what it leaves you.”`
        : `${name}: “Every relic here is catalogued and priced by its provenance. Nothing rare today.”`;
    }
    case 'broker_osric':
      return `${name}: “My purse holds ${run.accounts[merchantId] ?? 0}, from the Cinder ledger. I pay half a relic’s worth and not a chip more.”`;
    case 'merchant_wisp':
      return owes.length
        ? `${name}: “Bound, are you? The Underledger knows your creditors. Sell if you must; I pay half.”`
        : `${name}: “Unbound, down here? Rare. Sell if you must; I pay half.”`;
    default:
      return `${name}: “Every price is a real transfer.”`;
  }
}
