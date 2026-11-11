import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { openSheet } from '../../app/sheet';
import { toggleTheme, useTheme } from '../../app/theme';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import { addDays, dayKey, daysBetween, monthName, parseDay } from '../../lib/dates';
import type { Shift, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import type { TasksView } from './entry';
import { DEFAULT_MINUTES, hoursText, layoutDay, nearestSpan, pageStart, restZones, shiftName, SPANS, timeRange, toMinutes, turnPages } from './logic';
import { ShiftGlyph } from './ShiftGlyph';
import { completeTask } from './taskActions';
import type { TaskDraft } from './TaskPlate';
import { WeekStrip } from './WeekStrip';

/** The height of an hour. */
const HOUR = 64;
/** The whole day, from midnight to midnight. */
const DAY = 24 * 60;
/** The column of the hours on the left, px. */
const GUTTER = 48;
const MIN_SPAN = SPANS[0];
const MAX_SPAN = SPANS[SPANS.length - 1];
/** A little past either end while the fingers are still on it. */
const STRETCH = 0.3;
/** From this many days on, the columns are narrow and everything in them tightens up. */
const DENSE = 5;
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
/** Lower than this a task is a thin strip with one line in it, px. */
const THIN = 34;
/** An hour's label gives way to a task's own time this close to it, minutes. */
const NEAR = 22;
const GLIDE = { type: 'spring', stiffness: 300, damping: 34 } as const;
const TURN = { type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const;
const POP = { type: 'spring', stiffness: 420, damping: 30 } as const;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const shortDate = (key: string) => parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
const daysFrom = (first: string, n: number) => Array.from({ length: n }, (_, i) => dayKey(addDays(parseDay(first), i)));

/** The line of the day down the hours: a slow wave, the same every day, so it reads as a road and not as data. */
function dayLinePath(hourPx: number): string {
  const pts = Array.from({ length: 25 }, (_, h) => [7 + 5 * Math.sin(h * 0.75 + 0.6) + 2 * Math.sin(h * 1.9), h * hourPx] as const);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1]}`;
  }
  return d;
}

interface Props {
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
  /** The menu's way to the other sections. */
  onView: (v: TasksView) => void;
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

/**
 * The day hour by hour, from midnight to midnight: a glass bar with the week floating over it,
 * whole-width cards for the tasks, striped pauses between them, and a line of the day down the hours.
 * Pinched, it shows three days or a week; sideways it turns a page.
 */
export function Hours({ tasks, shifts, now, start, span, draft, onStart, onSpan, onOpen, onNew, onCalendar, onView }: Props) {
  const today = dayKey(now);
  const [stretch, setStretch] = useState<Stretch | null>(null);
  const [menu, setMenu] = useState(false);
  const { theme } = useTheme();
  const days = useMemo(() => daysFrom(start, span), [start, span]);
  // One page of days on each side is drawn, so a swipe finds its neighbours ready. While the number of days itself changes, all of them are.
  const [wide, setWide] = useState(false);
  const around = wide ? MAX_SPAN : span;
  const count = wide ? MAX_SPAN * 3 : span * 3;
  const ribbon = useMemo(() => daysFrom(dayKey(addDays(parseDay(start), -around)), count), [start, around, count]);
  const trackStyle = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, width: `calc(${count * 100}% / var(--span))`, marginLeft: `calc(${-around * 100}% / var(--span))` };
  const root = useRef<HTMLElement>(null);
  const topBox = useRef<HTMLDivElement>(null);
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

  // The hours start under the floating bar, whatever it holds today.
  useLayoutEffect(() => {
    const box = topBox.current;
    const el = root.current;
    if (!box || !el) return;
    const put = () => el.style.setProperty('--hx-top', `${box.offsetHeight}px`);
    put();
    const ro = new ResizeObserver(put);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

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

  // The fingers came off: settle on one of the views, and on whichever day ended up at the left edge.
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

  // A task being stretched is drawn where the finger has it, before it is saved.
  const inDay = (key: string) => tasks.filter((t) => t.due === key).map((t) => (t.id === stretch?.id ? { ...t, time: hhmm(stretch.from), minutes: stretch.length } : t));
  const hours = Array.from({ length: 25 }, (_, h) => h);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const top = (minutes: number) => (minutes / 60) * HOUR;
  const unlessPanned = (then: () => void) => () => {
    if (!panned.current) then();
  };
  const linePath = useMemo(() => dayLinePath(HOUR), []);

  // With one day on the screen its tasks put their own start times on the left, and the hours nearby step aside.
  const single = span === 1;
  const starts = single ? layoutDay(inDay(days[0])).map((p) => p.from) : [];
  const nearStart = (h: number) => starts.some((m) => Math.abs(m - h * 60) < NEAR);
  // The time now has its own red label on the left, and the hour under it steps aside too.
  const nearNow = (h: number) => days.includes(today) && Math.abs(minutesNow - h * 60) < NEAR;

  // The ring: how much of the days on the screen is done.
  const onScreen = tasks.filter((t) => t.due && days.includes(t.due));
  const share = onScreen.length ? onScreen.filter((t) => t.done).length / onScreen.length : 0;
  // The line of the day is bright up to now: wholly for a day gone, not at all for one to come.
  const lit = days.includes(today) ? top(minutesNow) : days[days.length - 1] < today ? top(DAY) : 0;
  const hasHeads = ribbon.some((d) => shifts.some((s) => s.date === d) || inDay(d).some((t) => !t.time));
  const ym = (span === 7 ? days[3] : days[0]).slice(0, 7);

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
      if (edge === 'bottom') cur = { ...cur, length: Math.max(MIN_LENGTH, Math.min(DAY - from0, len0 + d)) };
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

  // Arriving, the hours open at the time now, a little above the middle of the screen.
  useEffect(() => {
    const box = hoursBox.current;
    if (!box) return;
    box.scrollTo({ top: Math.max(0, top(minutesNow) - box.clientHeight * 0.35) });
    // Only on arrival: later it is the owner who scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (v: TasksView) => {
    setMenu(false);
    onView(v);
  };

  return (
    <section ref={root} className="tl hx" style={{ '--gut': `${GUTTER}px` } as React.CSSProperties}>
      <div ref={topBox} className="hx-top">
        <div className="hx-bar">
          <motion.button type="button" className={`hx-menu${menu ? ' is-open' : ''}`} aria-label="Меню" aria-expanded={menu} onClick={() => setMenu((m) => !m)} whileTap={{ scale: 0.88 }}>
            <i />
            <i />
          </motion.button>
          <WeekStrip
            anchor={start}
            today={today}
            // A whole week lit would say nothing: there only today is.
            active={span === 7 ? days.filter((d) => d === today) : days}
            onPick={(d) => onStart(pageStart(d, span))}
            onWeek={(d) => onStart(pageStart(dayKey(addDays(parseDay(start), d * 7)), span))}
            onPull={onCalendar}
          />
          <div className="hx-ring" role="img" aria-label={onScreen.length ? `Сделано ${Math.round(share * 100)}%` : 'Задач нет'}>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="16.5" className="hx-ring-track" />
              <motion.circle cx="20" cy="20" r="16.5" className="hx-ring-fill" style={{ opacity: share ? 1 : 0 }} pathLength={1} initial={{ pathLength: 0 }} animate={{ pathLength: share }} transition={{ duration: 0.9, ease: EASE }} />
            </svg>
            <span>{onScreen.length ? Math.round(share * 100) : '–'}</span>
          </div>
        </div>
        <AnimatePresence>
          {menu && (
            <>
              <motion.button key="shade" type="button" className="hx-shade" aria-label="Закрыть меню" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
              <motion.div key="pop" className="hx-pop" initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -6 }} transition={POP} style={{ originX: 0, originY: 0 }}>
                <p className="hx-pop-month">{monthName(ym)} {ym.slice(0, 4)}</p>
                <button type="button" onClick={() => (setMenu(false), onStart(pageStart(today, span)))}>
                  <Icon name="clock" size={18} />
                  Сегодня
                </button>
                <button type="button" onClick={() => go('month')}>
                  <Icon name="calendar" size={18} />
                  Календарь
                </button>
                <button type="button" onClick={() => go('habits')}>
                  <Icon name="repeat" size={18} />
                  Привычки
                </button>
                <div className="hx-pop-spans" role="radiogroup" aria-label="Сколько дней видно">
                  {SPANS.map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={span === n} className={span === n ? 'is-on' : undefined} onClick={() => onSpan(n)}>
                      {n === 1 ? 'День' : n === 3 ? '3 дня' : 'Неделя'}
                    </button>
                  ))}
                </div>
                <hr />
                <button type="button" onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}>
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
                  {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                </button>
                <button type="button" onClick={() => (setMenu(false), openSheet('profile'))}>
                  <Icon name="user" size={18} />
                  Профиль
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        {hasHeads && (
          <div className="tl-heads">
            <span />
            <div className="tl-view">
              <motion.div className="tl-track" style={{ x, opacity: fade, ...trackStyle }}>
                {ribbon.map((key) => {
                  const off = !days.includes(key);
                  return (
                    <div key={key} className="tl-head" aria-hidden={off || undefined}>
                      {shifts
                        .filter((s) => s.date === key)
                        .map((s) => (
                          <button key={s.id} type="button" className="hx-shift" tabIndex={off ? -1 : undefined} aria-label={`${shiftName(s.type)} смена, ${hoursText(s.h)} ч, изменить`} onClick={unlessPanned(() => openSheet('shift', { id: s.id }))}>
                            <ShiftGlyph type={s.type} size={13} />
                            <span>{shiftName(s.type)} · {hoursText(s.h)} ч</span>
                          </button>
                        ))}
                      {inDay(key)
                        .filter((t) => !t.time)
                        .map((t) => (
                          <motion.button key={t.id} type="button" tabIndex={off ? -1 : undefined} className={`tl-chip hx-chip p${t.priority ?? 0}${t.done ? ' is-done' : ''}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={POP} whileTap={{ scale: 0.94 }} onClick={unlessPanned(() => onOpen(t))}>
                            {t.done && <Icon name="check" size={12} stroke={2.6} />}
                            {t.title}
                          </motion.button>
                        ))}
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* The hours scroll under the bar, the whole height of the screen. */}
      <div ref={hoursBox} className="tl-scroll">
        <div className="tl-body" style={{ height: DAY / 60 * HOUR }}>
          <div className="tl-hours" aria-hidden="true">
            <svg className="hx-line" width={GUTTER} height={DAY / 60 * HOUR} viewBox={`0 0 ${GUTTER} ${DAY / 60 * HOUR}`}>
              <defs>
                <clipPath id="hx-lit">
                  <rect x="0" y="0" width={GUTTER} height={lit} />
                </clipPath>
              </defs>
              <path d={linePath} className="hx-line-dim" />
              <path d={linePath} className="hx-line-lit" clipPath="url(#hx-lit)" />
            </svg>
            {hours.map((h) => (
              <span key={h} className={`hx-hour${(single && nearStart(h)) || nearNow(h) ? ' is-hidden' : ''}`} style={{ top: h * HOUR, animationDelay: `${0.1 + Math.min(h, 12) * 0.02}s` }}>
                <b>{pad(h % 24)}</b>:00
              </span>
            ))}
            {single &&
              layoutDay(inDay(days[0])).map((p) => (
                <motion.em key={p.task.id} className={`hx-start${p.task.done ? ' is-done' : ''}`} style={{ top: top(p.from) }} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={POP}>
                  {hhmm(p.from)}
                </motion.em>
              ))}
          </div>
          <div ref={view} className="tl-view">
            <motion.div className="tl-track" style={{ x, opacity: fade, ...trackStyle }}>
              {ribbon.map((key) => {
                const off = !days.includes(key);
                const placed = layoutDay(inDay(key));
                return (
                  <div key={key} className="tl-col" style={{ backgroundSize: `100% ${HOUR}px` }} aria-hidden={off || undefined}>
                    {!off &&
                      hours.slice(0, 24).map((h) => (
                        <button key={h} type="button" className="tl-slot" style={{ top: h * HOUR, height: HOUR }} aria-label={`Новая задача, ${shortDate(key)}, ${h}:00`} onClick={unlessPanned(() => onNew(key, `${pad(h)}:00`))} />
                      ))}
                    {restZones(placed).map((r) => (
                      <i key={r.from} className={`hx-rest${r.to - r.from < 20 ? ' is-short' : ''}`} style={{ top: top(r.from) + 2, height: Math.max(6, top(r.to) - top(r.from) - 4) }}>
                        <span>Перерыв и отдых</span>
                      </i>
                    ))}
                    {draft?.due === key && draft.time && (
                      <motion.i className="tl-ghost" style={{ top: top(toMinutes(draft.time)) + 1, height: HOUR - 3 }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={POP}>
                        Новая задача
                      </motion.i>
                    )}
                    {placed.map((p) => {
                      const height = Math.max(18, (p.length / 60) * HOUR - 3);
                      const thin = height < THIN;
                      const live = stretch?.id === p.task.id;
                      const done = !!p.task.done;
                      const tick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (!panned.current) completeTask(p.task);
                      };
                      return (
                        <motion.div
                          key={p.task.id}
                          role="button"
                          tabIndex={off ? -1 : 0}
                          className={`tl-block hx-block p${p.task.priority ?? 0}${done ? ' is-done' : ''}${thin ? ' is-thin' : ''}${live ? ' is-stretching' : ''}`}
                          style={{ top: top(p.from) + 1, height, left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 3px)` }}
                          initial={{ opacity: 0, scale: 0.94 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={POP}
                          onClick={unlessPanned(() => onOpen(p.task))}
                          onKeyDown={(e) => e.key === 'Enter' && onOpen(p.task)}
                        >
                          <span className="hx-block-text">
                            <span className="tl-block-title">{p.task.title}</span>
                            {!thin && (height >= 56 || live) && <span className="tl-block-time">{timeRange(p.task)}</span>}
                          </span>
                          {thin ? (
                            <button type="button" className="hx-act" tabIndex={off ? -1 : 0} onClick={tick}>
                              {done ? (
                                <>
                                  <Icon name="check" size={11} stroke={2.6} />
                                  Выполнено
                                </>
                              ) : (
                                'Выполнить'
                              )}
                            </button>
                          ) : (
                            <button type="button" className="hx-check" tabIndex={off ? -1 : 0} aria-label={done ? 'Вернуть в работу' : 'Отметить выполненной'} aria-pressed={done} onClick={tick}>
                              <AnimatePresence initial={false}>
                                {done && (
                                  <motion.span key="tick" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={POP}>
                                    <Icon name="check" size={13} stroke={2.8} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </button>
                          )}
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
          <motion.i className="tl-now" style={{ top: top(minutesNow), originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.6, ease: EASE }} />
          <motion.b className="tl-now-pill" style={{ top: top(minutesNow) }} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35, ...POP }}>
            {hhmm(minutesNow)}
          </motion.b>
        </div>
      </div>
    </section>
  );
}
