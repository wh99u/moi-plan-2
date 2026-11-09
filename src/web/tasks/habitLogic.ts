import { addDays, dayKey, parseDay } from '../../lib/dates';
import type { Habit, HabitPart } from '../../lib/types';

export const doneOn = (h: Habit, day: string) => (h.marks[day] ?? 0) >= h.target;

/** One tap more; past the whole of it, back to nought. */
export const nextMark = (h: Habit, day: string) => {
  const v = h.marks[day] ?? 0;
  return v >= h.target ? 0 : v + 1;
};

/** Days in a row it was done, up to today; today not done yet does not break it. */
export function streak(h: Habit, today: string): number {
  let d = parseDay(today);
  if (!doneOn(h, today)) d = addDays(d, -1);
  let n = 0;
  while (doneOn(h, dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** How much of all the habits was done that day, from 0 to 1; null with none to do. */
export function dayShare(habits: Habit[], day: string): number | null {
  if (!habits.length) return null;
  const sum = habits.reduce((t, h) => t + Math.min(1, (h.marks[day] ?? 0) / h.target), 0);
  return sum / habits.length;
}

/** Days of the month up to today on which every habit was done. */
export const fullDays = (habits: Habit[], days: string[], today: string) => days.filter((d) => d <= today && dayShare(habits, d) === 1).length;

/** For one part of the day, those of it and those for any time. */
export const inPart = (habits: Habit[], part: HabitPart | 'all') => (part === 'all' ? habits : habits.filter((h) => !h.part || h.part === part));

/** A habit counted in minutes can be done with the focus timer. */
export const isTimed = (h: Pick<Habit, 'unit'>) => /^мин/.test(h.unit);

export const PART_NOW = (hour: number): HabitPart => (hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening');
