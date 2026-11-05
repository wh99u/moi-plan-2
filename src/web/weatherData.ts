/*
 * The weather in Saint Petersburg from Open-Meteo: free, no key, readable from a browser. Only the
 * city's fixed coordinates are sent. An answer is kept for a while so each visit to the home screen
 * does not ask again.
 */

export type WeatherKind = 'sun' | 'moon' | 'partly' | 'partlyNight' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface Weather {
  temp: number;
  code: number;
  isDay: boolean;
  /** When it was read, ms. */
  at: number;
}

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=59.94&longitude=30.31&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow';
const KEY = 'weather_spb';
const FRESH = 20 * 60_000;

/** The icon and two or three words for a WMO weather code, the scale Open-Meteo answers in. */
export function describeWeather(code: number, isDay: boolean): { kind: WeatherKind; words: string } {
  if (code === 0) return isDay ? { kind: 'sun', words: 'Ясно и солнечно' } : { kind: 'moon', words: 'Ясная ночь' };
  if (code === 1) return { kind: isDay ? 'partly' : 'partlyNight', words: 'Почти без облаков' };
  if (code === 2) return { kind: isDay ? 'partly' : 'partlyNight', words: 'Переменная облачность' };
  if (code === 3) return { kind: 'cloud', words: 'Сплошные облака' };
  if (code === 45) return { kind: 'fog', words: 'Густой туман' };
  if (code === 48) return { kind: 'fog', words: 'Туман с изморозью' };
  if (code >= 51 && code <= 55) return { kind: 'drizzle', words: 'Мелкая морось' };
  if (code === 56 || code === 57) return { kind: 'drizzle', words: 'Ледяная морось' };
  if (code === 61) return { kind: 'rain', words: 'Небольшой дождь' };
  if (code === 63) return { kind: 'rain', words: 'Идёт дождь' };
  if (code === 65) return { kind: 'rain', words: 'Сильный дождь' };
  if (code === 66 || code === 67) return { kind: 'rain', words: 'Ледяной дождь' };
  if (code === 71) return { kind: 'snow', words: 'Небольшой снег' };
  if (code === 73) return { kind: 'snow', words: 'Идёт снег' };
  if (code === 75) return { kind: 'snow', words: 'Сильный снег' };
  if (code === 77) return { kind: 'snow', words: 'Снежная крупа' };
  if (code === 80) return { kind: 'rain', words: 'Короткий дождь' };
  if (code === 81) return { kind: 'rain', words: 'Дождь с ливнями' };
  if (code === 82) return { kind: 'rain', words: 'Сильный ливень' };
  if (code === 85) return { kind: 'snow', words: 'Короткий снегопад' };
  if (code === 86) return { kind: 'snow', words: 'Сильный снегопад' };
  if (code === 95) return { kind: 'storm', words: 'Идёт гроза' };
  if (code === 96 || code === 99) return { kind: 'storm', words: 'Гроза с градом' };
  return { kind: 'cloud', words: 'Облачно' };
}

/** «+5°», «−3°», «0°». */
export function temperature(t: number): string {
  const n = Math.round(t);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}°`;
}

function saved(): Weather | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Weather | null;
  } catch {
    return null;
  }
}

export const lastWeather = saved;

export const isFresh = (w: Weather | null, now: number) => !!w && now - w.at < FRESH;

/** Null with no connection or an answer that makes no sense: the home screen then simply shows none. */
export async function fetchWeather(): Promise<Weather | null> {
  try {
    const res = await fetch(URL);
    if (!res.ok) return null;
    const json = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } };
    const c = json.current;
    if (typeof c?.temperature_2m !== 'number' || typeof c.weather_code !== 'number') return null;
    const w: Weather = { temp: c.temperature_2m, code: c.weather_code, isDay: c.is_day !== 0, at: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(w));
    } catch {
      /* it is asked for again next time */
    }
    return w;
  } catch {
    return null;
  }
}
