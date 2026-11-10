import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { EASE } from '../../app/ui/text';
import { openSheet } from '../../app/sheet';
import { actions, useStore } from '../../lib/appStore';
import { addDays, dayKey, daysBetween, monthName, parseDay } from '../../lib/dates';
import { visible } from '../../lib/records';
import type { Shift, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Recede } from '../Recede';
import { plural } from '../reminders';
import { Seg } from '../Seg';
import { useNow } from '../Today';
import { CalendarView } from './CalendarView';
import { DayPlate } from './DayPlate';
import { Habits } from './Habits';
import { clearWanted, wantedView, type TasksView } from './entry';
import { DEFAULT_MINUTES, hoursText, layoutDay, nearestSpan, pageStart, shiftName, SPANS, timeRange, toMinutes, turnPages } from './logic';
import { ShiftGlyph } from './ShiftGlyph';
import { TaskPlate, type TaskDraft } from './TaskPlate';
import { WeekStrip } from './WeekStrip';
import { blur } from '../../app/ui/device';

type View = TasksView;
const FIRST_HOUR = 7;
/** The height of an hour: room for a title and its time. */
const HOUR = 62;
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

const capital = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
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
  const habits = visible(useStore((s) => s.personal.habits));
  const now = useNow(60_000);
  const [view, setView] = useState<View>(() => wantedView() ?? 'month');
  const [start, setStart] = useState(() => dayKey(now));
  const [span, setSpan] = useState(savedSpan);
  useEffect(clearWanted, []);
  // A week always begins on Monday; three days begin wherever they were put.
  const first = pageStart(start, span);
  // The task whose window is open, or the one being made.
  const [taskId, setTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  // The day whose small window is open, and the one last opened, which the month keeps lit.
  const [plateDay, setPlateDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [newHabit, setNewHabit] = useState(0);
  const open = tasks.find((t) => t.id === taskId);
  const openTask = (t: Task) => setTaskId(t.id);
  const showDay = (d: string) => {
    setPicked(d);
    setPlateDay(d);
  };
  const toHours = (d: string) => {
    setPlateDay(null);
    setStart(pageStart(d, span));
    setView('hours');
  };
  const changeSpan = (n: number) => {
    setSpan(n);
    try {
      localStorage.setItem(SPAN_KEY, String(n));
    } catch {
      /* it will just start from three days next time */
    }
  };
  const full = view !== 'habits';
  const plus = view === 'habits' ? () => setNewHabit((n) => n + 1) : () => setDraft({ due: view === 'hours' && !daysFrom(first, span).includes(dayKey(now)) ? first : dayKey(now) });

  return (
    <>
      <div className={`budget tasks is-${view}${full ? ' is-full' : ''}`}>
        <div className="tasks-col">
          <Recede from={2.4} className="tasks-seg">
            <Seg
              value={view}
              onChange={setView}
              label="Раздел"
              options={[
                { id: 'month', label: 'Календарь' },
                { id: 'hours', label: 'По часам' },
                { id: 'habits', label: 'Привычки' },
              ]}
            />
          </Recede>
          {/* No initial={false} here: it would silence every entrance inside on arrival at the screen. */}
          <AnimatePresence mode="wait">
            <motion.div key={view} className={full ? 'tasks-fill' : undefined} initial={{ opacity: 0, y: 14, ...blur(6) }} animate={{ opacity: 1, y: 0, ...blur(0) }} exit={{ opacity: 0, y: -10, ...blur(4) }} transition={{ duration: 0.3, ease: EASE }}>
              {view === 'month' && <CalendarView tasks={tasks} shifts={shifts} now={now} picked={picked} onDay={showDay} onOpen={openTask} />}
              {view === 'hours' && <Timeline tasks={tasks} shifts={shifts} now={now} start={first} span={span} draft={draft} onStart={setStart} onSpan={changeSpan} onOpen={openTask} onNew={(due, time) => setDraft({ due, time })} onCalendar={() => setView('month')} />}
              {view === 'habits' && <Habits habits={habits} now={now} adding={newHabit} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        <motion.button
          key="plus"
          type="button"
          className="fab-plus"
          aria-label={view === 'habits' ? 'Новая привычка' : 'Новая задача'}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 90 }}
          transition={POP}
          whileTap={{ scale: 0.85 }}
          onClick={plus}
        >
          <Icon name="plus" size={26} stroke={2} />
        </motion.button>
      </AnimatePresence>
      <DayPlate
        day={plateDay}
        onClose={() => setPlateDay(null)}
        onHours={toHours}
        onOpenTask={(t) => {
          setPlateDay(null);
          setTaskId(t.id);
        }}
      />
      <TaskPlate task={open} draft={draft} onClose={() => (setTaskId(null), setDraft(null))} />
    </>
  );
}

