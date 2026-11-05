import { describe, expect, it } from 'vitest';
import type { Buy, Car, Income, Spend } from '../../lib/types';
import { dreamPlan, hasDream, isBlankBuy, monthlyPace, splitBuys, usablePhoto } from './logic';

const NOW = new Date(2026, 10, 5, 12);
const car = (o: Partial<Car>) => ({ name: 'Porsche 911', price: 1_000_000, date: '', color: '', updatedAt: 0, ...o }) as Car;
const buy = (id: string, o: Partial<Buy> = {}) => ({ id, title: id, url: '', price: 1, updatedAt: 0, ...o }) as Buy;

describe('monthlyPace', () => {
  const income = (date: string, amount: number) => ({ date, amount }) as Income;
  const spend = (date: string, amount: number) => ({ date, amount }) as Spend;

  it('averages what is left over the last three months', () => {
    const pace = monthlyPace([income('2026-10-01', 300000)], [spend('2026-10-02', 60000)], NOW)!;
    expect(pace).toBeGreaterThan(79000);
    expect(pace).toBeLessThan(82000);
  });

  it('ignores anything older', () => {
    expect(monthlyPace([income('2026-01-01', 300000)], [], NOW)).toBeNull();
  });

  it('has no pace when nothing is left over', () => {
    expect(monthlyPace([income('2026-10-01', 100)], [spend('2026-10-02', 500)], NOW)).toBeNull();
    expect(monthlyPace([], [], NOW)).toBeNull();
  });
});

describe('dreamPlan', () => {
  it('counts the days to save at the worked-out pace', () => {
    const p = dreamPlan(car({ saved: 400_000 }), 100_000, NOW);
    expect(p.left).toBe(600_000);
    expect(p.share).toBeCloseTo(0.4);
    expect(p.daysToSave).toBe(183);
  });

  it('prefers a pace set by hand', () => {
    expect(dreamPlan(car({ pace: 500_000 }), 100_000, NOW).daysToSave).toBe(61);
  });

  it('has nothing to count without a pace', () => {
    expect(dreamPlan(car({}), null, NOW).daysToSave).toBeNull();
  });

  it('is done when all is saved', () => {
    const p = dreamPlan(car({ saved: 2_000_000, date: '2026-11-15' }), null, NOW);
    expect(p).toMatchObject({ left: 0, share: 1, daysToSave: 0, daysLeft: 10, needed: null });
  });

  it('says how much is needed when the pace misses the date', () => {
    const p = dreamPlan(car({ date: '2027-01-04' }), 100_000, NOW);
    expect(p.daysLeft).toBe(60);
    expect(p.needed).toBeGreaterThan(500_000);
  });

  it('asks for nothing extra when the pace makes it', () => {
    expect(dreamPlan(car({ date: '2030-01-01' }), 100_000, NOW).needed).toBeNull();
  });
});

describe('hasDream', () => {
  it('does not take the placeholder of a new account for a dream', () => {
    expect(hasDream(car({ price: 0 }))).toBe(false);
    expect(hasDream(car({ price: 5 }))).toBe(true);
    expect(hasDream(car({ price: 0, imgId: 'x' }))).toBe(true);
  });
});

describe('splitBuys', () => {
  it('leaves bought ones out', () => {
    const { main, rest } = splitBuys([buy('a', { boughtAt: 1 }), buy('b')]);
    expect(main.map((b) => b.id)).toEqual(['b']);
    expect(rest).toEqual([]);
  });

  it('puts the brought-up ones first, newest first, then the nearest deadlines', () => {
    const { main, rest } = splitBuys([
      buy('late', { due: '2027-01-01' }),
      buy('soon', { due: '2026-12-01' }),
      buy('old', { pinned: 1 }),
      buy('new', { pinned: 2 }),
      buy('free'),
    ]);
    expect(main.map((b) => b.id)).toEqual(['new', 'old', 'soon']);
    expect(rest.map((b) => b.id)).toEqual(['late', 'free']);
  });

  it('keeps only the newest three up, the others go below', () => {
    const list = [1, 2, 3, 4].map((n) => buy(`p${n}`, { pinned: n }));
    const { main, rest } = splitBuys(list);
    expect(main.map((b) => b.id)).toEqual(['p4', 'p3', 'p2']);
    expect(rest.map((b) => b.id)).toEqual(['p1']);
  });
});

describe('usablePhoto', () => {
  it('wants a whole photo, not a cut-out', () => {
    expect(usablePhoto(car({ imgId: 'a' }))).toBe(true);
    expect(usablePhoto(car({ imgId: 'a', cut: true }))).toBe(false);
    expect(usablePhoto(car({}))).toBe(false);
  });
});

describe('isBlankBuy', () => {
  it('is a purchase nothing was written into', () => {
    expect(isBlankBuy(buy('a', { title: ' ', price: 0 }))).toBe(true);
  });

  it('keeps anything with a name, a link, a price or a note', () => {
    expect(isBlankBuy(buy('a', { title: 'Пылесос', price: 0 }))).toBe(false);
    expect(isBlankBuy(buy('a', { title: '', price: 100 }))).toBe(false);
    expect(isBlankBuy(buy('a', { title: '', price: 0, url: 'https://x.ru' }))).toBe(false);
    expect(isBlankBuy(buy('a', { title: '', price: 0, note: 'синий' }))).toBe(false);
  });
});
