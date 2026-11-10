import { useSyncExternalStore } from 'react';

/** Glass: see-through panels that blur what is behind them. Flat: the same shapes, solid and matte. */
export type Look = 'glass' | 'flat';

/** Also read by the small script in index.html, before the first paint. */
const KEY = 'app_look';

function read(): Look {
  try {
    return localStorage.getItem(KEY) === 'flat' ? 'flat' : 'glass';
  } catch {
    return 'glass';
  }
}

let current = read();
const listeners = new Set<() => void>();

const apply = () => {
  document.documentElement.dataset.look = current;
};
apply();

export function setLook(next: Look) {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* keeps working for this visit */
  }
  apply();
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useLook = () => useSyncExternalStore(subscribe, () => current);
