import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { closeSheet, useSheet, useSheetData } from '../../app/sheet';
import { Sheet } from '../../app/ui/Sheet';
import { actions } from '../../lib/appStore';
import { addDays, dayKey, fmtDay, parseDay } from '../../lib/dates';
import { pulseWave } from '../Wave';
import { parseGoal } from './goalLogic';
import { DEFAULT_MINUTES, parseQuick } from './logic';
import { Mic } from './Speech';

const FOCUS_AFTER = 380;
const shortDate = (key: string) => parseDay(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

/** After the sheet has sprung up, so the keyboard does not fight the animation. */
function useFocusSoon() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), FOCUS_AFTER);
    return () => clearTimeout(t);
  }, []);
  return input;
}

function Chips({ list }: { list: string[] }) {
  return (
    <AnimatePresence>
      {list.length > 0 && (
        <motion.div className="quick-chips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
          {list.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Type it as it comes: the day, time, priority and tags are read out of the line as you go, and shown above it. */
function NewTask({ date, time }: { date?: string; time?: string }) {
  const [text, setText] = useState('');
  const input = useFocusSoon();
  const now = new Date();
  const parsed = parseQuick(text, now, date);
  const due = parsed?.due ?? date ?? dayKey(now);
  const when = parsed?.time ?? time;
  const chips = [
    (parsed?.due || date) && (due === dayKey(now) ? 'Сегодня' : due === dayKey(addDays(now, 1)) ? 'Завтра' : shortDate(due)),
    when,
    parsed?.minutes && `${parsed.minutes} мин`,
    parsed?.repeat && { d: 'Каждый день', w: 'Каждую неделю', m: 'Каждый месяц' }[parsed.repeat],
    parsed?.priority && `${'!'.repeat(parsed.priority)} ${['', 'Низкий', 'Средний', 'Высокий'][parsed.priority]}`,
    ...(parsed?.tags ?? []).map((t) => `#${t}`),
  ].filter(Boolean) as string[];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    actions.addTask({ title: parsed.title, desc: '', due, time: when, minutes: parsed.minutes ?? (when ? DEFAULT_MINUTES : undefined), priority: parsed.priority, tags: parsed.tags.length ? parsed.tags : undefined, repeat: parsed.repeat });
    pulseWave();
    closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <Chips list={chips} />
      <div className="quick-bar quick-bar--sheet">
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Купить хлеб завтра в 15 !! #дом" aria-label="Новая задача" enterKeyHint="done" maxLength={200} />
        <Mic onText={setText} />
      </div>
      <motion.button type="submit" className="primary-btn" disabled={!parsed} whileTap={{ scale: 0.96 }}>
        Добавить
      </motion.button>
    </form>
  );
}

/** A goal in one line: the term is read out of it and shown above, as with tasks. */
function NewGoal() {
  const [text, setText] = useState('');
  const input = useFocusSoon();
  const now = new Date();
  const parsed = parseGoal(text, now);
  const chip = parsed ? `${parsed.guessed ? 'На месяц, ' : ''}до ${fmtDay(parsed.end, true).replace(/ \d{4}.*$/, '')}` : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    actions.addGoal({ title: parsed.title, start: dayKey(now), end: parsed.end });
    pulseWave();
    closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <Chips list={chip ? [chip] : []} />
      <div className="quick-bar quick-bar--sheet">
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Выучить английский за 3 месяца" aria-label="Новая цель" enterKeyHint="done" maxLength={200} />
        <Mic onText={setText} />
      </div>
      <motion.button type="submit" className="primary-btn" disabled={!parsed} whileTap={{ scale: 0.96 }}>
        Добавить
      </motion.button>
    </form>
  );
}

export function AddSheets() {
  const open = useSheet();
  const data = useSheetData();
  // While the sheet slides away its data is already gone; the form stays what it was.
  const shown = useRef(data);
  if (open === 'newTask') shown.current = data;
  return (
    <>
      <Sheet open={open === 'newTask'} onClose={closeSheet} title="Новая задача">
        <NewTask date={shown.current.date} time={shown.current.time} />
      </Sheet>
      <Sheet open={open === 'newGoal'} onClose={closeSheet} title="Новая цель">
        <NewGoal />
      </Sheet>
    </>
  );
}
