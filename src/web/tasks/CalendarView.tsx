import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EASE } from '../../app/ui/text';
import { addMonths, dayKey, monthIn, monthName, parseDay, ymKey } from '../../lib/dates';
import { rub } from '../../lib/money';
import type { Shift, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Plate } from '../Plate';
import { hoursText, monthCells, monthShifts, progressBetween, smartGroups, timeRange, todayStats } from './logic';
import { collapse, revealInView, unfold } from './motion';
import { ShiftGlyph } from './ShiftGlyph';
import { completeTask } from './taskActions';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i);
/** How long the scroll has to be still before it is settled on one of the two pages, ms. */
const SETTLE = 110;
/** Task titles a day cell has room for. */
const IN_CELL = 2;
const capital = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export interface CalendarProps {
  tasks: Task[];
  shifts: Shift[];
  now: Date;
  /** The day whose window was opened last. */
  picked: string | null;
  onDay: (day: string) => void;
  onOpen: (t: Task) => void;
}

/**
 * Two pages one over the other: the month on the whole screen, and under it, one swipe away, the
 * list of everything to do with the day's progress on top.
 */
export function CalendarView(props: CalendarProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [onList, setOnList] = useState(false);

  // Between the two pages it never stops: whichever way it was going, it goes on there.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let last = el.scrollTop;
    let dir = 0;
    let t = 0;
    let touching = false;
    const settle = () => {
      const top = list.current?.offsetTop ?? el.clientHeight;
      const y = el.scrollTop;
      if (touching || y <= 2 || y >= top - 2) return;
      el.scrollTo({ top: dir >= 0 ? top : 0, behavior: 'smooth' });
    };
    const onScroll = () => {
      const y = el.scrollTop;
      if (y !== last) dir = y > last ? 1 : -1;
      last = y;
      setOnList(y > el.clientHeight * 0.5);
      clearTimeout(t);
      t = window.setTimeout(settle, SETTLE);
    };
    const down = () => (touching = true);
    const up = () => {
      touching = false;
      clearTimeout(t);
      t = window.setTimeout(settle, SETTLE);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchend', up, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchend', up);
    };
  }, []);

  const go = (toList: boolean) => scroller.current?.scrollTo({ top: toList ? (list.current?.offsetTop ?? 0) : 0, behavior: 'smooth' });

  return (
    <div ref={scroller} className="calv">
      <section className="calv-page">
        <Month {...props} />
        <motion.button type="button" className="calv-hint" onClick={() => go(true)} animate={{ opacity: onList ? 0 : 1 }} whileTap={{ scale: 0.95 }}>
          <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
            <Icon name="down" size={16} stroke={2.2} />
          </motion.span>
          Свайп для просмотра списка
        </motion.button>
      </section>
      <section ref={list} className="calv-page calv-list">
        <button type="button" className="calv-back" onClick={() => go(false)} aria-label="К месяцу">
          <Icon name="down" size={16} stroke={2.2} />
        </button>
        <Agenda {...props} />
      </section>
    </div>
  );
}

/* ─────────── The month ─────────── */

