import type { Priority } from '../../lib/types';

/**
 * The line of the day down the hours. It runs quietly along the left edge and bends towards
 * the cards wherever there is a task: the more important the task, the further it reaches
 * and the more of the task's own colour it takes on.
 */

/** A task on the line: minutes from midnight and how important it is. */
export interface LineTask {
  from: number;
  to: number;
  priority: Priority;
}

/** One colour per kind of task, from none to high; the line is the first one wherever it is calm. */
export const TYPE_COLORS: Record<'dark' | 'light', readonly [string, string, string, string]> = {
  dark: ['#34c77b', '#4da3ff', '#e6d34a', '#ff6a3d'],
  light: ['#1fa463', '#2f84e6', '#c9a400', '#ec4f22'],
};
export const TYPE_NAMES = ['без важности', 'низкой', 'средней', 'высокой'] as const;

const DAY = 24 * 60;
/** Every this many minutes the line gets a point. */
const STEP = 5;
/** How far before and after a task the line already starts to lean towards it, minutes. */
const FALL = 40;
/** Where the line runs when nothing is going on, px from the left. */
const BASE = 5;
/** How far a task of each importance pulls the line to the right, px. */
const REACH = [5, 10, 16, 22] as const;

/** How strongly a task holds the line at this minute: wholly inside it, fading softly on either side. */
export function pull(t: LineTask, minute: number): number {
  const off = minute < t.from ? t.from - minute : minute > t.to ? minute - t.to : 0;
  return Math.exp(-((off / FALL) ** 2));
}

interface Sample {
  y: number;
  x: number;
  /** Which kind of task holds the line here, and how strongly. */
  p: Priority;
  w: number;
}

/** The line, one point every few minutes, smoothed so that two tasks next to each other meet without a corner. */
export function lineSamples(tasks: LineTask[], hourPx: number): Sample[] {
  const n = DAY / STEP;
  const raw: Sample[] = [];
  for (let i = 0; i <= n; i++) {
    const m = i * STEP;
    let reach = 0;
    let p: Priority = 0;
    let w = 0;
    for (const t of tasks) {
      const k = pull(t, m);
      const r = REACH[t.priority] * k;
      if (r > reach) reach = r;
      // The colour follows the most important task nearby, not just the nearest.
      const weight = k * (1 + t.priority);
      if (weight > w * (1 + p)) {
        p = t.priority;
        w = k;
      }
    }
    // A slow breath of its own, so even an empty day does not look ruled.
    const breath = 1.6 * Math.sin(m / 97 + 0.6) + 0.8 * Math.sin(m / 41);
    raw.push({ y: (m / 60) * hourPx, x: BASE + breath + reach, p, w });
  }
  // Two passes of a small average take out the corners where one task hands over to another.
  let xs = raw.map((s) => s.x);
  for (let pass = 0; pass < 2; pass++) {
    xs = xs.map((_, i) => {
      let sum = 0;
      let c = 0;
      for (let j = i - 2; j <= i + 2; j++) {
        if (j < 0 || j > n) continue;
        sum += xs[j];
        c++;
      }
      return sum / c;
    });
  }
  return raw.map((s, i) => ({ ...s, x: xs[i] }));
}

/** A smooth path through the points (Catmull-Rom turned into cubic curves). */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return '';
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Between two colours, `t` of the way from the first. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export interface DayLine {
  path: string;
  /** Down the line, as fractions of the day's height. */
  stops: { offset: number; color: string }[];
  /** Where the line is at a minute, px from the left. */
  xAt: (minute: number) => number;
  colorAt: (minute: number) => string;
}

export function dayLine(tasks: LineTask[], hourPx: number, theme: 'dark' | 'light'): DayLine {
  const s = lineSamples(tasks, hourPx);
  const colors = TYPE_COLORS[theme];
  const color = (i: number) => mix(colors[0], colors[s[i].p], Math.min(1, s[i].w * 1.15));
  const at = (minute: number) => Math.max(0, Math.min(s.length - 1, Math.round(minute / STEP)));
  // A stop every quarter of an hour is plenty for the eye, and keeps the gradient small.
  const stops = s.filter((_, i) => i % 3 === 0).map((_, k) => ({ offset: (k * 3) / (s.length - 1), color: color(k * 3) }));
  return {
    // Every other point is enough for the curve itself.
    path: smoothPath(s.filter((_, i) => i % 2 === 0 || i === s.length - 1)),
    stops,
    xAt: (minute) => s[at(minute)].x,
    colorAt: (minute) => color(at(minute)),
  };
}

/** The ring's parts: done tasks of each kind, in turn, as shares of all the tasks on the screen. */
export function ringParts(tasks: { done: boolean; priority?: Priority }[]): { priority: Priority; from: number; length: number }[] {
  const all = tasks.length;
  if (!all) return [];
  const out: { priority: Priority; from: number; length: number }[] = [];
  let from = 0;
  // The important ones first, from the top of the ring.
  for (const p of [3, 2, 1, 0] as const) {
    const n = tasks.filter((t) => t.done && (t.priority ?? 0) === p).length;
    if (!n) continue;
    out.push({ priority: p, from, length: n / all });
    from += n / all;
  }
  return out;
}
