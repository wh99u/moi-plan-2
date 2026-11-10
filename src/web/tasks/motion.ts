import { EASE } from '../../app/ui/text';

/*
 * The movements of the tasks section, in one place, so every card, row and tile arrives, goes
 * and opens the same way.
 */

/** Arrives a little later than the one before it, rising into place. */
export const reveal = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: Math.min(i, 10) * 0.04, duration: 0.45, ease: EASE },
});

/** The same, for what may be below the screen at first: it plays when it comes into view. */
export const revealInView = (i = 0) => ({
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { delay: Math.min(i, 10) * 0.04, duration: 0.45, ease: EASE },
});

/** A row that leaves closes the place it took. */
export const collapse = { opacity: 0, height: 0, paddingBottom: 0, transition: { duration: 0.26, ease: EASE } };

/** A part that opens and shuts under its button. */
export const unfold = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.32, ease: EASE },
} as const;

export const POP = { type: 'spring', stiffness: 420, damping: 30 } as const;
