import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { openSheet } from '../../app/sheet';
import { EASE } from '../../app/ui/text';
import { addMonths, dayKey, monthIn, monthName, parseDay, ymKey } from '../../lib/dates';
import { rub } from '../../lib/money';
import type { Goal, Shift, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Plate } from '../Plate';
import { activeGoals } from './goalLogic';
import { hoursText, monthCells, monthShifts, progressBetween, smartGroups, timeRange, todayStats } from './logic';
import { ShiftGlyph } from './ShiftGlyph';
import { completeTask } from './TaskWindow';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i);
/** How long the scroll has to be still before it is settled on one of the two pages, ms. */
const SETTLE = 110;
/** Task titles a day cell has room for. */
const IN_CELL = 2;

export interface CalendarProps {
  tasks: Task[];
  goals: Goal[];
  shifts: Shift[];
  now: Date;
  /** The day whose window is open. */
  picked: string | null;
  openedMorph?: string;
  onDay: (day: string) => void;
  onOpen: (t: Task, morph: string) => void;
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

function Month({ tasks, goals, shifts, now, picked, onDay }: CalendarProps) {
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
  const goalEnds = useMemo(() => new Set(activeGoals(goals).map((g) => g.end)), [goals]);
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
                {monthName(ym).replace(/^./, (c) => c.toUpperCase())}
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
          <motion.button type="button" className="mcal-turn" aria-label="Предыдущий месяц" onClick={() => turn(-1)} whileTap={{ scale: 0.82, x: -3 }}>
            <Icon name="back" size={16} stroke={2.2} />
          </motion.button>
          <motion.button type="button" className="mcal-turn is-next" aria-label="Следующий месяц" onClick={() => turn(1)} whileTap={{ scale: 0.82, x: 3 }}>
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
                    {goalEnds.has(key) && (
                      <i className="mcell-flag">
                        <Icon name="flag" size={9} stroke={2.6} />
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

      <div className="mcal-shifts">
        <span>
          <strong>Смены в {monthIn(ym)}</strong>
          {worked.list.length ? ` · ${worked.list.length} · ${hoursText(worked.hours)} ч · ${rub(worked.pay)}` : ' · пока нет'}
        </span>
        <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => openSheet('shift', { date: ym === today.slice(0, 7) ? today : `${ym}-01` })}>
          <Icon name="plus" size={14} stroke={2.2} />
          Смена
        </motion.button>
      </div>

      <Plate open={pick === 'month'} title="Месяц" note={String(year)} onClose={() => setPick(null)}>
        <div className="plate-grid">
          {MONTHS.map((m) => {
            const key = `${year}-${String(m + 1).padStart(2, '0')}`;
            return (
              <motion.button key={m} type="button" className={`plate-chip${key === ym ? ' is-on' : ''}${key === today.slice(0, 7) ? ' is-now' : ''}`} onClick={() => jump(key)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 + m * 0.02, duration: 0.3, ease: EASE }}>
                {monthName(key).replace(/^./, (c) => c.toUpperCase())}
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
      <motion.circle cx={size / 2} cy={size / 2} r={r} className="aring-fill" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - share) }} viewport={{ once: false }} transition={{ duration: 1.1, ease: EASE }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

const STATS = [
  { id: 'all', label: 'Всего', icon: 'list', tone: 'blue' },
  { id: 'done', label: 'Готово', icon: 'check', tone: 'green' },
  { id: 'left', label: 'Осталось', icon: 'clock', tone: 'orange' },
  { id: 'urgent', label: 'Срочно', icon: 'bolt', tone: 'red' },
] as const;

function Agenda({ tasks, now, openedMorph, onOpen }: CalendarProps) {
  const today = dayKey(now);
  const ym = ymKey(now);
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const stats = todayStats(tasks, today);
  const day = progressBetween(tasks, today, today);
  const month = progressBetween(tasks, `${ym}-01`, `${ym}-31`);
  const plan = tasks.filter((t) => t.due === today).sort((a, b) => Number(a.done) - Number(b.done) || (a.time ?? '99').localeCompare(b.time ?? '99') || (b.priority ?? 0) - (a.priority ?? 0));
  const tags = useMemo(() => [...new Set(tasks.filter((t) => !t.done).flatMap((t) => t.tags ?? []))], [tasks]);
  const groups = smartGroups(tag ? tasks.filter((t) => t.tags?.includes(tag)) : tasks, now).filter((g) => g.id !== 'today');
  const reveal = (i: number) => ({ initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.3 }, transition: { delay: i * 0.05, duration: 0.55, ease: EASE } });

  return (
    <div className="agenda">
      <motion.header className="agenda-head" {...reveal(0)}>
        <h2>План на сегодня</h2>
        <p>{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </motion.header>

      <div className="agenda-progress">
        {[
          { label: 'Сегодня', p: day },
          { label: monthName(ym).replace(/^./, (c) => c.toUpperCase()), p: month },
        ].map((x, i) => (
          <motion.div key={x.label} className="glass aprog" {...reveal(i + 1)}>
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

      <div className="agenda-stats">
        {STATS.map((s, i) => (
          <motion.div key={s.id} className={`glass astat is-${s.tone}`} {...reveal(i + 2)}>
            <Icon name={s.icon} size={18} stroke={2.2} />
            <strong>{stats[s.id]}</strong>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>

      {plan.length ? (
        <ul className="acards">
          <AnimatePresence initial={false}>
            {plan.map((t, i) => (
              <TaskCard key={t.id} task={t} index={i} openedMorph={openedMorph} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="agenda-empty">На сегодня ничего нет. Плюс внизу добавит задачу</p>
      )}

      {tags.length > 0 && (
        <div className="tags agenda-tags" role="group" aria-label="Метки">
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
          <section key={g.id} className={`agroup agroup--${g.id}`}>
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
              <ul className="acards">
                <AnimatePresence initial={false}>
                  {g.tasks.map((t, i) => (
                    <TaskCard key={t.id} task={t} index={i} compact openedMorph={openedMorph} onOpen={onOpen} />
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

/** A task as a card: a coloured edge for how important it is, a ring to tick, its time and steps. */
function TaskCard({ task, index, compact = false, openedMorph, onOpen }: { task: Task; index: number; compact?: boolean; openedMorph?: string; onOpen: (t: Task, morph: string) => void }) {
  const morph = `card-${task.id}`;
  const subs = task.subtasks ?? [];
  const subsDone = subs.filter((s) => s.done).length;
  const when = [compact && task.due ? parseDay(task.due).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : '', timeRange(task)].filter(Boolean).join(', ');

  return (
    <motion.li
      layout="position"
      className={`acard p${task.priority ?? 0}${task.done ? ' is-done' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      exit={{ opacity: 0, height: 0, paddingBottom: 0, transition: { duration: 0.28, ease: EASE } }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.5, ease: EASE }}
    >
      <div className="acard-box">
        <motion.button type="button" className="acard-check" aria-pressed={task.done} aria-label={task.done ? `Вернуть «${task.title}»` : `Готово: «${task.title}»`} onClick={() => completeTask(task)} whileTap={{ scale: 0.8 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <motion.path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: task.done ? 1 : 0, opacity: task.done ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
          </svg>
        </motion.button>
        <motion.button layoutId={morph} type="button" className="acard-main" style={{ borderRadius: 14, visibility: openedMorph === morph ? 'hidden' : undefined }} onClick={() => onOpen(task, morph)}>
          <span className="acard-title">{task.title}</span>
          {!compact && task.desc && <span className="acard-desc">{task.desc}</span>}
          {(when || task.tags?.length || subs.length > 0 || task.repeat) && (
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
              {task.repeat && <Icon name="repeat" size={12} stroke={2} />}
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
        </motion.button>
      </div>
    </motion.li>
  );
}
