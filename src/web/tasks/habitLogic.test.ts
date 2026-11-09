import { describe, expect, it } from 'vitest';
import type { Habit } from '../../lib/types';
import { dayShare, doneOn, fullDays, inPart, isTimed, nextMark, streak } from './habitLogic';

const habit = (marks: Record<string, number>, target = 2, part?: Habit['part']): Habit => ({ id: 'h', updatedAt: 0, title: 'Вода', icon: 'heart', target, unit: 'стаканов', part, marks });

describe('habits', () => {
  it('is done once the whole amount is there', () => {
    expect(doneOn(habit({ '2026-11-09': 2 }), '2026-11-09')).toBe(true);
    expect(doneOn(habit({ '2026-11-09': 1 }), '2026-11-09')).toBe(false);
  });

  it('counts up and starts over after the whole amount', () => {
    expect(nextMark(habit({}), '2026-11-09')).toBe(1);
    expect(nextMark(habit({ '2026-11-09': 1 }), '2026-11-09')).toBe(2);
    expect(nextMark(habit({ '2026-11-09': 2 }), '2026-11-09')).toBe(0);
  });

  it('keeps a streak that today has not broken yet', () => {
    const h = habit({ '2026-11-07': 2, '2026-11-08': 2 });
    expect(streak(h, '2026-11-09')).toBe(2);
    expect(streak({ ...h, marks: { ...h.marks, '2026-11-09': 2 } }, '2026-11-09')).toBe(3);
    expect(streak(habit({ '2026-11-07': 2 }), '2026-11-09')).toBe(0);
  });

  it('shares a day out between the habits, a part of one counting as a part', () => {
    const a = habit({ '2026-11-09': 2 });
    const b = { ...habit({ '2026-11-09': 1 }), id: 'b' };
    expect(dayShare([a, b], '2026-11-09')).toBe(0.75);
    expect(dayShare([], '2026-11-09')).toBeNull();
    expect(fullDays([a], ['2026-11-08', '2026-11-09', '2026-11-10'], '2026-11-09')).toBe(1);
  });

  it('shows the habits for any time in every part of the day', () => {
    const list = [habit({}, 1, 'morning'), { ...habit({}, 1), id: 'any' }, { ...habit({}, 1, 'evening'), id: 'eve' }];
    expect(inPart(list, 'morning').map((h) => h.id)).toEqual(['h', 'any']);
    expect(inPart(list, 'all')).toHaveLength(3);
  });

  it('knows a habit measured in minutes', () => {
    expect(isTimed({ unit: 'минут' })).toBe(true);
    expect(isTimed({ unit: 'страниц' })).toBe(false);
  });
});
