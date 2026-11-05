import { animate, motion, useInView, type MotionValue } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { openSheet } from '../../app/sheet';
import { EASE } from '../../app/ui/text';
import { useStore } from '../../lib/appStore';
import { getImageUrl } from '../../lib/images';
import { visible } from '../../lib/records';
import { plural } from '../reminders';
import { autoDream, DREAM, useImporting } from './importer';
import { dreamPlan, hasDream, monthlyPace, usablePhoto } from './logic';

/** A picture kept on this device, as a URL for an `<img>`. */
export function useImage(id?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (id) void getImageUrl(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

const DAYS: [string, string, string] = ['день', 'дня', 'дней'];
/** How much of the picture's own colour is left in the shade over it. */
const TINT = 0.32;

/** The picture's average colour, darkened, so the shade and the glass take on its mood. */
function usePictureTint(url: string | null) {
  const [tint, setTint] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return setTint(null);
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      const c = document.createElement('canvas');
      c.width = c.height = 12;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 12, 12);
      const d = ctx.getImageData(0, 0, 12, 12).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) (r += d[i]), (g += d[i + 1]), (b += d[i + 2]);
      const n = d.length / 4;
      setTint(`rgb(${Math.round((r / n) * TINT)} ${Math.round((g / n) * TINT)} ${Math.round((b / n) * TINT)})`);
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return tint;
}

/*
 * The big arc rising from the bottom of the screen, as on the reference: a circle far wider than
 * the screen, drawn in a 400 by 220 box. It fills from the left, and a capsule rides its tip.
 */
const ARC = { cx: 200, cy: 260, r: 210 };
const ARC_FROM = Math.atan2(196 - ARC.cy, 0 - ARC.cx);
const ARC_TO = Math.atan2(196 - ARC.cy, 400 - ARC.cx);
const ARC_PATH = 'M0 196A210 210 0 0 1 400 196';

function BottomArc({ share, play }: { share: number; play: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!play) return;
    const run = animate(0, share, { delay: 0.2, duration: 1.4, ease: EASE, onUpdate: setShown });
    return () => run.stop();
  }, [share, play]);

  const at = ARC_FROM + shown * (ARC_TO - ARC_FROM);
  const x = ARC.cx + ARC.r * Math.cos(at);
  const y = ARC.cy + ARC.r * Math.sin(at);
  return (
    <div className="arc" role="img" aria-label={`Накоплено ${Math.round(share * 100)}%`}>
      <svg viewBox="0 0 400 220" aria-hidden="true">
        <defs>
          <linearGradient id="arc-dome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${ARC_PATH}V220H0Z`} fill="url(#arc-dome)" />
        <path className="arc-inner" d="M26 220A180 180 0 0 1 374 220" />
        <path className="arc-track" d={ARC_PATH} />
        <path className="arc-fill" d={ARC_PATH} pathLength={1} strokeDasharray={`${shown} 1`} />
        <g transform={`translate(${x} ${y}) rotate(${(at * 180) / Math.PI + 90})`}>
          <rect className="arc-knob" x="-19" y="-10" width="38" height="20" rx="10" />
          <rect className="arc-knob-mark" x="-5" y="-1" width="10" height="2" rx="1" />
        </g>
      </svg>
      <div className="arc-mid">
        <strong>{Math.round(shown * 100)}%</strong>
        <span>накоплено</span>
      </div>
    </div>
  );
}

/**
 * The dream's photo, held still behind the whole section while the page moves over it. It only
 * dissolves in as the page is scrolled, so there is no edge where the purchases end and it begins.
 */
export function DreamBackdrop({ opacity, scale }: { opacity: MotionValue<number>; scale: MotionValue<number> }) {
  const car = useStore((s) => s.shared.car);
  const url = useImage(usablePhoto(car) ? car.imgId : undefined);
  const tint = usePictureTint(url);
  const style = { opacity, ...(tint ? { '--tint': tint } : {}) } as unknown as Parameters<typeof motion.div>[0]['style'];
  return (
    <motion.div className="dreamx-back" style={style} aria-hidden="true">
      {url && (
        <motion.div className="dreamx-back-in" style={{ scale }}>
          <img className="dreamx-haze" src={url} alt="" />
          <div className="dreamx-sharp">
            <motion.img key={url} src={url} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }} />
          </div>
        </motion.div>
      )}
      <div className="dreamx-shade" />
    </motion.div>
  );
}

/** The whole second screen of the section: how far off the dream still is, over its photo. */
export function Dream({ contentOpacity }: { contentOpacity: MotionValue<number> }) {
  const car = useStore((s) => s.shared.car);
  const incomes = visible(useStore((s) => s.shared.incomes));
  const spends = visible(useStore((s) => s.shared.spends));
  const { cur, rate } = useCurrency();
  const hasPhoto = usablePhoto(car);
  const picking = useImporting(DREAM);
  const now = useMemo(() => new Date(), []);
  const plan = dreamPlan(car, useMemo(() => monthlyPace(incomes, spends, now), [incomes, spends, now]), now);
  const money = (rub: number) => formatMoney(rub, cur, rate);
  const filled = hasDream(car);
  const place = useRef<HTMLElement>(null);
  const seen = useInView(place, { once: true, amount: 0.4 });

  // The picture is found here, by the name alone. A cut-out from before fills no screen, so it gives way.
  useEffect(() => {
    if (filled && !usablePhoto(car)) void autoDream(car.name);
  }, [filled, car]);

  if (!filled) {
    return (
      <section ref={place} className="dreamx dreamx--empty">
        <div className="dreamx-ask">
          <h2>Какая у тебя мечта?</h2>
          <p>Машина, переезд, отдых. Покажу, сколько копить</p>
          <motion.button type="button" className="dreamx-pill" onClick={() => openSheet('dream')} whileTap={{ scale: 0.96 }}>
            Добавить мечту
          </motion.button>
        </div>
      </section>
    );
  }

  const toSave = plan.daysToSave;

  return (
    <section ref={place} className="dreamx">
      <button type="button" className="dreamx-tap" aria-label="Сменить фон" onClick={() => openSheet('dreamPic')} />

      <motion.div className="dreamx-fade" style={{ opacity: contentOpacity }}>
      <div className="dreamx-in">
        <div className="dreamx-head">
          <h2>{car.name}</h2>
          <p>{money(car.price)}</p>
        </div>

        {picking && !hasPhoto && <p className="dreamx-wait is-loading">Подбираю картинку</p>}

        <div className="dreamx-low">
          <div className="dreamx-plates">
            <div className="dreamx-plate">
              <span>Накоплено</span>
              <strong>{money(plan.saved)}</strong>
              <motion.button type="button" className="dreamx-pill dreamx-pill--small" onClick={() => openSheet('dreamSave')} whileTap={{ scale: 0.95 }}>
                Отложить
              </motion.button>
            </div>
            <div className="dreamx-plate">
              <span>Осталось</span>
              <strong>{money(plan.left)}</strong>
              <em>{toSave === 0 ? 'Всё накоплено' : toSave !== null ? `Ещё ${toSave} ${plural(toSave, DAYS)}` : 'Укажи темп'}</em>
            </div>
          </div>
          <motion.button type="button" className="dreamx-pill" onClick={() => openSheet('dreamInfo')} whileTap={{ scale: 0.97 }}>
            Подробнее
          </motion.button>
        </div>
      </div>

      <BottomArc share={plan.share} play={seen} />
      </motion.div>
    </section>
  );
}
