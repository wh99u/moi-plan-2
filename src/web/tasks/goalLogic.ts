import { addDays, addMonthsKeepDay, dayKey, daysBetween, parseDay } from '../../lib/dates';
import type { Goal, Task } from '../../lib/types';
import { plural } from '../reminders';
import { MONTH_WORD, dateFromWords, word } from './logic';

/*
 * Long goals: weeks and months, not hours. What they count is what is left of their time and how
 * many of the tasks tied to them are done.
 */

const NUMBERS: Record<string, number> = { один: 1, одну: 1, одна: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10 };
const COUNT = `\\d{1,3}|${Object.keys(NUMBERS).join('|')}`;
const UNIT = 'день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев|год|года|лет';

const countOf = (raw?: string) => (raw ? (NUMBERS[raw.toLowerCase()] ?? Number(raw)) : 1);

/** Adds that many of the named unit to a day. */
function after(today: string, n: number, unit: string): string {
  const u = unit.toLowerCase();
  if (u.startsWith('нед')) return dayKey(addDays(parseDay(today), n * 7));
  if (u.startsWith('мес')) return addMonthsKeepDay(today, n);
  if (u.startsWith('год') || u === 'лет') return addMonthsKeepDay(today, n * 12);
  return dayKey(addDays(parseDay(today), n));
}

export interface GoalLine {
  title: string;
  end: string;
  /** No term was named, so the usual month was taken. */
  guessed: boolean;
}

/** «Выучить английский за 3 месяца», «похудеть до 20 декабря»: the term is read out of the line. */
export function parseGoal(line: string, now: Date): GoalLine | null {
  const today = dayKey(now);
  let text = ` ${line} `;
  let end: string | undefined;
  const take = (re: RegExp, then: (m: RegExpMatchArray) => string | undefined) => {
    const m = text.match(re);
    if (!m) return false;
    text = text.replace(m[0], ' ');
    end = then(m);
    return true;
  };

  void (
    take(word('(?:(?:за|на) )?полгода'), () => addMonthsKeepDay(today, 6)) ||
    take(word(`(?:за |на |в течение )?(${COUNT}) (${UNIT})`), (m) => after(today, countOf(m[1]), m[2])) ||
    take(word(`(?:за|на|в течение) (${UNIT})`), (m) => after(today, 1, m[1])) ||
    take(word('до конца (недели|месяца|года)'), (m) => {
      const d = parseDay(today);
      if (m[1].startsWith('нед')) return dayKey(addDays(d, (7 - d.getDay()) % 7));
      if (m[1].startsWith('мес')) return dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      return dayKey(new Date(d.getFullYear(), 11, 31));
    }) ||
    take(word(`(?:до|к) (\\d{1,2}) (${MONTH_WORD})`), (m) => dateFromWords(Number(m[1]), m[2], today)) ||
    take(word('(?:до|к) (\\d{1,2})[./](\\d{1,2})'), (m) => dateFromWords(Number(m[1]), Number(m[2]) - 1, today))
  );

  const title = text.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  return { title: title[0].toUpperCase() + title.slice(1), end: end ?? addMonthsKeepDay(today, 1), guessed: !end };
}

export type Pace = 'ahead' | 'on' | 'behind';

export interface GoalState {
  daysTotal: number;
  daysPassed: number;
  /** Below zero once the term is over. */
  daysLeft: number;
  /** Of the time, 0…1. */
  time: number;
  steps: Task[];
  stepsDone: number;
  /** Of the steps, 0…1; null while there are none. */
  share: number | null;
  /** Null while there is nothing to compare. */
  pace: Pace | null;
}

const AHEAD = 0.1;
const BEHIND = 0.15;

export function goalState(goal: Goal, tasks: Task[], now: Date): GoalState {
  const from = parseDay(goal.start);
  const to = parseDay(goal.end);
  const daysTotal = Math.max(1, daysBetween(from, to));
  const daysPassed = Math.min(daysTotal, Math.max(0, daysBetween(from, now)));
  const time = daysPassed / daysTotal;
  const steps = tasks.filter((t) => t.goalId === goal.id);
  const stepsDone = steps.filter((t) => t.done).length;
  const share = steps.length ? stepsDone / steps.length : null;
  const pace = share === null ? null : share >= time + AHEAD ? 'ahead' : share <= time - BEHIND ? 'behind' : 'on';
  return { daysTotal, daysPassed, daysLeft: daysBetween(now, to), time, steps, stepsDone, share, pace };
}

export interface GoalMarks {
  unit: 'Неделя' | 'Месяц';
  count: number;
  /** Whole ones gone by. */
  passed: number;
}

const WEEKS_UP_TO = 182;
const MONTH = 30.44;

/** The term in cells: weeks, or months once there would be too many weeks to count at a glance. */
export function goalMarks({ daysTotal, daysPassed }: Pick<GoalState, 'daysTotal' | 'daysPassed'>): GoalMarks {
  const size = daysTotal <= WEEKS_UP_TO ? 7 : MONTH;
  const count = Math.max(1, Math.ceil(daysTotal / size));
  return { unit: size === 7 ? 'Неделя' : 'Месяц', count, passed: Math.min(count, Math.floor(daysPassed / size)) };
}

/** How much is left, in the unit that reads best at that distance. */
export function leftWords(daysLeft: number): string {
  if (daysLeft < 0) return 'Срок вышел';
  if (daysLeft === 0) return 'Последний день';
  if (daysLeft < 14) return `ещё ${daysLeft} ${plural(daysLeft, ['день', 'дня', 'дней'])}`;
  if (daysLeft < 60) {
    const w = Math.round(daysLeft / 7);
    return `ещё ${w} ${plural(w, ['неделя', 'недели', 'недель'])}`;
  }
  const m = Math.round(daysLeft / MONTH);
  return `ещё ${m} ${plural(m, ['месяц', 'месяца', 'месяцев'])}`;
}

/** Those still going, nearest term first. */
export const activeGoals = (goals: Goal[]) => goals.filter((g) => !g.doneAt).sort((a, b) => a.end.localeCompare(b.end));
