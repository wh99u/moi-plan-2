import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import type { Task } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Seg } from '../Seg';
import { pulseWave } from '../Wave';

const LENGTHS = [
  { id: '15', label: '15 мин' },
  { id: '25', label: '25 мин' },
  { id: '50', label: '50 мин' },
];
const R = 112;
const C = 2 * Math.PI * R;
const TICK = 250;

/**
 * A pomodoro over the task, the way TickTick has one. It counts towards a moment on the clock, not
 * by ticks, so it stays right while the phone slows the page down in the background.
 */
export function Focus({ task, onClose }: { task: Task; onClose: () => void }) {
  const [minutes, setMinutes] = useState('25');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(25 * 60_000);
  const banked = useRef(0);
  const total = Number(minutes) * 60_000;

  const bank = (ms: number) => {
    const whole = Math.round(ms / 60_000);
    if (whole > banked.current) {
      actions.updateTask(task.id, { focused: (task.focused ?? 0) + whole - banked.current });
      banked.current = whole;
    }
  };

  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => {
      const rest = endsAt - Date.now();
      if (rest > 0) return setLeft(rest);
      setLeft(0);
      setEndsAt(null);
      bank(total);
      pulseWave();
    }, TICK);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, total]);

  const running = endsAt !== null;
  const untouched = !running && left === total;
  const seconds = Math.ceil(left / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const finish = () => {
    bank(total - left);
    onClose();
  };

  return (
    <motion.div className="focus" role="dialog" aria-modal="true" aria-label="Фокус" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <button type="button" className="round-btn focus-close" aria-label="Закрыть" onClick={finish}>
        <Icon name="close" size={18} />
      </button>
      <motion.p className="focus-title" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.5, ease: EASE }}>
        {task.title}
      </motion.p>
      <div className="focus-ring">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r={R} className="focus-track" />
          <circle cx="120" cy="120" r={R} className="focus-fill" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} transform="rotate(-90 120 120)" />
        </svg>
        <strong role="timer">{clock}</strong>
      </div>
      {untouched && (
        <Seg
          value={minutes}
          onChange={(v) => {
            setMinutes(v);
            setLeft(Number(v) * 60_000);
          }}
          options={LENGTHS}
          label="Длина"
        />
      )}
      {left > 0 ? (
        <motion.button type="button" className="primary-btn focus-go" whileTap={{ scale: 0.96 }} onClick={() => (running ? setEndsAt(null) : setEndsAt(Date.now() + left))}>
          {running ? 'Пауза' : untouched ? 'Начать' : 'Продолжить'}
        </motion.button>
      ) : (
        <motion.button type="button" className="primary-btn focus-go" whileTap={{ scale: 0.96 }} onClick={onClose}>
          Готово
        </motion.button>
      )}
    </motion.div>
  );
}
