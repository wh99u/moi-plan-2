import { describe, expect, it } from 'vitest';
import type { Shift, Task } from '../../lib/types';
import { hoursText, lastShift, layoutDay, monthCells, monthShifts, nextRepeat, parseQuick, quadrantOf, smartGroups } from './logic';

// Thursday, 5 November 2026, 12:30.
const NOW = new Date(2026, 10, 5, 12, 30);
const task = (id: string, o: Partial<Task> = {}) => ({ id, title: id, desc: '', due: '', done: false, updatedAt: 0, ...o }) as Task;

describe('parseQuick', () => {
  it('takes the day, the time, the priority and the tags out of the title', () => {
    expect(parseQuick('купить хлеб завтра в 15 !! #дом #еда', NOW)).toEqual({ title: 'Купить хлеб', due: '2026-11-06', time: '15:00', priority: 2, tags: ['дом', 'еда'] });
  });

  it('leaves a plain line alone', () => {
    expect(parseQuick('позвонить маме', NOW)).toEqual({ title: 'Позвонить маме', tags: [] });
  });

  it('knows days of the week, and today is not its own next', () => {
    expect(parseQuick('врач в пятницу', NOW)?.due).toBe('2026-11-06');
    expect(parseQuick('врач в четверг', NOW)?.due).toBe('2026-11-12');
    expect(parseQuick('врач во вторник', NOW)?.due).toBe('2026-11-10');
  });

  it('knows dates, moving a past one to next year', () => {
    expect(parseQuick('отчёт 20 ноября', NOW)?.due).toBe('2026-11-20');
    expect(parseQuick('отчёт 1 марта', NOW)?.due).toBe('2027-03-01');
    expect(parseQuick('отчёт 7 мая', NOW)?.due).toBe('2027-05-07');
    expect(parseQuick('отчёт 25.12', NOW)?.due).toBe('2026-12-25');
  });

  it('counts from today', () => {
    expect(parseQuick('сдать через 3 дня', NOW)?.due).toBe('2026-11-08');
    expect(parseQuick('сдать через неделю', NOW)?.due).toBe('2026-11-12');
    expect(parseQuick('сдать послезавтра', NOW)?.due).toBe('2026-11-07');
  });

  it('reads times in several ways', () => {
    expect(parseQuick('созвон в 9:30', NOW)).toMatchObject({ time: '09:30', due: '2026-11-06' });
    expect(parseQuick('созвон в 7 вечера', NOW)).toMatchObject({ time: '19:00', due: '2026-11-05' });
    expect(parseQuick('созвон с 15 до 16:30', NOW)).toMatchObject({ time: '15:00', minutes: 90, due: '2026-11-05' });
    expect(parseQuick('бегать утром', NOW)).toMatchObject({ title: 'Бегать', time: '09:00' });
  });

  it('a time already gone today means tomorrow, unless the day was named', () => {
    expect(parseQuick('созвон в 10', NOW)?.due).toBe('2026-11-06');
    expect(parseQuick('созвон сегодня в 10', NOW)?.due).toBe('2026-11-05');
  });

  it('does not see words inside words', () => {
    expect(parseQuick('завтрак', NOW)).toEqual({ title: 'Завтрак', tags: [] });
    expect(parseQuick('сегодняшний план', NOW)).toEqual({ title: 'Сегодняшний план', tags: [] });
  });

  it('reads repeats', () => {
    expect(parseQuick('зарядка каждый день', NOW)).toMatchObject({ title: 'Зарядка', repeat: 'd' });
  });

  it('gives nothing when only a date was typed', () => {
    expect(parseQuick('завтра в 15', NOW)).toBeNull();
    expect(parseQuick('   ', NOW)).toBeNull();
  });
});

describe('nextRepeat', () => {
  it('moves by the repeat', () => {
    expect(nextRepeat(task('a', { due: '2026-11-05', repeat: 'd' }))).toBe('2026-11-06');
    expect(nextRepeat(task('a', { due: '2026-11-05', repeat: 'w' }))).toBe('2026-11-12');
    expect(nextRepeat(task('a', { due: '2026-01-31', repeat: 'm' }))).toBe('2026-02-28');
  });

  it('does not repeat what does not', () => {
    expect(nextRepeat(task('a', { due: '2026-11-05' }))).toBeNull();
    expect(nextRepeat(task('a', { repeat: 'd' }))).toBeNull();
  });
});

