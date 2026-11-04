import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { blurCurve, sampleCurve } from './logic';

export interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

const H = 158;
const SAMPLES = 90;
const PAD_LEFT = 14;
const PAD_RIGHT = 20;
const TOP = 34;
const BOTTOM = 18;
/** How long a chosen point stays marked after the finger is gone. */
const PICK_MS = 3500;

const norm = (values: number[]) => {
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  return values.map((v) => (range ? (v - min) / range : 0.5));
};
const yOf = (n: number) => TOP + (1 - n) * (H - TOP - BOTTOM);

const SPRING = { type: 'spring', stiffness: 520, damping: 40 } as const;

/** The chart's colours, on canvas and so out of reach of the stylesheet. */
export interface ChartPalette {
  /** Under the line: the colour it melts from, its mid and its bright end. */
  fill: [string, string, string];
  /** The line, left to right. */
  stroke: [string, string, string];
  halo: string;
  headGlow: string;
  head: string;
  /** The thin line from a chosen point to the axis. */
  pick: string;
  soft: string;
}

const BRAND_RED: ChartPalette = {
  fill: ['rgba(214, 34, 63, 0)', 'rgba(214, 34, 63, 0.14)', 'rgba(255, 77, 102, 0.42)'],
  stroke: ['rgba(255, 77, 102, 0.55)', '#ff5a72', '#ffd2d9'],
  halo: 'rgba(255, 90, 114, 0.22)',
  headGlow: 'rgba(255, 150, 165, 0.45)',
  head: '#fff',
  pick: 'rgba(255, 255, 255, 0.55)',
  soft: 'rgba(255, 77, 102, 0.2)',
};

interface Props {
  points: ChartPoint[];
  palette?: ChartPalette;
  /** Seconds before the line starts to draw itself. */
  delay: number;
  format: (value: number) => string;
  onPick?: (p: ChartPoint) => void;
}

/**
 * One glowing line that holds still, and two softer waves that roll inside the area under it in
 * opposite directions. Canvas keeps this cheap on a phone, and it rests while off screen.
 */
