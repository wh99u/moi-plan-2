import { useSyncExternalStore } from 'react';
import { actions, appStore } from '../../lib/appStore';
import { putImage } from '../../lib/images';
import { visible } from '../../lib/records';
import { findPhotos, type Photo } from './dreamSearch';
import { parseShared, type Shared } from './shareScript';
import { generatePicture } from './productPictures';
import { fetchImage, firstUrl, fullScreen, lookup, pageImage, productName, shopOf } from './link';

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
function fillEmpty(id: string, found: { title?: string; price?: number; category?: string; note?: string }) {
  const b = current(id);
  if (!b) return;
  const patch = {
    ...(found.title && (!b.title || b.title === b.shop) ? { title: productName(found.title) } : {}),
    ...(found.price && !b.price ? { price: found.price } : {}),
    ...(found.category && !b.category ? { category: found.category } : {}),
    ...(found.note && !b.note?.trim() ? { note: found.note } : {}),
  };
  if (Object.keys(patch).length) actions.updateBuy(id, patch);
}

/** The photo of a purchase as the shop or the owner gave it, kept whole on this device: it fills the card. */
export async function setBuyPicture(id: string, blob: Blob) {
  const imgId = await putImage(blob);
  if (current(id)) actions.updateBuy(id, { imgId, cut: false, tint: undefined, autoPic: undefined });
}

/** The key the dream's search shows under in `useImporting`. */
export const DREAM = 'dream';

/** Found photos by name, and which of them is on screen, for «another one». */
const photos = new Map<string, { list: Photo[]; at: number }>();
const noPhoto = new Set<string>();

/**
 * The dream's picture by its name, the next one along if asked: the first photo in the list that
 * comes through. It stays a whole photo, background and all: here it is the screen.
 */
export async function autoDream(name: string, next = false): Promise<boolean> {
  if (busy.has(DREAM) || (!next && noPhoto.has(name))) return false;
  setBusy(DREAM, true);
  try {
    let found = photos.get(name);
    if (!found) {
      const list = await findPhotos(name);
      // After a reload the photo on screen is known by its source, so «another» does not bring it back.
      found = { list, at: list.findIndex((p) => p.creditUrl === appStore.get().shared.car.creditUrl) };
      photos.set(name, found);
    }
    for (let tried = 0; tried < found.list.length; tried++) {
      found.at = (found.at + 1) % found.list.length;
      const photo = found.list[found.at];
      const blob = await fetchImage(photo.url);
      if (!blob) continue;
      const imgId = await putImage(blob);
      if (appStore.get().shared.car.name === name) actions.setCar({ imgId, cut: false, ownPic: false, credit: photo.credit, creditUrl: photo.creditUrl });
      return true;
    }
    noPhoto.add(name);
    return false;
  } catch {
    return false; /* offline: tried again on the next visit */
  } finally {
    setBusy(DREAM, false);
  }
}

/** The owner's own photo for the dream: it stays whatever the dream is called. */
export async function setDreamPhoto(blob: Blob): Promise<void> {
  setBusy(DREAM, true);
  try {
    const imgId = await putImage(blob);
    actions.setCar({ imgId, cut: false, ownPic: true, credit: undefined, creditUrl: undefined });
  } finally {
    setBusy(DREAM, false);
  }
}

/** A link for the dream: to a picture itself, or to a page, whose preview picture is taken. False if neither gave one. */
export async function setDreamLink(text: string): Promise<boolean> {
  const url = firstUrl(text);
  if (!url) return false;
  setBusy(DREAM, true);
  try {
    let blob = (await fetchImage(fullScreen(url))) ?? (await fetchImage(url));
    if (!blob) {
      const image = await pageImage(url).catch(() => undefined);
      blob = image ? ((await fetchImage(fullScreen(image))) ?? (await fetchImage(image))) : null;
    }
    if (!blob) return false;
    const imgId = await putImage(blob);
    actions.setCar({ imgId, cut: false, ownPic: true, credit: undefined, creditUrl: undefined });
    return true;
  } finally {
    setBusy(DREAM, false);
  }
}

const imports = new Map<string, AbortController>();

async function fill(id: string, url: string) {
  imports.get(id)?.abort();
  const request = new AbortController();
  imports.set(id, request);
  setBusy(id, true);
  try {
    const found = await lookup(url, request.signal);
    if (!request.signal.aborted && current(id)?.url === url) {
      fillEmpty(id, found);
      void generatePicture(id);
    }
  } catch {
    // The link and any fields the owner entered remain available when the lookup fails.
  } finally {
    if (imports.get(id) === request) {
      imports.delete(id);
      setBusy(id, false);
    }
  }
}

/** A link pasted into a purchase already open. */
export function linkInto(id: string, text: string) {
  const url = firstUrl(text);
  if (!url) return;
  const shop = shopOf(url);
  const buy = current(id);
  if (!buy) return;
  // A name already written stays; otherwise the shop's stands in until its own name arrives.
  actions.updateBuy(id, { title: buy.title.trim() && buy.title !== buy.shop ? buy.title : shop, url, shop });
  void fill(id, url);
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

/** The product card read from the page the owner had open: everything the shop shows goes into ours. */
function addShared(s: Shared): string {
  const known = visible(appStore.get().shared.buys).find((b) => b.url === s.url && !b.boughtAt);
  const shop = shopOf(s.url);
  const id = known?.id ?? actions.addBuy({ title: s.title ? productName(s.title) : shop, url: s.url, price: s.price ?? 0, shop, note: s.note, category: s.category }).id;
  if (known) fillEmpty(id, s);
  void generatePicture(id);
  return id;
}

/** `#/shop?add=…`: what came from the phone's share menu through a shortcut, a whole card or just a link. */
export function takeShopLink(): string | null {
  const at = location.hash.indexOf('?');
  if (at < 0) return null;
  const q = new URLSearchParams(location.hash.slice(at + 1));
  const text = q.get('add');
  if (text === null) return null;
  history.replaceState(null, '', '#/shop');
  const shared = parseShared(q);
  const url = shared && firstUrl(shared.url);
  return shared && url ? addShared({ ...shared, url }) : addBuyFrom(text);
}
