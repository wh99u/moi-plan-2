import { addDays, addMonthsKeepDay, dayKey, parseDay } from '../../lib/dates';
import type { Priority, Repeat, Shift, Task } from '../../lib/types';

/*
 * What makes the tasks screen TickTick-like and has no screen in it: reading a date out of a typed
 * line, sorting into smart lists and the matrix, laying a day out in hours.
 */

export interface Quick {
  title: string;
  /** Only when the line named a day. */
  due?: string;
  time?: string;
  minutes?: number;
  priority?: Priority;
  tags: string[];
  repeat?: Repeat;
}

/** `\b` knows nothing of Cyrillic, so word edges are spelled out. */
export const word = (src: string) => new RegExp(`(?<![а-яёa-z0-9])(?:${src})(?![а-яёa-z0-9])`, 'i');
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (h: number, m = 0) => `${pad(h)}:${pad(m)}`;
export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const WEEKDAYS: [RegExp, number][] = [[/^пон|^пн/, 1], [/^вто|^вт/, 2], [/^сре|^ср/, 3], [/^чет|^чт/, 4], [/^пят|^пт/, 5], [/^суб|^сб/, 6], [/^вос|^вс/, 0]];
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const MONTH_WORD = 'январ[яь]|феврал[яь]|марта?|апрел[яь]|ма[яй]|июн[яь]|июл[яь]|августа?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь]';

/** The nearest such date, this year or the next. */
function nextDate(day: number, month: number, today: string): string | undefined {
  if (day < 1 || day > 31 || month < 0 || month > 11) return undefined;
  const year = Number(today.slice(0, 4));
  const key = dayKey(new Date(year, month, day));
  return key >= today ? key : dayKey(new Date(year + 1, month, day));
}

/** The same from a month named in words or by its index. */
export const dateFromWords = (day: number, month: string | number, today: string) => nextDate(day, typeof month === 'number' ? month : MONTHS.findIndex((p) => month.toLowerCase().startsWith(p)), today);

/**
 * A line as it is typed, «Купить хлеб завтра в 15 !! #дом», taken apart. What was understood is
 * removed from the title; null when no title is left. With `day` given, a time alone belongs to that day.
 */
