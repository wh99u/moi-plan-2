import { AnimatePresence, motion, useDragControls, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../ui/Icon';
import { Seg } from '../Seg';
import { pulseWave } from '../Wave';
import { closeFocus, FOCUS_LENGTHS, focusLeft, setFocusLength, startFocus, tickFocus, toggleFocusPause, useFocusTimer, type FocusTimer } from './focusTimer';

const R = 54;
const C = 2 * Math.PI * R;
const TICK = 500;
const LENGTHS = FOCUS_LENGTHS.map((m) => ({ id: String(m), label: `${m} мин` }));
const MORPH = { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 } as const;

/** Above every screen: asks how long, then shrinks into a small window that can be dragged out of the way. */
export function FocusWindow() {
  const timer = useFocusTimer();

  // A timer that ran out while the page was closed.
  useEffect(() => {
    if (tickFocus()) pulseWave();
  }, []);

  return createPortal(<AnimatePresence>{timer && <Body key={timer.taskId} timer={timer} />}</AnimatePresence>, document.body);
}

function Body({ timer }: { timer: FocusTimer }) {
  const [now, setNow] = useState(() => Date.now());
  const bounds = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const setup = timer.phase === 'setup';
  const done = timer.phase === 'done';
  const paused = timer.phase === 'run' && timer.endsAt === null;

  useEffect(() => {
    if (timer.phase !== 'run' || timer.endsAt === null) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (tickFocus()) pulseWave();
    }, TICK);
    return () => clearInterval(t);
  }, [timer.phase, timer.endsAt]);

  const left = focusLeft(timer, Math.max(now, Date.now()));
  const seconds = Math.ceil(left / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const ring = (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={R} className="focus-track" />
      <circle cx="60" cy="60" r={R} className="focus-fill" strokeDasharray={C} strokeDashoffset={C * (1 - left / timer.total)} transform="rotate(-90 60 60)" />
    </svg>
  );

  return (
    <>
      <AnimatePresence>{setup && <motion.div className="sheet-scrim focus-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => closeFocus()} />}</AnimatePresence>
      <div ref={bounds} className={`focus-bounds${setup ? ' is-setup' : ''}`}>
        <motion.div
          layout
          layoutDependency={timer.phase === 'setup'}
          className={setup ? 'focus-card' : `focus-mini${done ? ' is-done' : ''}${paused ? ' is-paused' : ''}`}
          role={setup ? 'dialog' : 'timer'}
          aria-modal={setup || undefined}
          aria-label={`Фокус: ${timer.title}`}
          style={{ borderRadius: 34, x: setup ? 0 : x, y: setup ? 0 : y }}
          drag={!setup}
          dragControls={controls}
          dragListener={false}
          dragConstraints={bounds}
          dragElastic={0.08}
          dragMomentum={false}
          onPointerDown={(e) => {
            if (!setup && !(e.target as Element).closest('button')) controls.start(e);
          }}
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.22 } }}
          transition={MORPH}
        >
          {setup ? (
            <>
              <button type="button" className="round-btn focus-close" aria-label="Закрыть" onClick={() => closeFocus()}>
                <Icon name="close" size={18} />
              </button>
              <motion.p layout="position" className="focus-title">
                {timer.title}
              </motion.p>
              <motion.div layoutId="focus-ring" className="focus-ring">
                {ring}
                <strong>{clock}</strong>
              </motion.div>
              <Seg value={String(timer.total / 60_000)} onChange={(v) => setFocusLength(Number(v))} options={LENGTHS} label="Длина" />
              <motion.button type="button" className="primary-btn focus-go" whileTap={{ scale: 0.96 }} onClick={() => startFocus()}>
                Начать
              </motion.button>
            </>
          ) : (
            <>
              <motion.div layoutId="focus-ring" className="focus-ring">
                {ring}
                {done ? (
                  <span className="focus-ring-done">
                    <Icon name="check" size={20} stroke={2.6} />
                  </span>
                ) : (
                  <motion.button type="button" className="focus-pause" aria-label={paused ? 'Продолжить' : 'Пауза'} whileTap={{ scale: 0.82 }} onClick={() => toggleFocusPause()}>
                    <Icon name={paused ? 'play' : 'pause'} size={18} />
                  </motion.button>
                )}
              </motion.div>
              <div className="focus-words">
                <strong>{done ? 'Готово' : clock}</strong>
                <span>{timer.title}</span>
              </div>
              <button type="button" className="focus-stop" aria-label={done ? 'Закрыть' : 'Закончить'} onClick={() => closeFocus()}>
                <Icon name="close" size={16} />
              </button>
            </>
          )}
        </motion.div>
      </div>
    </>
  );
}
