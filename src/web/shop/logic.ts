import { addDays, dayKey, daysBetween, parseDay } from '../../lib/dates';
import type { Buy, Car, Income, Spend } from '../../lib/types';

/** How many purchases fit on the main screen of the section. */
export const MAIN_COUNT = 3;
const PACE_DAYS = 90;
const DAYS_IN_MONTH = 30.44;

/**
 * What can be put aside per month: income minus spending over the last three months, averaged.
 * Null when nothing is left over, or there is nothing to go on.
 */
export function monthlyPace(incomes: Income[], spends: Spend[], now: Date): number | null {
  const from = dayKey(addDays(now, -PACE_DAYS));
  const sum = (list: { date: string; amount: number }[]) => list.filter((x) => x.date > from).reduce((t, x) => t + x.amount, 0);
  const left = (sum(incomes) - sum(spends)) / (PACE_DAYS / DAYS_IN_MONTH);
  return left > 0 ? Math.round(left) : null;
}

export interface DreamPlan {
  saved: number;
  left: number;
  /** 0…1 */
  share: number;
  /** Per month: the set pace, or the one worked out. */
  pace: number | null;
  /** How long saving will take at that pace; 0 when it is all there. */
  daysToSave: number | null;
  /** Until the chosen date. */
  daysLeft: number | null;
  /** Per month to make it by the date, when the pace falls short. */
  needed: number | null;
}

export function dreamPlan(car: Car, autoPace: number | null, today: Date): DreamPlan {
  const saved = Math.max(0, car.saved ?? 0);
  const left = Math.max(0, car.price - saved);
  const pace = car.pace && car.pace > 0 ? car.pace : autoPace;
  const daysToSave = left === 0 ? 0 : pace ? Math.ceil((left / pace) * DAYS_IN_MONTH) : null;
  const daysLeft = car.date ? daysBetween(today, parseDay(car.date)) : null;
  const late = left > 0 && daysLeft !== null && (daysToSave === null || daysToSave > daysLeft);
  return {
    saved,
    left,
    share: car.price > 0 ? Math.min(1, saved / car.price) : 0,
    pace,
    daysToSave,
    daysLeft,
    needed: late ? Math.ceil(left / Math.max(1, Math.max(daysLeft!, 1) / DAYS_IN_MONTH)) : null,
  };
}

/** The dream has been filled in: a new account holds a placeholder car with no price. */
export const hasDream = (car: Car) => car.price > 0 || !!car.imgId;

export const activeBuys = (buys: Buy[]) => buys.filter((b) => !b.boughtAt);

/** The dream has a photo that can fill the screen: a cut-out from the earlier design cannot. */
export const usablePhoto = (car: Car) => !!car.imgId && !car.cut;

/** Opened with the plus and left as it was: nothing to keep. */
export const isBlankBuy = (b: Buy) => !b.title.trim() && !b.url && !b.imgId && !b.price && !b.note && !b.why && !b.due;

/**
 * The main screen and the rest: what was brought up by hand, newest first; any free places go to
 * the nearest deadlines, then the oldest wishes.
 */
export function splitBuys(buys: Buy[]): { main: Buy[]; rest: Buy[] } {
  const list = activeBuys(buys);
  const pinned = list.filter((b) => b.pinned).sort((a, b) => b.pinned! - a.pinned!).slice(0, MAIN_COUNT);
  const others = list
    .filter((b) => !pinned.includes(b))
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (x.b.due ?? '9999').localeCompare(y.b.due ?? '9999') || x.i - y.i)
    .map((x) => x.b);
  const free = MAIN_COUNT - pinned.length;
  return { main: [...pinned, ...others.slice(0, free)], rest: others.slice(free) };
}

/** Shortest and slowest a swipe up can be and still count as a flick on to the dream. */
const FLICK_MIN_PX = 40;
const FLICK_MIN_SPEED = 0.4;
/** How much of the list may be left below, as a share of the screen. */
const FLICK_LEFT_SHARE = 0.4;

/** A flick up on the purchases goes straight to the dream, unless a long stretch of the list is still below. */
export function flickReachesDream(distance: number, ms: number, left: number, height: number): boolean {
  if (distance < FLICK_MIN_PX || ms <= 0 || distance / ms < FLICK_MIN_SPEED) return false;
  return left <= height * FLICK_LEFT_SHARE;
}