export function parseQuick(line: string, now: Date, day?: string): (Quick & { title: string }) | null {
  const today = dayKey(now);
  let text = ` ${line} `;
  const take = (re: RegExp, then: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (!m) return false;
    text = text.replace(m[0], ' ');
    then(m);
    return true;
  };
  const out: Quick = { title: '', tags: [] };

  for (let more = true; more; ) {
    more = take(/(?<=\s)#([^\s#]+)/, (m) => out.tags.push(m[1]));
  }
  take(/(?<=\s)(!{1,3})(?=\s)/, (m) => (out.priority = m[1].length as Priority));

  take(word('каждый день|ежедневно'), () => (out.repeat = 'd')) || take(word('каждую неделю|еженедельно'), () => (out.repeat = 'w')) || take(word('каждый месяц|ежемесячно'), () => (out.repeat = 'm'));

  const after = (n: number) => dayKey(addDays(now, n));
  take(word('послезавтра'), () => (out.due = after(2))) ||
    take(word('завтра'), () => (out.due = after(1))) ||
    take(word('сегодня'), () => (out.due = today)) ||
    take(word('через (\\d+ )?(день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев)'), (m) => {
      const n = Number(m[1] ?? 1);
      out.due = m[2].startsWith('нед') ? after(n * 7) : m[2].startsWith('мес') ? addMonthsKeepDay(today, n) : after(n);
    }) ||
    take(word('во? (понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|пн|вт|ср|чт|пт|сб|вс)'), (m) => {
      const target = WEEKDAYS.find(([re]) => re.test(m[1].toLowerCase()))![1];
      out.due = after((target - now.getDay() + 7) % 7 || 7);
    }) ||
    take(word(`(\\d{1,2}) (${MONTH_WORD})`), (m) => {
      out.due = dateFromWords(Number(m[1]), m[2], today);
    }) ||
    take(word('(\\d{1,2})[./](\\d{1,2})(?![:\\d])'), (m) => {
      out.due = nextDate(Number(m[1]), Number(m[2]) - 1, today);
    });

  const hour = (raw: string, part?: string) => {
    const h = Number(raw);
    const p = part?.toLowerCase();
    if ((p === 'дня' || p === 'вечера') && h < 12) return h + 12;
    if (p === 'ночи' && h === 12) return 0;
    return h;
  };
  take(word('с (\\d{1,2})(?:[:.](\\d{2}))? до (\\d{1,2})(?:[:.](\\d{2}))?'), (m) => {
    const from = Number(m[1]) * 60 + Number(m[2] ?? 0);
    const to = Number(m[3]) * 60 + Number(m[4] ?? 0);
    out.time = clock(Number(m[1]), Number(m[2] ?? 0));
    if (to > from) out.minutes = to - from;
  }) ||
    take(word('в (\\d{1,2})(?:[:.](\\d{2}))?(?: (утра|дня|вечера|ночи))?'), (m) => {
      const h = hour(m[1], m[3]);
      if (h <= 23) out.time = clock(h, Number(m[2] ?? 0));
    }) ||
    take(word('(\\d{1,2}):(\\d{2})'), (m) => {
      if (Number(m[1]) <= 23) out.time = clock(Number(m[1]), Number(m[2]));
    }) ||
    take(word('утром'), () => (out.time = clock(9))) ||
    take(word('дн[её]м'), () => (out.time = clock(14))) ||
    take(word('вечером'), () => (out.time = clock(19)));

  // A time alone means the next time it comes round.
  if (!day && out.time && !out.due && toMinutes(out.time) <= now.getHours() * 60 + now.getMinutes()) out.due = after(1);
  if (!day && out.time && !out.due) out.due = today;

  const title = text.replace(/\s+/g, ' ').trim();
  if (!title) return null;
  return { ...out, title: title[0].toUpperCase() + title.slice(1) };
}

/** Marks it done; a repeating one comes back on its next day, as a new task, so what was done stays. */
export function nextRepeat(task: Task): string | null {
  if (!task.repeat || !task.due) return null;
  if (task.repeat === 'd') return dayKey(addDays(parseDay(task.due), 1));
  if (task.repeat === 'w') return dayKey(addDays(parseDay(task.due), 7));
  return addMonthsKeepDay(task.due, 1);
}

export interface Group {
  id: string;
  label: string;
  tasks: Task[];
}

const inOrder = (a: Task, b: Task) => (b.priority ?? 0) - (a.priority ?? 0) || (a.due || '9').localeCompare(b.due || '9') || (a.time ?? '99').localeCompare(b.time ?? '99') || a.updatedAt - b.updatedAt;

/** The smart lists. Empty ones are left out. */
export function smartGroups(tasks: Task[], today: Date): Group[] {
  const t = dayKey(today);
  const tomorrow = dayKey(addDays(today, 1));
  const week = dayKey(addDays(today, 7));
  const open = tasks.filter((x) => !x.done);
  const groups: Group[] = [
    { id: 'late', label: 'Просрочено', tasks: open.filter((x) => x.due && x.due < t) },
    { id: 'today', label: 'Сегодня', tasks: open.filter((x) => x.due === t) },
    { id: 'tomorrow', label: 'Завтра', tasks: open.filter((x) => x.due === tomorrow) },
    { id: 'week', label: 'Следующие 7 дней', tasks: open.filter((x) => x.due > tomorrow && x.due <= week) },
    { id: 'later', label: 'Позже', tasks: open.filter((x) => x.due > week) },
    { id: 'none', label: 'Без даты', tasks: open.filter((x) => !x.due) },
    { id: 'done', label: 'Выполнено', tasks: tasks.filter((x) => x.done) },
  ];
  return groups.filter((g) => g.tasks.length).map((g) => ({ ...g, tasks: [...g.tasks].sort(inOrder) }));
}

export type Quadrant = 'do' | 'plan' | 'hand' | 'drop';

/** Eisenhower's four boxes: important is a high priority, urgent is due by tomorrow. */
export function quadrantOf(task: Task, today: Date): Quadrant {
  const important = (task.priority ?? 0) >= 2;
  const urgent = !!task.due && task.due <= dayKey(addDays(today, 1));
  return important ? (urgent ? 'do' : 'plan') : urgent ? 'hand' : 'drop';
}

export const DEFAULT_MINUTES = 60;

export const shiftName = (type: Shift['type']) => (type === 'n' ? 'Ночная' : 'Дневная');
/** «12», «11,5». */
export const hoursText = (h: number) => String(Math.round(h * 10) / 10).replace('.', ',');

/** The month's shifts in order of days, and what they add up to. */
export function monthShifts(shifts: Shift[], ym: string) {
  const list = shifts.filter((s) => s.date.startsWith(ym)).sort((a, b) => a.date.localeCompare(b.date));
  return { list, hours: list.reduce((t, s) => t + s.h, 0), pay: list.reduce((t, s) => t + s.pay, 0) };
}

/** The latest shift of this kind. */
export const lastShift = (shifts: Shift[], type: Shift['type']) => shifts.filter((s) => s.type === type).reduce<Shift | undefined>((last, s) => (!last || s.date > last.date ? s : last), undefined);

export interface Placed {
  task: Task;
  /** Minutes from midnight. */
  from: number;
  length: number;
  col: number;
  cols: number;
}

/** Side by side where they overlap; each cluster of overlapping tasks shares the width. */
export function layoutDay(tasks: Task[]): Placed[] {
  const timed = tasks
    .filter((t) => t.time)
    .map((task) => ({ task, from: toMinutes(task.time!), length: task.minutes || DEFAULT_MINUTES }))
    .sort((a, b) => a.from - b.from || b.length - a.length);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let ends = -1;
  const close = () => {
    const cols = Math.max(0, ...cluster.map((p) => p.col)) + 1;
    cluster.forEach((p) => (p.cols = cols));
    out.push(...cluster);
    cluster = [];
  };
  for (const t of timed) {
    if (t.from >= ends) {
      close();
      ends = -1;
    }
    let col = 0;
    while (cluster.some((p) => p.col === col && p.from + p.length > t.from)) col++;
    cluster.push({ ...t, col, cols: 1 });
    ends = Math.max(ends, t.from + t.length);
  }
  close();
  return out;
}

/** Longer than this between two tasks is no longer a pause: the hours are simply free. */
export const REST_MAX = 180;

/** The pauses between one task's end and the next one's start in a day, in minutes from midnight. */
export function restZones(placed: Pick<Placed, 'from' | 'length'>[]): { from: number; to: number }[] {
  const spans = placed.map((p) => [p.from, p.from + p.length] as const).sort((a, b) => a[0] - b[0]);
  const out: { from: number; to: number }[] = [];
  let end = -1;
  for (const [from, to] of spans) {
    if (end >= 0 && from > end && from - end <= REST_MAX) out.push({ from: end, to: from });
    end = Math.max(end, to);
  }
  return out;
}

/** The month's page: whole weeks from Monday, with the neighbours' days filling the first and last. */
export function monthCells(ym: string): string[] {
  const first = parseDay(`${ym}-01`);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => dayKey(addDays(start, i)));
  return cells[35].startsWith(ym) ? cells : cells.slice(0, 35);
}

