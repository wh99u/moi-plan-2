import { AnimatePresence, motion } from 'motion/react';
import { useState, type CSSProperties } from 'react';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import { addDays, dayKey, parseDay } from '../../lib/dates';
import type { Habit, HabitPart } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Plate, PlateRow } from '../Plate';
import { plural } from '../reminders';
import { pulseWave } from '../Wave';
import { focusHabit } from './focusTimer';
import { dayShare, doneOn, fullDays, inPart, isTimed, nextMark, streak } from './habitLogic';
import { monthCells } from './logic';
import { WeekStrip } from './WeekStrip';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const PARTS: { id: HabitPart | 'all'; label: string }[] = [
  { id: 'morning', label: 'Утро' },
  { id: 'all', label: 'Весь день' },
  { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' },
];
const ICONS = ['heart', 'bolt', 'book', 'health', 'food', 'sun', 'moon', 'bike', 'smile', 'sparkle', 'headphones', 'clock'];
const UNITS = ['раз', 'стаканов', 'страниц', 'минут', 'км', 'шагов'];
const TONES = ['blue', 'orange', 'yellow', 'pink', 'green'] as const;
const tone = (i: number) => TONES[i % TONES.length];

/** Which habit the window is open for: a new one, or one by id. */
type Editing = { id: string | null } | null;

export function Habits({ habits, now, onDay, adding }: { habits: Habit[]; now: Date; onDay: (day: string) => void; adding: number }) {
  const today = dayKey(now);
  const [sel, setSel] = useState(today);
  const [part, setPart] = useState<HabitPart | 'all'>('all');
  const [editing, setEditing] = useState<Editing>(null);
  // The plus lives outside, over the page; each tap of it is a new count here.
  const [seen, setSeen] = useState(adding);
  if (adding !== seen) {
    setSeen(adding);
    setEditing({ id: null });
  }
  const shown = inPart(habits, part);
  const ym = today.slice(0, 7);
  const cells = monthCells(ym);
  const monthDays = cells.filter((d) => d.startsWith(ym));
  const good = fullDays(habits, monthDays, today);

  return (
    <div className="habits">
      <motion.section className="hgrid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <header>
          <span>Привычки</span>
          <strong>
            {good} {plural(good, ['день', 'дня', 'дней'])}
          </strong>
        </header>
        <div className="hgrid-week" aria-hidden="true">
          {WEEK.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="hgrid-cells">
          {cells.map((key, i) => {
            if (!key.startsWith(ym)) return <i key={key} className="hcell is-out" />;
            const share = key <= today ? (dayShare(habits, key) ?? 0) : 0;
            const cls = ['hcell', key > today && 'is-future', key === today && 'is-today', key === sel && 'is-sel', share === 1 && 'is-full'].filter(Boolean).join(' ');
            return (
              <button key={key} type="button" className={cls} style={{ '--p': share, '--d': `${i * 0.018}s` } as CSSProperties} aria-label={`${parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${Math.round(share * 100)}%`} onClick={() => onDay(key)} />
            );
          })}
        </div>
      </motion.section>

      <WeekStrip
        anchor={sel}
        today={today}
        active={[sel]}
        fill={(d) => (d <= today ? dayShare(habits, d) : null)}
        onPick={(d) => (d === sel ? onDay(d) : setSel(d))}
        onWeek={(d) => setSel(dayKey(addDays(parseDay(sel), d * 7)))}
      />

      <div className="hparts" role="radiogroup" aria-label="Время дня">
        {PARTS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={part === p.id} className={`hpart${part === p.id ? ' is-on' : ''}`} onClick={() => setPart(p.id)}>
            {part === p.id && <motion.i layoutId="hpart-light" className="hpart-light" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {habits.length === 0 ? (
        <p className="tasks-empty">Вода, зарядка, чтение: то, что делаешь понемногу каждый день. Плюс внизу добавит привычку</p>
      ) : (
        <ul className="hlist">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((h, i) => (
              <HabitCard key={h.id} habit={h} index={habits.indexOf(h)} order={i} day={sel} today={today} onEdit={() => setEditing({ id: h.id })} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <HabitPlate editing={editing} habits={habits} onClose={() => setEditing(null)} />
    </div>
  );
}

function HabitCard({ habit, index, order, day, today, onEdit }: { habit: Habit; index: number; order: number; day: string; today: string; onEdit: () => void }) {
  const value = habit.marks[day] ?? 0;
  const done = doneOn(habit, day);
  const run = streak(habit, today);
  const timed = isTimed(habit);
  const tap = () => {
    const next = timed ? (done ? 0 : habit.target) : nextMark(habit, day);
    if (next >= habit.target && !done) pulseWave();
    actions.markHabit(habit.id, day, next);
  };

  return (
    <motion.li
      layout="position"
      className={`hcard is-${tone(index)}${done ? ' is-done' : ''}`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
      transition={{ delay: order * 0.05, duration: 0.45, ease: EASE }}
    >
      <motion.button type="button" className="hcard-main" onClick={tap} whileTap={{ scale: 0.97 }} aria-label={`${habit.title}: ${value} из ${habit.target}`}>
        <motion.i className="hcard-fill" initial={false} animate={{ scaleX: Math.min(1, value / habit.target) }} transition={{ type: 'spring', stiffness: 220, damping: 30 }} />
        <span className="hcard-icon">
          <Icon name={habit.icon} size={20} stroke={2} />
        </span>
        <span className="hcard-words">
          <strong>{habit.title}</strong>
          <span>
            <em>★</em> {run ? `${run} ${plural(run, ['день', 'дня', 'дней'])} подряд` : 'Новая'}
          </span>
        </span>
        {!timed && (
          <span className="hcard-count">
            <span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.b key={value} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.22 }}>
                  {value}
                </motion.b>
              </AnimatePresence>
              /{habit.target}
            </span>
            <small>{habit.unit}</small>
          </span>
        )}
      </motion.button>
      {timed && (
        <motion.button type="button" className="hcard-timer" aria-label={`Фокус на ${habit.title}`} onClick={() => focusHabit(habit)} whileTap={{ scale: 0.92 }}>
          {done ? <Icon name="check" size={20} stroke={2.6} /> : <Icon name="clock" size={20} stroke={2} />}
          <span>{done ? 'Готово' : `${Math.max(1, habit.target - value)}м`}</span>
        </motion.button>
      )}
      <button type="button" className="hcard-edit" aria-label={`Изменить «${habit.title}»`} onClick={onEdit}>
        <Icon name="dots" size={16} stroke={2} />
      </button>
    </motion.li>
  );
}

/** Making a habit or changing one, in the plain small window. */
function HabitPlate({ editing, habits, onClose }: { editing: Editing; habits: Habit[]; onClose: () => void }) {
  const habit = editing?.id ? habits.find((h) => h.id === editing.id) : undefined;
  return (
    <Plate open={!!editing} title={habit ? 'Привычка' : 'Новая привычка'} onClose={onClose}>
      {editing && <HabitForm key={editing.id ?? 'new'} habit={habit} onDone={onClose} />}
    </Plate>
  );
}

function HabitForm({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const [title, setTitle] = useState(habit?.title ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? 'heart');
  const [target, setTarget] = useState(habit?.target ?? 1);
  const [unit, setUnit] = useState(habit?.unit ?? 'раз');
  const [part, setPart] = useState<HabitPart | 'all'>(habit?.part ?? 'all');
  const ok = title.trim().length > 0;

  const save = () => {
    if (!ok) return;
    const data = { title: title.trim(), icon, target, unit, part: part === 'all' ? undefined : part };
    if (habit) actions.updateHabit(habit.id, data);
    else {
      actions.addHabit(data);
      pulseWave();
    }
    onDone();
  };

  return (
    <>
      <PlateRow label="Название">
        <input className="plate-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Пить воду" aria-label="Название" maxLength={60} autoFocus={!habit} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </PlateRow>
      <PlateRow label="Значок" index={1} wide>
        <div className="plate-chips">
          {ICONS.map((n) => (
            <button key={n} type="button" className={`plate-chip is-icon${n === icon ? ' is-on' : ''}`} aria-pressed={n === icon} aria-label={n} onClick={() => setIcon(n)}>
              <Icon name={n} size={17} stroke={2} />
            </button>
          ))}
        </div>
      </PlateRow>
      <PlateRow label="В день" index={2}>
        <div className="plate-stepper">
          <button type="button" aria-label="Меньше" onClick={() => setTarget(Math.max(1, target - (target > 10 ? 5 : 1)))}>
            <Icon name="minus" size={16} />
          </button>
          <strong>{target}</strong>
          <button type="button" aria-label="Больше" onClick={() => setTarget(Math.min(999, target + (target >= 10 ? 5 : 1)))}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </PlateRow>
      <PlateRow label="Чего" index={3} wide>
        <div className="plate-chips">
          {UNITS.map((u) => (
            <button key={u} type="button" className={`plate-chip${u === unit ? ' is-on' : ''}`} aria-pressed={u === unit} onClick={() => setUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </PlateRow>
      <PlateRow label="Когда" index={4} wide>
        <div className="plate-chips">
          {PARTS.map((p) => (
            <button key={p.id} type="button" className={`plate-chip${p.id === part ? ' is-on' : ''}`} aria-pressed={p.id === part} onClick={() => setPart(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </PlateRow>
      <div className="plate-foot">
        {habit && (
          <button
            type="button"
            className="plate-del"
            onClick={() => {
              actions.deleteHabit(habit.id);
              onDone();
            }}
          >
            Удалить
          </button>
        )}
        <motion.button type="button" className="plate-go" disabled={!ok} onClick={save} whileTap={{ scale: 0.94 }}>
          {habit ? 'Сохранить' : 'Добавить'}
        </motion.button>
      </div>
    </>
  );
}
