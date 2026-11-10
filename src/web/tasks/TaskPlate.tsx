import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import { dayKey } from '../../lib/dates';
import { uid } from '../../lib/ids';
import type { Priority, Subtask, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { DateField } from '../money/sheets';
import { Plate, PlateRow } from '../Plate';
import { pulseWave } from '../Wave';
import { DEFAULT_MINUTES } from './logic';
import { completeTask, deleteTaskUndoable } from './taskActions';

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 0, label: 'Нет' },
  { id: 1, label: 'Низкая' },
  { id: 2, label: 'Средняя' },
  { id: 3, label: 'Высокая' },
];

/** What a new task starts from: the day and hour it was made for. */
export interface TaskDraft {
  due?: string;
  time?: string;
}

type Fields = Pick<Task, 'title' | 'due' | 'time' | 'minutes' | 'priority' | 'tags' | 'subtasks'>;

/**
 * One window for a task, new or old, in the plain style of every small window: name, day, time,
 * importance, steps, hashtags. An old one is saved as it is typed; a new one on «Добавить».
 */
export function TaskPlate({ task, draft, onClose }: { task?: Task; draft?: TaskDraft | null; onClose: () => void }) {
  const open = !!task || !!draft;
  // While the window goes away its task may already be gone; it keeps showing what it showed.
  const [last, setLast] = useState<{ task?: Task; draft?: TaskDraft | null }>({ task, draft });
  if (open && (task !== last.task || draft !== last.draft)) setLast({ task, draft });
  const shown = open ? { task, draft } : last;
  return (
    <Plate open={open} title={shown.task ? 'Задача' : 'Новая задача'} note={shown.task?.done ? 'Выполнена' : undefined} onClose={onClose}>
      {(shown.task || shown.draft) && <Form key={shown.task?.id ?? `new-${shown.draft?.due}-${shown.draft?.time}`} task={shown.task} draft={shown.draft ?? {}} onClose={onClose} />}
    </Plate>
  );
}

