import { addDays, dayKey, daysBetween, daysLeftInMonth, parseDay, ymKey } from './dates';
import { visible } from './records';
import type { BudgetMonth, Car, Category, Shift, Spend } from './types';

const sum = <T>(list: T[], f: (x: T) => number) => list.reduce((t, x) => t + f(x), 0);

/** `10.000`: thousands split by dots, in every sum on the site. */
export function grouped(n: number) {
  const v = Math.round(n) || 0;
  return `${v < 0 ? '-' : ''}${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** `5.000 ₽`, the space no-break so amounts never wrap. */
export function rub(n: number) {
  return `${grouped(n)} ₽`;
}

/** Compact amount for tight cells: 1500 → «1.5к». */
export const kf = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}к` : String(Math.round(n)));

export const monthAccruals = (shifts: Shift[], ym: string) =>
  sum(visible(shifts).filter((s) => s.date.startsWith(ym)), (s) => s.pay);

export interface BudgetSummary {
  income: number;
  allocated: number;
  free: number;
  spent: number;
  left: number;
  perDay: number | null;
  daysLeft: number | null;
  cats: { cat: Category; spent: number; pct: number; over: boolean }[];
}

export function budgetSummary(month: BudgetMonth | undefined, spends: Spend[], today: Date): BudgetSummary {
  const cats = month?.cats ?? [];
  const ms = month ? visible(spends).filter((s) => s.ym === month.ym) : [];
  const byCat = cats.map((cat) => {
    const spent = sum(ms.filter((s) => s.catId === cat.id), (s) => s.amount);
    const pct = cat.limit > 0 ? (spent / cat.limit) * 100 : spent > 0 ? 100 : 0;
    return { cat, spent, pct, over: spent > cat.limit };
  });
  const income = month?.income ?? 0;
  const allocated = sum(cats, (c) => c.limit);
  const spent = sum(byCat, (c) => c.spent);
  const left = allocated - spent;
  const current = !!month && month.ym === ymKey(today);
  const daysLeft = current ? daysLeftInMonth(today) : null;
  return {
    income,
    allocated,
    free: income - allocated,
    spent,
    left,
    daysLeft,
    perDay: daysLeft ? Math.max(0, left) / daysLeft : null,
    cats: byCat,
  };
}

export interface DreamProgress {
  price: number;
  saved: number;
  left: number;
  pct: number;
  daysToDeadline: number | null;
  perDay: number | null;
  perWeek: number | null;
  perMonth: number | null;
  forecastYm: string | null;
  milestones: boolean[];
}

export function dreamProgress(car: Car, saved: number, shifts: Shift[], today: Date): DreamProgress {
  const price = car.price;
  const left = Math.max(0, price - saved);
  const pct = price > 0 ? Math.min(100, Math.max(0, (saved / price) * 100)) : 0;
  const daysToDeadline = car.date ? daysBetween(today, parseDay(car.date)) : null;
  const perDay = daysToDeadline !== null && daysToDeadline > 0 && left > 0 ? left / daysToDeadline : null;
  const since = dayKey(addDays(today, -30));
  const income30 = sum(visible(shifts).filter((s) => s.date >= since), (s) => s.pay);
  const forecastYm = left > 0 && income30 > 0 ? ymKey(addDays(today, Math.ceil(left / (income30 / 30)))) : null;
  return {
    price,
    saved,
    left,
    pct,
    daysToDeadline,
    perDay,
    perWeek: perDay === null ? null : perDay * 7,
    perMonth: perDay === null ? null : perDay * 30,
    forecastYm,
    milestones: [25, 50, 75, 100].map((m) => price > 0 && pct >= m),
  };
}
