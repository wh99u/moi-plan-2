import { useSyncExternalStore } from 'react';

/** The site's colours all turn on one number: how far round the colour wheel from the original blue. */
export const ACCENTS = [
  { id: 'blue', label: 'Голубой', hue: 0, swatch: '#3b8cff' },
  { id: 'red', label: 'Красный', hue: 145, swatch: '#f0343f' },
  { id: 'violet', label: 'Фиолетовый', hue: 50, swatch: '#8b5cf6' },
  { id: 'green', label: 'Зелёный', hue: -70, swatch: '#22b566' },
  { id: 'orange', label: 'Оранжевый', hue: 175, swatch: '#f97b16' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

/** Also read by the small script in index.html, before the first paint. */
const KEY = 'app_accent';

export const hueOf = (id: string) => ACCENTS.find((a) => a.id === id)?.hue ?? 0;

function read(): AccentId {
  try {
    const v = localStorage.getItem(KEY);
    if (ACCENTS.some((a) => a.id === v)) return v as AccentId;
  } catch {
    /* private mode: the original blue */
  }
  return 'blue';
}

let current = read();
const listeners = new Set<() => void>();

function apply() {
  document.documentElement.style.setProperty('--hue', String(hueOf(current)));
}
apply();

export function setAccent(id: AccentId) {
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* keeps working for this visit */
  }
  apply();
  listeners.forEach((l) => l());
}

export const getAccent = () => current;

export const subscribeAccent = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useAccent = () => useSyncExternalStore(subscribeAccent, getAccent);

/** A colour for what CSS cannot reach, such as a canvas: `hsla` with the site's hue applied. */
export const hued = (hue: number, h: number, s: number, l: number, a = 1) => `hsla(${h + hue}, ${s}%, ${l}%, ${a})`;

/**
 * The same turn of the colour wheel as a matrix for the background line's shader: whites stay
 * white, because they lie on the axis it turns around. Column by column, as WebGL wants it.
 */
export function hueMatrix(deg: number): Float32Array {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = 1 / 3;
  const q = Math.sqrt(k);
  const d = k * (1 - c);
  return new Float32Array([c + d, d + q * s, d - q * s, d - q * s, c + d, d + q * s, d + q * s, d - q * s, c + d]);
}
