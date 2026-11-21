import { useSyncExternalStore } from 'react';
import { actions, appStore } from '../../lib/appStore';
import { putImage } from '../../lib/images';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { findPhotos, findPictures, type Photo } from './dreamSearch';
import { parseShared, type Shared } from './shareScript';
import { fetchImage, firstUrl, fullScreen, lookup, pageImage, proxied, shopOf } from './link';

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

/** The photo of a purchase as the shop or the owner gave it, kept whole on this device: it fills the card. */
export async function setBuyPicture(id: string, blob: Blob) {
  const imgId = await putImage(blob);
  if (current(id)) actions.updateBuy(id, { imgId, cut: false, tint: undefined, autoPic: undefined });
}

/** How far down the results to look when a picture does not load. */
const TRIES = 4;
const MIN_NAME = 3;

/**
 * The first found picture that loads, whole. Cutting the thing out of it with a neural network took
 * about 800 MB, enough for a phone to shut the tab, so nothing heavier than a download runs here.
 */
async function pictureByName(name: string, signal: AbortSignal): Promise<Blob | null> {
  for (const f of (await findPictures(name, signal)).slice(0, TRIES)) {
    const blob = await fetchImage(f.full, signal);
    if (signal.aborted) return null;
    if (blob) return blob;
  }
  return null;
}

/** A purchase with no picture, or with one found by a name since changed. A shop's or the owner's own stays. */
export const wantsPicture = (b: Buy) => {
  const name = b.title.trim();
  if (name.length < MIN_NAME || name === b.shop) return false;
  return !b.imgId || (b.autoPic !== undefined && b.autoPic !== name);
};

/** Purchases being filled from a link right now: the search by name waits for what the shop gives. */
const linking = new Set<string>();
const picking = new Map<string, { name: string; stop: AbortController }>();
/** Names that found nothing, so they are not searched again until the next visit. */
const nothing = new Set<string>();

/** Finds and sets the picture by the purchase's name. Safe to call again and again. */
export async function autoPicture(id: string): Promise<void> {
  const b = current(id);
  if (!b || !wantsPicture(b) || linking.has(id)) return;
  const name = b.title.trim();
  if (picking.get(id)?.name === name || nothing.has(name)) return;
  picking.get(id)?.stop.abort();
  const stop = new AbortController();
  picking.set(id, { name, stop });
  setBusy(id, true);
  try {
    const blob = await pictureByName(name, stop.signal);
    if (stop.signal.aborted) return;
    if (!blob) {
      nothing.add(name);
      return;
    }
    const imgId = await putImage(blob);
    if (current(id)?.title.trim() === name) actions.updateBuy(id, { imgId, cut: false, tint: undefined, autoPic: name });
  } catch {
    /* offline: the card stays without a picture until it is opened again */
  } finally {
    if (picking.get(id)?.stop === stop) {
      picking.delete(id);
      setBusy(id, false);
    }
  }
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

async function fill(id: string, url: string) {
  setBusy(id, true);
  linking.add(id);
  try {
    const found = await lookup(url);
    fillEmpty(id, found);
    if (found.image) {
      // Some shops let a browser read their pictures, others only through the image proxy.
      const blob = (await fetchImage(found.image)) ?? (await fetchImage(proxied(found.image)));
      if (blob && !current(id)?.imgId) await setBuyPicture(id, blob);
    }
  } finally {
    linking.delete(id);
    setBusy(id, false);
  }
  // A closed shop gives a name at most: the picture is then found by that name.
  void autoPicture(id);
}

/** A link pasted into a purchase already open. */
export function linkInto(id: string, text: string) {
  const url = firstUrl(text);
  if (!url) return;
  const shop = shopOf(url);
  // A name already written stays; otherwise the shop's stands in until its own name arrives.
  actions.updateBuy(id, { title: current(id)?.title.trim() ? current(id)!.title : shop, url, shop });
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
  const id = known?.id ?? actions.addBuy({ title: s.title ?? shop, url: s.url, price: s.price ?? 0, shop, note: s.note, category: s.category }).id;
  if (known) fillEmpty(id, s);
  if (s.image && !known?.imgId) {
    const image = s.image;
    setBusy(id, true);
    void (async () => {
      try {
        const blob = (await fetchImage(image)) ?? (await fetchImage(proxied(image, 1200)));
        if (blob) await setBuyPicture(id, blob);
      } finally {
        setBusy(id, false);
      }
    })();
  }
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
  return shared ? addShared(shared) : addBuyFrom(text);
}
