import { useSyncExternalStore } from 'react';
import { actions, appStore } from '../../lib/appStore';
import { putImage } from '../../lib/images';
import { visible } from '../../lib/records';
import { cutOut } from './cutout';
import { fetchImage, firstUrl, lookup, proxied, shopOf } from './link';

/** Purchases whose card is still being filled from their link. */
let busy = new Set<string>();
const listeners = new Set<() => void>();
const setBusy = (id: string, on: boolean) => {
  busy = new Set(busy);
  if (on) busy.add(id);
  else busy.delete(id);
  listeners.forEach((l) => l());
};

export const useImporting = (id: string) =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => busy.has(id),
  );

const current = (id: string) => visible(appStore.get().shared.buys).find((b) => b.id === id);

/** Sets a field only if it is still empty: what the owner has typed meanwhile stays. */
function fillEmpty(id: string, found: { title?: string; price?: number; category?: string }) {
  const b = current(id);
  if (!b) return;
  actions.updateBuy(id, {
    ...(found.title && (!b.title || b.title === b.shop) ? { title: found.title } : {}),
    ...(found.price && !b.price ? { price: found.price } : {}),
    ...(found.category && !b.category ? { category: found.category } : {}),
  });
}

/** The picture of a purchase, cut out of its background and kept on this device. */
export async function setBuyPicture(id: string, blob: Blob) {
  const cut = await cutOut(blob);
  const imgId = await putImage(cut.blob);
  if (current(id)) actions.updateBuy(id, { imgId, cut: cut.removed, tint: cut.tint });
}

async function fill(id: string, url: string) {
  setBusy(id, true);
  try {
    const found = await lookup(url);
    fillEmpty(id, found);
    if (found.image) {
      // Some shops let a browser read their pictures, others only through the image proxy.
      const blob = (await fetchImage(found.image)) ?? (await fetchImage(proxied(found.image)));
      if (blob && !current(id)?.imgId) await setBuyPicture(id, blob);
    }
  } finally {
    setBusy(id, false);
  }
}

/**
 * A new purchase from what was pasted: a link fills the card by itself as far as the shop allows,
 * anything else becomes its name. Returns its id, at once; the rest arrives while the card is open.
 */
export function addBuyFrom(text: string): string | null {
  const clean = text.trim();
  if (!clean) return null;
  const url = firstUrl(clean);
  if (!url) return actions.addBuy({ title: clean, url: '', price: 0 }).id;

  const known = visible(appStore.get().shared.buys).find((b) => b.url === url && !b.boughtAt);
  if (known) return known.id;
  const shop = shopOf(url);
  const id = actions.addBuy({ title: shop, url, price: 0, shop }).id;
  void fill(id, url);
  return id;
}

/** `#/shop?add=…`: a link sent from the phone's share menu through a shortcut. */
export function takeShopLink(): string | null {
  const q = location.hash.indexOf('?');
  if (q < 0) return null;
  const text = new URLSearchParams(location.hash.slice(q + 1)).get('add');
  if (text === null) return null;
  history.replaceState(null, '', '#/shop');
  return addBuyFrom(text);
}
