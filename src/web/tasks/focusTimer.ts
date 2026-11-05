import { useSyncExternalStore } from 'react';
import { actions, appStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Task } from '../../lib/types';

/*
 * The pomodoro lives apart from any screen: once started it stays in its small window on every tab,
 * and comes back after a reload. It counts towards a moment on the clock, not by ticks, so it stays
 * right while the phone slows the page down in the background.
 */

export type FocusPhase = 'setup' | 'run' | 'done';

export interface FocusTimer {
  taskId: string;
  title: string;
  phase: FocusPhase;
  /** Whole length, ms. */
  total: number;
  /** What was left when last stopped, ms. */
  left: number;
  /** When it ends; null while on pause. */
  endsAt: number | null;
  /** Minutes already written to the task. */
  banked: number;
}

const KEY = 'focus_timer';
const MINUTE = 60_000;
export const FOCUS_LENGTHS = [15, 25, 50];
const DEFAULT_LENGTH = 25;

export const focusLeft = (t: Pick<FocusTimer, 'left' | 'endsAt'>, now: number) => (t.endsAt === null ? t.left : Math.max(0, t.endsAt - now));

/** Whole minutes spent and not yet written to the task. */
export const minutesToBank = (t: Pick<FocusTimer, 'total' | 'left' | 'endsAt' | 'banked'>, now: number) => Math.max(0, Math.round((t.total - focusLeft(t, now)) / MINUTE) - t.banked);

function read(): FocusTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FocusTimer) : null;
  } catch {
    return null;
  }
}

let timer = read();
const listeners = new Set<() => void>();

function put(next: FocusTimer | null) {
  timer = next;
  try {
    // A choice not yet started is not worth bringing back after a reload.
    if (next && next.phase !== 'setup') localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* it just will not survive a reload */
  }
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useFocusTimer = () =>
  useSyncExternalStore(
    subscribe,
    () => timer,
  );

function bank(t: FocusTimer, now: number): FocusTimer {
  const whole = minutesToBank(t, now);
  if (!whole) return t;
  const task = visible(appStore.get().personal.tasks).find((x) => x.id === t.taskId);
  if (task) actions.updateTask(t.taskId, { focused: (task.focused ?? 0) + whole });
  return { ...t, banked: t.banked + whole };
}

/** Asks how long; a timer already going is finished and written down first. */
export function openFocus(task: Task) {
  if (timer) bank(timer, Date.now());
  const total = DEFAULT_LENGTH * MINUTE;
  put({ taskId: task.id, title: task.title, phase: 'setup', total, left: total, endsAt: null, banked: 0 });
}

export function setFocusLength(minutes: number) {
  if (timer?.phase === 'setup') put({ ...timer, total: minutes * MINUTE, left: minutes * MINUTE });
}

export function startFocus(now = Date.now()) {
  if (timer) put({ ...timer, phase: 'run', endsAt: now + timer.left });
}

export function toggleFocusPause(now = Date.now()) {
  if (timer?.phase !== 'run') return;
  put(timer.endsAt === null ? { ...timer, endsAt: now + timer.left } : { ...bank(timer, now), left: focusLeft(timer, now), endsAt: null });
}

/** True at the moment it runs out. */
export function tickFocus(now = Date.now()): boolean {
  if (timer?.phase !== 'run' || timer.endsAt === null || timer.endsAt > now) return false;
  put({ ...bank(timer, now), phase: 'done', left: 0, endsAt: null });
  return true;
}

export function closeFocus(now = Date.now()) {
  if (timer) bank(timer, now);
  put(null);
}
