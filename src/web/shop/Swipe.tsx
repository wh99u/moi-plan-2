import { animate, motion, useIsPresent, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../ui/Icon';

/** How far, as a share of the width, a slow swipe has to go to count. */
const PASS = 0.34;
/** A quick flick counts sooner: this fast, in px a second, and past a small start. */
const FLING = 550;
const FLING_FROM = 28;
const BACK = { type: 'spring', stiffness: 520, damping: 38 } as const;
const AWAY = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const;

interface Props {
  children: ReactNode;
  /** Narrow cards show only the icons. */
  compact?: boolean;
  radius: number;
  /** True when buying needs nothing more, so the thing can fly off; otherwise it comes back and a form asks the rest. */
  buysAtOnce: boolean;
  onBuy: () => void;
  onDelete: () => void;
}

/** Right is «Купил», left is «Удалить»: what is underneath shows as the thing moves aside. */
export function Swipe({ children, compact = false, radius, buysAtOnce, onBuy, onDelete }: Props) {
  const x = useMotionValue(0);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const buyShow = useTransform(x, [8, 64], [0, 1]);
  const delShow = useTransform(x, [-64, -8], [1, 0]);
  const buyScale = useTransform(x, [20, 110], [0.6, 1]);
  const delScale = useTransform(x, [-110, -20], [1, 0.6]);
  // «Отменить» can bring it back while it is still on its way out: then it returns to its place.
  const present = useIsPresent();
  useEffect(() => {
    if (present && x.get() !== 0) void animate(x, 0, BACK);
  }, [present, x]);

  const end = (_: PointerEvent, info: PanInfo) => {
    const w = box.current?.offsetWidth ?? 320;
    const dx = x.get();
    const left = dx < -w * PASS || (dx < -FLING_FROM && info.velocity.x < -FLING);
    const right = dx > w * PASS || (dx > FLING_FROM && info.velocity.x > FLING);
    if (left) {
      void animate(x, -w * 1.15, AWAY).then(onDelete);
    } else if (right && buysAtOnce) {
      void animate(x, w * 1.15, AWAY).then(onBuy);
    } else {
      void animate(x, 0, BACK);
      if (right) onBuy();
    }
  };

  return (
    <div ref={box} className={`swipe${compact ? ' is-compact' : ''}`} style={{ borderRadius: radius }}>
      <motion.span className="swipe-under is-buy" style={{ opacity: buyShow, borderRadius: radius }} aria-hidden="true">
        <motion.span className="swipe-mark" style={{ scale: buyScale }}>
          <Icon name="check" size={compact ? 20 : 18} stroke={2.4} />
          {!compact && 'Купил'}
        </motion.span>
      </motion.span>
      <motion.span className="swipe-under is-del" style={{ opacity: delShow, borderRadius: radius }} aria-hidden="true">
        <motion.span className="swipe-mark" style={{ scale: delScale }}>
          {!compact && 'Удалить'}
          <Icon name="trash" size={compact ? 20 : 18} stroke={2} />
        </motion.span>
      </motion.span>
      <motion.div
        className="swipe-top"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragElastic={0}
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