function Month({ tasks, shifts, now, picked, onDay }: CalendarProps) {
  const today = dayKey(now);
  const [ym, setYm] = useState(() => (picked ?? today).slice(0, 7));
  const [dir, setDir] = useState(0);
  const [pick, setPick] = useState<'month' | 'year' | null>(null);
  const cells = monthCells(ym);
  const rows = cells.length / 7;
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.due) m.set(t.due, [...(m.get(t.due) ?? []), t]);
    for (const list of m.values()) list.sort((a, b) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99'));
    return m;
  }, [tasks]);
  const worked = monthShifts(shifts, ym);
  const origin = Math.max(0, cells.indexOf(today)) || 17;
  const year = Number(ym.slice(0, 4));

  const turn = (n: number) => {
    setDir(n);
    setYm(addMonths(ym, n));
  };
  const jump = (next: string) => {
    setDir(next > ym ? 1 : -1);
    setYm(next);
    setPick(null);
  };

  return (
    <div className="mcal">
      <header className="mcal-head">
        <div className="mcal-titles">
          <button type="button" className="mcal-pick" onClick={() => setPick('month')}>
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.span key={ym.slice(5)} custom={dir} variants={{ enter: (d: number) => ({ opacity: 0, y: d * 16 }), show: { opacity: 1, y: 0 }, leave: (d: number) => ({ opacity: 0, y: d * -16 }) }} initial="enter" animate="show" exit="leave" transition={{ duration: 0.3, ease: EASE }}>
                {capital(monthName(ym))}
              </motion.span>
            </AnimatePresence>
            <Icon name="chevron" size={14} stroke={2.2} />
          </button>
          <button type="button" className="mcal-pick is-year" onClick={() => setPick('year')}>
            {year}
            <Icon name="chevron" size={14} stroke={2.2} />
          </button>
        </div>
        <div className="mcal-turns">
          <motion.button type="button" className="round-btn mcal-turn" aria-label="Предыдущий месяц" onClick={() => turn(-1)} whileTap={{ scale: 0.82, x: -3 }}>
            <Icon name="back" size={16} stroke={2.2} />
          </motion.button>
          <motion.button type="button" className="round-btn mcal-turn is-next" aria-label="Следующий месяц" onClick={() => turn(1)} whileTap={{ scale: 0.82, x: 3 }}>
            <Icon name="back" size={16} stroke={2.2} />
          </motion.button>
        </div>
      </header>

      <div className="mcal-week" aria-hidden="true">
        {WEEK.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="mcal-stage">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={ym}
            className="mcal-grid"
            style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
            custom={dir}
            variants={{ enter: (d: number) => ({ opacity: 0, x: d * 50 }), show: { opacity: 1, x: 0 }, leave: (d: number) => ({ opacity: 0, x: d * -50 }) }}
            initial="enter"
            animate="show"
            exit="leave"
            transition={{ duration: 0.34, ease: EASE }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, i) => {
              if (Math.abs(i.offset.x) > 60) turn(i.offset.x < 0 ? 1 : -1);
            }}
          >
            {cells.map((key, i) => {
              const list = byDay.get(key) ?? [];
              const dayShifts = shifts.filter((s) => s.date === key);
              const far = Math.hypot(Math.floor(i / 7) - Math.floor(origin / 7), (i % 7) - (origin % 7));
              const cls = ['mcell', !key.startsWith(ym) && 'is-other', key === today && 'is-today', key === picked && 'is-picked', list.length > 0 && list.every((t) => t.done) && 'is-clear'].filter(Boolean).join(' ');
              return (
                <button key={key} type="button" className={cls} style={{ '--d': `${far * 0.035}s` } as CSSProperties} aria-label={parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + (list.length ? `, задач: ${list.length}` : '')} onClick={() => onDay(key)}>
                  <span className="mcell-top">
                    <strong>{Number(key.slice(8))}</strong>
                    {dayShifts.length > 0 && (
                      <i className="mcell-shift">
                        {dayShifts.map((s) => (
                          <ShiftGlyph key={s.id} type={s.type} size={11} />
                        ))}
                      </i>
                    )}
                  </span>
                  <span className="mcell-tasks">
                    {list.slice(0, IN_CELL).map((t) => (
                      <span key={t.id} className={`mcell-task p${t.priority ?? 0}${t.done ? ' is-done' : ''}`}>
                        {t.title}
                      </span>
                    ))}
                    {list.length > IN_CELL && <span className="mcell-more">+{list.length - IN_CELL}</span>}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mcal-shifts">
        <strong>Смены в {monthIn(ym)}</strong>
        {worked.list.length ? ` · ${worked.list.length} · ${hoursText(worked.hours)} ч · ${rub(worked.pay)}` : ' · пока нет'}
      </p>

      <Plate open={pick === 'month'} title="Месяц" note={String(year)} onClose={() => setPick(null)}>
        <div className="plate-grid">
          {MONTHS.map((m) => {
            const key = `${year}-${String(m + 1).padStart(2, '0')}`;
            return (
              <motion.button key={m} type="button" className={`plate-chip${key === ym ? ' is-on' : ''}${key === today.slice(0, 7) ? ' is-now' : ''}`} onClick={() => jump(key)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 + m * 0.02, duration: 0.3, ease: EASE }}>
                {capital(monthName(key))}
              </motion.button>
            );
          })}
        </div>
      </Plate>
      <Plate open={pick === 'year'} title="Год" onClose={() => setPick(null)}>
        <div className="plate-grid">
          {[-2, -1, 0, 1, 2, 3].map((n, i) => {
            const y = Number(today.slice(0, 4)) + n;
            return (
              <motion.button key={y} type="button" className={`plate-chip${y === year ? ' is-on' : ''}`} onClick={() => jump(`${y}${ym.slice(4)}`)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 + i * 0.03, duration: 0.3, ease: EASE }}>
                {y}
              </motion.button>
            );
          })}
        </div>
      </Plate>
    </div>
  );
}

/* ─────────── The list under it ─────────── */

function Ring({ share, size = 54 }: { share: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg className="aring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="aring-track" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} className="aring-fill" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - share) }} transition={{ duration: 1.1, ease: EASE }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

const STATS = [
  { id: 'all', label: 'Всего', icon: 'list', tone: 'blue', empty: 'На сегодня задач нет' },
  { id: 'done', label: 'Готово', icon: 'check', tone: 'green', empty: 'Сегодня ещё ничего не готово' },
  { id: 'left', label: 'Осталось', icon: 'clock', tone: 'orange', empty: 'Всё на сегодня сделано' },
  { id: 'urgent', label: 'Срочно', icon: 'bolt', tone: 'red', empty: 'Срочного нет' },
] as const;
type StatId = (typeof STATS)[number]['id'];

function Agenda({ tasks, now, onOpen }: CalendarProps) {
  const today = dayKey(now);
  const ym = ymKey(now);
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [stat, setStat] = useState<StatId | null>(null);
  const stats = todayStats(tasks, today);
  const day = progressBetween(tasks, today, today);
  const month = progressBetween(tasks, `${ym}-01`, `${ym}-31`);
  const byTime = (a: Task, b: Task) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99') || (b.priority ?? 0) - (a.priority ?? 0);
  const mine = tasks.filter((t) => t.due === today);
  const plan = [...mine].sort(byTime);
  // What each tile counts, so the list it opens holds exactly that.
  const statList: Record<StatId, Task[]> = {
    all: plan,
    done: plan.filter((t) => t.done),
    left: plan.filter((t) => !t.done),
    urgent: tasks.filter((t) => !t.done && t.due && (t.due < today || (t.due === today && (t.priority ?? 0) >= 3))).sort(byTime),
  };
  const tags = useMemo(() => [...new Set(tasks.filter((t) => !t.done).flatMap((t) => t.tags ?? []))], [tasks]);
  const groups = smartGroups(tag ? tasks.filter((t) => t.tags?.includes(tag)) : tasks, now).filter((g) => g.id !== 'today');
  const open = STATS.find((s) => s.id === stat);

  return (
    <div className="agenda">
      <motion.header className="agenda-head" {...revealInView(0)}>
        <h2>План на сегодня</h2>
        <p>{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </motion.header>

      <div className="agenda-progress">
        {[
          { label: 'Сегодня', p: day },
          { label: capital(monthName(ym)), p: month },
        ].map((x, i) => (
          <motion.div key={x.label} className="tcard aprog" {...revealInView(i + 1)}>
            <span className="aprog-ring">
              <Ring share={x.p.all ? x.p.done / x.p.all : 0} />
              <strong>{x.p.all ? Math.round((x.p.done / x.p.all) * 100) : 0}%</strong>
            </span>
            <span className="aprog-words">
              <strong>{x.label}</strong>
              <span>{x.p.all ? `${x.p.done} из ${x.p.all} готово` : 'Задач нет'}</span>
            </span>
          </motion.div>
        ))}
      </div>

      {/* A tile opens into its list: the tile goes to the left, what it counts comes in on the right. */}
      <LayoutGroup>
        <motion.div layout className={`agenda-stats${open ? ' is-open' : ''}`} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
          {STATS.filter((s) => !open || s.id === open.id).map((s, i) => (
            <motion.button
              key={s.id}
              layout
              type="button"
              className={`tcard astat is-${s.tone}${stat === s.id ? ' is-on' : ''}`}
              aria-expanded={stat === s.id}
              onClick={() => setStat(stat === s.id ? null : s.id)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, opacity: { delay: open ? 0 : i * 0.04 } }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon name={s.icon} size={18} stroke={2.2} />
              <strong>{stats[s.id]}</strong>
              <span>{s.label}</span>
            </motion.button>
          ))}
          <AnimatePresence>
            {open && (
              <motion.ul key={open.id} className="astat-list" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }} transition={{ delay: 0.08, duration: 0.4, ease: EASE }}>
                {statList[open.id].length ? (
                  statList[open.id].map((t, i) => (
                    <motion.li key={t.id} className={`p${t.priority ?? 0}${t.done ? ' is-done' : ''}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.04, duration: 0.35, ease: EASE }}>
                      <button type="button" className="plate-tick" aria-pressed={t.done} aria-label={t.done ? `Вернуть «${t.title}»` : `Готово: «${t.title}»`} onClick={() => completeTask(t)}>
                        <Icon name="check" size={11} stroke={3} />
                      </button>
                      <button type="button" className="astat-task" onClick={() => onOpen(t)}>
                        <span>{t.title}</span>
                        {(t.time || t.due !== today) && <small>{[t.due !== today && t.due ? parseDay(t.due).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : '', timeRange(t)].filter(Boolean).join(', ')}</small>}
                      </button>
                    </motion.li>
                  ))
                ) : (
                  <li className="astat-empty">{open.empty}</li>
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {plan.length ? (
        <ul className="acards">
          <AnimatePresence initial={false}>
            {plan.map((t, i) => (
              <TaskCard key={t.id} task={t} index={i} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="agenda-empty">На сегодня ничего нет. Плюс внизу добавит задачу</p>
      )}

      {tags.length > 0 && (
        <div className="plate-chips agenda-tags" role="group" aria-label="Хэштеги">
          {tags.map((t) => (
            <button key={t} type="button" className={`plate-chip${tag === t ? ' is-on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {groups.map((g) => {
        const folds = g.id === 'done';
        const shown = !folds || showDone;
        return (
          <section key={g.id} className={`agroup agroup--${g.id}`}>
            <h3>
              {folds ? (
                <button type="button" className="agroup-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
                  {g.label}
                  <span>{g.tasks.length}</span>
                  <motion.i animate={{ rotate: showDone ? 90 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
                    <Icon name="chevron" size={14} stroke={2.2} />
                  </motion.i>
                </button>
              ) : (
                <>
                  {g.label}
                  <span>{g.tasks.length}</span>
                </>
              )}
            </h3>
            <AnimatePresence initial={false}>
              {shown && (
                <motion.ul key="list" className="acards" {...(folds ? unfold : {})}>
                  <AnimatePresence initial={false}>
                    {g.tasks.map((t, i) => (
                      <TaskCard key={t.id} task={t} index={i} compact onOpen={onOpen} />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

/** A task as a card: a coloured edge for how important it is, a ring to tick, its time and steps. */
function TaskCard({ task, index, compact = false, onOpen }: { task: Task; index: number; compact?: boolean; onOpen: (t: Task) => void }) {
  const subs = task.subtasks ?? [];
  const subsDone = subs.filter((s) => s.done).length;
  const when = [compact && task.due ? parseDay(task.due).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : '', timeRange(task)].filter(Boolean).join(', ');

  return (
    <motion.li layout="position" className={`acard p${task.priority ?? 0}${task.done ? ' is-done' : ''}`} {...revealInView(index)} exit={collapse}>
      <div className="tcard acard-box">
        <motion.button type="button" className="acard-check" aria-pressed={task.done} aria-label={task.done ? `Вернуть «${task.title}»` : `Готово: «${task.title}»`} onClick={() => completeTask(task)} whileTap={{ scale: 0.8 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <motion.path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: task.done ? 1 : 0, opacity: task.done ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
          </svg>
        </motion.button>
        <button type="button" className="acard-main" onClick={() => onOpen(task)}>
          <span className="acard-title">{task.title}</span>
          {(when || task.tags?.length || subs.length > 0) && (
            <span className="acard-meta">
              {task.tags?.slice(0, 2).map((t) => (
                <em key={t} className="acard-tag">
                  #{t}
                </em>
              ))}
              {when && (
                <span className="acard-time">
                  <Icon name="clock" size={12} stroke={2} />
                  {when}
                </span>
              )}
              {subs.length > 0 && (
                <span className="acard-subs">
                  {subsDone}/{subs.length}
                </span>
              )}
            </span>
          )}
          {!compact && subs.length > 0 && (
            <span className="acard-bar">
              <i style={{ transform: `scaleX(${subsDone / subs.length})` }} />
            </span>
          )}
        </button>
      </div>
    </motion.li>
  );
}