function Form({ task, draft, onClose }: { task?: Task; draft: TaskDraft; onClose: () => void }) {
  const [local, setLocal] = useState<Fields>(() => ({ title: '', due: draft.due ?? dayKey(new Date()), time: draft.time, minutes: draft.time ? DEFAULT_MINUTES : undefined }));
  const v: Fields = task ?? local;
  const set = (patch: Partial<Fields>) => (task ? actions.updateTask(task.id, patch) : setLocal((l) => ({ ...l, ...patch })));
  const [step, setStep] = useState('');
  const [tag, setTag] = useState('');
  const subs = v.subtasks ?? [];
  const tags = v.tags ?? [];
  const ok = v.title.trim().length > 0;

  const addStep = (e?: FormEvent) => {
    e?.preventDefault();
    if (!step.trim()) return;
    set({ subtasks: [...subs, { id: uid(), title: step.trim(), done: false }] });
    setStep('');
  };
  const addTag = (e?: FormEvent) => {
    e?.preventDefault();
    const t = tag.trim().replace(/^#+/, '').replace(/\s+/g, '_');
    if (t && !tags.includes(t)) set({ tags: [...tags, t] });
    setTag('');
  };
  const setSubs = (next: Subtask[]) => set({ subtasks: next.length ? next : undefined });
  const create = () => {
    if (!ok) return;
    actions.addTask({ ...local, title: local.title.trim(), desc: '', tags: tags.length ? tags : undefined, subtasks: subs.length ? subs : undefined });
    pulseWave();
    onClose();
  };

  let row = 0;
  return (
    <>
      <PlateRow label="Задача" index={row++}>
        <input className="plate-input" value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Что сделать" aria-label="Название" maxLength={200} autoFocus={!task} enterKeyHint={task ? 'done' : 'go'} onKeyDown={(e) => !task && e.key === 'Enter' && create()} />
      </PlateRow>
      <PlateRow label="Дата" index={row++}>
        <DateField value={v.due} placeholder="Без даты" onChange={(due) => set({ due })} />
      </PlateRow>
      <PlateRow label="Время" index={row++}>
        <TimeField value={v.time ?? ''} onChange={(time) => set({ time: time || undefined, minutes: time ? (v.minutes ?? DEFAULT_MINUTES) : undefined })} />
      </PlateRow>
      <PlateRow label="Важность" index={row++} wide>
        <div className="plate-chips">
          {PRIORITIES.map((p) => (
            <button key={p.id} type="button" className={`plate-chip is-pri p${p.id}${(v.priority ?? 0) === p.id ? ' is-on' : ''}`} aria-pressed={(v.priority ?? 0) === p.id} onClick={() => set({ priority: p.id || undefined })}>
              {p.id > 0 && <Icon name="flag" size={13} stroke={2.2} />}
              {p.label}
            </button>
          ))}
        </div>
      </PlateRow>
      <PlateRow label="Подзадачи" index={row++} wide>
        <div className="plate-stack">
          <AnimatePresence initial={false}>
            {subs.map((s) => (
              <motion.div key={s.id} className={`plate-sub${s.done ? ' is-done' : ''}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }}>
                <button type="button" className="plate-tick" aria-pressed={s.done} aria-label={`Готово: ${s.title}`} onClick={() => setSubs(subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}>
                  <Icon name="check" size={11} stroke={3} />
                </button>
                <span>{s.title}</span>
                <button type="button" className="plate-x" aria-label={`Убрать: ${s.title}`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))}>
                  <Icon name="close" size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <form className="plate-add" onSubmit={addStep}>
            <input className="plate-input" value={step} onChange={(e) => setStep(e.target.value)} placeholder="Добавить подзадачу" aria-label="Новая подзадача" enterKeyHint="done" />
            <PlusButton disabled={!step.trim()} label="Добавить подзадачу" />
          </form>
        </div>
      </PlateRow>
      <PlateRow label="Хэштег" index={row++} wide>
        <div className="plate-stack">
          {tags.length > 0 && (
            <div className="plate-chips">
              <AnimatePresence initial={false}>
                {tags.map((t) => (
                  <motion.button key={t} type="button" className="plate-chip is-on" aria-label={`Убрать #${t}`} onClick={() => set({ tags: tags.filter((x) => x !== t).length ? tags.filter((x) => x !== t) : undefined })} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                    #{t}
                    <Icon name="close" size={12} />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
          <form className="plate-add" onSubmit={addTag}>
            <label className="plate-hash">
              <span aria-hidden="true">#</span>
              <input className="plate-input" value={tag} onChange={(e) => setTag(e.target.value.replace(/^#+/, ''))} placeholder="работа" aria-label="Хэштег" enterKeyHint="done" maxLength={30} />
            </label>
            <PlusButton disabled={!tag.trim()} label="Добавить хэштег" />
          </form>
        </div>
      </PlateRow>

      <div className="plate-foot">
        {task ? (
          <>
            <button
              type="button"
              className="plate-del"
              onClick={() => {
                onClose();
                deleteTaskUndoable(task);
              }}
            >
              Удалить
            </button>
            <motion.button
              type="button"
              className="plate-go"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                completeTask(task);
                onClose();
              }}
            >
              {task.done ? 'Вернуть' : 'Готово'}
            </motion.button>
          </>
        ) : (
          <motion.button type="button" className="plate-go" disabled={!ok} whileTap={{ scale: 0.94 }} onClick={create}>
            Добавить
          </motion.button>
        )}
      </div>
    </>
  );
}

/** The round plus beside a field: what is typed goes in on a tap, not only on the keyboard's key. */
export function PlusButton({ disabled, label }: { disabled?: boolean; label: string }) {
  return (
    <motion.button type="submit" className="plate-plus" disabled={disabled} aria-label={label} whileTap={{ scale: 0.85, rotate: 90 }}>
      <Icon name="plus" size={18} stroke={2.2} />
    </motion.button>
  );
}

/** Looks like the date beside it: words over the device's own picker, which writes «AM» in some languages. */
function TimeField({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  return (
    <label className="date-field">
      <span className={value ? undefined : 'date-field-empty'}>{value || 'Без времени'}</span>
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
