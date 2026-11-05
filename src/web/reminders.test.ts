import { describe, expect, it } from 'vitest';
import type { DueSub } from '../app/money/logic';
import type { Task } from '../lib/types';
import { buildReminders, plural } from './reminders';

const task = (title: string) => ({ title }) as Task;
const none = { open: [], late: [], tomorrow: [], due: [] };

describe('buildReminders', () => {
  it('puts a payment first, then late tasks, then today', () => {
    const late = task('Отчёт');
    const due = [{ sub: { name: 'Связь', amount: 500 }, days: 0, status: 'overdue' }] as unknown as DueSub[];
    const out = buildReminders({ hour: 10, open: [late, task('Звонок')], late: [late], tomorrow: [], due });
    expect(out[0]).toContain('Пора оплатить: Связь');
    expect(out[1]).toBe('1 задача просрочена. Начни с «Отчёт»');
    expect(out[2]).toBe('Не забудь: Звонок');
  });

  it('does not repeat a late task as a fresh one', () => {
    const late = task('Отчёт');
    const out = buildReminders({ ...none, hour: 10, open: [late], late: [late] });
    expect(out.filter((r) => r.includes('Отчёт'))).toHaveLength(1);
  });

  it('counts what is left for tomorrow', () => {
    expect(buildReminders({ ...none, hour: 10, tomorrow: [task('Врач'), task('Почта')] })[0]).toBe('Завтра: Врач и ещё 1');
  });

  it('always has several things to say, so a new visit can show a new one', () => {
    const out = buildReminders({ ...none, hour: 10 });
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBeGreaterThan(5);
  });

  it('gives a tip for the hour when the day is empty', () => {
    expect(buildReminders({ ...none, hour: 2 })[0]).toContain('сон');
    expect(buildReminders({ ...none, hour: 9 })[0]).toContain('три главных дела');
    expect(buildReminders({ ...none, hour: 15 })[0]).toContain('паузу');
    expect(buildReminders({ ...none, hour: 20 })[0]).toContain('получилось');
  });
});

describe('plural', () => {
  it('picks the Russian form', () => {
    const forms: [string, string, string] = ['задача', 'задачи', 'задач'];
    expect([1, 3, 5, 11, 21, 22].map((n) => plural(n, forms))).toEqual(['задача', 'задачи', 'задач', 'задач', 'задача', 'задачи']);
  });
});
