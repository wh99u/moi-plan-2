import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { EASE } from '../../app/ui/text';
import { useStore } from '../../lib/appStore';
import { addDays, dayKey, parseDay } from '../../lib/dates';
import { visible } from '../../lib/records';
import type { Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Recede } from '../Recede';
import { Seg } from '../Seg';
import { useNow } from '../Today';
import { CalendarView } from './CalendarView';
import { DayPlate } from './DayPlate';
import { Habits } from './Habits';
import { Hours } from './Hours';
import { clearWanted, wantedView, type TasksView } from './entry';
import { nearestSpan, pageStart } from './logic';
import { TaskPlate, type TaskDraft } from './TaskPlate';
import { blur } from '../../app/ui/device';

type View = TasksView;
/** A new key: since the hours became one day by default, everyone starts from one day again. */
const SPAN_KEY = 'tasks_span_v2';
const POP = { type: 'spring', stiffness: 420, damping: 30 } as const;

const daysFrom = (first: string, n: number) => Array.from({ length: n }, (_, i) => dayKey(addDays(parseDay(first), i)));

function savedSpan(): number {
  try {
    return nearestSpan(Number(localStorage.getItem(SPAN_KEY)) || 1);
  } catch {
    return 1;
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
  // By the hours the site's own top bar steps aside: the day's bar takes the top of the screen.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-hours', view === 'hours');
    return () => document.documentElement.removeAttribute('data-hours');
  }, [view]);
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
      /* it will just start from one day next time */
    }
  };
  const full = view !== 'habits';
  const plus = view === 'habits' ? () => setNewHabit((n) => n + 1) : () => setDraft({ due: view === 'hours' && !daysFrom(first, span).includes(dayKey(now)) ? first : dayKey(now) });

  return (
    <>
      <div className={`budget tasks is-${view}${full ? ' is-full' : ''}`}>
        <div className="tasks-col">
          {/* By the hours the sections are in the day bar's menu, so the hours get the whole screen. */}
          {view !== 'hours' && (
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
          )}
          {/* No initial={false} here: it would silence every entrance inside on arrival at the screen. */}
          <AnimatePresence mode="wait">
            <motion.div key={view} className={full ? 'tasks-fill' : undefined} initial={{ opacity: 0, y: 14, ...blur(6) }} animate={{ opacity: 1, y: 0, ...blur(0) }} exit={{ opacity: 0, y: -10, ...blur(4) }} transition={{ duration: 0.3, ease: EASE }}>
              {view === 'month' && <CalendarView tasks={tasks} shifts={shifts} now={now} picked={picked} onDay={showDay} onOpen={openTask} />}
              {view === 'hours' && <Hours tasks={tasks} shifts={shifts} now={now} start={first} span={span} draft={draft} onStart={setStart} onSpan={changeSpan} onOpen={openTask} onNew={(due, time) => setDraft({ due, time })} onCalendar={() => setView('month')} onView={setView} />}
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
