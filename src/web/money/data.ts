import { addDays, addMonths, dayKey, fmtDay, fmtMonth, parseDay, ymKey } from '../../lib/dates';
import type { Bank, BankCode, Income, Spend } from '../../lib/types';
import type { ChartPoint } from '../../app/money/WaveChart';

/** The owner's cards, in the order they are listed. */
export const CARDS: { code: BankCode; label: string; domain: string }[] = [
  { code: 'wb', label: 'ВБ', domain: 'wildberries.ru' },
  { code: 'ozon', label: 'Озон', domain: 'ozon.ru' },
  { code: 'alfa', label: 'Альфа', domain: 'alfabank.ru' },
  { code: 'sber', label: 'Сбер', domain: 'sberbank.ru' },
  { code: 'tbank', label: 'Т-Банк', domain: 'tbank.ru' },
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
export const DAYS = 30;
export const MONTHS = 12;

/** Income per day for the last 30 days, or per month for the last 12; oldest first. */
export function incomeSeries(incomes: Income[], span: Span, now: Date): ChartPoint[] {
  const sums = new Map<string, number>();
  for (const i of incomes) {
    const key = span === 'days' ? i.date : i.date.slice(0, 7);
    sums.set(key, (sums.get(key) ?? 0) + i.amount);
  }
  if (span === 'days') {
    return Array.from({ length: DAYS }, (_, i) => {
      const key = dayKey(addDays(now, i - DAYS + 1));
      return { key, label: fmtDay(key), value: sums.get(key) ?? 0 };
    });
  }
  const ym = ymKey(now);
  return Array.from({ length: MONTHS }, (_, i) => {
    const key = addMonths(ym, i - MONTHS + 1);
    return { key, label: fmtMonth(key), value: sums.get(key) ?? 0 };
  });
}

/** The total of the shown period and how it compares with the one before, in percent. */
export function incomeTotals(incomes: Income[], span: Span, now: Date): { sum: number; change: number | null } {
  const inPeriod = (from: string, to: string) => incomes.filter((i) => i.date >= from && i.date <= to).reduce((t, i) => t + i.amount, 0);
  let sum: number;
  let before: number;
  if (span === 'days') {
    const today = dayKey(now);
    sum = inPeriod(dayKey(addDays(now, 1 - DAYS)), today);
    before = inPeriod(dayKey(addDays(now, 1 - DAYS * 2)), dayKey(addDays(now, -DAYS)));
  } else {
    const ym = ymKey(now);
    const first = (m: string) => `${m}-01`;
    const end = (m: string) => `${m}-31`;
    sum = inPeriod(first(addMonths(ym, 1 - MONTHS)), end(ym));
    before = inPeriod(first(addMonths(ym, 1 - MONTHS * 2)), end(addMonths(ym, -MONTHS)));
  }
  return { sum, change: before > 0 ? Math.round(((sum - before) / before) * 100) : null };
}

/** «Сегодня», «Вчера» or the date; the year only when it is not this one. */
export function dayTitle(key: string, now: Date) {
  if (key === dayKey(now)) return 'Сегодня';
  if (key === dayKey(addDays(now, -1))) return 'Вчера';
  const d = parseDay(key);
  return d.toLocaleDateString('ru-RU', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
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
