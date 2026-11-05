import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { addDays, dayKey, monthName, parseDay, ymKey, addMonths } from '../../lib/dates';
import { visible } from '../../lib/records';
import type { Shift, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Recede } from '../Recede';
import { Seg } from '../Seg';
import { useNow } from '../Today';
import { pulseWave } from '../Wave';
import { Focus } from './Focus';
import { DEFAULT_MINUTES, layoutDay, monthCells, parseQuick, quadrantOf, smartGroups, type Quadrant } from './logic';
import { completeTask, TaskWindow } from './TaskWindow';

type View = 'days' | 'list' | 'matrix';
interface Opened {
  id: string;
  morph: string;
}
interface Draft {
  due: string;
  time?: string;
}

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const SPAN = 3;
const FIRST_HOUR = 7;
const HOUR = 44;

const shortDate = (key: string) => parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

export function Tasks() {
  const tasks = visible(useStore((s) => s.personal.tasks));
  const shifts = visible(useStore((s) => s.personal.shifts));
  const now = useNow(60_000);
  const today = dayKey(now);
  const [view, setView] = useState<View>('days');
  const [start, setStart] = useState(today);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const open = tasks.find((t) => t.id === opened?.id);
  const focused = tasks.find((t) => t.id === focus);
  const openTask = (t: Task, morph: string) => setOpened({ id: t.id, morph });

  return (
    <>
      <div className="budget tasks">
        <div className="tasks-col">
          <Recede from={2.4} className="tasks-seg">
            <Seg
              value={view}
              onChange={setView}
              label="Вид"
              options={[
                { id: 'days', label: '3 дня' },
                { id: 'list', label: 'Список' },
                { id: 'matrix', label: 'Матрица' },
              ]}
            />
          </Recede>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}>
              {view === 'days' && <Days tasks={tasks} shifts={shifts} now={now} start={start} onStart={setStart} opened={opened} onOpen={openTask} onSlot={setDraft} />}
              {view === 'list' && <List tasks={tasks} now={now} opened={opened} onOpen={openTask} />}
              {view === 'matrix' && <Matrix tasks={tasks} now={now} opened={opened} onOpen={openTask} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <QuickAdd fallback={view === 'days' ? start : today} draft={draft} onDraftUsed={() => setDraft(null)} />
      {createPortal(
        <>
          <AnimatePresence>{open && opened && <TaskWindow key={open.id} task={open} morph={opened.morph} onClose={() => setOpened(null)} onFocus={() => setFocus(open.id)} />}</AnimatePresence>
          <AnimatePresence>{focused && <Focus key={focused.id} task={focused} onClose={() => setFocus(null)} />}</AnimatePresence>
        </>,
        document.body,
      )}
    </>
  );
}

/* ─────────── Month and three days ─────────── */

interface DaysProps {
  tasks: Task[];
  shifts: Shift[];
  now: Date;
  start: string;
  onStart: (key: string) => void;
  opened: Opened | null;
  onOpen: (t: Task, morph: string) => void;
  onSlot: (d: Draft) => void;
}

