import { useCallback, useEffect, useRef, useState } from 'react';
import { closeSheet, toggleSheet, useSheet } from '../app/sheet';
import { Icon } from '../ui/Icon';
import { Mark } from './Mark';
import { NavGlyph } from './NavGlyphs';
import { CIRCLE_R, FULL_H, HEAD, barPath, itemX, navFrame } from './navShape';
import { Recede } from './Recede';
import { TABS, href, tabIndex, type Route } from './route';

const ITEMS = [...TABS.map((t) => ({ key: t.id, label: t.label, icon: t.icon })), { key: 'more', label: 'Ещё', icon: 'grid' }];
const MORE = ITEMS.length - 1;
const SWITCH_MS = 860;
/** The circle first grows out of the bar as the opening pull-back is landing. */
const FIRST_DELAY = 420;
/**
 * Where in a switch the tab's own animation starts: the circle is out of the bar by now and nearly
 * full size, so the whole of it is seen.
 */
const PLAY_AT = 0.7;
/** The icon in the bar stays until the new circle is about to appear, so the place is never empty. */
const ICON_LEAVES_AT = 0.4;

const glyph = (i: number, size: number) => (i === 0 ? <Mark size={size + 2} /> : <Icon name={ITEMS[i].icon} size={size} stroke={1.9} />);

/**
 * Tab bar from the reference video on frosted glass. The active item is a circle raised out of a
 * notch; on a switch it sinks, the edge ripples and a new circle tears off a hill at the new place.
 * Drawn by hand frame by frame, because the outline itself is what moves.
 */
export function Nav({ route }: { route: Route }) {
  const sheet = useSheet();
  const moreOpen = sheet === 'more';
  const active = moreOpen ? MORE : Math.min(tabIndex(route), MORE);

  const root = useRef<HTMLElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const rim = useRef<SVGPathElement>(null);
  const tint = useRef<SVGRadialGradientElement>(null);
  const tintStop = useRef<SVGStopElement>(null);
  const circle = useRef<HTMLDivElement>(null);
  const icons = useRef<(HTMLElement | null)[]>([]);

  const anim = useRef({ from: null as number | null, to: active, t: 0.3, width: 0, raf: 0, played: false });
  const [inCircle, setInCircle] = useState(active);
  const [run, setRun] = useState(false);

  const draw = useCallback(() => {
    const s = anim.current;
    if (!s.width) return;
    const center = (i: number) => itemX(s.width, i, ITEMS.length);
    const f = navFrame(s.t, s.from === null ? null : center(s.from), center(s.to));
    const d = barPath(s.width, f);

    glass.current!.style.clipPath = `path("${d}")`;
    fill.current!.setAttribute('d', d);
    rim.current!.setAttribute('d', d);
    tint.current!.setAttribute('cx', String(f.hill.x));
    tint.current!.setAttribute('cy', String(HEAD - 4));
    tintStop.current!.style.stopOpacity = String(f.hill.size);

    const c = circle.current!;
    c.style.transform = `translate(${f.circle.x - CIRCLE_R}px, ${f.circle.y - CIRCLE_R}px) scale(${f.circle.scale})`;
    c.style.opacity = String(f.circle.opacity);

    icons.current.forEach((icon, i) => {
      const hidden = (i === s.to && s.t > ICON_LEAVES_AT) || (i === s.from && s.t < 0.34);
      icon?.classList.toggle('is-away', hidden);
    });
    setInCircle(f.circle.which === 'from' ? s.from! : s.to);
    if (!s.played && s.t >= PLAY_AT) {
      s.played = true;
      setRun(true);
    }
  }, []);

  const start = useCallback(
    (delay: number) => {
      const s = anim.current;
      cancelAnimationFrame(s.raf);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        s.t = 1;
        draw();
        return;
      }
      const t0 = s.t;
      const at = performance.now() + delay;
      const step = (now: number) => {
        s.t = Math.min(1, t0 + Math.max(0, now - at) / SWITCH_MS);
        draw();
        if (s.t < 1) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    },
    [draw],
  );

  useEffect(() => {
    const s = anim.current;
    const node = root.current!;
    const size = () => {
      s.width = node.clientWidth;
      svg.current!.setAttribute('viewBox', `0 0 ${s.width} ${FULL_H}`);
      draw();
    };
    const ro = new ResizeObserver(size);
    ro.observe(node);
    size();
    start(FIRST_DELAY);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(s.raf);
    };
  }, [draw, start]);

  useEffect(() => {
    const s = anim.current;
    if (active === s.to) return;
    s.from = s.to;
    s.to = active;
    s.t = 0;
    s.played = false;
    setRun(false);
    start(0);
  }, [active, start]);

  return (
    <Recede from={3} delay={0.05} solid className="lnav-wrap">
      <nav ref={root} className="lnav" aria-label="Разделы">
        <div ref={glass} className="lnav-glass" />
        <svg ref={svg} className="lnav-svg" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <radialGradient ref={tint} id="lnav-tint" gradientUnits="userSpaceOnUse" r="62">
              <stop ref={tintStop} offset="0" className="lnav-tint-a" />
              <stop offset="1" className="lnav-tint-b" />
            </radialGradient>
            <linearGradient id="lnav-rim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="lnav-rim-a" />
              <stop offset="1" className="lnav-rim-b" />
            </linearGradient>
          </defs>
          <path ref={fill} fill="url(#lnav-tint)" />
          <path ref={rim} fill="none" stroke="url(#lnav-rim)" strokeWidth="1" />
        </svg>

        <div ref={circle} className="lnav-circle" aria-hidden="true">
          <NavGlyph key={inCircle} index={inCircle} run={run && inCircle === anim.current.to} size={22} />
        </div>

        <div className="lnav-tabs">
          {ITEMS.map((item, i) => {
            const on = i === active;
            const inner = (
              <span
                ref={(n) => {
                  icons.current[i] = n;
                }}
                className="lnav-icon"
              >
                {glyph(i, 23)}
              </span>
            );
            return i === MORE ? (
              <button key={item.key} type="button" className={`lnav-tab${on ? ' is-on' : ''}`} aria-label={moreOpen ? 'Закрыть' : 'Ещё разделы'} aria-expanded={moreOpen} onClick={() => toggleSheet('more')}>
                {inner}
              </button>
            ) : (
              <a key={item.key} href={href(TABS[i].id)} className={`lnav-tab${on ? ' is-on' : ''}`} aria-label={item.label} aria-current={on ? 'page' : undefined} onClick={closeSheet}>
                {inner}
              </a>
            );
          })}
        </div>
      </nav>
    </Recede>
  );
}
