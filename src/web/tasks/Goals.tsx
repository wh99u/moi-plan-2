import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import { addDays, addMonthsKeepDay, dayKey, fmtDay, parseDay } from '../../lib/dates';
import type { Goal, Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { DateField } from '../money/sheets';
import { GrowText } from '../shop/BuyWindow';
import { pulseWave } from '../Wave';
import { activeGoals, goalMarks, goalState, leftWords, type GoalState, type Pace } from './goalLogic';
import { DEFAULT_MINUTES, parseQuick } from './logic';
import { completeTask } from './TaskWindow';
import { blur } from '../../app/ui/device';

const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;
const PACE: Record<Pace, string> = { ahead: 'С опережением', on: 'По плану', behind: 'Отстаёшь' };

const part = (i: number) => ({
  initial: { opacity: 0, y: 12, ...blur(6) },
  animate: { opacity: 1, y: 0, ...blur(0) },
  transition: { delay: 0.12 + i * 0.035, duration: 0.45, ease: EASE },
});

export interface OpenedGoal {
  id: string;
  morph: string;
}

/** The term as cells that fill up, and under it how far the steps have got. */
function Meter({ state, delay = 0 }: { state: GoalState; delay?: number }) {
  const marks = goalMarks(state);
  const current = Math.min(marks.count, marks.passed + 1);
  const share = state.share ?? 0;
  return (
    <div className="goal-meter">
      <div className="goal-cells" role="img" aria-label={`${marks.unit} ${current} из ${marks.count}`}>
        {Array.from({ length: marks.count }, (_, i) => (
          <i key={i} className={i < marks.passed ? 'is-gone' : i === marks.passed ? 'is-now' : undefined} style={{ animationDelay: `${delay + i * 0.03}s` }} />
        ))}
      </div>
      <p className="goal-line">
        <span>
          {marks.unit} {current} из {marks.count}
        </span>
        {state.pace && <span className={`goal-pace is-${state.pace}`}>{PACE[state.pace]}</span>}
      </p>
      {state.share !== null && (
        <>
          <div className="goal-bar">
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: share }} transition={{ delay: delay + 0.2, duration: 0.9, ease: EASE }} />
          </div>
          <p className="goal-line">
            <span>
              Шаги {state.stepsDone} из {state.steps.length}
            </span>
            <span>{Math.round(share * 100)}%</span>
          </p>
        </>
      )}
    </div>
  );
}

