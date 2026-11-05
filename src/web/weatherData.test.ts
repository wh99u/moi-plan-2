import { describe, expect, it } from 'vitest';
import { describeWeather, isFresh, temperature } from './weatherData';

describe('describeWeather', () => {
  it.each([
    [0, true, 'sun'],
    [0, false, 'moon'],
    [2, true, 'partly'],
    [2, false, 'partlyNight'],
    [3, true, 'cloud'],
    [45, true, 'fog'],
    [53, true, 'drizzle'],
    [63, true, 'rain'],
    [81, true, 'rain'],
    [75, true, 'snow'],
    [86, false, 'snow'],
    [95, true, 'storm'],
    [99, true, 'storm'],
  ])('code %i, day %s is %s', (code, day, kind) => {
    expect(describeWeather(code, day).kind).toBe(kind);
  });

  it('says it in two or three words, for every code on the scale', () => {
    for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) {
      const n = describeWeather(code, true).words.split(' ').length;
      expect(n, String(code)).toBeGreaterThanOrEqual(2);
      expect(n, String(code)).toBeLessThanOrEqual(3);
    }
  });

  it('copes with a code it does not know', () => {
    expect(describeWeather(1000, true).kind).toBe('cloud');
  });
});

describe('temperature', () => {
  it.each([
    [4.6, '+5°'],
    [-2.5, '−2°'],
    [-3.4, '−3°'],
    [0.2, '0°'],
    [-0.2, '0°'],
  ])('%f is %s', (t, text) => {
    expect(temperature(t)).toBe(text);
  });
});

it('keeps an answer for twenty minutes', () => {
  const w = { temp: 1, code: 0, isDay: true, at: 1000 };
  expect(isFresh(w, 1000 + 19 * 60_000)).toBe(true);
  expect(isFresh(w, 1000 + 21 * 60_000)).toBe(false);
  expect(isFresh(null, 1000)).toBe(false);
});
