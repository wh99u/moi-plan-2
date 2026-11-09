import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type CSSProperties } from 'react';
import { addDays, dayKey, parseDay } from '../../lib/dates';
import { Icon } from '../../ui/Icon';
import { weekStart } from './logic';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/** How far a finger goes before it is a swipe, px. */
const SWIPE = 36;

interface Props {
  /** Any day of the week to show. */
  anchor: string;
  today: string;
  /** Days in light: the ones on the screen below. */
  active: string[];
  onPick: (day: string) => void;
  /** Sideways: a week back or on. */
  onWeek: (delta: -1 | 1) => void;
  /** Pulled down: the whole month. */
  onPull?: () => void;
  /** 0..1 under each day: how much of it is done. */
  fill?: (day: string) => number | null;
}

/**
 * A small row of the week's days. Sideways it turns the week; pulled down, with the grip under it,
 * it opens the month.
 */
export function WeekStrip({ anchor, today, active, onPick, onWeek, onPull, fill }: Props) {
  const first = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(parseDay(first), i)));
  const [dir, setDir] = useState(0);
  const swiped = useRef(false);

  const turn = (d: -1 | 1) => {
    setDir(d);
    onWeek(d);
  };

  return (
    <div
      className="wstrip"
      onPointerDown={(e) => {
        const f = { x: e.clientX, y: e.clientY, id: e.pointerId };
        swiped.current = false;
        // Heard on the whole window: a mouse is let go wherever the swipe took it.
        const up = (u: PointerEvent) => {
          if (u.pointerId !== f.id) return;
          removeEventListener('pointerup', up);
          removeEventListener('pointercancel', up);
          if (u.type === 'pointercancel') return;
          const dx = u.clientX - f.x;
          const dy = u.clientY - f.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
          swiped.current = true;
          if (Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
          else if (dy > 0) onPull?.();
        };
        addEventListener('pointerup', up);
        addEventListener('pointercancel', up);
      }}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        e.stopPropagation();
        swiped.current = false;
      }}
    >
      <div className="wstrip-view">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={first}
            className="wstrip-row"
            custom={dir}
            variants={{ enter: (d: number) => ({ x: d * 60, opacity: 0 }), show: { x: 0, opacity: 1 }, leave: (d: number) => ({ x: d * -60, opacity: 0 }) }}
            initial="enter"
            animate="show"
            exit="leave"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {days.map((key, i) => {
              const on = active.includes(key);
              const share = fill?.(key) ?? null;
              const cls = ['wday', on && 'is-on', on && active[0] === key && 'is-first', on && active[active.length - 1] === key && 'is-last', key === today && 'is-today'].filter(Boolean).join(' ');
              return (
                <motion.button key={key} type="button" className={cls} aria-pressed={on} onClick={() => onPick(key)} whileTap={{ scale: 0.9 }} style={{ animationDelay: `${i * 0.03}s` }}>
                  {on && <motion.i layoutId={active.length === 1 ? 'wday-light' : undefined} className="wday-light" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span>{DAYS[i]}</span>
                  <strong>{Number(key.slice(8))}</strong>
                  {share !== null && <i className="wday-fill" style={{ '--p': share } as CSSProperties} />}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      {onPull && (
        <button type="button" className="wstrip-grip" aria-label="Открыть месяц" onClick={onPull}>
          <Icon name="down" size={16} stroke={2.2} />
        </button>
      )}
    </div>
  );
}
