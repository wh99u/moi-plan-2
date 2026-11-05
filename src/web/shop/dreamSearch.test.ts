import { describe, expect, it } from 'vitest';
import { dreamQuery, mixFound, type Found } from './dreamSearch';

const found = (id: string) => ({ id }) as Found;

describe('dreamQuery', () => {
  it('knows the names people dream of, without a translator', async () => {
    expect(await dreamQuery('порш 911')).toBe('porsche 911');
    expect(await dreamQuery('Порше Панамера')).toBe('porsche panamera');
    expect(await dreamQuery('айфон 17 про')).toContain('iphone 17');
  });

  it('leaves a Latin name as it is', async () => {
    expect(await dreamQuery(' Porsche 911 ')).toBe('Porsche 911');
  });
});

describe('mixFound', () => {
  it('takes turns from both sources', () => {
    expect(mixFound([found('a1'), found('a2')], [found('b1')]).map((f) => f.id)).toEqual(['a1', 'b1', 'a2']);
  });

  it('stops at the limit', () => {
    expect(mixFound([found('a1'), found('a2')], [found('b1'), found('b2')], 3)).toHaveLength(3);
  });
});
