import { addDays, addMonths, dayKey, daysInMonth, fmtDay, fmtMonth, parseDay, ymKey } from '../../lib/dates';
import type { Bank, BankCode, Income, Spend } from '../../lib/types';
import type { ChartPoint } from '../../app/money/WaveChart';

/** The owner's cards, in the order they are listed. */
export const CARDS: { code: BankCode; label: string; domain: string }[] = [
  { code: 'tbank', label: 'Т-Банк', domain: 'tbank.ru' },
  { code: 'ozon', label: 'Озон', domain: 'ozon.ru' },
  { code: 'sber', label: 'Сбер', domain: 'sberbank.ru' },
  { code: 'alfa', label: 'Альфа', domain: 'alfabank.ru' },
  { code: 'wb', label: 'ВБ', domain: 'wildberries.ru' },
  { code: 'vtb', label: 'ВТБ', domain: 'vtb.ru' },
];

export interface CardView {
  code: BankCode;
  label: string;
  domain: string;
  /** The record new operations go to; absent until the card has been created. */
  id?: string;
  sum: number;
}

/** Older data can hold several records of one bank: on screen that is one card with their sum. */
export function cardViews(banks: Bank[]): CardView[] {
  return CARDS.map((c) => {
    const own = banks.filter((b) => b.code === c.code).sort((a, b) => a.order - b.order);
    return { ...c, id: own[0]?.id, sum: own.reduce((t, b) => t + b.sum, 0) };
  });
}

export const missingCards = (banks: Bank[]) => CARDS.filter((c) => !banks.some((b) => b.code === c.code)).map((c) => c.code);

export const cardLabel = (banks: Bank[], bankId?: string) => {
  const code = banks.find((b) => b.id === bankId)?.code;
  return CARDS.find((c) => c.code === code)?.label;
};

export type Span = 'days' | 'months';

/** Income per day of this month so far, or per month of this year so far; oldest first. */
export function incomeSeries(incomes: Income[], span: Span, now: Date): ChartPoint[] {
  const sums = new Map<string, number>();
  for (const i of incomes) {
    const key = span === 'days' ? i.date : i.date.slice(0, 7);
    sums.set(key, (sums.get(key) ?? 0) + i.amount);
  }
  if (span === 'days') {
    return Array.from({ length: now.getDate() }, (_, i) => {
      const key = dayKey(new Date(now.getFullYear(), now.getMonth(), i + 1));
      return { key, label: fmtDay(key), value: sums.get(key) ?? 0 };
    });
  }
  return Array.from({ length: now.getMonth() + 1 }, (_, i) => {
    const key = ymKey(new Date(now.getFullYear(), i, 1));
    return { key, label: fmtMonth(key), value: sums.get(key) ?? 0 };
  });
}

/** «Доход за ноябрь 2026» or «Доход за весь год», whichever the chart is showing. */
export const incomeTitle = (span: Span, now: Date) => (span === 'days' ? `Доход за ${fmtMonth(ymKey(now))}` : 'Доход за весь год');

/** The total of the shown period so far, and in percent against the same stretch of the one before. */
export function incomeTotals(incomes: Income[], span: Span, now: Date): { sum: number; change: number | null } {
  const inPeriod = (from: string, to: string) => incomes.filter((i) => i.date >= from && i.date <= to).reduce((t, i) => t + i.amount, 0);
  const today = dayKey(now);
  let sum: number;
  let before: number;
  if (span === 'days') {
    const ago = addMonths(ymKey(now), -1);
    // The 31st compares with the last day of a shorter month.
    const day = Math.min(now.getDate(), daysInMonth(ago));
    sum = inPeriod(`${ymKey(now)}-01`, today);
    before = inPeriod(`${ago}-01`, `${ago}-${String(day).padStart(2, '0')}`);
  } else {
    const y = now.getFullYear();
    sum = inPeriod(`${y}-01-01`, today);
    before = inPeriod(`${y - 1}-01-01`, `${y - 1}${today.slice(4)}`);
  }
  return { sum, change: before > 0 ? Math.round(((sum - before) / before) * 100) : null };
}

/** «5 ноября 2026», without the «г.» the Russian locale adds after a year. */
export const fullDate = (key: string) => parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');

/** «Сегодня», «Вчера» or the date; the year only when it is not this one. */
export function dayTitle(key: string, now: Date) {
  if (key === dayKey(now)) return 'Сегодня';
  if (key === dayKey(addDays(now, -1))) return 'Вчера';
  const d = parseDay(key);
  return d.getFullYear() === now.getFullYear() ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : fullDate(key);
}

/** Newest first, grouped by day. */
export function byDay(spends: Spend[]) {
  const sorted = [...spends].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  const groups: { day: string; list: Spend[] }[] = [];
  for (const s of sorted) {
    const last = groups[groups.length - 1];
    if (last?.day === s.date) last.list.push(s);
    else groups.push({ day: s.date, list: [s] });
  }
  return groups;
}

/** «1 234,5» → 1234.5; empty or junk → 0. */
export const parseAmount = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0;
