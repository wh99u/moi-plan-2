import { describe, expect, it } from 'vitest';
import type { Goal, Task } from '../../lib/types';
import { activeGoals, goalMarks, goalState, leftWords, parseGoal } from './goalLogic';
import { focusLeft, minutesToBank } from './focusTimer';

const NOW = new Date(2026, 10, 5, 12);
const goal = (over: Partial<Goal> = {}): Goal => ({ id: 'g', title: 'Цель', start: '2026-11-01', end: '2027-01-24', updatedAt: 0, ...over });
const task = (done: boolean, goalId = 'g'): Task => ({ id: String(Math.random()), title: 'Шаг', desc: '', due: '', done, goalId, updatedAt: 0 });

describe('parseGoal', () => {
  it.each([
    ['Выучить английский за 3 месяца', 'Выучить английский', '2027-02-05'],
    ['похудеть на 2 недели', 'Похудеть', '2026-11-19'],
    ['бегать три недели', 'Бегать', '2026-11-26'],
    ['накопить за год', 'Накопить', '2027-11-05'],
    ['ремонт за полгода', 'Ремонт', '2027-05-05'],
    ['дочитать книгу до 20 декабря', 'Дочитать книгу', '2026-12-20'],
    ['сдать проект к 15.01', 'Сдать проект', '2027-01-15'],
    ['закрыть хвосты до конца месяца', 'Закрыть хвосты', '2026-11-30'],
    ['закрыть год до конца года', 'Закрыть год', '2026-12-31'],
  ])('%s', (line, title, end) => {
    expect(parseGoal(line, NOW)).toMatchObject({ title, end, guessed: false });
  });

  it('takes a month when no term is named', () => {
    expect(parseGoal('сходить за хлебом', NOW)).toEqual({ title: 'Сходить за хлебом', end: '2026-12-05', guessed: true });
  });

  it('wants a name', () => {
    expect(parseGoal('за 3 месяца', NOW)).toBeNull();
  });
});

describe('goalState', () => {
  it('counts the time gone and the steps done', () => {
    const s = goalState(goal(), [task(true), task(false), task(false, 'other')], NOW);
    expect(s.daysTotal).toBe(84);
    expect(s.daysPassed).toBe(4);
    expect(s.daysLeft).toBe(80);
    expect(s.stepsDone).toBe(1);
    expect(s.share).toBe(0.5);
    expect(s.pace).toBe('ahead');
  });

  it('has no pace without steps', () => {
    expect(goalState(goal(), [], NOW)).toMatchObject({ share: null, pace: null });
  });

  it('falls behind when the time goes faster than the steps', () => {
    const s = goalState(goal({ start: '2026-08-01', end: '2026-12-01' }), [task(false), task(false)], NOW);
    expect(s.pace).toBe('behind');
  });

  it('stays inside the term once it is over', () => {
    const s = goalState(goal({ start: '2026-10-01', end: '2026-10-31' }), [], NOW);
    expect(s.time).toBe(1);
    expect(s.daysLeft).toBeLessThan(0);
  });
});

describe('goalMarks', () => {
  it('counts weeks for a short term', () => {
    expect(goalMarks({ daysTotal: 84, daysPassed: 15 })).toEqual({ unit: 'Неделя', count: 12, passed: 2 });
  });
  it('counts months for a long one', () => {
    expect(goalMarks({ daysTotal: 365, daysPassed: 65 })).toMatchObject({ unit: 'Месяц', count: 12, passed: 2 });
  });
});

describe('leftWords', () => {
  it.each([
    [-1, 'Срок вышел'],
    [0, 'Последний день'],
    [1, 'ещё 1 день'],
    [3, 'ещё 3 дня'],
    [11, 'ещё 11 дней'],
    [21, 'ещё 3 недели'],
    [35, 'ещё 5 недель'],
    [91, 'ещё 3 месяца'],
  ])('%i', (n, words) => {
    expect(leftWords(n)).toBe(words);
  });
});

it('goes by the nearest term and leaves out the reached ones', () => {
  const list = activeGoals([goal({ id: 'a', end: '2027-03-01' }), goal({ id: 'b', end: '2026-12-01' }), goal({ id: 'c', end: '2026-11-10', doneAt: '2026-11-05' })]);
  expect(list.map((g) => g.id)).toEqual(['b', 'a']);
});

describe('focus timer', () => {
  it('counts to a moment on the clock while running, and holds on pause', () => {
    expect(focusLeft({ left: 1000, endsAt: 5000 }, 2000)).toBe(3000);
    expect(focusLeft({ left: 1000, endsAt: 5000 }, 9000)).toBe(0);
    expect(focusLeft({ left: 1000, endsAt: null }, 9000)).toBe(1000);
  });

  it('writes down only the minutes not yet written', () => {
    const t = { total: 25 * 60_000, left: 15 * 60_000, endsAt: null, banked: 4 };
    expect(minutesToBank(t, 0)).toBe(6);
    expect(minutesToBank({ ...t, banked: 10 }, 0)).toBe(0);
  });
});
