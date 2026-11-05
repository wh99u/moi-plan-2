import { describe, expect, it } from 'vitest';
import type { Bank, Income, Spend } from '../../lib/types';
import { byDay, cardViews, dayTitle, fullDate, incomeSeries, incomeTitle, incomeTotals, missingCards, parseAmount, typedAmount } from './data';

const NOW = new Date(2026, 10, 5, 12);
const income = (date: string, amount: number) => ({ date, amount }) as Income;
const bank = (id: string, code: Bank['code'], sum: number, order = 0) => ({ id, code, sum, order }) as Bank;

describe('cardViews', () => {
  it('always lists the six cards in order', () => {
    expect(cardViews([]).map((c) => c.label)).toEqual(['Т-Банк', 'Озон', 'Сбер', 'Альфа', 'ВБ', 'ВТБ']);
  });

  it('sums several records of one bank and picks the first as the card', () => {
    const c = cardViews([bank('b', 'sber', 200, 3), bank('a', 'sber', 100, 1)]).find((x) => x.code === 'sber')!;
    expect(c).toMatchObject({ id: 'a', sum: 300 });
  });

  it('knows which cards still have to be created', () => {
    expect(missingCards([bank('a', 'sber', 0), bank('b', 'wb', 0)])).toEqual(['tbank', 'ozon', 'alfa', 'vtb']);
  });
});

describe('incomeSeries', () => {
  it('gives the days of this month so far, with sums per day', () => {
    const s = incomeSeries([income('2026-11-05', 100), income('2026-11-05', 50), income('2026-11-01', 7), income('2026-10-31', 999)], 'days', NOW);
    expect(s).toHaveLength(5);
    expect(s[4]).toMatchObject({ key: '2026-11-05', value: 150 });
    expect(s[0]).toMatchObject({ key: '2026-11-01', value: 7 });
  });

  it('gives the months of this year so far', () => {
    const s = incomeSeries([income('2026-11-01', 10), income('2026-11-30', 5), income('2026-01-15', 3), income('2025-12-15', 999)], 'months', NOW);
    expect(s).toHaveLength(11);
    expect(s[10]).toMatchObject({ key: '2026-11', value: 15 });
    expect(s[0]).toMatchObject({ key: '2026-01', value: 3 });
  });
});

describe('incomeTitle', () => {
  it('names what the chart shows', () => {
    expect(incomeTitle('days', NOW)).toBe('Доход за ноябрь 2026');
    expect(incomeTitle('months', NOW)).toBe('Доход за весь год');
  });
});

describe('incomeTotals', () => {
  it('compares this month with the same days of the last one', () => {
    const list = [income('2026-11-01', 150), income('2026-10-02', 100), income('2026-10-20', 999)];
    expect(incomeTotals(list, 'days', NOW)).toEqual({ sum: 150, change: 50 });
  });

  it('compares this year with the same part of the last one', () => {
    const list = [income('2026-02-01', 50), income('2025-02-01', 100), income('2025-12-01', 999)];
    expect(incomeTotals(list, 'months', NOW)).toEqual({ sum: 50, change: -50 });
  });

  it('has no comparison when nothing came before', () => {
    expect(incomeTotals([income('2026-11-01', 150)], 'months', NOW)).toEqual({ sum: 150, change: null });
  });

  it('copes with a month longer than the one before', () => {
    const end = new Date(2026, 9, 31);
    expect(incomeTotals([income('2026-10-31', 200), income('2026-09-30', 100)], 'days', end)).toEqual({ sum: 200, change: 100 });
  });
});

describe('fullDate', () => {
  it('has no trailing «г.»', () => {
    expect(fullDate('2026-11-05')).toBe('5 ноября 2026');
  });
});

describe('dayTitle', () => {
  it('names the near days and dates the rest', () => {
    expect(dayTitle('2026-11-05', NOW)).toBe('Сегодня');
    expect(dayTitle('2026-11-04', NOW)).toBe('Вчера');
    expect(dayTitle('2026-10-30', NOW)).toBe('30 октября');
    expect(dayTitle('2025-10-30', NOW)).toBe('30 октября 2025');
  });
});

describe('byDay', () => {
  it('groups newest first, the last added on top', () => {
    const s = (id: string, date: string, updatedAt: number) => ({ id, date, updatedAt }) as Spend;
    const g = byDay([s('a', '2026-11-01', 1), s('b', '2026-11-03', 1), s('c', '2026-11-03', 2)]);
    expect(g.map((x) => x.day)).toEqual(['2026-11-03', '2026-11-01']);
    expect(g[0].list.map((x) => x.id)).toEqual(['c', 'b']);
  });
});

describe('parseAmount', () => {
  it('reads what people type', () => {
    expect(parseAmount('1 234,5')).toBe(1234.5);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('sums as they are written', () => {
  it.each([
    ['10.000', 10000],
    ['1.234.567', 1234567],
    ['1.234,5', 1234.5],
    ['12.5', 12.5],
    ['12,50', 12.5],
    ['-1.000', -1000],
    ['−1.000', -1000],
  ])('%s reads as %f', (text, n) => {
    expect(parseAmount(text)).toBe(n);
  });

  it.each([
    ['10000', '', '10.000'],
    ['1.2345', '1.234', '12.345'],
    ['1.23', '1.234', '123'],
    ['100', '10', '100'],
    ['007', '', '7'],
    ['10.', '10', '10,'],
    ['10,5', '10,', '10,5'],
    ['10,567', '10,56', '10,56'],
    ['1234.5', '', '1.234,5'],
    ['-5000', '', '-5.000'],
    ['abc', '', ''],
    ['', '1', ''],
  ])('%s after %s shows as %s', (raw, prev, shown) => {
    expect(typedAmount(raw, prev)).toBe(shown);
  });

  it('reads back what it shows', () => {
    for (const n of [5, 999, 1000, 10000, 1234567]) expect(parseAmount(typedAmount(String(n)))).toBe(n);
  });
});
