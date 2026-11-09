import { useState } from 'react';
import { flushSync } from 'react-dom';

/** A window whose record was deleted sinks and fades where it stands: there is no card left to shrink back into. */
export const GONE = { opacity: 0, scale: 0.86, y: 40, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } } as const;

/**
 * For a window that grows out of a card (`layoutId`). On delete it first lets go of the card,
 * so motion does not fly it back into a card that is leaving too, and takes its own way out.
 */
export function useGone(morph: string) {
  const [gone, setGone] = useState(false);
  return {
    layoutId: gone ? undefined : morph,
    exit: gone ? GONE : undefined,
    /** Runs the deletion once the window knows it is leaving for good. */
    leave(then: () => void) {
      flushSync(() => setGone(true));
      then();
    },
  };
}
