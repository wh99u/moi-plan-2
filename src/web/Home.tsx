import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { firstName, greeting, useProfile } from '../app/profile';
import { openSheet } from '../app/sheet';
import { EASE, MorphText, RollingText } from '../app/ui/text';
import { Icon } from '../ui/Icon';
import { Recede } from './Recede';
import { nextReminderTurn } from './reminders';
import { Today, useNow, useToday } from './Today';
import { pulseWave } from './Wave';
import { WeatherLine } from './Weather';

const TILT = { stiffness: 120, damping: 18, mass: 0.6 };

/** The card's two faces change places. */
const swap = {
  initial: { opacity: 0, scale: 1.05, filter: 'blur(10px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
  exit: { opacity: 0, scale: 0.96, filter: 'blur(8px)', transition: { duration: 0.24, ease: 'easeIn' } },
} as const;

/** Each part of the card comes up after the one above it, every time the home screen opens. */
const arrive = (i: number) => ({
  initial: { opacity: 0, y: 22, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
  transition: { delay: 0.12 + i * 0.09, duration: 0.7, ease: EASE },
});

export function Home() {
  const [view, setView] = useState<'hello' | 'today'>('hello');

  // The line behind flares as the screen opens.
  useEffect(() => pulseWave(), []);

  // The glass leans towards the mouse and catches a light where it points.
  const card = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, TILT);
  const rotateY = useSpring(ry, TILT);
  const onMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || !card.current) return;
    const b = card.current.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    card.current.style.setProperty('--mx', `${x * 100}%`);
    card.current.style.setProperty('--my', `${y * 100}%`);
    rx.set((0.5 - y) * 5);
    ry.set((x - 0.5) * 6);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  // Height follows the content, so the card grows into the task list instead of swapping.
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = inner.current!;
    const ro = new ResizeObserver(() => setHeight(node.offsetHeight));
    ro.observe(node);
    setHeight(node.offsetHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="home">
      <div className="hero-float">
      <Recede
        from={5}
        panel
        className="glass hero-card"
        style={{ rotateX, rotateY, transformPerspective: 1100 }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <div ref={card} className="hero-light">
          <motion.div className="hero-size" animate={height === null ? undefined : { height }} initial={false} transition={{ type: 'spring', stiffness: 170, damping: 24, mass: 0.9 }}>
            <div ref={inner} className="hero-inner">
              <AnimatePresence mode="wait">
                {view === 'hello' ? (
                  <motion.div key="hello" {...swap}>
                    <Hello onOpen={() => setView('today')} />
                  </motion.div>
                ) : (
                  <motion.div key="today" {...swap}>
                    <Today onBack={() => setView('hello')} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </Recede>
      </div>
    </div>
  );
}

function Hello({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="hello">
      <Recede from={2.2} delay={0.02} className="hello-part">
        <motion.div {...arrive(0)}>
          <NowChip />
        </motion.div>
        <motion.div {...arrive(1)}>
          <WeatherLine />
        </motion.div>
      </Recede>
      <Recede from={1.9} delay={0.06} className="hello-part">
        <motion.div {...arrive(2)}>
          <Greeting />
        </motion.div>
      </Recede>
      <Recede from={1.7} delay={0.12} className="hello-part">
        <motion.button
          type="button"
          className="cta"
          onClick={() => {
            pulseWave();
            onOpen();
          }}
          initial={{ opacity: 0, y: 26, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.38, type: 'spring', stiffness: 240, damping: 18 }}
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.96 }}
        >
          <span className="cta-shine" aria-hidden="true" />
          <span>Задачи на сегодня</span>
          <span className="cta-arrow">
            <Icon name="arrowRight" size={18} stroke={2} />
          </span>
        </motion.button>
      </Recede>
      <Recede from={1.45} delay={0.18} className="hello-part">
        <motion.div {...arrive(4)}>
          <Reminder />
        </motion.div>
      </Recede>
    </div>
  );
}

/** Weekday, date and the clock on a pill that fills up as the day goes by. */
function NowChip() {
  const now = useNow(1000);
  const date = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const share = (now.getHours() * 60 + now.getMinutes()) / 1440;
  return (
    <span className="chip" title={`Прошло ${Math.round(share * 100)}% дня`}>
      <motion.span className="chip-fill" initial={{ scaleX: 0 }} animate={{ scaleX: share }} transition={{ delay: 0.7, duration: 1.8, ease: EASE }} />
      <span className="chip-text">{date}</span>
      <span className="chip-clock">
        <RollingText text={String(now.getHours()).padStart(2, '0')} />
        <span className="chip-colon">:</span>
        <RollingText text={String(now.getMinutes()).padStart(2, '0')} />
      </span>
    </span>
  );
}

function Greeting() {
  const now = useNow(60_000);
  const { name } = useProfile();
  const first = firstName(name);
  const hello = greeting(now.getHours());
  return (
    <h1 className="hi">
      <MorphText text={first ? `${hello},` : hello} delay={0.3} />
      {first && (
        <button type="button" className="hi-name" onClick={() => openSheet('profile')}>
          {/* The name writes itself in right after the last letter of the greeting. */}
          <MorphText text={first} delay={0.3 + (hello.length + 1) * 0.028} />
        </button>
      )}
    </h1>
  );
}

/** One small line, a different one each time the home screen comes into view. */
function Reminder() {
  const { reminders } = useToday();
  const [turn] = useState(nextReminderTurn);
  const text = reminders[turn % reminders.length];

  return (
    <div className="reminder">
      <motion.span className="reminder-icon" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 380, damping: 20 }}>
        <Icon name="list" size={15} stroke={2} />
      </motion.span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={text}
          className="reminder-text"
          initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