/** The views of the hours: one day, three days and a week. */
export const SPANS = [1, 3, 7] as const;

export const nearestSpan = (z: number): number => SPANS.reduce<number>((best, n) => (Math.abs(n - z) < Math.abs(best - z) ? n : best), SPANS[0]);

/** The Monday of that week. */
export function weekStart(key: string): string {
  const d = parseDay(key);
  return dayKey(addDays(d, -((d.getDay() + 6) % 7)));
}

/** The first day shown when the window of `span` days holds this one. */
export const pageStart = (key: string, span: number) => (span === 7 ? weekStart(key) : key);

/** Past this share of the window a slow swipe turns the page. */
const TURN_SHARE = 0.22;
/** Faster than this a flick turns it however short it was, px per ms. */
const TURN_SPEED = 0.35;

/**
 * Where a swipe ends: always exactly one page, or none. `offset` is how far the ribbon has moved,
 * `speed` how fast the finger was going. Moving left brings later days: +1.
 */
export function turnPages(offset: number, width: number, speed: number): -1 | 0 | 1 {
  if (!width) return 0;
  if (Math.abs(speed) >= TURN_SPEED) {
    // A flick back against the way it was dragged puts the page back.
    if (offset * speed < 0) return 0;
    return speed < 0 ? 1 : -1;
  }
  if (Math.abs(offset) < width * TURN_SHARE) return 0;
  return offset < 0 ? 1 : -1;
}

/** «08:00 – 09:30», or just the start for a task with no length. */
export function timeRange(task: Pick<Task, 'time' | 'minutes'>): string {
  if (!task.time) return '';
  if (!task.minutes) return task.time;
  const end = (toMinutes(task.time) + task.minutes) % (24 * 60);
  return `${task.time} – ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** How many of the tasks due between two days, both included, are done. */
export function progressBetween(tasks: Task[], from: string, to: string): { done: number; all: number } {
  const inside = tasks.filter((t) => t.due && t.due >= from && t.due <= to);
  return { done: inside.filter((t) => t.done).length, all: inside.length };
}

/** The four tiles over today's plan; urgent is the top priority today and anything overdue. */
export function todayStats(tasks: Task[], today: string) {
  const mine = tasks.filter((t) => t.due === today);
  const done = mine.filter((t) => t.done).length;
  const urgent = tasks.filter((t) => !t.done && t.due && (t.due < today || (t.due === today && (t.priority ?? 0) >= 3))).length;
  return { all: mine.length, done, left: mine.length - done, urgent };
}
