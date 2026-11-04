import { describe, expect, it } from 'vitest';
import { HEAD, barPath, navFrame, topEdge } from './navShape';

const W = 400;

describe('navFrame', () => {
  it('starts with the old notch open and no hill', () => {
    const f = navFrame(0, 40, 200);
    expect(f.notches).toEqual([{ x: 40, size: 1 }]);
    expect(f.hill.size).toBe(0);
    expect(f.circle.which).toBe('from');
    expect(f.circle.opacity).toBe(1);
  });

  it('ends with only the new notch and the circle resting there', () => {
    const f = navFrame(1, 40, 200);
    expect(f.notches).toEqual([{ x: 200, size: 1 }]);
    expect(f.hill.size).toBe(0);
    expect(f.circle).toMatchObject({ x: 200, scale: 1, opacity: 1, which: 'to' });
  });

  it('swells a hill at the new place halfway through', () => {
    const f = navFrame(0.5, 40, 200);
    expect(f.hill.x).toBe(200);
    expect(f.hill.size).toBe(1);
    expect(topEdge(200, W, f)).toBeLessThan(HEAD);
  });

  it('has nothing to leave behind on the first appearance', () => {
    expect(navFrame(0.2, null, 200).circle.which).toBe('to');
    expect(navFrame(0.45, null, 200).notches).toEqual([]);
  });
});

describe('topEdge', () => {
  it('is flat away from the notch and rounded at the corners', () => {
    const f = navFrame(1, null, 200);
    expect(topEdge(320, W, f)).toBe(HEAD);
    expect(topEdge(0, W, f)).toBeGreaterThan(HEAD + 20);
    expect(topEdge(W, W, f)).toBeGreaterThan(HEAD + 20);
  });

  it('dips under the circle', () => {
    expect(topEdge(200, W, navFrame(1, null, 200))).toBeCloseTo(HEAD + 30);
  });
});

describe('barPath', () => {
  it('is a closed path across the whole width', () => {
    const d = barPath(W, navFrame(1, null, 200));
    expect(d.startsWith('M0 ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain(`L${W} `);
  });
});
