import { describe, expect, test } from 'vitest';
import { budgetSummary, dreamProgress, kf, monthAccruals, rub } from './money';
import type { BudgetMonth, Car, Shift, Spend } from './types';

describe('formatting', () => {
  test('rub groups with dots and keeps a no-break space', () => {
    expect(rub(5000)).toBe('5.000 ₽');
    expect(rub(0)).toBe('0 ₽');
    expect(rub(-1200.6)).toBe('-1.201 ₽');
  });
  test('kf compacts thousands', () => {
    expect(kf(1500)).toBe('1.5к');
    expect(kf(2000)).toBe('2к');
    expect(kf(800)).toBe('800');
  });
});

const cats = [
  { id: 'a', name: 'Еда', icon: 'food', color: '#30D158', limit: 10000 },
  { id: 'b', name: 'Транспорт', icon: 'bus', color: '#0A84FF', limit: 5000 },
];
const month: BudgetMonth = { id: '2026-10', ym: '2026-10', income: 20000, cats, updatedAt: 0 };
const spends: Spend[] = [
  { id: '1', ym: '2026-10', catId: 'a', amount: 12000, date: '2026-10-02', updatedAt: 0 },
  { id: '2', ym: '2026-10', catId: 'b', amount: 1000, date: '2026-10-03', updatedAt: 0 },
  { id: '3', ym: '2026-09', catId: 'a', amount: 999, date: '2026-09-03', updatedAt: 0 },
  { id: '4', ym: '2026-10', catId: 'b', amount: 777, date: '2026-10-04', updatedAt: 0, deleted: true },
];

describe('budgetSummary', () => {
  test('totals, leftover and per-day allowance for the current month', () => {
    const s = budgetSummary(month, spends, new Date(2026, 9, 17));
    expect(s).toMatchObject({ income: 20000, allocated: 15000, free: 5000, spent: 13000, left: 2000, daysLeft: 15 });
    expect(s.perDay).toBeCloseTo(2000 / 15);
    expect(s.cats[0]).toMatchObject({ spent: 12000, over: true, pct: 120 });
    expect(s.cats[1]).toMatchObject({ spent: 1000, over: false, pct: 20 });
  });
  test('no per-day allowance outside the current month', () => {
    const s = budgetSummary(month, spends, new Date(2026, 10, 1));
    expect(s.perDay).toBeNull();
    expect(s.daysLeft).toBeNull();
  });
  test('overspent month never gives a negative allowance', () => {
    const heavy = [...spends, { id: '5', ym: '2026-10', catId: 'b', amount: 9000, date: '2026-10-05', updatedAt: 0 }];
    const s = budgetSummary(month, heavy, new Date(2026, 9, 17));
    expect(s.left).toBe(-7000);
    expect(s.perDay).toBe(0);
  });
  test('missing month is all zeros', () => {
    expect(budgetSummary(undefined, [], new Date())).toMatchObject({ allocated: 0, spent: 0, left: 0, cats: [] });
  });
});

describe('accruals', () => {
  test('monthAccruals sums visible shift pay of the month', () => {
    const shifts: Shift[] = [
      { id: 'a', date: '2026-10-01', type: 'd', pay: 4500, h: 12, updatedAt: 0 },
      { id: 'b', date: '2026-10-30', type: 'n', pay: 5000, h: 12, updatedAt: 0 },
      { id: 'c', date: '2026-09-30', type: 'n', pay: 9999, h: 12, updatedAt: 0 },
      { id: 'd', date: '2026-10-02', type: 'd', pay: 1, h: 1, updatedAt: 0, deleted: true },
    ];
    expect(monthAccruals(shifts, '2026-10')).toBe(9500);
  });
});

describe('dreamProgress', () => {
  const car: Car = { name: 'Porsche Panamera', price: 100000, date: '2026-11-16', color: '#1c1c1e', updatedAt: 0 };
  const shifts: Shift[] = [{ id: 's', date: '2026-10-10', type: 'd', pay: 15000, h: 12, updatedAt: 0 }];

  test('progress, deadline pace and forecast', () => {
    const d = dreamProgress(car, 40000, shifts, new Date(2026, 9, 17));
    expect(d).toMatchObject({ left: 60000, pct: 40, daysToDeadline: 30, milestones: [true, false, false, false] });
    expect(d.perDay).toBe(2000);
    expect(d.perWeek).toBe(14000);
    expect(d.perMonth).toBe(60000);
    expect(d.forecastYm).toBe('2027-02');
  });
  test('reached goal clamps to 100% and has no pace', () => {
    const d = dreamProgress(car, 250000, shifts, new Date(2026, 9, 17));
    expect(d.pct).toBe(100);
    expect(d.left).toBe(0);
    expect(d.perDay).toBeNull();
    expect(d.forecastYm).toBeNull();
    expect(d.milestones).toEqual([true, true, true, true]);
  });
  test('no price means zero progress', () => {
    expect(dreamProgress({ ...car, price: 0 }, 1, [], new Date()).pct).toBe(0);
  });
  test('no income means no forecast, no date means no pace', () => {
    const d = dreamProgress({ ...car, date: '' }, 0, [], new Date(2026, 9, 17));
    expect(d.forecastYm).toBeNull();
    expect(d.daysToDeadline).toBeNull();
    expect(d.perDay).toBeNull();
  });
});
