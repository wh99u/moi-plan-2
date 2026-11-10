import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { addDays, dayKey, parseDay } from '../../lib/dates';
import { rub } from '../../lib/money';
import { visible } from '../../lib/records';
import type { Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Plate, PlateRow } from '../Plate';
import { navigate } from '../route';
import { pulseWave } from '../Wave';
import { DEFAULT_MINUTES, hoursText, parseQuick, shiftName, timeRange } from './logic';
import { ShiftEditor } from './ShiftEditor';
import { ShiftGlyph } from './ShiftGlyph';
import { completeTask } from './taskActions';
import { PlusButton } from './TaskPlate';

const inTimeOrder = (a: Task, b: Task) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99');

function dayNote(day: string, today: Date) {
  if (day === dayKey(today)) return 'Сегодня';
  if (day === dayKey(addDays(today, 1))) return 'Завтра';
  if (day === dayKey(addDays(today, -1))) return 'Вчера';
  return parseDay(day).toLocaleDateString('ru-RU', { year: 'numeric' });
}

/** Everything about one day in a small window: what to do, the shifts, the money. */
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
      {key && <Inside key={key} day={key} onOpenTask={onOpenTask} />}
    </Plate>
  );
}

function Inside({ day, onOpenTask }: { day: string; onOpenTask: (t: Task) => void }) {
  const [text, setText] = useState('');
  // Which shift is open below its button: one by id, a new one, or none.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const tasks = visible(useStore((s) => s.personal.tasks)).filter((t) => t.due === day).sort(inTimeOrder);
  const allShifts = visible(useStore((s) => s.personal.shifts));
  const shifts = allShifts.filter((s) => s.date === day);
  const spent = visible(useStore((s) => s.shared.spends)).filter((s) => s.date === day).reduce((t, s) => t + s.amount, 0);
  const toBuy = visible(useStore((s) => s.shared.buys)).filter((b) => b.due === day && !b.boughtAt);
  const done = tasks.filter((t) => t.done).length;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const q = parseQuick(text, new Date(), day);
    if (!q) return;
    actions.addTask({ title: q.title, desc: '', due: q.due ?? day, time: q.time, minutes: q.minutes ?? (q.time ? DEFAULT_MINUTES : undefined), priority: q.priority, tags: q.tags.length ? q.tags : undefined, repeat: q.repeat });
    pulseWave();
    setText('');
  };
  const toggle = (id: string | 'new') => setEditing(editing === id ? null : id);

  let row = 0;
  return (
    <>
      <PlateRow label="Задачи" index={row++} wide={tasks.length > 0}>
        {tasks.length ? (
          <div className="plate-stack">
            <div className="plate-meter">
              <i style={{ transform: `scaleX(${done / tasks.length})` }} />
              <span>
                {done} из {tasks.length}
              </span>
            </div>
            <ul className="plate-tasks">
              <AnimatePresence initial={false}>
                {tasks.map((t) => (
                  <motion.li key={t.id} layout="position" className={`p${t.priority ?? 0}${t.done ? ' is-done' : ''}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }}>
                    <button type="button" className="plate-tick" aria-pressed={t.done} aria-label={t.done ? `Вернуть «${t.title}»` : `Готово: «${t.title}»`} onClick={() => completeTask(t)}>
                      <Icon name="check" size={11} stroke={3} />
                    </button>
                    <button type="button" className="plate-task" onClick={() => onOpenTask(t)}>
                      <span>{t.title}</span>
                      {t.time && <small>{timeRange(t)}</small>}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ) : (
          <span className="plate-dim">Свободный день</span>
        )}
      </PlateRow>
      <PlateRow label="Добавить" index={row++}>
        <form className="plate-add" onSubmit={add}>
          <input className="plate-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Задача, можно «в 15 !!»" aria-label="Новая задача на этот день" enterKeyHint="done" maxLength={200} />
          <PlusButton disabled={!text.trim()} label="Добавить задачу" />
        </form>
      </PlateRow>
      <PlateRow label="Смены" index={row++} wide>
        <div className="plate-stack">
          <div className="plate-chips">
            {shifts.map((s) => (
              <button key={s.id} type="button" className={`plate-chip is-shift${editing === s.id ? ' is-on' : ''}`} aria-expanded={editing === s.id} onClick={() => toggle(s.id)}>
                <ShiftGlyph type={s.type} size={14} />
                {shiftName(s.type)} · {hoursText(s.h)} ч · {rub(s.pay)}
              </button>
            ))}
            {/* A day with a shift already has its button: a tap on it changes it. */}
            {!shifts.length && (
              <button type="button" className={`plate-chip${editing === 'new' ? ' is-on' : ''}`} aria-expanded={editing === 'new'} onClick={() => toggle('new')}>
                <Icon name="plus" size={13} stroke={2.2} />
                Смена
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {editing && <ShiftEditor key={editing} day={day} shift={shifts.find((s) => s.id === editing)} shifts={allShifts} onDone={() => setEditing(null)} />}
          </AnimatePresence>
        </div>
      </PlateRow>
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
    </>
  );
}