describe('smartGroups', () => {
  const ids = (list: Task[]) => Object.fromEntries(smartGroups(list, NOW).map((g) => [g.id, g.tasks.map((t) => t.id)]));

  it('sorts by day, and leaves empty lists out', () => {
    expect(
      ids([
        task('old', { due: '2026-11-01' }),
        task('now', { due: '2026-11-05' }),
        task('next', { due: '2026-11-06' }),
        task('week', { due: '2026-11-10' }),
        task('far', { due: '2026-12-10' }),
        task('free'),
        task('did', { due: '2026-11-05', done: true }),
      ]),
    ).toEqual({ late: ['old'], today: ['now'], tomorrow: ['next'], week: ['week'], later: ['far'], none: ['free'], done: ['did'] });
  });

  it('puts high priority first, then the earlier time', () => {
    expect(ids([task('a', { due: '2026-11-05', time: '09:00' }), task('b', { due: '2026-11-05', priority: 3 }), task('c', { due: '2026-11-05', time: '08:00' })]).today).toEqual(['b', 'c', 'a']);
  });
});

describe('quadrantOf', () => {
  it('splits by priority and by how soon', () => {
    expect(quadrantOf(task('a', { priority: 3, due: '2026-11-05' }), NOW)).toBe('do');
    expect(quadrantOf(task('a', { priority: 2, due: '2026-12-01' }), NOW)).toBe('plan');
    expect(quadrantOf(task('a', { priority: 1, due: '2026-11-06' }), NOW)).toBe('hand');
    expect(quadrantOf(task('a'), NOW)).toBe('drop');
  });
});

describe('layoutDay', () => {
  it('leaves out what has no time', () => {
    expect(layoutDay([task('a')])).toEqual([]);
  });

  it('gives a free task the whole width, overlapping ones a share', () => {
    const placed = layoutDay([task('a', { time: '09:00', minutes: 60 }), task('b', { time: '09:30', minutes: 60 }), task('c', { time: '12:00' })]);
    expect(placed.map((p) => [p.task.id, p.col, p.cols])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 1]]);
  });

  it('uses a freed column again', () => {
    const placed = layoutDay([task('a', { time: '09:00', minutes: 120 }), task('b', { time: '09:30', minutes: 30 }), task('c', { time: '10:15', minutes: 30 })]);
    expect(placed.map((p) => p.col)).toEqual([0, 1, 1]);
  });

  it('does not count touching tasks as overlapping', () => {
    const placed = layoutDay([task('a', { time: '09:00', minutes: 60 }), task('b', { time: '10:00', minutes: 60 })]);
    expect(placed.map((p) => p.cols)).toEqual([1, 1]);
  });
});

describe('monthCells', () => {
  it('starts on a Monday and holds the whole month', () => {
    const cells = monthCells('2026-11');
    expect(cells[0]).toBe('2026-10-26');
    expect(cells).toContain('2026-11-30');
    expect(cells.length % 7).toBe(0);
  });

  it('takes five weeks when they are enough', () => {
    expect(monthCells('2026-10')).toHaveLength(35);
  });
});

describe('shifts', () => {
  const shift = (date: string, type: Shift['type'], h: number, pay: number): Shift => ({ id: date + type, date, type, h, pay, updatedAt: 0 });
  const all = [shift('2026-11-07', 'n', 12, 6000), shift('2026-11-02', 'd', 11.5, 5000), shift('2026-10-30', 'n', 8, 4000)];

  it('adds up one month, in order of days', () => {
    const m = monthShifts(all, '2026-11');
    expect(m.list.map((s) => s.date)).toEqual(['2026-11-02', '2026-11-07']);
    expect(m.hours).toBe(23.5);
    expect(m.pay).toBe(11000);
  });

  it('has nothing in an empty month', () => {
    expect(monthShifts(all, '2026-12')).toEqual({ list: [], hours: 0, pay: 0 });
  });

  it('finds the latest of a kind', () => {
    expect(lastShift(all, 'n')?.date).toBe('2026-11-07');
    expect(lastShift([], 'd')).toBeUndefined();
  });

  it('writes hours the Russian way', () => {
    expect(hoursText(12)).toBe('12');
    expect(hoursText(11.5)).toBe('11,5');
  });
});
