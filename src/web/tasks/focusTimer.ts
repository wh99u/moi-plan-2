import { useSyncExternalStore } from 'react';
import { actions, appStore } from '../../lib/appStore';
import { dayKey } from '../../lib/dates';
import { visible } from '../../lib/records';
import type { Habit, Task } from '../../lib/types';

/*
 * The pomodoro lives apart from any screen: once started it stays in its pill, and comes back after
 * a reload. It counts towards a moment on the clock, not by ticks, so it stays right while the phone
 * slows the page down in the background.
 */

export type FocusPhase = 'run' | 'done';
/** What the minutes are written to: a task, a habit counted in minutes, or nothing at all. */
export type FocusKind = 'task' | 'habit' | 'free';

export interface FocusTimer {
  kind: FocusKind;
  refId?: string;
  title: string;
  phase: FocusPhase;
  /** Whole length, ms. */
  total: number;
  /** What was left when last stopped, ms. */
  left: number;
  /** When it ends; null while on pause. */
  endsAt: number | null;
  /** Minutes already written down. */
  banked: number;
}

const KEY = 'focus_timer';
const LENGTH_KEY = 'focus_len';
const MINUTE = 60_000;
export const FOCUS_LENGTHS = [15, 25, 30, 45, 60, 90];
const DEFAULT_LENGTH = 25;

export const focusLeft = (t: Pick<FocusTimer, 'left' | 'endsAt'>, now: number) => (t.endsAt === null ? t.left : Math.max(0, t.endsAt - now));

/** Whole minutes spent and not yet written to the task. */
export const minutesToBank = (t: Pick<FocusTimer, 'total' | 'left' | 'endsAt' | 'banked'>, now: number) => Math.max(0, Math.round((t.total - focusLeft(t, now)) / MINUTE) - t.banked);

/** «12 мин», «1 ч 05 мин», «40 с»: how long the focus lasted. */
export function spentWords(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, '0')} мин`;
}

function read(): FocusTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as FocusTimer & { taskId?: string };
    // Saved before habits could have a timer: then it always belonged to a task.
    if (!t.kind) return { ...t, kind: 'task', refId: t.taskId, phase: t.phase === 'done' ? 'done' : 'run' };
    return t;
  } catch {
    return null;
  }
}

function readLength(): number {
  try {
    return Number(localStorage.getItem(LENGTH_KEY)) || DEFAULT_LENGTH;
  } catch {
    return DEFAULT_LENGTH;
  }
}

let timer = read();
let length = readLength();
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());

function put(next: FocusTimer | null) {
  timer = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* it just will not survive a reload */
  }
  ping();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useFocusTimer = () => useSyncExternalStore(subscribe, () => timer);
export const useFocusLength = () => useSyncExternalStore(subscribe, () => length);

export function setFocusLength(minutes: number) {
  length = minutes;
  try {
    localStorage.setItem(LENGTH_KEY, String(minutes));
  } catch {
    /* the default comes back next time */
  }
  ping();
}

function bank(t: FocusTimer, now: number): FocusTimer {
  const whole = minutesToBank(t, now);
  if (!whole || !t.refId) return { ...t, banked: t.banked + whole };
  const { personal } = appStore.get();
  if (t.kind === 'task') {
    const task = visible(personal.tasks).find((x) => x.id === t.refId);
    if (task) actions.updateTask(task.id, { focused: (task.focused ?? 0) + whole });
  } else if (t.kind === 'habit') {
    const h = visible(personal.habits).find((x) => x.id === t.refId);
    const today = dayKey(new Date(now));
    if (h) actions.markHabit(h.id, today, (h.marks[today] ?? 0) + whole);
  }
  return { ...t, banked: t.banked + whole };
}

/** Starts at once; a timer already going is finished and written down first. */
export function startFocus(what: { kind?: FocusKind; refId?: string; title?: string; minutes?: number } = {}, now = Date.now()) {
  if (timer?.phase === 'run') bank(timer, now);
  const total = (what.minutes ?? length) * MINUTE;
  put({ kind: what.kind ?? 'free', refId: what.refId, title: what.title ?? 'Фокус', phase: 'run', total, left: total, endsAt: now + total, banked: 0 });
}

export const openFocus = (task: Task) => startFocus({ kind: 'task', refId: task.id, title: task.title });

/** A habit in minutes: as long as is left of it today. */
export const focusHabit = (h: Habit) => startFocus({ kind: 'habit', refId: h.id, title: h.title, minutes: Math.max(1, h.target - (h.marks[dayKey(new Date())] ?? 0)) });

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

/** Stopped early: what was done is written down, and shown for a moment. */
export function finishFocus(now = Date.now()) {
  if (timer?.phase !== 'run') return;
  put({ ...bank(timer, now), phase: 'done', left: focusLeft(timer, now), endsAt: null });
}

export function closeFocus(now = Date.now()) {
  if (timer?.phase === 'run') bank(timer, now);
  put(null);
}
