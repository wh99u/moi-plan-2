import { EASE } from './text';
import { blur, LOW } from './device';

/** Fade-and-rise entrance used by cards across the app. */
export const rise = (delay: number) => ({
  initial: { opacity: 0, y: 24, ...blur(8) },
  animate: { opacity: 1, y: 0, ...blur(0), transitionEnd: LOW ? undefined : { filter: 'none' } },
  transition: { delay, duration: 0.9, ease: EASE },
});
