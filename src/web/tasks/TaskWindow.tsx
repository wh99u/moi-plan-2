import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { uid } from '../../lib/ids';
import { visible } from '../../lib/records';
import type { Priority, Repeat, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { DateField } from '../money/sheets';
import { Seg } from '../Seg';
import { GrowText } from '../shop/BuyWindow';
import { pulseWave } from '../Wave';
import { activeGoals } from './goalLogic';
import { DEFAULT_MINUTES, nextRepeat } from './logic';

const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

const part = (i: number) => ({
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay: 0.12 + i * 0.035, duration: 0.45, ease: EASE },
});

/** Marks it done or back; a repeating one comes back as a new task on its next day. */
export function completeTask(task: Task) {
  if (!task.done) {
    pulseWave();
    const next = nextRepeat(task);
    if (next) {
      const { id: _id, updatedAt: _at, done: _done, ...rest } = task;
      actions.addTask({ ...rest, due: next, subtasks: rest.subtasks?.map((s) => ({ ...s, done: false })) });
    }
  }
  actions.toggleTask(task.id);
}

/** Looks like the date beside it: words over the device's own picker, which writes «AM» in some languages. */
function TimeField({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  return (
    <label className="date-field">
      <span className={value ? undefined : 'date-field-empty'}>{value || 'Время'}</span>
      {value ? (
        <button
          type="button"
          className="time-clear"
          aria-label="Убрать время"
          onClick={(e) => {
            e.preventDefault();
            onChange('');
          }}
        >
          <Icon name="close" size={15} />
        </button>
      ) : (
        <Icon name="clock" size={18} />
      )}
      <input type="time" value={value} aria-label="Время" onChange={(e) => onChange(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
    </label>
  );
}

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 3, label: 'Высокий' },
  { id: 2, label: 'Средний' },
  { id: 1, label: 'Низкий' },
  { id: 0, label: 'Нет' },
];
const LENGTHS: { id: string; label: string }[] = [
  { id: '30', label: '30 м' },
  { id: '60', label: '1 ч' },
  { id: '120', label: '2 ч' },
  { id: '240', label: '4 ч' },
];
const REPEATS: { id: Repeat | 'no'; label: string }[] = [
  { id: 'no', label: 'Нет' },
  { id: 'd', label: 'День' },
  { id: 'w', label: 'Неделя' },
  { id: 'm', label: 'Месяц' },
];

/** The line or block grows into this window; all of it is saved as it is typed. */
export function TaskWindow({ task, morph, onClose, onFocus }: { task: Task; morph: string; onClose: () => void; onFocus: () => void }) {
  const [sure, setSure] = useState(false);
  const [sub, setSub] = useState('');
  const [tag, setTag] = useState('');
  const set = (patch: Partial<Task>) => actions.updateTask(task.id, patch);
  const subs = task.subtasks ?? [];
  const tags = task.tags ?? [];
  const goals = activeGoals(visible(useStore((s) => s.personal.goals)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const addSub = (e: FormEvent) => {
    e.preventDefault();
    if (!sub.trim()) return;
    set({ subtasks: [...subs, { id: uid(), title: sub.trim(), done: false }] });
    setSub('');
  };
  const addTag = (e: FormEvent) => {
    e.preventDefault();
    const t = tag.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) set({ tags: [...tags, t] });
    setTag('');
  };

  return (
    <>
      <motion.div className="sheet-scrim p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <div className="p-win-place buy-place" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="buy-holder task-holder">
          <motion.div layoutId={morph} className="buy-win" style={{ borderRadius: 36 }} role="dialog" aria-modal="true" aria-label={task.title} transition={MORPH}>
            <motion.div className={`buy-in task-win p${task.priority ?? 0}${task.done ? ' is-done' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ delay: 0.1, duration: 0.3 }}>
              <button type="button" className="round-btn buy-close" aria-label="Закрыть" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>

              <motion.div className="task-win-head" {...part(0)}>
                <motion.button type="button" className="check" aria-pressed={task.done} aria-label="Готово" onClick={() => completeTask(task)} whileTap={{ scale: 0.78 }}>
                  <Icon name="check" size={14} stroke={3} />
                </motion.button>
                <input className="task-win-title" value={task.title} placeholder="Название" aria-label="Название" maxLength={200} onChange={(e) => set({ title: e.target.value })} />
              </motion.div>

              <GrowText value={task.desc} placeholder="Описание" aria-label="Описание" {...part(1)} onChange={(e) => set({ desc: e.target.value })} />

              <motion.div className="task-when" {...part(2)}>
                <DateField value={task.due} placeholder="Дата" onChange={(due) => set({ due })} />
                <TimeField value={task.time ?? ''} onChange={(time) => set({ time: time || undefined, minutes: time ? (task.minutes ?? DEFAULT_MINUTES) : undefined })} />
              </motion.div>

              {task.time && (
                <motion.div className="task-win-row" {...part(3)}>
                  <span>Сколько</span>
                  <Seg value={String(task.minutes ?? DEFAULT_MINUTES)} onChange={(v) => set({ minutes: Number(v) })} options={LENGTHS.some((l) => l.id === String(task.minutes ?? DEFAULT_MINUTES)) ? LENGTHS : [...LENGTHS, { id: String(task.minutes), label: `${task.minutes} м` }]} label="Сколько времени" />
                </motion.div>
              )}

              <motion.div className="task-win-row" {...part(4)}>
                <span>Важность</span>
                <div className="pri-pick" role="radiogroup" aria-label="Важность">
                  {PRIORITIES.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={(task.priority ?? 0) === p.id} className={`pri p${p.id}${(task.priority ?? 0) === p.id ? ' is-on' : ''}`} onClick={() => set({ priority: p.id || undefined })}>
                      <Icon name="flag" size={15} stroke={2} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div className="task-win-row" {...part(5)}>
                <span>Повтор</span>
                <Seg value={task.repeat ?? 'no'} onChange={(v) => set({ repeat: v === 'no' ? undefined : v })} options={REPEATS} label="Повтор" />
              </motion.div>

              <motion.div className="task-subs" {...part(6)}>
                <span className="task-win-label">Подзадачи</span>
                {subs.map((s) => (
                  <div key={s.id} className={`task-sub${s.done ? ' is-done' : ''}`}>
                    <button type="button" className="check" aria-pressed={s.done} aria-label={`Готово: ${s.title}`} onClick={() => set({ subtasks: subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}>
                      <Icon name="check" size={12} stroke={3} />
                    </button>
                    <span>{s.title}</span>
                    <button type="button" className="task-sub-del" aria-label={`Убрать: ${s.title}`} onClick={() => set({ subtasks: subs.filter((x) => x.id !== s.id) })}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
                <form onSubmit={addSub}>
                  <input className="field" value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Добавить подзадачу" aria-label="Новая подзадача" enterKeyHint="done" />
                </form>
              </motion.div>

              <motion.div className="task-subs" {...part(7)}>
                <span className="task-win-label">Метки</span>
                {tags.length > 0 && (
                  <div className="tags">
                    {tags.map((t) => (
                      <button key={t} type="button" className="tag is-on" aria-label={`Убрать метку ${t}`} onClick={() => set({ tags: tags.filter((x) => x !== t) })}>
                        #{t}
                        <Icon name="close" size={12} />
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={addTag}>
                  <input className="field" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Добавить метку" aria-label="Новая метка" enterKeyHint="done" />
                </form>
              </motion.div>

              {goals.length > 0 && (
                <motion.div className="task-subs" {...part(8)}>
                  <span className="task-win-label">Цель</span>
                  <div className="tags">
                    {goals.map((g) => (
                      <button key={g.id} type="button" className={`tag${task.goalId === g.id ? ' is-on' : ''}`} aria-pressed={task.goalId === g.id} onClick={() => set({ goalId: task.goalId === g.id ? undefined : g.id })}>
                        {g.title}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.button type="button" className="scan-link" {...part(9)} onClick={onFocus}>
                <Icon name="clock" size={18} />
                Фокус{task.focused ? `: уже ${task.focused} мин` : ''}
              </motion.button>

              <button
                type="button"
                className={`p-delete${sure ? ' is-sure' : ''}`}
                onClick={() => {
                  if (!sure) return setSure(true);
                  actions.deleteTask(task.id);
                  onClose();
                }}
              >
                {sure ? 'Точно удалить' : 'Удалить'}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
