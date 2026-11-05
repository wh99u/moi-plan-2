import { describe, expect, it, vi } from 'vitest';
import { dreamQuery, fitsQuery } from './dreamSearch';

describe('dreamQuery', () => {
  it('knows the names people dream of, without a translator', async () => {
    expect(await dreamQuery('порш 911')).toBe('porsche 911');
    expect(await dreamQuery('Порше Панамера')).toBe('porsche panamera');
    expect(await dreamQuery('айфон 17 про')).toBe('iphone 17 pro');
  });

  it('keeps model numbers when other words need translating', async () => {
    const offline = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await dreamQuery('велосипед 29')).toBe('bicycle 29');
    offline.mockRestore();
  });

  it('leaves a Latin name as it is', async () => {
    expect(await dreamQuery(' Porsche 911 ')).toBe('Porsche 911');
  });
});

describe('fitsQuery', () => {
  it('counts the words of the query in the name', () => {
    expect(fitsQuery('Robot Vacuum Cleaner', 'vacuum cleaner')).toBe(2);
    expect(fitsQuery('Old vacuum', 'vacuum cleaner')).toBe(1);
    expect(fitsQuery('Worn Sneaker', 'sneakers')).toBe(1);
  });

  it('turns down what merely came up in the search', () => {
    expect(fitsQuery('Golden table', 'vacuum cleaner')).toBe(0);
  });

  it('turns down sets of many things', () => {
    expect(fitsQuery('Vacuum cleaner props pack', 'vacuum cleaner')).toBe(0);
  });
});
