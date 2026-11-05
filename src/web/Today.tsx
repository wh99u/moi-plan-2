import { useEffect, useState } from 'react';
import { upcoming } from '../app/money/logic';
import { useStore } from '../lib/appStore';
import { addDays, dayKey } from '../lib/dates';
import { visible } from '../lib/records';
import { buildReminders } from './reminders';

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
