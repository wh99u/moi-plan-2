import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { EASE } from '../app/ui/text';
import { describeWeather, fetchWeather, isFresh, lastWeather, temperature, type Weather as Now, type WeatherKind } from './weatherData';

const CLOUD = 'M7 18.500a4 4 0 0 1-.6-7.950 5.500 5.500 0 0 1 10.600-1.200A4.600 4.600 0 0 1 17.500 18.500z';
const LOW_CLOUD = 'M7.500 15a3.500 3.500 0 0 1-.5-6.960 5 5 0 0 1 9.600-1.040A4.100 4.100 0 0 1 17 15z';

function Sun({ small = false }: { small?: boolean }) {
  return (
    <g className={small ? 'wx-sun wx-sun--small' : 'wx-sun'}>
      <circle cx="12" cy="12" r="4.200" className="wx-sun-disc" />
      <g className="wx-rays">
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d="M12 3.200v2.200" transform={`rotate(${i * 45} 12 12)`} />
        ))}
      </g>
    </g>
  );
}

const Moon = ({ small = false }: { small?: boolean }) => <path className={small ? 'wx-moon wx-moon--small' : 'wx-moon'} d="M19.500 14.200A8 8 0 0 1 9.800 4.500a8 8 0 1 0 9.700 9.700z" />;

/** Each kind of weather drawn in a few strokes, and moving a little: rays turn, rain and snow fall. */
function Picture({ kind }: { kind: WeatherKind }) {
  const falling = kind === 'drizzle' || kind === 'rain' || kind === 'snow' || kind === 'storm';
  return (
    <svg className="wx-icon" viewBox="0 0 24 24" width="30" height="30" fill="none" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'sun' && <Sun />}
      {kind === 'moon' && <Moon />}
      {kind === 'partly' && <Sun small />}
      {kind === 'partlyNight' && <Moon small />}
      {(kind === 'partly' || kind === 'partlyNight' || kind === 'cloud') && <path className="wx-cloud" d={CLOUD} />}
      {falling && <path className="wx-cloud" d={LOW_CLOUD} />}
      {kind === 'fog' && (
        <g className="wx-fog">
          <path className="wx-cloud" d={LOW_CLOUD} />
          <path d="M5 18h14" />
          <path d="M7.500 21h9" />
        </g>
      )}
      {(kind === 'rain' || kind === 'drizzle') && (
        <g className="wx-drops">
          <path d="M8.500 17.500l-1 3" />
          <path d="M12.500 17.500l-1 3" />
          <path d="M16.500 17.500l-1 3" />
        </g>
      )}
      {kind === 'snow' && (
        <g className="wx-flakes">
          <circle cx="8" cy="18.500" r="1" />
          <circle cx="12" cy="20" r="1" />
          <circle cx="16" cy="18.500" r="1" />
        </g>
      )}
      {kind === 'storm' && <path className="wx-bolt" d="M12.800 15.500l-2.800 4h3.400L11.500 23" />}
    </svg>
  );
}

/** A small line on the home screen; nothing at all while the weather is not known. */
export function WeatherLine() {
  const [now, setNow] = useState<Now | null>(lastWeather);

  useEffect(() => {
    if (isFresh(now, Date.now())) return;
    let alive = true;
    void fetchWeather().then((w) => {
      if (alive && w) setNow(w);
    });
    return () => {
      alive = false;
    };
    // Asked once per visit to the home screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!now) return null;
  const { kind, words } = describeWeather(now.code, now.isDay);
  return (
    <p className="wx" title="Погода в Санкт-Петербурге">
      <motion.span className="wx-pic" initial={{ opacity: 0, scale: 0.3, rotate: -60 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 16 }}>
        <Picture kind={kind} />
      </motion.span>
      <Degrees value={now.temp} />
      <motion.span initial={{ opacity: 0, x: -10, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ delay: 0.55, duration: 0.6, ease: EASE }}>
        {words}
      </motion.span>
    </p>
  );
}

/** The degrees count up to what they are. */
function Degrees({ value }: { value: number }) {
  const shown = useMotionValue(0);
  const text = useTransform(shown, temperature);
  useEffect(() => {
    const c = animate(shown, value, { delay: 0.4, duration: 0.9, ease: EASE });
    return () => c.stop();
  }, [shown, value]);
  return (
    <motion.strong initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
      {text}
    </motion.strong>
  );
}
