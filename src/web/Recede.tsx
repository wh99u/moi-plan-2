import { motion, type HTMLMotionProps } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { blur, LOW } from '../app/ui/device';

/** Very quick at the start, a long soft landing: sharp and very smooth at once. */
export const PULL_EASE = [0.04, 0.86, 0.1, 1] as const;
const PULL = 1.9;

let entryAt = performance.now();
/** The opening shot starts now: called as the loading screen gets out of the way. */
export const startEntry = () => {
  entryAt = performance.now();
};
/** True only just after that, so the pull-back happens once per visit. */
const entering = () => performance.now() - entryAt < 1200;

interface Props extends HTMLMotionProps<'div'> {
  /** How close to the viewer it starts: 2.4 is 2.4 times its size. */
  from: number;
  delay?: number;
  /** It starts off screen, so it need not fade in. Keeps a glass child's blur alive from the first frame. */
  solid?: boolean;
  /** The main panel of a page: also moves when the page changes, not only on arrival. */
  panel?: boolean;
}

/**
 * Part of the opening shot: the camera pulls back from the middle of the screen, so a thing starts
 * enlarged around that point rather than its own. Nearer things start bigger and travel further.
 * The motion is on the element itself: an animated parent's opacity would cut a glass panel off
 * its backdrop, and the panel would stay clear until the fade ended.
 */
export function Recede({ from, delay = 0, solid = false, panel = false, onAnimationComplete, ...rest }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const play = useRef(entering());

  useLayoutEffect(() => {
    const node = el.current;
    if (!node || !play.current) return;
    const held = node.style.transform;
    node.style.transform = 'none';
    const box = node.getBoundingClientRect();
    node.style.transform = held;
    node.style.transformOrigin = `${innerWidth / 2 - box.left}px ${innerHeight / 2 - box.top}px`;
  }, []);

  // Out of focus while it is that close, as things near a lens are. A blur on a solid one would cut its glass children off too.
  const near = !solid && play.current;
  const initial = play.current ? { scale: from, opacity: solid ? 1 : 0, ...(near ? { ...blur(16) } : {}) } : panel ? { scale: 1.14, opacity: 0 } : false;
  const pull = play.current ? PULL : 1;

  return (
    <motion.div
      ref={el}
      initial={initial}
      animate={{ scale: 1, opacity: 1, ...(near ? { ...blur(0), transitionEnd: LOW ? undefined : { filter: 'none' } } : {}) }}
      exit={panel ? { scale: 0.92, opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } } : undefined}
      transition={{
        scale: { delay, duration: pull, ease: PULL_EASE },
        opacity: { delay, duration: play.current ? 0.28 : 0.3, ease: 'easeOut' },
        filter: { delay, duration: 0.7, ease: 'easeOut' },
      }}
      onAnimationComplete={(def) => {
        if (el.current) el.current.style.transformOrigin = '';
        onAnimationComplete?.(def);
      }}
      {...rest}
    />
  );
}
