import { AnimatePresence, motion } from 'motion/react';
import { useState, type CSSProperties } from 'react';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import { dayKey, parseDay } from '../../lib/dates';
import type { Habit } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Plate, PlateRow } from '../Plate';
import { plural } from '../reminders';
import { Swipe } from '../Swipe';
import { pulseWave } from '../Wave';
import { focusHabit } from './focusTimer';
import { dayShare, doneOn, fullDays, isTimed, nextMark, streak } from './habitLogic';
import { monthCells } from './logic';
import { reveal } from './motion';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/** Each one looks different from the others. */
const ICONS = ['heart', 'bolt', 'book', 'sun', 'moon', 'bike', 'shoe', 'smile', 'sparkle', 'headphones', 'bed', 'laptop', 'coins', 'camera'];
const TONES = ['blue', 'orange', 'yellow', 'pink', 'green'] as const;
const tone = (i: number) => TONES[i % TONES.length];

/** Which habit the window is open for: a new one, or one by id. */
type Editing = { id: string | null } | null;

export function Habits({ habits, now, adding }: { habits: Habit[]; now: Date; adding: number }) {
  const today = dayKey(now);
  const [editing, setEditing] = useState<Editing>(null);
  // The plus lives outside, over the page; each tap of it is a new count here.
  const [seen, setSeen] = useState(adding);
  if (adding !== seen) {
    setSeen(adding);
    setEditing({ id: null });
  }
  const ym = today.slice(0, 7);
  const cells = monthCells(ym);
  const good = fullDays(habits, cells.filter((d) => d.startsWith(ym)), today);

  return (
    <div className="habits">
      <motion.section className="hgrid" {...reveal(0)}>
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
            const cls = ['hcell', key > today && 'is-future', key === today && 'is-today', share === 1 && 'is-full'].filter(Boolean).join(' ');
            return <i key={key} className={cls} style={{ '--p': share, '--d': `${i * 0.018}s` } as CSSProperties} title={`${parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${Math.round(share * 100)}%`} />;
          })}
        </div>
      </motion.section>

      {habits.length === 0 ? (
        <p className="tasks-empty">Вода, зарядка, чтение: то, что делаешь понемногу каждый день. Плюс внизу добавит привычку</p>
      ) : (
        <>
          <p className="habits-hint">Вправо — выполнено, влево — изменить</p>
          <ul className="hlist">
            <AnimatePresence initial={false}>
              {habits.map((h, i) => (
                <HabitCard key={h.id} habit={h} index={i} today={today} onEdit={() => setEditing({ id: h.id })} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}

      <HabitPlate editing={editing} habits={habits} onClose={() => setEditing(null)} />
    </div>
  );
}

function HabitCard({ habit, index, today, onEdit }: { habit: Habit; index: number; today: string; onEdit: () => void }) {
  const value = habit.marks[today] ?? 0;
  const done = doneOn(habit, today);
  const run = streak(habit, today);
  const timed = isTimed(habit);
  const mark = (next: number) => {
    if (next >= habit.target && !done) pulseWave();
    actions.markHabit(habit.id, today, next);
  };

  return (
    <motion.li layout="position" className={`hcard is-${tone(index)}${done ? ' is-done' : ''}`} {...reveal(index + 1)} exit={{ opacity: 0, height: 0, paddingBottom: 0, transition: { duration: 0.26, ease: EASE } }}>
      <Swipe
        radius={18}
        right={{ label: done ? 'Отменить' : 'Выполнено', icon: done ? 'back' : 'check', tone: 'buy', away: false, run: () => mark(done ? 0 : habit.target) }}
        left={{ label: 'Изменить', icon: 'edit', tone: 'edit', away: false, run: onEdit }}
      >
        <div className="hcard-row">
          <motion.button type="button" className="hcard-main" onClick={() => mark(timed ? (done ? 0 : habit.target) : nextMark(habit, today))} whileTap={{ scale: 0.98 }} aria-label={`${habit.title}: ${value} из ${habit.target}`}>
            <motion.i className="hcard-fill" initial={false} animate={{ scaleX: Math.min(1, value / habit.target) }} transition={{ type: 'spring', stiffness: 220, damping: 30 }} />
            <span className="hcard-icon">
              <Icon name={habit.icon === 'health' ? 'heart' : habit.icon} size={20} stroke={2} />
            </span>
            <span className="hcard-words">
              <strong>{habit.title}</strong>
              <span>
                <em>★</em> {run ? `${run} ${plural(run, ['день', 'дня', 'дней'])} подряд` : 'Новая'}
              </span>
            </span>
            {!timed && (
              <span className="hcard-count">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.b key={value} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.22 }}>
                    {value}
                  </motion.b>
                </AnimatePresence>
                /{habit.target}
              </span>
            )}
          </motion.button>
          {timed && (
            <motion.button type="button" className="hcard-timer" aria-label={`Фокус на ${habit.title}`} onClick={() => focusHabit(habit)} whileTap={{ scale: 0.92 }}>
              <Icon name={done ? 'check' : 'clock'} size={20} stroke={done ? 2.6 : 2} />
              <span>{done ? 'Готово' : `${Math.max(1, habit.target - value)}м`}</span>
            </motion.button>
          )}
        </div>
      </Swipe>
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
  const [icon, setIcon] = useState(habit?.icon === 'health' ? 'heart' : (habit?.icon ?? 'heart'));
  const [target, setTarget] = useState(habit?.target ?? 1);
  const ok = title.trim().length > 0;

  const save = () => {
    if (!ok) return;
    const data = { title: title.trim(), icon, target };
    if (habit) actions.updateHabit(habit.id, data);
    else {
      actions.addHabit({ ...data, unit: 'раз' });
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
      <div className="plate-foot">
        {habit && (
          <button
            type="button"
            className="plate-del"
            onClick={() => {
              onDone();
              actions.deleteHabit(habit.id);
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
