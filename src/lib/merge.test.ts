import { describe, expect, it } from 'vitest';
import { emptyState } from './defaults';
import { imageIds, mergeRecords, mergeStates, sameState } from './merge';
import type { Task } from './types';

const task = (id: string, updatedAt: number, o: Partial<Task> = {}) => ({ id, title: id, desc: '', due: '', done: false, updatedAt, ...o }) as Task;

describe('mergeRecords', () => {
  it('keeps what only one side has', () => {
    expect(mergeRecords([task('a', 1)], [task('b', 1)]).map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('takes the later change of a record', () => {
    expect(mergeRecords([task('a', 1, { title: 'old' })], [task('a', 2, { title: 'new' })])[0].title).toBe('new');
    expect(mergeRecords([task('a', 3, { title: 'mine' })], [task('a', 2, { title: 'theirs' })])[0].title).toBe('mine');
  });

  it('lets a later deletion through, and a later edit over an old deletion', () => {
    expect(mergeRecords([task('a', 1)], [task('a', 2, { deleted: true })])[0].deleted).toBe(true);
    expect(mergeRecords([task('a', 3)], [task('a', 2, { deleted: true })])[0].deleted).toBeUndefined();
  });
});

describe('mergeStates', () => {
  it('brings two devices to the same data, whichever merges first', () => {
    const a = emptyState(1);
    const b = emptyState(1);
    a.personal.tasks = [task('x', 5), task('y', 1, { title: 'old' })];
    b.personal.tasks = [task('y', 9, { title: 'new' }), task('z', 2)];
    a.shared.car = { ...a.shared.car, name: 'Порше', updatedAt: 10 };
    b.shared.car = { ...b.shared.car, name: 'Старое', updatedAt: 4 };
    const one = mergeStates(a, b);
    const two = mergeStates(b, a);
    expect(one.personal.tasks.find((t) => t.id === 'y')?.title).toBe('new');
    expect(one.shared.car.name).toBe('Порше');
    expect(sameState(one, { ...two, personal: { ...two.personal, settings: one.personal.settings, plan: one.personal.plan, processedLaunches: one.personal.processedLaunches } })).toBe(true);
  });

  it('survives a copy from an older version with lists missing', () => {
    const a = emptyState(1);
    const old = emptyState(1) as unknown as { personal: Record<string, unknown> };
    delete old.personal.goals;
    expect(() => mergeStates(a, old as never)).not.toThrow();
  });

  it('joins own categories', () => {
    const a = emptyState(1);
    const b = emptyState(1);
    a.personal.settings.spendCats = ['Кофе'];
    b.personal.settings.spendCats = ['Хобби'];
    expect(mergeStates(a, b).personal.settings.spendCats?.sort()).toEqual(['Кофе', 'Хобби']);
  });
});

it('finds the pictures in use', () => {
  const s = emptyState(1);
  s.shared.car.imgId = 'car';
  s.shared.buys = [
    { id: '1', title: '', url: '', price: 0, updatedAt: 1, imgId: 'a' },
    { id: '2', title: '', url: '', price: 0, updatedAt: 1, imgId: 'gone', deleted: true },
  ];
  expect(imageIds(s).sort()).toEqual(['a', 'car']);
});
