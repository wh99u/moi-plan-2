import { describe, expect, it } from 'vitest';
import { dayLine, lineSamples, mix, pull, ringParts } from './dayLine';

describe('the line of the day', () => {
  it('is held wholly inside a task and lets go softly around it', () => {
    const t = { from: 600, to: 660, priority: 2 as const };
    expect(pull(t, 630)).toBe(1);
    expect(pull(t, 580)).toBeGreaterThan(0.6);
    expect(pull(t, 480)).toBeLessThan(0.01);
  });

  it('reaches further for a more important task', () => {
    const low = lineSamples([{ from: 600, to: 660, priority: 1 }], 64);
    const high = lineSamples([{ from: 600, to: 660, priority: 3 }], 64);
    const at = (s: typeof low) => s[630 / 5].x;
    expect(at(high)).toBeGreaterThan(at(low) + 5);
    // Far from the task both run along the same calm edge.
    expect(Math.abs(low[60].x - high[60].x)).toBeLessThan(0.01);
  });

  it('takes on the colour of the task it bends to', () => {
    const line = dayLine([{ from: 600, to: 720, priority: 3 }], 64, 'dark');
    expect(line.colorAt(660)).toBe('#ff6a3d');
    expect(line.colorAt(60)).toBe('#34c77b');
    expect(line.stops[0].offset).toBe(0);
    expect(line.stops[line.stops.length - 1].offset).toBe(1);
  });

  it('mixes colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('the ring', () => {
  it('is filled by done tasks, each kind its own share of all of them', () => {
    const t = (priority: 0 | 1 | 2 | 3, done = true) => ({ priority, done });
    expect(ringParts([t(0), t(0), t(0), t(3), t(3)])).toEqual([
      { priority: 3, from: 0, length: 0.4 },
      { priority: 0, from: 0.4, length: 0.6 },
    ]);
    expect(ringParts([t(1), t(2, false)])).toEqual([{ priority: 1, from: 0, length: 0.5 }]);
    expect(ringParts([])).toEqual([]);
  });
});