function Days({ tasks, shifts, now, start, onStart, opened, onOpen, onSlot }: DaysProps) {
  const today = dayKey(now);
  const [ym, setYm] = useState(start.slice(0, 7));
  const [shift, setShift] = useState(0);
  const days = useMemo(() => Array.from({ length: SPAN }, (_, i) => dayKey(addDays(parseDay(start), i))), [start]);
  const cells = monthCells(ym);
  const busy = useMemo(() => new Set(tasks.filter((t) => !t.done && t.due).map((t) => t.due)), [tasks]);

  const turn = (n: number) => {
    setShift(n);
    setYm(addMonths(ym, n));
  };
  const pick = (key: string) => {
    onStart(key);
    if (!key.startsWith(ym)) turn(key < ym ? -1 : 1);
  };
  const move = (n: number) => {
    const key = dayKey(addDays(parseDay(start), n));
    onStart(key);
    if (!key.startsWith(ym)) turn(n > 0 ? 1 : -1);
  };

  return (
    <>
      <section className="cal">
        <header className="cal-head">
          <button type="button" className="cal-turn" aria-label="Предыдущий месяц" onClick={() => turn(-1)}>
            <Icon name="back" size={18} />
          </button>
          <button
            type="button"
            className="cal-month"
            onClick={() => {
              onStart(today);
              setYm(ymKey(now));
            }}
            aria-label="К сегодняшнему дню"
          >
            {monthName(ym)}
            {!ym.startsWith(String(now.getFullYear())) && <small> {ym.slice(0, 4)}</small>}
          </button>
          <button type="button" className="cal-turn cal-turn--next" aria-label="Следующий месяц" onClick={() => turn(1)}>
            <Icon name="back" size={18} />
          </button>
        </header>
        <div className="cal-week" aria-hidden="true">
          {WEEK.map((d) => (
            <span key={d}>{d}</span>
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
            {cells.map((key, i) => {
              const at = days.indexOf(key);
              const weekStart = i % 7 === 0;
              const weekEnd = i % 7 === 6;
              const cls = ['cal-day', !key.startsWith(ym) && 'is-other', at >= 0 && 'in-range', (at === 0 || (at > 0 && weekStart)) && 'range-from', (at === SPAN - 1 || (at >= 0 && weekEnd)) && 'range-to'].filter(Boolean).join(' ');
              return (
                <button key={key} type="button" className={cls} aria-label={parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} aria-pressed={at === 0} onClick={() => pick(key)}>
                  <span className={key === today ? 'cal-num is-today' : 'cal-num'}>{Number(key.slice(8))}</span>
                  {busy.has(key) && <i className="cal-dot" />}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </section>

      <Timeline days={days} tasks={tasks} shifts={shifts} now={now} opened={opened} onOpen={onOpen} onSlot={onSlot} onMove={move} />
    </>
  );
}

function Timeline({ days, tasks, shifts, now, opened, onOpen, onSlot, onMove }: { days: string[]; tasks: Task[]; shifts: Shift[]; now: Date; opened: Opened | null; onOpen: (t: Task, morph: string) => void; onSlot: (d: Draft) => void; onMove: (n: number) => void }) {
  const today = dayKey(now);
  const inDay = (key: string) => tasks.filter((t) => t.due === key);
  const earliest = Math.min(FIRST_HOUR, ...days.flatMap((d) => inDay(d).flatMap((t) => (t.time ? [Number(t.time.slice(0, 2))] : []))));
  const hours = Array.from({ length: 24 - earliest }, (_, i) => earliest + i);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const top = (minutes: number) => ((minutes - earliest * 60) / 60) * HOUR;

  return (
    <motion.section className="tl" drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={0.12} onDragEnd={(_, i) => Math.abs(i.offset.x) > 70 && onMove(i.offset.x < 0 ? 1 : -1)}>
      <div className="tl-heads">
        <span />
        {days.map((key) => {
          const d = parseDay(key);
          const day = shifts.find((s) => s.date === key);
          return (
            <div key={key} className="tl-head">
              <div className="tl-date">
                <span>{d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase()}</span>
                <strong className={key === today ? 'is-today' : undefined}>{d.getDate()}</strong>
              </div>
              {day && <span className="tl-chip tl-chip--shift">{day.type === 'n' ? 'Ночная смена' : 'Дневная смена'}</span>}
              {inDay(key)
                .filter((t) => !t.time)
                .map((t) => {
                  const morph = `chip-${t.id}`;
                  return (
                    <motion.button key={t.id} layoutId={morph} type="button" className={`tl-chip p${t.priority ?? 0}${t.done ? ' is-done' : ''}`} style={{ borderRadius: 8, visibility: opened?.morph === morph ? 'hidden' : undefined }} onClick={() => onOpen(t, morph)}>
                      {t.title}
                    </motion.button>
                  );
                })}
            </div>
          );
        })}
      </div>
      <div className="tl-body" style={{ height: hours.length * HOUR }}>
        <div className="tl-hours" aria-hidden="true">
          {hours.map((h) => (
            <span key={h} style={{ top: (h - earliest) * HOUR }}>
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {days.map((key) => (
          <div key={key} className="tl-col" style={{ backgroundSize: `100% ${HOUR}px` }}>
            {hours.map((h) => (
              <button key={h} type="button" className="tl-slot" style={{ top: (h - earliest) * HOUR, height: HOUR }} aria-label={`Новая задача, ${shortDate(key)}, ${h}:00`} onClick={() => onSlot({ due: key, time: `${String(h).padStart(2, '0')}:00` })} />
            ))}
            {layoutDay(inDay(key)).map((p) => {
              const morph = `block-${p.task.id}`;
              return (
                <motion.button
                  key={p.task.id}
                  layoutId={morph}
                  type="button"
                  className={`tl-block p${p.task.priority ?? 0}${p.task.done ? ' is-done' : ''}`}
                  style={{ top: top(p.from), height: Math.max(22, (p.length / 60) * HOUR - 2), left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 2px)`, borderRadius: 6, visibility: opened?.morph === morph ? 'hidden' : undefined }}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  onClick={() => onOpen(p.task, morph)}
                >
                  {p.task.title}
                </motion.button>
              );
            })}
            {key === today && minutesNow >= earliest * 60 && <i className="tl-now" style={{ top: top(minutesNow) }} />}
          </div>
        ))}
      </div>
    </motion.section>
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

/* ─────────── The line at the bottom ─────────── */

type Speech = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };
const SpeechApi = (window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Speech }).webkitSpeechRecognition;

/** Type it as it comes: the day, time, priority and tags are read out of the line as you go, and shown above it. */
function QuickAdd({ fallback, draft, onDraftUsed }: { fallback: string; draft: Draft | null; onDraftUsed: () => void }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const speech = useRef<Speech | null>(null);
  const now = new Date();
  const parsed = parseQuick(text, now);

  useEffect(() => {
    if (draft) input.current?.focus();
  }, [draft]);

  const due = parsed?.due ?? draft?.due ?? fallback;
  const time = parsed?.time ?? draft?.time;
  const chips = [
    (parsed?.due || draft) && (due === dayKey(now) ? 'Сегодня' : due === dayKey(addDays(now, 1)) ? 'Завтра' : shortDate(due)),
    time,
    parsed?.minutes && `${parsed.minutes} мин`,
    parsed?.repeat && { d: 'Каждый день', w: 'Каждую неделю', m: 'Каждый месяц' }[parsed.repeat],
    parsed?.priority && `${'!'.repeat(parsed.priority)} ${['', 'Низкий', 'Средний', 'Высокий'][parsed.priority]}`,
    ...(parsed?.tags ?? []).map((t) => `#${t}`),
  ].filter(Boolean) as string[];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    actions.addTask({ title: parsed.title, desc: '', due, time, minutes: parsed.minutes ?? (time ? DEFAULT_MINUTES : undefined), priority: parsed.priority, tags: parsed.tags.length ? parsed.tags : undefined, repeat: parsed.repeat });
    pulseWave();
    setText('');
    onDraftUsed();
  };

  const listen = () => {
    if (!SpeechApi) return;
    if (listening) return speech.current?.stop();
    const s = new SpeechApi();
    s.lang = 'ru-RU';
    s.interimResults = true;
    s.onresult = (e) => setText(Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' '));
    s.onend = () => setListening(false);
    speech.current = s;
    s.start();
    setListening(true);
  };

  return (
    <form className="quick" onSubmit={submit}>
      <AnimatePresence>
        {chips.length > 0 && (
          <motion.div className="quick-chips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
            {chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="quick-bar">
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => !text && onDraftUsed()} placeholder="Создать…" aria-label="Новая задача" enterKeyHint="done" maxLength={200} />
        {text.trim() ? (
          <motion.button type="submit" className="quick-go" aria-label="Добавить" disabled={!parsed} initial={{ scale: 0.6 }} animate={{ scale: 1 }} whileTap={{ scale: 0.85 }}>
            <Icon name="check" size={18} stroke={2.4} />
          </motion.button>
        ) : (
          SpeechApi && (
            <button type="button" className={`quick-mic${listening ? ' is-on' : ''}`} aria-label={listening ? 'Остановить запись' : 'Сказать голосом'} aria-pressed={listening} onClick={listen}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5.500 11a6.500 6.500 0 0 0 13 0M12 17.500V21" />
              </svg>
            </button>
          )
        )}
      </div>
    </form>
  );
}
