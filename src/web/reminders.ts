import { dueLabel, money, type DueSub } from '../app/money/logic';
import type { Task } from '../lib/types';

export const plural = (n: number, forms: [string, string, string]) => {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return forms[0];
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return forms[1];
  return forms[2];
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ReminderInput {
  hour: number;
  open: Task[];
  late: Task[];
  tomorrow: Task[];
  due: DueSub[];
}

/** Everything worth saying right now: what is urgent first, then a tip for the hour, then everyday ones. */
export function buildReminders({ hour, open, late, tomorrow, due }: ReminderInput): string[] {
  const out: string[] = [];
  for (const d of due.slice(0, 2)) {
    const head = d.status === 'overdue' ? 'Пора оплатить' : `${capital(dueLabel(d.days))} оплатить`;
    out.push(`${head}: ${d.sub.name}, ${money(d.sub.amount)}`);
  }
  if (late.length) {
    out.push(`${late.length} ${plural(late.length, ['задача просрочена', 'задачи просрочены', 'задач просрочено'])}. Начни с «${late[0].title}»`);
  }
  const fresh = open.filter((t) => !late.includes(t));
  if (fresh.length) out.push(`Не забудь: ${fresh[0].title}`);
  if (tomorrow.length) out.push(`Завтра: ${tomorrow[0].title}${tomorrow.length > 1 ? ` и ещё ${tomorrow.length - 1}` : ''}`);

  const forHour =
    hour >= 23 || hour < 5
      ? 'Хороший сон — половина завтрашних дел'
      : hour < 12
        ? 'Запиши три главных дела, остальное подождёт'
        : hour < 18
          ? 'Сделай паузу: вода и пара минут без телефона'
          : 'Что сегодня получилось? Перенеси остальное на завтра';
  return [...out, forHour, ...EVERYDAY];
}

/** Small things that are always true, so the line has something new to say on every visit. */
const EVERYDAY = [
  'Выпей стакан воды',
  'Разомни плечи и спину',
  'Проветри комнату',
  'Запиши сегодняшние покупки, пока помнишь',
  'Посмотри, что запланировано на завтра',
  'Напиши тому, кому давно собирался',
  'Убери одну мелочь, которая давно мешает',
  'Отложи телефон на пять минут',
];

const TURN_KEY = 'reminder_turn';

/** A number that grows with every look at the home screen, across visits too. */
export function nextReminderTurn() {
  let turn = Math.floor(Math.random() * 1000);
  try {
    const saved = Number(localStorage.getItem(TURN_KEY));
    if (saved) turn = saved + 1;
    localStorage.setItem(TURN_KEY, String(turn));
  } catch {
    /* private mode: the random start still gives a different line */
  }
  return turn;
}
