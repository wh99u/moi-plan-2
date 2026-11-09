import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { openSheet } from '../../app/sheet';
import { actions, useStore } from '../../lib/appStore';
import { addDays, dayKey, parseDay } from '../../lib/dates';
import { rub } from '../../lib/money';
import { visible } from '../../lib/records';
import type { Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Plate, PlateRow } from '../Plate';
import { plural } from '../reminders';
import { navigate } from '../route';
import { pulseWave } from '../Wave';
import { dayShare } from './habitLogic';
import { DEFAULT_MINUTES, hoursText, parseQuick, shiftName, timeRange } from './logic';
import { ShiftGlyph } from './ShiftGlyph';
import { completeTask } from './TaskWindow';

const inTimeOrder = (a: Task, b: Task) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99');

function dayNote(day: string, today: Date) {
  const t = dayKey(today);
  if (day === t) return 'Сегодня';
  if (day === dayKey(addDays(today, 1))) return 'Завтра';
  if (day === dayKey(addDays(today, -1))) return 'Вчера';
  return parseDay(day).toLocaleDateString('ru-RU', { year: 'numeric' });
}

/** Everything about one day in a small window: what to do, the shifts, the habits, the money. */
export function DayPlate({ day, onClose, onHours, onOpenTask }: { day: string | null; onClose: () => void; onHours: (day: string) => void; onOpenTask: (t: Task) => void }) {
  const [shown, setShown] = useState(day);
  if (day && day !== shown) setShown(day);
  const key = day ?? shown;
  return (
    <Plate
      open={!!day}
      stage={key ?? undefined}
      title={key ? parseDay(key).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()) : ''}
      note={key ? dayNote(key, new Date()) : undefined}
      onClose={onClose}
      action={key ? { label: 'Открыть по часам', onClick: () => onHours(key) } : undefined}
    >
      {key && <Inside key={key} day={key} onClose={onClose} onOpenTask={onOpenTask} />}
    </Plate>
  );
}

function Inside({ day, onClose, onOpenTask }: { day: string; onClose: () => void; onOpenTask: (t: Task) => void }) {
  const [text, setText] = useState('');
  const tasks = visible(useStore((s) => s.personal.tasks)).filter((t) => t.due === day).sort(inTimeOrder);
  const shifts = visible(useStore((s) => s.personal.shifts)).filter((s) => s.date === day);
  const habits = visible(useStore((s) => s.personal.habits));
  const spent = visible(useStore((s) => s.shared.spends)).filter((s) => s.date === day).reduce((t, s) => t + s.amount, 0);
  const toBuy = visible(useStore((s) => s.shared.buys)).filter((b) => b.due === day && !b.boughtAt);
  const share = dayShare(habits, day);
  const done = tasks.filter((t) => t.done).length;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const q = parseQuick(text, new Date(), day);
    if (!q) return;
    actions.addTask({ title: q.title, desc: '', due: q.due ?? day, time: q.time, minutes: q.minutes ?? (q.time ? DEFAULT_MINUTES : undefined), priority: q.priority, tags: q.tags.length ? q.tags : undefined, repeat: q.repeat });
    pulseWave();
    setText('');
  };
  // A sheet goes over the page, not over this window.
  const sheet = (...args: Parameters<typeof openSheet>) => {
    onClose();
    openSheet(...args);
  };

  let row = 0;
  return (
    <>
      <PlateRow label="Задачи" index={row++} wide>
        {tasks.length ? (
          <>
            <div className="plate-meter">
              <i style={{ transform: `scaleX(${tasks.length ? done / tasks.length : 0})` }} />
              <span>
                {done} из {tasks.length}
              </span>
            </div>
            <ul className="plate-tasks">
              {tasks.map((t) => (
                <li key={t.id} className={`p${t.priority ?? 0}${t.done ? ' is-done' : ''}`}>
                  <motion.button type="button" className="check" aria-pressed={t.done} aria-label={t.done ? `Вернуть «${t.title}»` : `Готово: «${t.title}»`} onClick={() => completeTask(t)} whileTap={{ scale: 0.8 }}>
                    <Icon name="check" size={12} stroke={3} />
                  </motion.button>
                  <button type="button" className="plate-task" onClick={() => onOpenTask(t)}>
                    <span>{t.title}</span>
                    {t.time && <small>{timeRange(t)}</small>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className="plate-dim">Свободный день</span>
        )}
      </PlateRow>
      <PlateRow label="Добавить" index={row++}>
        <form onSubmit={add}>
          <input className="plate-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Задача, можно «в 15 !!»" aria-label="Новая задача на этот день" enterKeyHint="done" maxLength={200} />
        </form>
      </PlateRow>
      <PlateRow label="Смены" index={row++}>
        <div className="plate-chips">
          {shifts.map((s) => (
            <button key={s.id} type="button" className="plate-chip is-shift" onClick={() => sheet('shift', { id: s.id })}>
              <ShiftGlyph type={s.type} size={14} />
              {shiftName(s.type)} · {hoursText(s.h)} ч · {rub(s.pay)}
            </button>
          ))}
          {shifts.length < 2 && (
            <button type="button" className="plate-chip" onClick={() => sheet('shift', { date: day })}>
              <Icon name="plus" size={13} stroke={2.2} />
              Смена
            </button>
          )}
        </div>
      </PlateRow>
      {share !== null && (
        <PlateRow label="Привычки" index={row++}>
          <div className="plate-meter is-habit">
            <i style={{ transform: `scaleX(${share})` }} />
            <span>{Math.round(share * 100)}%</span>
          </div>
        </PlateRow>
      )}
      {(spent > 0 || toBuy.length > 0) && (
        <PlateRow label="Деньги" index={row++}>
          <div className="plate-chips">
            {spent > 0 && (
              <button type="button" className="plate-chip" onClick={() => navigate('money')}>
                <Icon name="wallet" size={13} stroke={2} />
                Потрачено {rub(spent)}
              </button>
            )}
            {toBuy.map((b) => (
              <button key={b.id} type="button" className="plate-chip" onClick={() => navigate('shop')}>
                <Icon name="bag" size={13} stroke={2} />
                {b.title}
              </button>
            ))}
          </div>
        </PlateRow>
      )}
      {tasks.some((t) => t.focused) && (
        <PlateRow label="Фокус" index={row++}>
          <span>
            {tasks.reduce((s, t) => s + (t.focused ?? 0), 0)} {plural(tasks.reduce((s, t) => s + (t.focused ?? 0), 0), ['минута', 'минуты', 'минут'])}
          </span>
        </PlateRow>
      )}
    </>
  );
}
