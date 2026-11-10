import { animate, motion, useIsPresent, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';

/** How far, as a share of the width, a slow swipe has to go to count. */
const PASS = 0.34;
/** A quick flick counts sooner: this fast, in px a second, and past a small start. */
const FLING = 550;
const FLING_FROM = 28;
const BACK = { type: 'spring', stiffness: 520, damping: 38 } as const;
const AWAY = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const;

/** What one side does: its word and sign underneath, and whether the thing flies off before it happens. */
export interface SwipeSide {
  label: string;
  icon: string;
  tone: 'buy' | 'del' | 'edit';
  /** Flies off the screen first (it leaves the list); otherwise it comes back to its place. */
  away: boolean;
  run: () => void;
}

interface Props {
  children: ReactNode;
  /** Narrow cards show only the icons. */
  compact?: boolean;
  radius: number;
  /** Swiped to the right. */
  right?: SwipeSide;
  /** Swiped to the left. */
  left?: SwipeSide;
}

/** A row that moves aside under the finger; what each side does shows underneath as it goes. */
export function Swipe({ children, compact = false, radius, right, left }: Props) {
  const x = useMotionValue(0);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const rightShow = useTransform(x, [8, 64], [0, 1]);
  const leftShow = useTransform(x, [-64, -8], [1, 0]);
  const rightScale = useTransform(x, [20, 110], [0.6, 1]);
  const leftScale = useTransform(x, [-110, -20], [1, 0.6]);
  // A deletion taken back while it was still on its way out: then it returns to its place.
  const present = useIsPresent();
  useEffect(() => {
    if (present && x.get() !== 0) void animate(x, 0, BACK);
  }, [present, x]);

  const end = (_: PointerEvent, info: PanInfo) => {
    const w = box.current?.offsetWidth ?? 320;
    const dx = x.get();
    const toLeft = !!left && (dx < -w * PASS || (dx < -FLING_FROM && info.velocity.x < -FLING));
    const toRight = !!right && (dx > w * PASS || (dx > FLING_FROM && info.velocity.x > FLING));
    const side = toLeft ? left : toRight ? right : undefined;
    if (side?.away) {
      void animate(x, (toLeft ? -1 : 1) * w * 1.15, AWAY).then(side.run);
      return;
    }
    void animate(x, 0, BACK);
    side?.run();
  };

  const under = (side: SwipeSide, show: typeof rightShow, scale: typeof rightScale, at: 'start' | 'end') => (
    <motion.span className={`swipe-under is-${side.tone} is-${at}`} style={{ opacity: show, borderRadius: radius }} aria-hidden="true">
      <motion.span className="swipe-mark" style={{ scale }}>
        {at === 'end' && !compact && side.label}
        <Icon name={side.icon} size={compact ? 20 : 18} stroke={2.2} />
        {at === 'start' && !compact && side.label}
      </motion.span>
    </motion.span>
  );

  return (
    <div ref={box} className={`swipe${compact ? ' is-compact' : ''}`} style={{ borderRadius: radius }}>
      {right && under(right, rightShow, rightScale, 'start')}
      {left && under(left, leftShow, leftScale, 'end')}
      <motion.div
        className="swipe-top"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={right && left ? undefined : right ? { left: 0 } : { right: 0 }}
        onPointerDownCapture={() => {
          moved.current = false;
        }}
        onDragStart={() => {
          moved.current = true;
        }}
        onDragEnd={end}
        // A swipe ends over the card it started on: that must not open it.
        onClickCapture={(e) => {
          if (!moved.current) return;
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