export function Goals({ goals, tasks, now, opened, onOpen }: { goals: Goal[]; tasks: Task[]; now: Date; opened: OpenedGoal | null; onOpen: (o: OpenedGoal) => void }) {
  const [showDone, setShowDone] = useState(false);
  const active = activeGoals(goals);
  const reached = goals.filter((g) => g.doneAt);

  if (!goals.length) return <p className="tasks-empty">Долгосрочные цели на недели или месяцы</p>;

  return (
    <div className="goals">
      <ul>
        <AnimatePresence initial={false}>
          {active.map((g, i) => {
            const morph = `goal-${g.id}`;
            const state = goalState(g, tasks, now);
            return (
              <motion.li key={g.id} layout="position" initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ delay: i * 0.06, duration: 0.55, ease: EASE }}>
                <motion.button layoutId={morph} type="button" className="glass goal-card" style={{ borderRadius: 26, visibility: opened?.morph === morph ? 'hidden' : undefined }} onClick={() => onOpen({ id: g.id, morph })} whileTap={{ scale: 0.98 }}>
                  <span className="goal-head">
                    <strong>{g.title}</strong>
                    <em className={state.daysLeft < 0 ? 'is-late' : undefined}>{leftWords(state.daysLeft)}</em>
                  </span>
                  <Meter state={state} delay={i * 0.06} />
                </motion.button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {reached.length > 0 && (
        <section className="tgroup">
          <h3>
            <button type="button" className="tgroup-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
              Достигнуты
              <span>{reached.length}</span>
            </button>
          </h3>
          {showDone && (
            <ul>
              {reached.map((g) => {
                const morph = `goal-${g.id}`;
                return (
                  <li key={g.id}>
                    <motion.button layoutId={morph} type="button" className="goal-reached" style={{ borderRadius: 14, visibility: opened?.morph === morph ? 'hidden' : undefined }} onClick={() => onOpen({ id: g.id, morph })}>
                      <Icon name="flag" size={15} stroke={2} />
                      <span>{g.title}</span>
                      <small>{fmtDay(g.doneAt!)}</small>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

const TERMS: { label: string; end: (start: string) => string }[] = [
  { label: '2 недели', end: (s) => dayKey(addDays(parseDay(s), 14)) },
  { label: 'Месяц', end: (s) => addMonthsKeepDay(s, 1) },
  { label: '3 месяца', end: (s) => addMonthsKeepDay(s, 3) },
  { label: 'Полгода', end: (s) => addMonthsKeepDay(s, 6) },
  { label: 'Год', end: (s) => addMonthsKeepDay(s, 12) },
];

/** The card grows into this window: all of it is saved as it is typed. Steps are ordinary tasks, tied to the goal. */
export function GoalWindow({ goal, tasks, now, morph, onClose, onOpenTask }: { goal: Goal; tasks: Task[]; now: Date; morph: string; onClose: () => void; onOpenTask: (t: Task) => void }) {
  const [sure, setSure] = useState(false);
  const [step, setStep] = useState('');
  const set = (patch: Partial<Goal>) => actions.updateGoal(goal.id, patch);
  const state = goalState(goal, tasks, now);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const addStep = (e: FormEvent) => {
    e.preventDefault();
    const q = parseQuick(step, new Date());
    if (!q) return;
    actions.addTask({ title: q.title, desc: '', due: q.due ?? '', time: q.time, minutes: q.minutes ?? (q.time ? DEFAULT_MINUTES : undefined), priority: q.priority, tags: q.tags.length ? q.tags : undefined, repeat: q.repeat, goalId: goal.id });
    setStep('');
  };

  return (
    <>
      <motion.div className="sheet-scrim p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <div className="p-win-place buy-place" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="buy-holder task-holder">
          <motion.div layoutId={morph} className="buy-win" style={{ borderRadius: 36 }} role="dialog" aria-modal="true" aria-label={goal.title} transition={MORPH}>
            <motion.div className="buy-in task-win" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ delay: 0.1, duration: 0.3 }}>
              <button type="button" className="round-btn buy-close" aria-label="Закрыть" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>

              <motion.div className="task-win-head" {...part(0)}>
                <input className="task-win-title" value={goal.title} placeholder="Цель" aria-label="Цель" maxLength={200} onChange={(e) => set({ title: e.target.value })} />
              </motion.div>

              <motion.p className={`goal-left${state.daysLeft < 0 ? ' is-late' : ''}`} {...part(1)}>
                {leftWords(state.daysLeft)}
              </motion.p>
              <motion.div {...part(1)}>
                <Meter state={state} delay={0.2} />
              </motion.div>

              <GrowText value={goal.why ?? ''} placeholder="Зачем мне это" aria-label="Зачем мне это" {...part(2)} onChange={(e) => set({ why: e.target.value })} />

              <motion.div className="task-subs" {...part(3)}>
                <span className="task-win-label">Срок</span>
                <div className="tags">
                  {TERMS.map((t) => {
                    const end = t.end(goal.start);
                    return (
                      <button key={t.label} type="button" className={`tag${goal.end === end ? ' is-on' : ''}`} aria-pressed={goal.end === end} onClick={() => set({ end })}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <DateField value={goal.start} placeholder="Начало" onChange={(start) => start && set({ start })} />
                <DateField value={goal.end} placeholder="Конец" onChange={(end) => end && set({ end })} />
              </motion.div>

              <motion.div className="task-subs" {...part(4)}>
                <span className="task-win-label">Шаги</span>
                {state.steps.map((t) => (
                  <div key={t.id} className={`task-sub${t.done ? ' is-done' : ''}`}>
                    <button type="button" className="check" aria-pressed={t.done} aria-label={`Готово: ${t.title}`} onClick={() => completeTask(t)}>
                      <Icon name="check" size={12} stroke={3} />
                    </button>
                    <button type="button" className="goal-step" onClick={() => onOpenTask(t)}>
                      <span>{t.title}</span>
                      {t.due && <small>{fmtDay(t.due)}</small>}
                    </button>
                  </div>
                ))}
                <form onSubmit={addStep}>
                  <input className="field" value={step} onChange={(e) => setStep(e.target.value)} placeholder="Добавить шаг, можно с датой" aria-label="Новый шаг" enterKeyHint="done" />
                </form>
              </motion.div>

              <motion.button
                type="button"
                className={`scan-link${goal.doneAt ? ' is-on' : ''}`}
                {...part(5)}
                onClick={() => {
                  if (!goal.doneAt) pulseWave();
                  set({ doneAt: goal.doneAt ? undefined : dayKey(new Date()) });
                }}
              >
                <Icon name="flag" size={18} />
                {goal.doneAt ? 'Вернуть в работу' : 'Цель достигнута'}
              </motion.button>

              <button
                type="button"
                className={`p-delete${sure ? ' is-sure' : ''}`}
                onClick={() => {
                  if (!sure) return setSure(true);
                  actions.deleteGoal(goal.id);
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
