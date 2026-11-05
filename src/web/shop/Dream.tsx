import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { openSheet } from '../../app/sheet';
import { EASE } from '../../app/ui/text';
import { useStore } from '../../lib/appStore';
import { getImageUrl } from '../../lib/images';
import { visible } from '../../lib/records';
import { Icon } from '../../ui/Icon';
import { fullDate } from '../money/data';
import { Recede } from '../Recede';
import { plural } from '../reminders';
import { dreamPlan, hasDream, monthlyPace } from './logic';

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

/** A gauge open at the bottom, as on the reference; `share` fills it from the left. */
function Gauge({ share, value, unit, label, hint, onClick }: { share: number; value: string; unit: string; label: string; hint: string; onClick: () => void }) {
  const R = 52;
  const C = 2 * Math.PI * R * 0.75;
  return (
    <button type="button" className="gauge" onClick={onClick}>
      <span className="gauge-dial">
        <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
          <circle className="gauge-track" cx="60" cy="60" r={R} strokeDasharray={`${C} ${2 * Math.PI * R}`} transform="rotate(135 60 60)" />
          <motion.circle
            className="gauge-fill"
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={`${C} ${2 * Math.PI * R}`}
            transform="rotate(135 60 60)"
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - Math.max(0, Math.min(1, share))) }}
            transition={{ delay: 0.3, duration: 1.3, ease: EASE }}
          />
        </svg>
        <span className="gauge-value">{value}</span>
        <span className="gauge-unit">{unit}</span>
      </span>
      <strong>{label}</strong>
      <span className="gauge-hint">{hint}</span>
    </button>
  );
}

/** The first screen of the section: the one big thing, with its picture coming in from the edge. */
export function Dream() {
  const car = useStore((s) => s.shared.car);
  const incomes = visible(useStore((s) => s.shared.incomes));
  const spends = visible(useStore((s) => s.shared.spends));
  const { cur, rate } = useCurrency();
  const url = useImage(car.imgId);
  const now = useMemo(() => new Date(), []);
  const plan = dreamPlan(car, useMemo(() => monthlyPace(incomes, spends, now), [incomes, spends, now]), now);
  const money = (rub: number) => formatMoney(rub, cur, rate);

  if (!hasDream(car)) {
    return (
      <section className="dream dream--empty">
        <Recede from={3.4} panel className="dream-ask">
          <span className="dream-ask-icon">
            <Icon name="sparkle" size={26} />
          </span>
          <h1>Какая у тебя мечта?</h1>
          <p>Машина, переезд, отдых, телефон. Покажу, сколько копить и когда она станет твоей</p>
          <motion.button type="button" className="primary-btn" onClick={() => openSheet('dream')} whileTap={{ scale: 0.96 }}>
            Добавить мечту
          </motion.button>
        </Recede>
      </section>
    );
  }

  const toSave = plan.daysToSave;
  return (
    <section className="dream">
      <div className="dream-glow" aria-hidden="true" />
      <Recede from={3} className="dream-head">
        <button type="button" className="dream-title" onClick={() => openSheet('dream')}>
          <span className="dream-name">{car.name}</span>
          <span className="dream-price">{money(car.price)}</span>
        </button>
      </Recede>

      <Recede from={2.4} delay={0.05} className="gauges">
        <Gauge
          share={plan.share}
          value={toSave === null ? '—' : String(toSave)}
          unit={toSave === null ? '' : plural(toSave, DAYS)}
          label={toSave === 0 ? 'Всё накоплено' : 'Копить'}
          hint={plan.pace ? `при ${money(plan.pace)} в месяц` : 'Укажи темп'}
          onClick={() => openSheet('dream')}
        />
        <Gauge
          share={plan.daysLeft === null ? 0 : 1 - Math.min(1, Math.max(0, plan.daysLeft) / 365)}
          value={plan.daysLeft === null ? '—' : String(Math.max(0, plan.daysLeft))}
          unit={plan.daysLeft === null ? '' : plural(Math.max(0, plan.daysLeft), DAYS)}
          label="Осталось"
          hint={car.date ? `до ${fullDate(car.date)}` : 'Поставь дату'}
          onClick={() => openSheet('dream')}
        />
      </Recede>

      <button type="button" className="dream-pic" aria-label={url ? 'Сменить картинку' : 'Выбрать картинку'} onClick={() => openSheet('dreamPic')}>
        {url ? (
          <motion.img
            key={url}
            src={url}
            alt={car.name}
            className={car.cut ? 'is-cut' : undefined}
            initial={{ opacity: 0, x: '-18%', scale: 1.12, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.15, duration: 1.3, ease: EASE }}
          />
        ) : (
          <span className="dream-pic-empty">
            <Icon name="photo" size={22} />
            Выбрать картинку
          </span>
        )}
      </button>

      <Recede from={2} delay={0.08} className="dream-tiles">
        <motion.button type="button" className="glass dream-tile" onClick={() => openSheet('dreamSave')} whileTap={{ scale: 0.97 }}>
          <span className="dream-tile-label">Накоплено</span>
          <strong>{money(plan.saved)}</strong>
          <span className="dream-bar">
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: plan.share }} transition={{ delay: 0.4, duration: 1.2, ease: EASE }} />
          </span>
          <span className="dream-tile-hint">
            <Icon name="plus" size={14} stroke={2.2} />
            Отложить
          </span>
        </motion.button>
        <motion.button type="button" className="glass dream-tile" onClick={() => openSheet('dream')} whileTap={{ scale: 0.97 }}>
          <span className="dream-tile-label">Осталось собрать</span>
          <strong>{money(plan.left)}</strong>
          <span className="dream-tile-note">{plan.needed ? `Чтобы успеть, нужно ${money(plan.needed)} в месяц` : plan.pace ? `Темп ${money(plan.pace)} в месяц` : 'Укажи темп или добавь доходы'}</span>
        </motion.button>
      </Recede>
    </section>
  );
}
