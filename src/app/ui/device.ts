/**
 * A phone or a tablet: no mouse under the finger. Effects that cost a lot and show little there
 * (blur in transitions, scaling while scrolling) are left out, so the screen stays smooth.
 */
export const LOW = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

/** A blur in an animation's keyframe: `{ opacity: 0, ...blur(8) }`. Nothing at all on a phone. */
export const blur = (px: number): { filter?: string } => (LOW ? {} : { filter: `blur(${px}px)` });
