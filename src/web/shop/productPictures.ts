import { useSyncExternalStore } from 'react';
import { actions, appStore } from '../../lib/appStore';
import { putImage } from '../../lib/images';
import type { Buy } from '../../lib/types';

const pictures: [RegExp, string][] = [
  [/канцелярск[а-яё]*\s+нож|нож\s+канцелярск|utility knife/iu, 'utility-knife'],
  [/смазк[а-яё]*\s+силиконов|силиконов[а-яё]*\s+смазк/iu, 'silicone-spray'],
  [/airpods|earbuds|беспроводн[а-яё]*\s+вкладыш/iu, 'earbuds'],
  [/куртк|пуховик/iu, 'jacket'],
  [/монитор/iu, 'monitor'],
  [/кроссов|sneaker/iu, 'sneaker'],
  [/(?:^|\s)стол(?:\s|$)/iu, 'desk'],
  [/смартфон|iphone|телефон/iu, 'phone'],
  [/витамин|vitamin/iu, 'vitamins'],
];

export function catalogImage(name: string) {
  if (/coca[\s-]*cola|кока[\s-]*кола/iu.test(name)) return `${import.meta.env.BASE_URL}purchase-cola.webp`;
  const match = pictures.find(([pattern]) => pattern.test(name));
  return match && `${import.meta.env.BASE_URL}products/${match[1]}.webp`;
}

const API = 'https://aihorde.net/api/v2/generate';
const keyFor = (id: string) => `planner:product-image:${id}`;
const current = (id: string) => appStore.get().shared.buys.find(b => b.id === id && !b.deleted && !b.boughtAt);
const running = new Map<string, string>();
const errors = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

export function usePictureStatus(id: string) {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); },
    () => running.has(id) ? 'pending' : errors.has(id) ? 'error' : 'idle');
}

function savedJob(id: string, name: string): string | undefined {
  try {
    const job = JSON.parse(localStorage.getItem(keyFor(id)) || 'null');
    return job?.name === name && typeof job.job === 'string' ? job.job : undefined;
  } catch { return undefined; }
}

export function needsPicture(b: Buy) {
  return !!b.title.trim() && b.title !== b.shop && !catalogImage(b.title) && (!b.imgId || (!!b.autoPic && b.autoPic !== b.title.trim()));
}

async function request(path: string, init?: RequestInit) {
  const res = await fetch(API + path, { ...init, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function generatePicture(id: string, resumeOnly = false) {
  const buy = current(id);
  if (!buy || !needsPicture(buy)) return;
  const name = buy.title.trim();
  let job = savedJob(id, name);
  if ((resumeOnly && !job) || running.get(id) === name) return;
  const relevant = () => {
    const b = current(id);
    return b && b.title.trim() === name && needsPicture(b);
  };
  running.set(id, name);
  errors.delete(id);
  notify();
  try {
    if (!job) {
      const result = await request('/async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: '0000000000', 'Client-Agent': 'MoiPlan:1.0:github.com/wh99u/moi-plan-2' },
        body: JSON.stringify({ prompt: `Studio product photograph of a single item: ${name.slice(0, 120)}. Isolated on a plain charcoal background, front three-quarter view, centered, realistic materials, no captions.`,
          params: { n: 1, width: 512, height: 512, steps: 16 }, nsfw: false, shared: false, r2: false }),
      });
      if (!result.id) throw new Error('No generation ID');
      if (!relevant()) return;
      job = result.id;
      localStorage.setItem(keyFor(id), JSON.stringify({ name, job }));
    }
    for (let attempt = 0; attempt < 90 && relevant(); attempt++) {
      await new Promise(resolve => setTimeout(resolve, attempt < 3 ? 3000 : 10000));
      const state = await request('/check/' + job);
      if (state.faulted) throw new Error('Generation failed');
      if (!state.done) continue;
      const result = await request('/status/' + job);
      const image = result.generations?.[0];
      if (!image?.img || image.censored) throw new Error('Image unavailable');
      const source = image.img.startsWith('https://') ? image.img : 'data:image/webp;base64,' + image.img;
      const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Invalid image');
      if (!relevant()) return;
      const imgId = await putImage(blob);
      if (relevant()) {
        actions.updateBuy(id, { imgId, autoPic: name, cut: false });
        localStorage.removeItem(keyFor(id));
      }
      return;
    }
    if (relevant()) throw new Error('Queue timeout');
  } catch {
    if (relevant()) {
      errors.add(id);
      localStorage.removeItem(keyFor(id));
    }
  } finally {
    if (running.get(id) === name) running.delete(id);
    notify();
  }
}