export function WaveChart({ points, palette = BRAND_RED, delay, format, onPick }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const timer = useRef(0);
  const live = useRef({
    target: new Float32Array(SAMPLES),
    cur: new Float32Array(SAMPLES),
    // A much softer copy of the line, for the waves under it.
    softTarget: new Float32Array(SAMPLES),
    soft: new Float32Array(SAMPLES),
    w: 0,
    picked: null as number | null,
    count: 0,
    palette,
    wake: () => {},
  });

  // A new theme repaints at once, even where the chart otherwise stands still.
  useEffect(() => {
    live.current.palette = palette;
    live.current.wake();
  }, [palette]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // New data: the line flows over to its new shape from wherever it is.
  const key = points.map((p) => p.value).join();
  useEffect(() => {
    const s = sampleCurve(norm(points.map((p) => p.value)), SAMPLES);
    const l = live.current;
    l.target.set(blurCurve(s, 2));
    l.softTarget.set(blurCurve(s, 11));
    l.count = points.length;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      l.cur.set(l.target);
      l.soft.set(l.softTarget);
    }
    l.wake();
    // `key` stands for the values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const c = canvas.current;
    const l = live.current;
    if (!c || !w) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = H * dpr;
    l.w = w;
    l.wake();
  }, [w]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const l = live.current;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let first = 0;
    let last = 0;
    let inView = true;

    const draw = (time: number, reveal: number) => {
      const width = l.w;
      if (!width) return;
      const dpr = c.width / width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, H);
      const span = width - PAD_LEFT - PAD_RIGHT;
      const xAt = (i: number) => PAD_LEFT + (i / (SAMPLES - 1)) * span;
      const base = (i: number) => yOf(l.cur[i]);
      const wave = (x: number, length: number, speed: number, amp: number) => amp * Math.sin((x / length) * Math.PI * 2 + time * speed);
      const trace = (y: (i: number) => number) => {
        ctx.beginPath();
        for (let i = 0; i < SAMPLES; i++) {
          if (i) ctx.lineTo(xAt(i), y(i));
          else ctx.moveTo(xAt(i), y(i));
        }
      };
      const close = () => {
        ctx.lineTo(xAt(SAMPLES - 1), H);
        ctx.lineTo(xAt(0), H);
        ctx.closePath();
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, PAD_LEFT + span * reveal + 16, H);
      ctx.clip();

      // Two waves underneath, rolling their own ways; brighter on the right, as the line is.
      const soft = (i: number) => yOf(l.soft[i]);
      const pal = l.palette;
      const rise = ctx.createLinearGradient(PAD_LEFT, H, width, TOP);
      rise.addColorStop(0, pal.fill[0]);
      rise.addColorStop(1, pal.soft);
      ctx.fillStyle = rise;
      // They stay under the line: the area below it is all they can draw on.
      ctx.save();
      trace(base);
      close();
      ctx.clip();
      trace((i) => Math.min(H, soft(i) + 30 + wave(xAt(i), 170, 0.9, 7)));
      close();
      ctx.fill();
      trace((i) => Math.min(H, soft(i) + 14 + wave(xAt(i), 115, -1.2, 5.5)));
      close();
      ctx.fill();
      ctx.restore();

      const lineY = base;
      const fill = ctx.createLinearGradient(PAD_LEFT, H, width, TOP);
      fill.addColorStop(0, pal.fill[0]);
      fill.addColorStop(0.55, pal.fill[1]);
      fill.addColorStop(1, pal.fill[2]);
      trace(lineY);
      close();
      ctx.fillStyle = fill;
      ctx.fill();

      // Everything under the line melts into the dark panel towards the bottom.
      const melt = ctx.createLinearGradient(0, H * 0.45, 0, H);
      melt.addColorStop(0, 'rgba(0, 0, 0, 0)');
      melt.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = melt;
      ctx.fillRect(0, 0, width, H);
      ctx.globalCompositeOperation = 'source-over';

      // The glow is drawn as wide soft strokes: a canvas shadow would be too slow on a phone.
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const stroke = ctx.createLinearGradient(PAD_LEFT, 0, width - PAD_RIGHT, 0);
      stroke.addColorStop(0, pal.stroke[0]);
      stroke.addColorStop(0.6, pal.stroke[1]);
      stroke.addColorStop(1, pal.stroke[2]);
      ctx.strokeStyle = stroke;
      for (const [lw, alpha] of [
        [9, 0.09],
        [5, 0.2],
        [2, 1],
      ]) {
        trace(lineY);
        ctx.lineWidth = lw;
        ctx.globalAlpha = alpha;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // The head of the line, breathing; or the point the finger is on.
      const headI = Math.round((SAMPLES - 1) * reveal);
      const at = l.picked !== null && l.count > 1 ? Math.round((l.picked / (l.count - 1)) * (SAMPLES - 1)) : headI;
      const hx = xAt(at);
      const hy = lineY(at);
      if (l.picked !== null) {
        const fall = ctx.createLinearGradient(0, hy, 0, H);
        fall.addColorStop(0, pal.pick);
        fall.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = fall;
        ctx.fillRect(hx - 0.5, hy, 1, H - hy);
      }
      const breath = 0.5 + 0.5 * Math.sin(time * 2.4);
      ctx.fillStyle = pal.halo;
      ctx.beginPath();
      ctx.arc(hx, hy, 9 + breath * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.headGlow;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.head;
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = (now: number) => {
      raf = 0;
      if (!first) {
        first = now;
        last = now;
        // The line starts flat along the bottom, so its first move is a rising swell.
        l.cur.fill(0.08);
        l.soft.fill(0.08);
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const flow = 1 - Math.exp(-dt * 5);
      for (let i = 0; i < SAMPLES; i++) {
        l.cur[i] += (l.target[i] - l.cur[i]) * flow;
        l.soft[i] += (l.softTarget[i] - l.soft[i]) * flow;
      }
      const since = (now - first) / 1000 - delay;
      const p = Math.max(0, Math.min(1, since / 1.25));
      const reveal = 1 - (1 - p) ** 3;
      draw(now / 1000, reveal);
      if (inView && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const paintStill = () => {
      l.cur.set(l.target);
      l.soft.set(l.softTarget);
      draw(0, 1);
    };
    const wake = () => {
      if (still) paintStill();
      else if (!raf && inView && !document.hidden) raf = requestAnimationFrame(tick);
    };
    l.wake = wake;
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      wake();
    });
    io.observe(c);
    document.addEventListener('visibilitychange', wake);
    wake();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', wake);
      l.wake = () => {};
    };
  }, [delay]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (i: number | null) => {
    live.current.picked = i;
    setPicked(i);
    live.current.wake();
  };
  const indexAt = (e: PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const share = (e.clientX - r.left - PAD_LEFT) / Math.max(1, r.width - PAD_LEFT - PAD_RIGHT);
    return Math.max(0, Math.min(points.length - 1, Math.round(share * (points.length - 1))));
  };

  const values = norm(points.map((p) => p.value));
  const span = w - PAD_LEFT - PAD_RIGHT;
  const px = picked === null ? 0 : PAD_LEFT + (picked / Math.max(1, points.length - 1)) * span;
  const py = picked === null ? 0 : yOf(values[picked] ?? 0.5);
  const point = picked === null ? null : points[picked];

  return (
    <div
      ref={box}
      className="b-wave"
      style={{ height: H }}
      role="img"
      aria-label={points.length ? `График, последнее значение ${format(points[points.length - 1].value)}` : 'График'}
      onPointerDown={(e) => {
        clearTimeout(timer.current);
        e.currentTarget.setPointerCapture(e.pointerId);
        choose(indexAt(e));
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) choose(indexAt(e));
      }}
      onPointerUp={(e) => {
        const p = points[indexAt(e)];
        if (p) onPick?.(p);
        timer.current = window.setTimeout(() => choose(null), PICK_MS);
      }}
      onPointerCancel={() => choose(null)}
    >
      <canvas ref={canvas} style={{ width: '100%', height: H, display: 'block' }} />
      {point && (
        <motion.span className="b-wave-at" initial={false} animate={{ x: Math.max(58, Math.min(w - 58, px)), y: Math.max(40, py - 12) }} transition={SPRING}>
          <motion.span className="b-wave-bubble t-caption t-num" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
            <span className="b-wave-date">{point.label}</span>
            <span className="b-amt">{format(point.value)}</span>
          </motion.span>
        </motion.span>
      )}
    </div>
  );
}
