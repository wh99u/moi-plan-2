import { animate, AnimatePresence, motion, useMotionValue, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { openSheet, useSheet, useSheetData } from '../../app/sheet';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { addDays, addMonths, dayKey, daysBetween, fmtDay, fmtWeekday, monthIn, monthName, parseDay, ymKey } from '../../lib/dates';
import { rub } from '../../lib/money';
import { visible } from '../../lib/records';
import type { Goal, Shift, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Recede } from '../Recede';
import { plural } from '../reminders';
import { navigate } from '../route';
import { Seg } from '../Seg';
import { useNow } from '../Today';
import { pulseWave } from '../Wave';
import { openFocus } from './focusTimer';
import { GoalWindow, Goals, type OpenedGoal } from './Goals';
import { activeGoals, leftWords } from './goalLogic';
import { clearWanted, wantedView, type TasksView } from './entry';
import { DEFAULT_MINUTES, hoursText, layoutDay, monthCells, monthShifts, nearestSpan, pageStart, parseQuick, quadrantOf, shiftName, smartGroups, SPANS, toMinutes, turnPages, type Quadrant } from './logic';
import { ShiftGlyph } from './ShiftGlyph';
import { completeTask, TaskWindow } from './TaskWindow';
import { blur, LOW } from '../../app/ui/device';

type View = TasksView;
interface Opened {
  id: string;
  morph: string;
}
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const FIRST_HOUR = 7;
const HOUR = 44;
/** One row of the month: a cell and the gap under it. */
const ROW = 48;
/** How far the page has to scroll for the month to have stepped back. */
const MONTH_BACK = 320;
const BANDS = 2;
const MIN_SPAN = SPANS[0];
const MAX_SPAN = SPANS[SPANS.length - 1];
/** A little past either end while the fingers are still on it. */
const STRETCH = 0.3;
/** From this many days on, the columns are narrow and everything in them tightens up. */
const DENSE = 5;
const SPAN_KEY = 'tasks_span';
/** From where a far-off day comes in, when the ribbon is not long enough to travel there. */
const JUMP = 44;
/** How long after the last turn of a trackpad's pinch it is taken as finished, ms. */
const WHEEL_REST = 180;
/** How far a finger goes before it is known whether it is swiping or scrolling, px. */
const LOCK = 8;
/** A pause this long before lifting the finger cancels the flick, ms. */
const FLICK_GONE = 90;
/** How long all the neighbours stay drawn after the number of days changes, ms. */
const WIDE_FOR = 600;
const GLIDE = { type: 'spring', stiffness: 300, damping: 34 } as const;
const TURN = { type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const;
const POP = { type: 'spring', stiffness: 420, damping: 30 } as const;

const shortDate = (key: string) => parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
const daysFrom = (first: string, n: number) => Array.from({ length: n }, (_, i) => dayKey(addDays(parseDay(first), i)));

function savedSpan(): number {
  try {
    return nearestSpan(Number(localStorage.getItem(SPAN_KEY)) || 3);
  } catch {
    return 3;
  }
}

export function Tasks() {
  const tasks = visible(useStore((s) => s.personal.tasks));
  const shifts = visible(useStore((s) => s.personal.shifts));
  const goals = visible(useStore((s) => s.personal.goals));
  const now = useNow(60_000);
  const [view, setView] = useState<View>(() => wantedView() ?? 'month');
  const [start, setStart] = useState(() => dayKey(now));
  const [span, setSpan] = useState(savedSpan);
  useEffect(clearWanted, []);
  // A week always begins on Monday; one day or three begin wherever they were put.
  const first = pageStart(start, span);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [goalOpen, setGoalOpen] = useState<OpenedGoal | null>(null);
  // The day open in the panel under the month.
  const [day, setDay] = useState<string | null>(null);
  const open = tasks.find((t) => t.id === opened?.id);
  const goal = goals.find((g) => g.id === goalOpen?.id);
  const scroller = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scroller });
  const monthOpacity = useTransform(scrollY, [0, MONTH_BACK], [1, 0.25]);
  // Scaling a whole month on every step of a scroll is too much for a phone.
  const monthScale = useTransform(scrollY, [0, MONTH_BACK], [1, LOW ? 1 : 0.95]);
  const openTask = (t: Task, morph: string) => setOpened({ id: t.id, morph });
  const changeSpan = (n: number) => {
    setSpan(n);
    // Going closer, today stays in sight if it was.
    const today = dayKey(now);
    if (n < span && today >= first && today <= dayKey(addDays(parseDay(first), span - 1))) setStart(today);
    try {
      localStorage.setItem(SPAN_KEY, String(n));
    } catch {
      /* it will just start from three days next time */
    }
  };

  return (
    <>
      <div ref={scroller} className={`budget tasks${view === 'hours' ? ' is-hours' : ''}`}>
        <div className="tasks-col">
          <Recede from={2.4} className="tasks-seg">
            <Seg
              value={view}
              onChange={setView}
              label="Раздел"
              options={[
                { id: 'month', label: 'Календарь' },
                { id: 'hours', label: 'По часам' },
                { id: 'list', label: 'Список' },
                { id: 'goals', label: 'Цели' },
              ]}
            />
          </Recede>
          {/* No initial={false} here: it would silence every entrance inside, the matrix's among them, on arrival at the screen. */}
          <AnimatePresence
            mode="wait"
            onExitComplete={() => {
              if (scroller.current) scroller.current.scrollTop = 0;
            }}
          >
            <motion.div key={view} className={view === 'hours' ? 'tasks-fill' : undefined} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}>
              {view === 'month' && (
                <>
                  <Month
                    tasks={tasks}
                    goals={goals}
                    shifts={shifts}
                    now={now}
                    start={start}
                    selected={day}
                    opacity={monthOpacity}
                    scale={monthScale}
                    onStart={setStart}
                    onPick={(key) => {
                      setStart(key);
                      setDay(day === key ? null : key);
                    }}
                  />
                  {/* The day comes up over the matrix and goes back down to show it again. */}
                  <AnimatePresence mode="wait">
                    {day ? (
                      <DayPanel
                        key="day"
                        day={day}
                        tasks={tasks}
                        shifts={shifts}
                        now={now}
                        opened={opened}
                        onOpen={openTask}
                        onClose={() => setDay(null)}
                        onHours={() => {
                          setDay(null);
                          setView('hours');
                        }}
                      />
                    ) : (
                      <motion.div key="matrix" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.35, ease: EASE }}>
                        <Matrix tasks={tasks} now={now} opened={opened} onOpen={openTask} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              {view === 'hours' && <Timeline tasks={tasks} goals={goals} shifts={shifts} now={now} start={first} span={span} opened={opened} goalOpen={goalOpen} onStart={setStart} onSpan={changeSpan} onOpen={openTask} onGoal={setGoalOpen} />}
              {view === 'list' && <List tasks={tasks} now={now} opened={opened} onOpen={openTask} />}
              {view === 'goals' && <Goals goals={goals} tasks={tasks} now={now} opened={goalOpen} onOpen={setGoalOpen} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {(view === 'list' || view === 'goals') && (
          <motion.button
            key="plus"
            type="button"
            className="fab-plus"
            aria-label={view === 'goals' ? 'Новая цель' : 'Новая задача'}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={POP}
            whileTap={{ scale: 0.85 }}
            onClick={() => openSheet(view === 'goals' ? 'newGoal' : 'newTask')}
          >
            <Icon name="plus" size={26} stroke={2} />
          </motion.button>
        )}
      </AnimatePresence>
      {createPortal(
        <>
          <AnimatePresence>
            {open && opened && (
              <TaskWindow
                key={open.id}
                task={open}
                morph={opened.morph}
                onClose={() => setOpened(null)}
                onFocus={() => {
                  openFocus(open);
                  setOpened(null);
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {goal && goalOpen && (
              <GoalWindow
                key={goal.id}
                goal={goal}
                tasks={tasks}
                now={now}
                morph={goalOpen.morph}
                onClose={() => setGoalOpen(null)}
                onOpenTask={(t) => {
                  setGoalOpen(null);
                  setOpened({ id: t.id, morph: `step-${t.id}` });
                }}
              />
            )}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </>
  );
}

/* ─────────── The month ─────────── */

function Month({ tasks, goals, shifts, now, start, selected, opacity, scale, onStart, onPick }: { tasks: Task[]; goals: Goal[]; shifts: Shift[]; now: Date; start: string; selected: string | null; opacity: MotionValue<number>; scale: MotionValue<number>; onStart: (key: string) => void; onPick: (key: string) => void }) {
  const today = dayKey(now);
  const [ym, setYm] = useState(start.slice(0, 7));
  const [shift, setShift] = useState(0);
  const cells = monthCells(ym);
  const busy = useMemo(() => new Set(tasks.filter((t) => !t.done && t.due).map((t) => t.due)), [tasks]);
  const goalEnds = useMemo(() => new Set(activeGoals(goals).map((g) => g.end)), [goals]);
  const worked = monthShifts(shifts, ym);
  const [showShifts, setShowShifts] = useState(false);
  // Each cell comes up later the further it is from today, or from the middle of a month without it.
  const origin = Math.max(0, cells.indexOf(today)) || 17;
  const at = selected ? cells.indexOf(selected) : -1;

  const turn = (n: number) => {
    setShift(n);
    setYm(addMonths(ym, n));
  };

  return (
    <motion.section className="cal" style={{ opacity, scale, transformOrigin: '50% 0%' }}>
      <header className="cal-head">
        <motion.button type="button" className="cal-turn" aria-label="Предыдущий месяц" onClick={() => turn(-1)} whileTap={{ scale: 0.8, x: -3 }}>
          <Icon name="back" size={18} />
        </motion.button>
        <button
          type="button"
          className="cal-month"
          onClick={() => {
            onStart(today);
            setYm(ymKey(now));
          }}
          aria-label="К сегодняшнему дню"
        >
          <AnimatePresence mode="popLayout" initial={false} custom={shift}>
            <motion.span
              key={ym}
              className="cal-month-in"
              custom={shift}
              variants={{ enter: (n: number) => ({ opacity: 0, y: n * 22, ...blur(6) }), show: { opacity: 1, y: 0, ...blur(0) }, leave: (n: number) => ({ opacity: 0, y: n * -22, ...blur(6) }) }}
              initial="enter"
              animate="show"
              exit="leave"
              transition={{ duration: 0.36, ease: EASE }}
            >
              {monthName(ym)}
              {!ym.startsWith(String(now.getFullYear())) && <small> {ym.slice(0, 4)}</small>}
            </motion.span>
          </AnimatePresence>
        </button>
        <motion.button type="button" className="cal-turn cal-turn--next" aria-label="Следующий месяц" onClick={() => turn(1)} whileTap={{ scale: 0.8, x: 3 }}>
          <Icon name="back" size={18} />
        </motion.button>
      </header>
      <div className="cal-week" aria-hidden="true">
        {WEEK.map((d, i) => (
          <span key={d} style={{ animationDelay: `${i * 0.03}s` }}>
            {d}
          </span>
        ))}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={shift}>
        <motion.div
          key={ym}
          className="cal-grid"
          custom={shift}
          variants={{ enter: (n: number) => ({ opacity: 0, x: n * 40 }), show: { opacity: 1, x: 0 }, leave: (n: number) => ({ opacity: 0, x: n * -40 }) }}
          initial="enter"
          animate="show"
          exit="leave"
          transition={{ duration: 0.32, ease: EASE }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, i) => {
            if (Math.abs(i.offset.x) > 60) turn(i.offset.x < 0 ? 1 : -1);
          }}
        >
          <AnimatePresence initial={false}>
            {at >= 0 && (
              <motion.span
                key="picked"
                className="cal-strip"
                initial={{ opacity: 0, scale: 0.7, left: `${((at % 7) / 7) * 100}%`, top: Math.floor(at / 7) * ROW }}
                animate={{ opacity: 1, scale: 1, left: `${((at % 7) / 7) * 100}%`, top: Math.floor(at / 7) * ROW }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              />
            )}
          </AnimatePresence>
          {cells.map((key, i) => {
            const cls = ['cal-day', !key.startsWith(ym) && 'is-other', key === selected && 'is-start'].filter(Boolean).join(' ');
            const far = Math.hypot(Math.floor(i / 7) - Math.floor(origin / 7), i % 7 - origin % 7);
            return (
              <button key={key} type="button" className={cls} style={{ animationDelay: `${far * 0.035}s` }} aria-label={parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} aria-pressed={key === selected} onClick={() => onPick(key)}>
                <span className={key === today ? 'cal-num is-today' : 'cal-num'}>{Number(key.slice(8))}</span>
                {busy.has(key) && <i className="cal-dot" />}
                {shifts.some((s) => s.date === key) && (
                  <i className="cal-shift">
                    {shifts
                      .filter((s) => s.date === key)
                      .map((s) => (
                        <ShiftGlyph key={s.id} type={s.type} size={13} />
                      ))}
                  </i>
                )}
                {goalEnds.has(key) && (
                  <i className="cal-flag">
                    <Icon name="flag" size={10} stroke={2.4} />
                  </i>
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
      <div className="shifts">
        <button type="button" className="shifts-sum" aria-expanded={showShifts} disabled={!worked.list.length} onClick={() => setShowShifts(!showShifts)}>
          <strong>Смены в {monthIn(ym)}</strong>
          <span>{worked.list.length ? `${worked.list.length} · ${hoursText(worked.hours)} ч · ${rub(worked.pay)}` : 'Пока нет'}</span>
        </button>
        <motion.button type="button" className="shifts-add" whileTap={{ scale: 0.92 }} onClick={() => openSheet('shift', { date: selected ?? (start.startsWith(ym) ? start : `${ym}-01`) })}>
          <Icon name="plus" size={16} stroke={2} />
          Смена
        </motion.button>
      </div>
      <AnimatePresence initial={false}>
        {showShifts && worked.list.length > 0 && (
          <motion.ul className="shift-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }}>
            {worked.list.map((s) => (
              <li key={s.id}>
                <button type="button" className="shift-row" onClick={() => openSheet('shift', { id: s.id })}>
                  <ShiftGlyph type={s.type} size={16} />
                  <span>
                    {fmtDay(s.date).replace('.', '')}, {shiftName(s.type).toLowerCase()}
                  </span>
                  <small>{hoursText(s.h)} ч</small>
                  <strong>{rub(s.pay)}</strong>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/* ─────────── One day, over the matrix ─────────── */

const inTimeOrder = (a: Task, b: Task) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99');

function DayPanel({ day, tasks, shifts, now, opened, onOpen, onClose, onHours }: { day: string; tasks: Task[]; shifts: Shift[]; now: Date; opened: Opened | null; onOpen: (t: Task, morph: string) => void; onClose: () => void; onHours: () => void }) {
  const [text, setText] = useState('');
  const list = tasks.filter((t) => t.due === day).sort(inTimeOrder);
  const worked = shifts.filter((s) => s.date === day);
  const parsed = parseQuick(text, now, day);
  const spent = visible(useStore((s) => s.shared.spends)).filter((s) => s.date === day).reduce((t, s) => t + s.amount, 0);
  const toBuy = visible(useStore((s) => s.shared.buys)).filter((b) => b.due === day && !b.boughtAt);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    actions.addTask({ title: parsed.title, desc: '', due: parsed.due ?? day, time: parsed.time, minutes: parsed.minutes ?? (parsed.time ? DEFAULT_MINUTES : undefined), priority: parsed.priority, tags: parsed.tags.length ? parsed.tags : undefined, repeat: parsed.repeat });
    pulseWave();
    setText('');
  };

  return (
    <motion.section className="day-panel" aria-label={fmtWeekday(day)} initial={{ opacity: 0, y: 90 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 90, transition: { duration: 0.2, ease: 'easeIn' } }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
      <i className="day-panel-grip" />
      <header className="day-panel-head">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2 key={day} initial={{ opacity: 0, y: 10, ...blur(6) }} animate={{ opacity: 1, y: 0, ...blur(0) }} exit={{ opacity: 0, y: -10, ...blur(6) }} transition={{ duration: 0.28, ease: EASE }}>
            {fmtWeekday(day)}
          </motion.h2>
        </AnimatePresence>
        <button type="button" className="round-btn" aria-label="Закрыть день" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="day-shifts">
        {worked.map((s) => (
          <motion.button key={s.id} type="button" className="day-shift" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={POP} whileTap={{ scale: 0.96 }} onClick={() => openSheet('shift', { id: s.id })}>
            <ShiftGlyph type={s.type} size={18} />
            <span>
              {shiftName(s.type)} смена
              <small>
                {hoursText(s.h)} ч · {rub(s.pay)}
              </small>
            </span>
          </motion.button>
        ))}
        {worked.length < 2 && (
          <motion.button type="button" className="day-shift day-shift--add" whileTap={{ scale: 0.96 }} onClick={() => openSheet('shift', { date: day })}>
            <Icon name="plus" size={16} stroke={2} />
            <span>Смена</span>
          </motion.button>
        )}
      </div>

      {list.length > 0 && (
        <ul className="day-tasks">
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <TaskLine key={t.id} task={t} compact morphPrefix="day" opened={opened} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {(spent > 0 || toBuy.length > 0) && (
        <div className="day-money">
          {spent > 0 && (
            <button type="button" onClick={() => navigate('money')}>
              <Icon name="wallet" size={16} stroke={2} />
              <span>Потрачено</span>
              <strong>{rub(spent)}</strong>
            </button>
          )}
          {toBuy.map((b) => (
            <button key={b.id} type="button" onClick={() => navigate('shop')}>
              <Icon name="bag" size={16} stroke={2} />
              <span>Купить: {b.title}</span>
              {b.price > 0 && <strong>{rub(b.price)}</strong>}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={add}>
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Добавить задачу на этот день" aria-label="Новая задача на этот день" enterKeyHint="done" maxLength={200} />
      </form>

      <button type="button" className="scan-link" onClick={onHours}>
        <Icon name="clock" size={18} />
        Открыть по часам
      </button>
    </motion.section>
  );
}

/* ─────────── Hour by hour ─────────── */

interface TimelineProps {
  tasks: Task[];
  goals: Goal[];
  shifts: Shift[];
  now: Date;
  start: string;
  span: number;
  opened: Opened | null;
  goalOpen: OpenedGoal | null;
  onStart: (key: string) => void;
  onSpan: (n: number) => void;
  onOpen: (t: Task, morph: string) => void;
  onGoal: (o: OpenedGoal) => void;
}

function Timeline({ tasks, goals, shifts, now, start, span, opened, goalOpen, onStart, onSpan, onOpen, onGoal }: TimelineProps) {
  const today = dayKey(now);
  // The hour a new task is being written for stands marked while its sheet is open.
  const sheet = useSheet();
  const sheetData = useSheetData();
  const draft = sheet === 'newTask' && sheetData.date && sheetData.time ? { due: sheetData.date, time: sheetData.time } : null;
  const days = useMemo(() => daysFrom(start, span), [start, span]);
  // One page of days on each side is drawn, so a swipe finds its neighbours ready. While the number of days itself changes, all of them are.
  const [wide, setWide] = useState(false);
  const around = wide ? MAX_SPAN : span;
  const count = wide ? MAX_SPAN * 3 : span * 3;
  const ribbon = useMemo(() => daysFrom(dayKey(addDays(parseDay(start), -around)), count), [start, around, count]);
  const trackStyle = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, width: `calc(${count * 100}% / var(--span))`, marginLeft: `calc(${-around * 100}% / var(--span))` };
  const root = useRef<HTMLElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const hoursBox = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const fade = useMotionValue(1);
  // Days in the window as a number with a fraction, while the fingers are on it.
  const zoom = useMotionValue(span);
  const shown = useRef(start);
  const pinching = useRef(false);
  const panned = useRef(false);
  const turning = useRef<{ stop: () => void } | null>(null);
  const latest = useRef({ start, span, around, onStart, onSpan });
  latest.current = { start, span, around, onStart, onSpan };
  const widthNow = () => view.current?.offsetWidth ?? 0;
  const colWidth = (n: number) => widthNow() / n;
  const narrowLater = useRef(0);
  const widen = (ms: number) => {
    setWide(true);
    clearTimeout(narrowLater.current);
    if (ms) narrowLater.current = window.setTimeout(() => setWide(false), ms);
  };

  // The ribbon has just been redrawn around the new day: put it back where the eye left it, and let it arrive.
  useLayoutEffect(() => {
    const diff = daysBetween(parseDay(shown.current), parseDay(start));
    shown.current = start;
    if (!diff) return;
    if (Math.abs(diff) <= latest.current.around) {
      const at = x.get() + diff * colWidth(zoom.get());
      // A finished swipe lands exactly here, with nothing left to travel.
      if (Math.abs(at) < 1) x.set(0);
      else {
        x.set(at);
        animate(x, 0, GLIDE);
      }
    } else {
      x.set(Math.sign(diff) * JUMP);
      fade.set(0);
      animate(fade, 1, { duration: 0.35 });
      animate(x, 0, GLIDE);
    }
  }, [start, x, fade, zoom]);

  // Column widths and how tight they are come straight from the zoom, with no redraw on every move of the fingers.
  useLayoutEffect(() => {
    const paint = (z: number) => {
      root.current?.style.setProperty('--span', String(z));
      root.current?.classList.toggle('is-dense', z >= DENSE - 0.5);
      root.current?.classList.toggle('is-single', z < 1.5);
    };
    paint(zoom.get());
    return zoom.on('change', paint);
  }, [zoom]);

  const lastSpan = useRef(span);
  useLayoutEffect(() => {
    if (lastSpan.current === span) return;
    lastSpan.current = span;
    if (!pinching.current) widen(WIDE_FOR);
    const c = animate(zoom, span, GLIDE);
    return () => c.stop();
  }, [span, zoom]);

  useEffect(() => () => clearTimeout(narrowLater.current), []);

  // The fingers came off: settle on one of the three views, and on whichever day ended up at the left edge.
  const settle = useRef(() => {});
  settle.current = () => {
    const l = latest.current;
    const next = nearestSpan(zoom.get());
    const w = colWidth(zoom.get());
    const n = w ? Math.max(-MAX_SPAN, Math.min(MAX_SPAN, Math.round(-x.get() / w))) : 0;
    const first = pageStart(dayKey(addDays(parseDay(l.start), n)), next);
    if (next !== l.span) l.onSpan(next);
    else animate(zoom, next, GLIDE);
    if (first !== l.start) l.onStart(first);
    else animate(x, 0, GLIDE);
    widen(WIDE_FOR);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let pinch: { dist: number; zoom: number; mid: number; day: number } | null = null;
    let rest = 0;
    const apart = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const middle = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2 - (view.current?.getBoundingClientRect().left ?? 0);
    const stretch = (z: number) => Math.max(MIN_SPAN - STRETCH, Math.min(MAX_SPAN + STRETCH, z));

    const onStartTouch = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      turning.current?.stop();
      x.stop();
      zoom.stop();
      pinching.current = panned.current = true;
      widen(0);
      const mid = middle(e.touches);
      // The day under the fingers stays under them, as a place on a photo does.
      pinch = { dist: apart(e.touches), zoom: zoom.get(), mid, day: (mid - x.get()) / colWidth(zoom.get()) };
    };
    const onMoveTouch = (e: TouchEvent) => {
      if (!pinch || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      // Fingers apart is closer in, so fewer days.
      const z = stretch((pinch.zoom * pinch.dist) / apart(e.touches));
      zoom.set(z);
      x.set(middle(e.touches) - pinch.day * colWidth(z));
    };
    const onEndTouch = (e: TouchEvent) => {
      if (!pinch || e.touches.length >= 2) return;
      pinch = null;
      pinching.current = false;
      settle.current();
      setTimeout(() => (panned.current = false), 80);
    };
    // A trackpad's pinch arrives as a wheel with Ctrl held.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom.stop();
      widen(0);
      zoom.set(stretch(zoom.get() * (1 + e.deltaY * 0.01)));
      clearTimeout(rest);
      rest = window.setTimeout(() => settle.current(), WHEEL_REST);
    };

    /*
     * One finger going sideways turns exactly one page. Which way it is going is decided once, after
     * the first few pixels; going up or down, it is left to the browser, which scrolls the hours.
     */
    let drag: { id: number; from: number; y: number; base: number; lastX: number; lastT: number; speed: number; on: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (drag || pinching.current || e.button !== 0) return;
      if (!(e.target as Element).closest('.tl-heads, .tl-scroll')) return;
      drag = { id: e.pointerId, from: e.clientX, y: e.clientY, base: 0, lastX: e.clientX, lastT: e.timeStamp, speed: 0, on: false };
    };
    const onMovePointer = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (pinching.current) {
        drag = null;
        return;
      }
      if (!drag.on) {
        const dx = e.clientX - drag.from;
        const dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) < LOCK) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          drag = null;
          return;
        }
        drag.on = panned.current = true;
        // A page still arriving is caught wherever it is, so nothing jumps under the finger.
        turning.current?.stop();
        x.stop();
        drag.base = x.get();
        drag.from = e.clientX;
      }
      const w = widthNow();
      x.set(Math.max(-w, Math.min(w, drag.base + e.clientX - drag.from)));
      const dt = e.timeStamp - drag.lastT;
      if (dt > 0) {
        drag.speed = 0.7 * ((e.clientX - drag.lastX) / dt) + 0.3 * drag.speed;
        drag.lastX = e.clientX;
        drag.lastT = e.timeStamp;
      }
    };
    const release = (speed: number) => {
      const w = widthNow();
      const pages = turnPages(x.get(), w, speed);
      turning.current = animate(x, -pages * w, {
        ...TURN,
        onComplete: () => {
          if (!pages) return;
          const l = latest.current;
          // At once: the eye must not catch the ribbon between the old day and the new one.
          flushSync(() => l.onStart(dayKey(addDays(parseDay(l.start), pages * l.span))));
        },
      });
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const was = drag;
      drag = null;
      if (!was.on) return;
      // A finger that stopped before lifting has no flick left in it.
      release(e.type === 'pointerup' && e.timeStamp - was.lastT < FLICK_GONE ? was.speed : 0);
      setTimeout(() => (panned.current = false), 80);
    };

    el.addEventListener('touchstart', onStartTouch, { passive: false });
    el.addEventListener('touchmove', onMoveTouch, { passive: false });
    el.addEventListener('touchend', onEndTouch);
    el.addEventListener('touchcancel', onEndTouch);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMovePointer);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
    return () => {
      clearTimeout(rest);
      el.removeEventListener('touchstart', onStartTouch);
      el.removeEventListener('touchmove', onMoveTouch);
      el.removeEventListener('touchend', onEndTouch);
      el.removeEventListener('touchcancel', onEndTouch);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onMovePointer);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
    };
    // Reads everything that changes through refs, so a swipe is not cut off by a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, zoom]);

  const inDay = (key: string) => tasks.filter((t) => t.due === key);
  const earliest = Math.min(FIRST_HOUR, ...ribbon.flatMap((d) => inDay(d).flatMap((t) => (t.time ? [Number(t.time.slice(0, 2))] : []))));
  const hours = Array.from({ length: 24 - earliest }, (_, i) => earliest + i);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const top = (minutes: number) => ((minutes - earliest * 60) / 60) * HOUR;
  const bands = activeGoals(goals)
    .filter((g) => g.start <= days[span - 1] && g.end >= start)
    .slice(0, BANDS);
  const unlessPanned = (then: () => void) => () => {
    if (!panned.current) then();
  };
  const lastDay = days[span - 1];
  const title = start.slice(0, 7) === lastDay.slice(0, 7) ? monthName(start.slice(0, 7)) : `${monthName(start.slice(0, 7))} – ${monthName(lastDay.slice(0, 7))}`;

  // With today further down than the screen reaches, the hours start at the current one.
  useEffect(() => {
    const box = hoursBox.current;
    if (!box || !daysFrom(start, span).includes(today)) return;
    const y = top(minutesNow);
    if (y > box.clientHeight * 0.6) box.scrollTo({ top: y - box.clientHeight * 0.4, behavior: 'smooth' });
    // Only on arrival: later it is the owner who scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={root} className="tl">
      <header className="tl-top">
        <button type="button" className="tl-title" aria-label="К сегодняшнему дню" onClick={() => onStart(pageStart(today, span))}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h2 key={title} initial={{ opacity: 0, y: 12, ...blur(6) }} animate={{ opacity: 1, y: 0, ...blur(0) }} exit={{ opacity: 0, y: -12, ...blur(6) }} transition={{ duration: 0.32, ease: EASE }}>
              {title}
            </motion.h2>
          </AnimatePresence>
        </button>
        <div className="tl-spans">
          <Seg value={String(span)} onChange={(v) => onSpan(Number(v))} label="Сколько дней видно" options={SPANS.map((n) => ({ id: String(n), label: `${n} ${plural(n, ['день', 'дня', 'дней'])}` }))} />
        </div>
      </header>
      {bands.length > 0 && (
        <div className="tl-goals" style={{ gridTemplateColumns: `44px repeat(${span}, minmax(0, 1fr))` }}>
          {bands.map((g, i) => {
            const morph = `band-${g.id}`;
            const from = Math.max(0, days.findIndex((k) => k >= g.start));
            const across = days.filter((k) => k >= g.start && k <= g.end).length;
            return (
              <motion.button key={g.id} layoutId={morph} type="button" className="tl-goal" style={{ gridColumn: `${from + 2} / span ${across}`, borderRadius: 8, visibility: goalOpen?.morph === morph ? 'hidden' : undefined }} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: EASE }} onClick={() => onGoal({ id: g.id, morph })}>
                <Icon name="flag" size={11} stroke={2.2} />
                <span>{g.title}</span>
                {across * 2 > span && <small>{leftWords(daysBetween(now, parseDay(g.end)))}</small>}
              </motion.button>
            );
          })}
        </div>
      )}
      <div className="tl-heads">
        <span />
        <div className="tl-view">
          <motion.div className="tl-track" style={{ x, opacity: fade, ...trackStyle }}>
            {ribbon.map((key) => {
              const d = parseDay(key);
              const off = !days.includes(key);
              return (
                <div key={key} className="tl-head" aria-hidden={off || undefined}>
                  {/* The place is kept on every day, so the row does not jump when one with a shift slides in. */}
                  <div className="tl-shift">
                    {shifts
                      .filter((s) => s.date === key)
                      .map((s) => (
                        <button key={s.id} type="button" tabIndex={off ? -1 : undefined} aria-label={`${shiftName(s.type)} смена, ${hoursText(s.h)} ч, изменить`} onClick={unlessPanned(() => openSheet('shift', { id: s.id }))}>
                          <ShiftGlyph type={s.type} size={14} />
                        </button>
                      ))}
                  </div>
                  <div className="tl-date">
                    <span>{d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase()}</span>
                    <strong className={key === today ? 'is-today' : undefined}>{d.getDate()}</strong>
                  </div>
                  {inDay(key)
                    .filter((t) => !t.time)
                    .map((t) => {
                      const morph = `chip-${t.id}`;
                      const on = opened?.morph === morph;
                      return (
                        <motion.button key={t.id} layoutId={morph} layoutDependency={on} type="button" tabIndex={off ? -1 : undefined} className={`tl-chip p${t.priority ?? 0}${t.done ? ' is-done' : ''}`} style={{ borderRadius: 8, visibility: on ? 'hidden' : undefined }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={POP} whileTap={{ scale: 0.94 }} onClick={unlessPanned(() => onOpen(t, morph))}>
                          {t.title}
                        </motion.button>
                      );
                    })}
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
      {/* Only the hours scroll: the month and the days above them stay where they are. */}
      <div ref={hoursBox} className="tl-scroll">
        <div className="tl-body" style={{ height: hours.length * HOUR }}>
          <div className="tl-hours" aria-hidden="true">
            {hours.map((h, i) => (
              <span key={h} style={{ top: (h - earliest) * HOUR, animationDelay: `${0.15 + i * 0.025}s` }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          <div ref={view} className="tl-view">
            <motion.div className="tl-track" style={{ x, opacity: fade, ...trackStyle }}>
              {ribbon.map((key) => {
                const off = !days.includes(key);
                return (
                  <div key={key} className="tl-col" style={{ backgroundSize: `100% ${HOUR}px` }} aria-hidden={off || undefined}>
                    {!off &&
                      hours.map((h) => (
                        <button key={h} type="button" className="tl-slot" style={{ top: (h - earliest) * HOUR, height: HOUR }} aria-label={`Новая задача, ${shortDate(key)}, ${h}:00`} onClick={unlessPanned(() => openSheet('newTask', { date: key, time: `${String(h).padStart(2, '0')}:00` }))} />
                      ))}
                    {draft?.due === key && draft.time && (
                      <motion.i className="tl-ghost" style={{ top: top(toMinutes(draft.time)), height: HOUR - 2 }} initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={POP}>
                        Новая задача
                      </motion.i>
                    )}
                    {layoutDay(inDay(key)).map((p) => {
                      const morph = `block-${p.task.id}`;
                      const on = opened?.morph === morph;
                      return (
                        <motion.button
                          key={p.task.id}
                          layoutId={morph}
                          // Only for growing into its window: the ribbon alone moves it the rest of the time.
                          layoutDependency={on}
                          type="button"
                          tabIndex={off ? -1 : undefined}
                          className={`tl-block p${p.task.priority ?? 0}${p.task.done ? ' is-done' : ''}`}
                          style={{ top: top(p.from), height: Math.max(22, (p.length / 60) * HOUR - 2), left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 2px)`, borderRadius: 6, visibility: on ? 'hidden' : undefined }}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={POP}
                          whileTap={{ scale: 0.96 }}
                          onClick={unlessPanned(() => onOpen(p.task, morph))}
                        >
                          {p.task.title}
                        </motion.button>
                      );
                    })}
                    {key === today && minutesNow >= earliest * 60 && <motion.i className="tl-now" style={{ top: top(minutesNow), originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.35, duration: 0.6, ease: EASE }} />}
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── A line of a task ─────────── */

function TaskLine({ task, compact = false, morphPrefix, opened, onOpen }: { task: Task; compact?: boolean; morphPrefix: string; opened: Opened | null; onOpen: (t: Task, morph: string) => void }) {
  const morph = `${morphPrefix}-${task.id}`;
  const today = dayKey(new Date());
  const subs = task.subtasks ?? [];
  const bits = [task.due && !compact ? (task.due === today ? 'Сегодня' : shortDate(task.due)) : '', task.time ?? '', subs.length ? `${subs.filter((s) => s.done).length}/${subs.length}` : '', ...(task.tags ?? []).map((t) => `#${t}`)].filter(Boolean);

  return (
    <motion.li layout="position" className={`tline p${task.priority ?? 0}${task.done ? ' is-done' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      <motion.button type="button" className="check" aria-pressed={task.done} aria-label={task.done ? `Вернуть «${task.title}»` : `Готово: «${task.title}»`} onClick={() => completeTask(task)} whileTap={{ scale: 0.78 }}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <motion.path d="M5 12.500l4.500 4.500L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: task.done ? 1 : 0, opacity: task.done ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
        </svg>
      </motion.button>
      <motion.button layoutId={morph} type="button" className="tline-main" style={{ borderRadius: 12, visibility: opened?.morph === morph ? 'hidden' : undefined }} onClick={() => onOpen(task, morph)}>
        <span className="tline-title">{task.title}</span>
        {bits.length > 0 && <span className="tline-bits">{bits.join(' · ')}</span>}
      </motion.button>
      {task.repeat && <Icon name="repeat" size={14} />}
    </motion.li>
  );
}

/* ─────────── Smart lists ─────────── */

function List({ tasks, now, opened, onOpen }: { tasks: Task[]; now: Date; opened: Opened | null; onOpen: (t: Task, morph: string) => void }) {
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const tags = useMemo(() => [...new Set(tasks.filter((t) => !t.done).flatMap((t) => t.tags ?? []))], [tasks]);
  const groups = smartGroups(tag ? tasks.filter((t) => t.tags?.includes(tag)) : tasks, now);

  if (!tasks.length) return <p className="tasks-empty">Здесь появятся задачи. Попробуй написать внизу: «купить хлеб завтра в 15 !!»</p>;

  return (
    <div className="tlist">
      {tags.length > 0 && (
        <div className="tags" role="group" aria-label="Метки">
          {tags.map((t) => (
            <button key={t} type="button" className={`tag${tag === t ? ' is-on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
        </div>
      )}
      {groups.map((g) => {
        const hidden = g.id === 'done' && !showDone;
        return (
          <section key={g.id} className={`tgroup tgroup--${g.id}`}>
            <h3>
              {g.id === 'done' ? (
                <button type="button" className="tgroup-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
                  {g.label}
                  <span>{g.tasks.length}</span>
                </button>
              ) : (
                <>
                  {g.label}
                  <span>{g.tasks.length}</span>
                </>
              )}
            </h3>
            {!hidden && (
              <ul>
                <AnimatePresence initial={false}>
                  {g.tasks.map((t) => (
                    <TaskLine key={t.id} task={t} morphPrefix="line" opened={opened} onOpen={onOpen} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ─────────── Eisenhower matrix ─────────── */

const BOXES: { id: Quadrant; title: string; hint: string }[] = [
  { id: 'do', title: 'Срочно и важно', hint: 'Сделать сейчас' },
  { id: 'plan', title: 'Важно, не срочно', hint: 'Запланировать' },
  { id: 'hand', title: 'Срочно, не важно', hint: 'Быстро закрыть' },
  { id: 'drop', title: 'Не срочно, не важно', hint: 'Подождёт' },
];

function Matrix({ tasks, now, opened, onOpen }: { tasks: Task[]; now: Date; opened: Opened | null; onOpen: (t: Task, morph: string) => void }) {
  const open = tasks.filter((t) => !t.done);
  return (
    <div className="matrix">
      {BOXES.map((b, i) => {
        const inBox = open.filter((t) => quadrantOf(t, now) === b.id);
        return (
          <motion.section key={b.id} className={`glass mbox mbox--${b.id}`} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, duration: 0.45, ease: EASE }}>
            <h3>{b.title}</h3>
            <p>{b.hint}</p>
            <ul>
              <AnimatePresence initial={false}>
                {inBox.map((t) => (
                  <TaskLine key={t.id} task={t} compact morphPrefix="box" opened={opened} onOpen={onOpen} />
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        );
      })}
    </div>
  );
}