/* ─────────── Hour by hour ─────────── */

interface TimelineProps {
  tasks: Task[];
  shifts: Shift[];
  now: Date;
  start: string;
  span: number;
  /** A task being made for an hour: that hour stands marked while its window is open. */
  draft: TaskDraft | null;
  onStart: (key: string) => void;
  onSpan: (n: number) => void;
  onOpen: (t: Task) => void;
  onNew: (due: string, time: string) => void;
  /** Pulled down from the days: the month. */
  onCalendar: () => void;
}

/** A task being stretched by one of its edges: where it starts and how long it is, in minutes, as it goes. */
interface Stretch {
  id: string;
  from: number;
  length: number;
}
/** Times snap to a quarter of an hour. */
const SNAP = 15;
const MIN_LENGTH = 15;

function Timeline({ tasks, shifts, now, start, span, draft, onStart, onSpan, onOpen, onNew, onCalendar }: TimelineProps) {
  const today = dayKey(now);
  const [stretch, setStretch] = useState<Stretch | null>(null);
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
      const at = e.target as Element;
      // An edge of a task is for stretching it, not for turning the page.
      if (!at.closest('.tl-heads, .tl-scroll') || at.closest('.tl-edge')) return;
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

  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // A task being stretched is drawn where the finger has it, before it is saved.
  const inDay = (key: string) => tasks.filter((t) => t.due === key).map((t) => (t.id === stretch?.id ? { ...t, time: hhmm(stretch.from), minutes: stretch.length } : t));
  const earliest = Math.min(FIRST_HOUR, ...ribbon.flatMap((d) => inDay(d).flatMap((t) => (t.time ? [Number(t.time.slice(0, 2))] : []))));
  const hours = Array.from({ length: 24 - earliest }, (_, i) => earliest + i);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const top = (minutes: number) => ((minutes - earliest * 60) / 60) * HOUR;
  const unlessPanned = (then: () => void) => () => {
    if (!panned.current) then();
  };
  const lastDay = days[span - 1];
  const title = start.slice(0, 7) === lastDay.slice(0, 7) ? monthName(start.slice(0, 7)) : `${monthName(start.slice(0, 7))} – ${monthName(lastDay.slice(0, 7))}`;

  /** Pulling an edge of a task: the top moves its start, the bottom its end, a quarter of an hour at a time. */
  const pull = (e: React.PointerEvent, task: Task, edge: 'top' | 'bottom') => {
    if (!task.time) return;
    e.stopPropagation();
    e.preventDefault();
    const from0 = toMinutes(task.time);
    const len0 = task.minutes ?? DEFAULT_MINUTES;
    const y0 = e.clientY;
    panned.current = true;
    let cur: Stretch = { id: task.id, from: from0, length: len0 };
    setStretch(cur);
    const move = (m: PointerEvent) => {
      const d = Math.round(((m.clientY - y0) / HOUR) * (60 / SNAP)) * SNAP;
      if (edge === 'bottom') cur = { ...cur, length: Math.max(MIN_LENGTH, Math.min(24 * 60 - from0, len0 + d)) };
      else {
        const f = Math.max(0, Math.min(from0 + len0 - MIN_LENGTH, from0 + d));
        cur = { ...cur, from: f, length: from0 + len0 - f };
      }
      setStretch(cur);
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      if (cur.from !== from0 || cur.length !== len0) actions.updateTask(task.id, { time: hhmm(cur.from), minutes: cur.length });
      setStretch(null);
      setTimeout(() => (panned.current = false), 80);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  };

  // With the current hour further down than the screen reaches, the hours start at it.
  useEffect(() => {
    const box = hoursBox.current;
    if (!box) return;
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
              {capital(title)}
            </motion.h2>
          </AnimatePresence>
        </button>
        <div className="tl-spans">
          <Seg value={String(span)} onChange={(v) => onSpan(Number(v))} label="Сколько дней видно" options={SPANS.map((n) => ({ id: String(n), label: `${n} ${plural(n, ['день', 'дня', 'дней'])}` }))} />
        </div>
      </header>
      <WeekStrip
        anchor={start}
        today={today}
        // A whole week lit would say nothing: there only today is.
        active={span === 7 ? days.filter((d) => d === today) : days}
        onPick={(d) => onStart(pageStart(d, span))}
        onWeek={(d) => onStart(pageStart(dayKey(addDays(parseDay(start), d * 7)), span))}
        onPull={onCalendar}
      />
      <div className="tl-heads">
        <span />
        <div className="tl-view">
          <motion.div className="tl-track" style={{ x, opacity: fade, ...trackStyle }}>
            {ribbon.map((key) => {
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
                  {inDay(key)
                    .filter((t) => !t.time)
                    .map((t) => (
                      <motion.button key={t.id} type="button" tabIndex={off ? -1 : undefined} className={`tl-chip p${t.priority ?? 0}${t.done ? ' is-done' : ''}`} style={{ borderRadius: 8 }} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={POP} whileTap={{ scale: 0.94 }} onClick={unlessPanned(() => onOpen(t))}>
                        {t.title}
                      </motion.button>
                    ))}
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
      {/* Only the hours scroll: the days above them stay where they are. */}
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
                        <button key={h} type="button" className="tl-slot" style={{ top: (h - earliest) * HOUR, height: HOUR }} aria-label={`Новая задача, ${shortDate(key)}, ${h}:00`} onClick={unlessPanned(() => onNew(key, `${String(h).padStart(2, '0')}:00`))} />
                      ))}
                    {draft?.due === key && draft.time && (
                      <motion.i className="tl-ghost" style={{ top: top(toMinutes(draft.time)), height: HOUR - 2 }} initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={POP}>
                        Новая задача
                      </motion.i>
                    )}
                    {layoutDay(inDay(key)).map((p) => {
                      const height = Math.max(22, (p.length / 60) * HOUR - 2);
                      const live = stretch?.id === p.task.id;
                      return (
                        <motion.div
                          key={p.task.id}
                          role="button"
                          tabIndex={off ? -1 : 0}
                          className={`tl-block p${p.task.priority ?? 0}${p.task.done ? ' is-done' : ''}${live ? ' is-stretching' : ''}`}
                          style={{ top: top(p.from), height, left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 2px)`, borderRadius: 12 }}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={POP}
                          onClick={unlessPanned(() => onOpen(p.task))}
                          onKeyDown={(e) => e.key === 'Enter' && onOpen(p.task)}
                        >
                          <span className="tl-block-title">{p.task.title}</span>
                          {(p.length >= 40 || live) && <span className="tl-block-time">{timeRange(p.task)}</span>}
                          {!off && (
                            <>
                              <span className="tl-edge is-top" aria-hidden="true" onPointerDown={(e) => pull(e, p.task, 'top')} />
                              <span className="tl-edge is-bottom" aria-hidden="true" onPointerDown={(e) => pull(e, p.task, 'bottom')} />
                            </>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })}
            </motion.div>
          </div>
          {/* The time now runs across every day on the screen. */}
          {minutesNow >= earliest * 60 && (
            <>
              <motion.i className="tl-now" style={{ top: top(minutesNow), originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.35, duration: 0.6, ease: EASE }} />
              <motion.b className="tl-now-pill" style={{ top: top(minutesNow) }} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, ...POP }}>
                {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
              </motion.b>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
