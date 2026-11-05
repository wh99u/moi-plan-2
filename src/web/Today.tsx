import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { upcoming } from '../app/money/logic';
import { openSheet } from '../app/sheet';
import { CountUp, EASE } from '../app/ui/text';
import { useStore } from '../lib/appStore';
import { addDays, dayKey } from '../lib/dates';
import { visible } from '../lib/records';
import type { Task } from '../lib/types';
import { Icon } from '../ui/Icon';
import { buildReminders, plural } from './reminders';
import { completeTask } from './tasks/TaskWindow';

/** Re-renders on every `step` boundary of the wall clock. */
export function useNow(step = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t = 0;
    const loop = () => {
      setNow(new Date());
      t = window.setTimeout(loop, step - (Date.now() % step) + 5);
    };
    t = window.setTimeout(loop, step - (Date.now() % step) + 5);
    return () => clearTimeout(t);
  }, [step]);
  return now;
}

export function useToday() {
  const now = useNow(60_000);
  const tasks = visible(useStore((s) => s.personal.tasks));
  const subs = useStore((s) => s.shared.subs);
  const today = dayKey(now);
  const next = dayKey(addDays(now, 1));
  const list = tasks
    .filter((t) => t.due === today || (!t.done && t.due && t.due < today))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due) || a.updatedAt - b.updatedAt);
  const open = list.filter((t) => !t.done);
  return {
    list,
    open,
    done: list.length - open.length,
    reminders: buildReminders({
      hour: now.getHours(),
      open,
      late: open.filter((t) => t.due && t.due < today),
      tomorrow: tasks.filter((t) => !t.done && t.due === next),
      due: upcoming(subs, now).filter((d) => d.status !== 'later'),
    }),
  };
}

const rows = {
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.16 } },
};
const row = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
};

/** What the card turns into after «Смотреть задачи на сегодня». */
export function Today({ onBack }: { onBack: () => void }) {
  const { list, open, done } = useToday();
  const total = list.length;

  return (
    <motion.div className="today" initial="hidden" animate="show" variants={rows}>
      <motion.header className="today-head" variants={row}>
        <motion.button type="button" className="round-btn" aria-label="Назад" onClick={onBack} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}>
          <Icon name="back" size={20} />
        </motion.button>
        <div className="today-title">
          <h2>Сегодня</h2>
          <p>
            {!total ? (
              'Пока ничего не запланировано'
            ) : open.length ? (
              <>
                <CountUp value={open.length} delay={0.2} /> {plural(open.length, ['задача осталась', 'задачи осталось', 'задач осталось'])}
              </>
            ) : (
              'Всё сделано'
            )}
          </p>
        </div>
        <Ring share={total ? done / total : 0} />
      </motion.header>

      <ul className="today-list">
        <AnimatePresence>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </AnimatePresence>
      </ul>

      <motion.button type="button" className="add-btn" variants={row} onClick={() => openSheet('task')} whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}>
        <Icon name="plus" size={18} />
        Новая задача
      </motion.button>
    </motion.div>
  );
}

function Ring({ share }: { share: number }) {
  const R = 19;
  const C = 2 * Math.PI * R;
  return (
    <svg className="ring" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle cx="24" cy="24" r={R} className="ring-track" />
      <motion.circle
        cx="24"
        cy="24"
        r={R}
        className="ring-fill"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - share) }}
        transition={{ delay: 0.2, duration: 1.2, ease: EASE }}
      />
      <AnimatePresence>
        {share === 1 && (
          <motion.path
            d="M16.5 24.5l5 5 10-10.5"
            className="ring-check"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}

function TaskRow({ task }: { task: Task }) {
  const late = !task.done && !!task.due && task.due < dayKey(new Date());
  return (
    <motion.li layout className={`task${task.done ? ' is-done' : ''}`} variants={row} exit={{ opacity: 0, height: 0 }} transition={{ layout: { duration: 0.5, ease: EASE } }}>
      <motion.button
        type="button"
        className="check"
        aria-pressed={task.done}
        aria-label={task.done ? `Вернуть «${task.title}»` : `Готово: «${task.title}»`}
        onClick={() => completeTask(task)}
        whileTap={{ scale: 0.78 }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: task.done ? 1 : 0, opacity: task.done ? 1 : 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          />
        </svg>
      </motion.button>
      <span className="task-title">
        <span className="task-text">
          {task.title}
          <motion.span className="task-strike" initial={false} animate={{ scaleX: task.done ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }} />
        </span>
      </span>
      {late && <span className="task-late">просрочено</span>}
    </motion.li>
  );
}
