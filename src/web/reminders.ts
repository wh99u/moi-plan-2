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

/** What is worth saying right now, most urgent first; a tip for the hour when nothing is. */
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
  if (out.length) return out;

  if (hour >= 23 || hour < 5) return ['Хороший сон — половина завтрашних дел'];
  if (hour < 12) return ['Запиши три главных дела, остальное подождёт'];
  if (hour < 18) return ['Сделай паузу: вода и пара минут без телефона'];
  return ['Что сегодня получилось? Перенеси остальное на завтра'];
}
