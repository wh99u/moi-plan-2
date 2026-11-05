import { motion } from 'motion/react';
import { useId } from 'react';
import { Icon } from '../ui/Icon';
import { Mark } from './Mark';

/**
 * What each tab does inside the raised circle once it has landed. Before `run` turns on, every
 * glyph is its plain icon, so nothing pops when the circle first comes out of the bar, and each
 * one comes back to that plain icon when it has finished.
 */
interface GlyphProps {
  run: boolean;
  size: number;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Home({ run, size }: GlyphProps) {
  return (
    <motion.span className="glyph" initial={false} animate={run ? { rotate: [0, -14, 9, -4, 0], y: [0, -3, 0, -1, 0] } : { rotate: 0, y: 0 }} transition={{ duration: 0.8, ease: 'easeInOut' }}>
      <Mark size={size + 4} />
    </motion.span>
  );
}

/** Face ID, as when paying: corners close in, a face is scanned, it turns into a tick, the wallet comes back. */
function Wallet({ run, size }: GlyphProps) {
  const d = 2;
  const once = { duration: d, ease: 'easeInOut' } as const;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} overflow="visible" aria-hidden="true" {...stroke}>
      <motion.g initial={false} animate={run ? { opacity: [1, 0, 0, 1], scale: [1, 0.7, 0.7, 1] } : { opacity: 1, scale: 1 }} transition={{ ...once, times: [0, 0.1, 0.88, 1] }} style={{ originX: '50%', originY: '50%' }}>
        <rect x="3" y="6" width="18" height="13" rx="3.5" />
        <path d="M3 10.5h18M15.5 15h2" />
      </motion.g>

      <motion.g
        initial={false}
        animate={run ? { opacity: [0, 1, 1, 1, 0], scale: [1.35, 1, 1, 1.06, 0.8] } : { opacity: 0, scale: 1 }}
        transition={{ ...once, times: [0, 0.14, 0.56, 0.68, 0.9] }}
        style={{ originX: '50%', originY: '50%' }}
      >
        <path d="M3.5 8V6.5a3 3 0 0 1 3-3H8M16 3.5h1.5a3 3 0 0 1 3 3V8M20.5 16v1.5a3 3 0 0 1-3 3H16M8 20.5H6.5a3 3 0 0 1-3-3V16" />
      </motion.g>

      <motion.g initial={false} animate={run ? { opacity: [0, 0, 1, 1, 0] } : { opacity: 0 }} transition={{ ...once, times: [0, 0.12, 0.2, 0.52, 0.6] }}>
        <path d="M9 9v1.2M15 9v1.2M12.2 9v3.4h-.9M9 15.2a4.2 4.2 0 0 0 6 0" />
      </motion.g>

      <motion.path
        d="M5.5 7H18.5"
        strokeWidth="1.4"
        initial={false}
        animate={run ? { y: [0, 0, 10, 0, 10], opacity: [0, 0, 1, 1, 0] } : { y: 0, opacity: 0 }}
        transition={{ ...once, times: [0, 0.14, 0.3, 0.46, 0.56] }}
      />

      <motion.path
        d="M7.2 12.4l3.3 3.3 6.3-6.8"
        strokeWidth="2.4"
        initial={false}
        animate={run ? { pathLength: [0, 0, 1, 1, 1], opacity: [0, 0, 1, 1, 0] } : { pathLength: 0, opacity: 0 }}
        transition={{ ...once, ease: 'easeOut', times: [0, 0.56, 0.72, 0.84, 0.92] }}
      />
    </svg>
  );
}

/** Things drop into the bag one by one, it gives under each and fills up, then it empties back to the plain icon. */
function Bag({ run, size }: GlyphProps) {
  const clip = useId();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} overflow="visible" aria-hidden="true" {...stroke}>
      <defs>
        <clipPath id={clip}>
          <motion.rect
            x="0"
            y="0"
            width="24"
            height="24"
            initial={false}
            animate={run ? { y: [21, 21, 16, 12, 9, 9, 21] } : { y: 21 }}
            transition={{ duration: 1.9, times: [0, 0.14, 0.27, 0.4, 0.53, 0.78, 1], ease: 'easeOut' }}
          />
        </clipPath>
      </defs>
      {[9.2, 14.8, 12].map((cx, i) => (
        <motion.circle
          key={cx}
          cx={cx}
          cy="12"
          r="1.7"
          fill="currentColor"
          stroke="none"
          initial={false}
          animate={run ? { y: [-17, 0], opacity: [0, 1, 1, 0] } : { y: -17, opacity: 0 }}
          transition={{ delay: i * 0.24, duration: 0.34, ease: 'easeIn', opacity: { delay: i * 0.24, duration: 0.34, times: [0, 0.2, 0.85, 1] } }}
        />
      ))}
      <motion.g
        style={{ originX: '50%', originY: '100%', transformBox: 'fill-box' }}
        initial={false}
        animate={run ? { scaleY: [1, 1, 0.9, 1.04, 0.9, 1.04, 0.9, 1.05, 1], scaleX: [1, 1, 1.06, 0.98, 1.06, 0.98, 1.07, 0.98, 1] } : { scaleX: 1, scaleY: 1 }}
        transition={{ duration: 1.15 }}
      >
        <path d="M5 8h14l-1 12H6z" fill="currentColor" fillOpacity="0.3" stroke="none" clipPath={`url(#${clip})`} />
        <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />
      </motion.g>
    </svg>
  );
}

/** One big tick across the whole page of the calendar, then the plain calendar again. */
function Calendar({ run, size }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} overflow="visible" aria-hidden="true" {...stroke}>
      <motion.g initial={false} animate={run ? { scale: [1, 0.92, 1.06, 1] } : { scale: 1 }} transition={{ duration: 0.7, times: [0, 0.2, 0.65, 1] }} style={{ originX: '50%', originY: '50%' }}>
        <rect x="3" y="5" width="18" height="16" rx="3.5" />
        <path d="M8 3v4M16 3v4" />
        <motion.path d="M3 10h18" initial={false} animate={run ? { opacity: [1, 0, 0, 1] } : { opacity: 1 }} transition={{ duration: 1.7, times: [0, 0.1, 0.82, 1] }} />
        <motion.path
          d="M6.6 13.4l3.8 3.9 7-8.3"
          strokeWidth="2.5"
          initial={false}
          animate={run ? { pathLength: [0, 0, 1, 1, 1], opacity: [0, 1, 1, 1, 0] } : { pathLength: 0, opacity: 0 }}
          transition={{ duration: 1.7, times: [0, 0.08, 0.38, 0.82, 1], ease: 'easeOut' }}
        />
      </motion.g>
    </svg>
  );
}

/** Just one turn around its own axis. */
function More({ run, size }: GlyphProps) {
  return (
    <motion.span className="glyph" initial={false} animate={{ rotate: run ? 360 : 0 }} transition={run ? { duration: 0.85, ease: [0.45, 0, 0.15, 1] } : { duration: 0 }}>
      <Icon name="grid" size={size} stroke={1.9} />
    </motion.span>
  );
}

const GLYPHS = [Home, Wallet, Bag, Calendar, More];

export function NavGlyph({ index, run, size }: { index: number; run: boolean; size: number }) {
  const Glyph = GLYPHS[index];
  return <Glyph run={run} size={size} />;
}
