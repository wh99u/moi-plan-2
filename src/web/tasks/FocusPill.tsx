import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { blur } from '../../app/ui/device';
import { Icon } from '../../ui/Icon';
import { Plate, PlateRow } from '../Plate';
import type { Route } from '../route';
import { pulseWave } from '../Wave';
import { closeFocus, finishFocus, FOCUS_LENGTHS, focusLeft, setFocusLength, spentWords, startFocus, tickFocus, toggleFocusPause, useFocusLength, useFocusTimer } from './focusTimer';

const R = 13;
const C = 2 * Math.PI * R;
const TICK = 250;
/** How long «Готово» glows before the pill is ready for the next one, ms. */
const DONE_FOR = 2800;
const SHAPE = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;
/** What is inside changes through a blur, as in the reference: the old goes soft and the new comes sharp. */
const SWAP = {
  initial: { opacity: 0, scale: 0.9, ...blur(8) },
  animate: { opacity: 1, scale: 1, ...blur(0) },
  exit: { opacity: 0, scale: 0.9, ...blur(8) },
  transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
} as const;

const clockOf = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The pomodoro in the corner: «Фокус 25:00» with a gear; a tap turns it into a ring, the time and a
 * pause; paused, «Продолжить» and a stop come out; at the end it glows with how long it lasted.
 * On the tasks it is always there; elsewhere only while it runs.
 */
export function FocusPill({ route }: { route: Route }) {
  const timer = useFocusTimer();
  const length = useFocusLength();
  const [now, setNow] = useState(() => Date.now());
  const [setup, setSetup] = useState(false);
  const running = timer?.phase === 'run';
  const paused = running && timer.endsAt === null;
  const done = timer?.phase === 'done';

  // A timer that ran out while the page was closed.
  useEffect(() => {
    if (tickFocus()) pulseWave();
  }, []);

  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (tickFocus()) pulseWave();
    }, TICK);
    return () => clearInterval(t);
  }, [running, paused]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => closeFocus(), DONE_FOR);
    return () => clearTimeout(t);
  }, [done]);

  const shown = route === 'tasks' || !!timer;
  const left = timer ? focusLeft(timer, Math.max(now, Date.now())) : length * 60_000;
  const share = timer ? 1 - left / timer.total : 0;
  const state = done ? 'done' : paused ? 'paused' : running ? 'run' : 'idle';

  return createPortal(
    <>
      <AnimatePresence>
        {shown && (
          <motion.div
            key="pill"
            layout
            className={`fpill is-${state}`}
            style={{ borderRadius: 26 }}
            role="timer"
            aria-label={timer ? `${timer.title}: ${clockOf(left)}` : 'Фокус'}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.8, transition: { duration: 0.2 } }}
            transition={SHAPE}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {state === 'idle' && (
                <motion.div key="idle" className="fpill-row" {...SWAP}>
                  <motion.button type="button" className="fpill-start" onClick={() => startFocus()} whileTap={{ scale: 0.94 }}>
                    <Icon name="clock" size={16} stroke={2} />
                    <span>Фокус</span>
                    <em>{clockOf(length * 60_000)}</em>
                  </motion.button>
                  <motion.button type="button" className="fpill-round" aria-label="Длина фокуса" onClick={() => setSetup(true)} whileTap={{ scale: 0.85, rotate: 60 }}>
                    <Gear />
                  </motion.button>
                </motion.div>
              )}

              {(state === 'run' || state === 'paused') && (
                <motion.div key="run" className="fpill-row" {...SWAP}>
                  <span className="fpill-ring" aria-hidden="true">
                    <svg viewBox="0 0 32 32">
                      <circle cx="16" cy="16" r={R} className="fpill-track" />
                      <circle cx="16" cy="16" r={R} className="fpill-fill" strokeDasharray={C} strokeDashoffset={C * (1 - share)} transform="rotate(-90 16 16)" />
                    </svg>
                  </span>
                  <motion.span layout="position" className={`fpill-time${paused ? ' is-dim' : ''}`}>
                    {clockOf(left)}
                  </motion.span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {paused ? (
                      <motion.div key="paused" className="fpill-row" {...SWAP}>
                        <motion.button type="button" className="fpill-resume" onClick={() => toggleFocusPause()} whileTap={{ scale: 0.94 }}>
                          <Icon name="play" size={13} stroke={2.2} />
                          Продолжить
                        </motion.button>
                        <motion.button type="button" className="fpill-round" aria-label="Закончить" onClick={() => finishFocus()} whileTap={{ scale: 0.85 }}>
                          <i className="fpill-stop" />
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.button key="pause" type="button" className="fpill-round" aria-label="Пауза" onClick={() => toggleFocusPause()} whileTap={{ scale: 0.85 }} {...SWAP}>
                        <Icon name="pause" size={14} stroke={2.2} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {state === 'done' && timer && (
                <motion.button key="done" type="button" className="fpill-done" onClick={() => closeFocus()} {...SWAP}>
                  <Icon name="check" size={15} stroke={2.6} />
                  Фокус {spentWords(timer.total - timer.left)}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <Plate open={setup} title="Фокус" note="Сколько длится один подход" onClose={() => setSetup(false)} action={{ label: 'Начать', onClick: () => { setSetup(false); startFocus(); } }}>
        <PlateRow label="Длина" wide>
          <div className="plate-chips">
            {FOCUS_LENGTHS.map((m) => (
              <button key={m} type="button" className={`plate-chip${m === length ? ' is-on' : ''}`} aria-pressed={m === length} onClick={() => setFocusLength(m)}>
                {m} мин
              </button>
            ))}
          </div>
        </PlateRow>
        <PlateRow label="Своя" index={1}>
          <div className="plate-stepper">
            <button type="button" aria-label="Меньше" onClick={() => setFocusLength(Math.max(5, length - 5))}>
              <Icon name="minus" size={16} />
            </button>
            <strong>{length} мин</strong>
            <button type="button" aria-label="Больше" onClick={() => setFocusLength(Math.min(180, length + 5))}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        </PlateRow>
      </Plate>
    </>,
    document.body,
  );
}

function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
