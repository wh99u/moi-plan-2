import { setNotice } from '../../app/money/auto';
import { openSheet } from '../../app/sheet';
import { actions, appStore } from '../../lib/appStore';
import { rub } from '../../lib/money';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { cardLabel } from '../money/data';
import { pulseWave } from '../Wave';
import { isBlankBuy } from './logic';

/** The card a bought thing is paid from: the one used last, or the first. */
function payCard() {
  const { shared, personal } = appStore.get();
  const banks = visible(shared.banks);
  return banks.find((b) => b.id === personal.settings.lastTopUpBankId) ?? banks[0];
}

/** With a price and a card, a swipe is enough; without them the «Куплено» form asks. */
export const buysAtOnce = (b: Buy) => b.price > 0 && !!payCard();

/** Swiped right: paid from the usual card at its price, and it can be taken back. */
export function buyNow(b: Buy) {
  const card = payCard();
  if (!card || b.price <= 0) {
    openSheet('bought', { id: b.id });
    return;
  }
  const spend = actions.buyFrom(b.id, card.id, b.price);
  if (!spend) return;
  pulseWave();
  const from = cardLabel(visible(appStore.get().shared.banks), card.id);
  setNotice({ text: `Куплено: −${rub(b.price)}${from ? ` с ${from}` : ''}`, undo: () => actions.revertSpend(spend.id) });
}

/** Swiped left, or «Удалить» in the window: gone at once, with a moment to change one's mind. */
export function deleteBuyUndoable(b: Buy) {
  actions.deleteBuy(b.id);
  if (isBlankBuy(b)) return;
  setNotice({ text: `«${b.title || 'Покупка'}» удалена`, undo: () => actions.updateBuy(b.id, { deleted: undefined }) });
}
