import { describe, expect, it } from 'vitest';
import type { Bank, Income, Spend } from '../../lib/types';
import { byDay, cardViews, dayTitle, incomeSeries, incomeTotals, missingCards, parseAmount } from './data';

const NOW = new Date(2026, 10, 5, 12);
const income = (date: string, amount: number) => ({ date, amount }) as Income;
const bank = (id: string, code: Bank['code'], sum: number, order = 0) => ({ id, code, sum, order }) as Bank;

describe('cardViews', () => {
  it('always lists the six cards in order', () => {
    expect(cardViews([]).map((c) => c.label)).toEqual(['ВБ', 'Озон', 'Альфа', 'Сбер', 'Т-Банк', 'ВТБ']);
  });

  it('sums several records of one bank and picks the first as the card', () => {
    const c = cardViews([bank('b', 'sber', 200, 3), bank('a', 'sber', 100, 1)]).find((x) => x.code === 'sber')!;
    expect(c).toMatchObject({ id: 'a', sum: 300 });
  });

  it('knows which cards still have to be created', () => {
    expect(missingCards([bank('a', 'sber', 0), bank('b', 'wb', 0)])).toEqual(['ozon', 'alfa', 'tbank', 'vtb']);
  });
});

describe('incomeSeries', () => {
  it('gives 30 days ending today, with sums per day', () => {
    const s = incomeSeries([income('2026-11-05', 100), income('2026-11-05', 50), income('2026-10-07', 7), income('2026-10-06', 999)], 'days', NOW);
    expect(s).toHaveLength(30);
    expect(s[29]).toMatchObject({ key: '2026-11-05', value: 150 });
    expect(s[0]).toMatchObject({ key: '2026-10-07', value: 7 });
  });

  it('gives 12 months ending this one', () => {
    const s = incomeSeries([income('2026-11-01', 10), income('2026-11-30', 5), income('2025-12-15', 3)], 'months', NOW);
    expect(s).toHaveLength(12);
    expect(s[11]).toMatchObject({ key: '2026-11', value: 15 });
    expect(s[0]).toMatchObject({ key: '2025-12', value: 3 });
  });
});

describe('incomeTotals', () => {
  it('compares with the period before', () => {
    expect(incomeTotals([income('2026-11-01', 150), income('2026-10-01', 100)], 'days', NOW)).toEqual({ sum: 150, change: 50 });
  });

  it('has no comparison when nothing came before', () => {
    expect(incomeTotals([income('2026-11-01', 150)], 'months', NOW)).toEqual({ sum: 150, change: null });
  });
});

describe('dayTitle', () => {
  it('names the near days and dates the rest', () => {
    expect(dayTitle('2026-11-05', NOW)).toBe('Сегодня');
    expect(dayTitle('2026-11-04', NOW)).toBe('Вчера');
    expect(dayTitle('2026-10-30', NOW)).toBe('30 октября');
    expect(dayTitle('2025-10-30', NOW)).toContain('2025');
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
