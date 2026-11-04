/** Geometry of the liquid tab bar: a pure function of time, drawn by Nav.tsx. */

export const BAR_H = 64;
/** Room above the bar for the raised circle and the hill it grows out of. */
export const HEAD = 42;
export const FULL_H = HEAD + BAR_H;
export const CIRCLE_R = 25;

const RADIUS = 26;
const NOTCH_DEPTH = 30;
const NOTCH_HALF = 54;
const HILL_HEIGHT = 34;
const HILL_HALF = 46;
/** Circle centre at rest, a little above the bar's top edge. */
const REST_Y = HEAD - 8;
const SINK_Y = HEAD + 20;
const STEP = 2;

export interface Bump {
  x: number;
  /** 0 is flat, 1 is the full depth or height; overshoots a little while opening. */
  size: number;
}

export interface NavFrame {
  notches: Bump[];
  hill: Bump;
  circle: { x: number; y: number; scale: number; opacity: number; which: 'from' | 'to' };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const backOut = (x: number, s = 1.4) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * One switch, t from 0 to 1, as in the reference video: the circle sinks into the bar, its
 * notch heals, a hill swells at the new place, the circle tears off it and a notch opens under.
 * `fromX` null means nothing to leave behind: the very first appearance.
 */
export function navFrame(t: number, fromX: number | null, toX: number): NavFrame {
  const moving = fromX !== null && fromX !== toX;
  const notches: Bump[] = [];

  if (moving) {
    const closing = 1 - smooth(0.02, 0.5, t);
    if (closing > 0) notches.push({ x: mix(fromX, toX, 0.1 * smooth(0, 0.5, t)), size: closing });
  }
  const opening = clamp01((t - 0.5) / 0.42);
  if (opening > 0) notches.push({ x: toX, size: backOut(opening) });

  const hill = { x: toX, size: smooth(0.08, 0.46, t) * (1 - smooth(0.56, 0.86, t)) };

  if (moving && t < 0.28) {
    const k = t / 0.28;
    return {
      notches,
      hill,
      circle: { x: fromX, y: mix(REST_Y, SINK_Y, k * k), scale: 1 - 0.5 * k * k, opacity: 1 - smooth(0.6, 1, k), which: 'from' },
    };
  }
  const k = clamp01((t - 0.42) / 0.5);
  return {
    notches,
    hill,
    circle: { x: toX, y: mix(SINK_Y - 12, REST_Y, backOut(k, 1.1)), scale: mix(0.35, 1, smooth(0, 1, k)), opacity: smooth(0, 0.14, k), which: 'to' },
  };
}

/** A round-shouldered bump: 1 at the centre, 0 from `half` on. */
const bump = (dx: number, half: number) => {
  const u = Math.abs(dx) / half;
  return u < 1 ? (Math.cos(Math.PI * u) + 1) / 2 : 0;
};

/** Height of the bar's top edge at x. */
export function topEdge(x: number, width: number, frame: Pick<NavFrame, 'notches' | 'hill'>) {
  const fromSide = Math.min(x, width - x);
  const corner = fromSide < RADIUS ? RADIUS - Math.sqrt(RADIUS * RADIUS - (RADIUS - fromSide) ** 2) : 0;
  let dip = 0;
  for (const n of frame.notches) dip += NOTCH_DEPTH * n.size * bump(x - n.x, NOTCH_HALF);
  return HEAD + Math.max(corner, dip) - HILL_HEIGHT * frame.hill.size * bump(x - frame.hill.x, HILL_HALF);
}

/** The bar's outline as an SVG path; also used as its glass's clip-path. */
export function barPath(width: number, frame: Pick<NavFrame, 'notches' | 'hill'>) {
  let d = `M0 ${topEdge(0, width, frame).toFixed(1)}`;
  for (let x = STEP; x < width; x += STEP) d += `L${x} ${topEdge(x, width, frame).toFixed(1)}`;
  d += `L${width} ${topEdge(width, width, frame).toFixed(1)}`;
  d += `V${FULL_H - RADIUS}A${RADIUS} ${RADIUS} 0 0 1 ${width - RADIUS} ${FULL_H}H${RADIUS}A${RADIUS} ${RADIUS} 0 0 1 0 ${FULL_H - RADIUS}Z`;
  return d;
}
