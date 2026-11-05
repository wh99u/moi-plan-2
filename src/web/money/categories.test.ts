import { describe, expect, it } from 'vitest';
import { allCats, catIcon, existingCat } from './categories';

describe('allCats', () => {
  it('starts with the built-in ones', () => {
    expect(allCats().slice(0, 3)).toEqual(['Еда', 'Электроника', 'Мебель']);
  });

  it('adds the owner’s own and those met on purchases, without repeats', () => {
    const cats = allCats(['Рыбалка', 'еда'], ['Рыбалка', 'Сад', undefined, ' ']);
    expect(cats.filter((c) => c.toLowerCase() === 'еда')).toHaveLength(1);
    expect(cats.slice(-2)).toEqual(['Рыбалка', 'Сад']);
  });
});

describe('existingCat', () => {
  it('finds a name however it was typed', () => {
    expect(existingCat(['Еда'], ' еДа ')).toBe('Еда');
    expect(existingCat(['Еда'], 'Сад')).toBeUndefined();
  });
});

describe('catIcon', () => {
  it('has an icon for the built-in ones and a plain one for the rest', () => {
    expect(catIcon('еда')).toBe('food');
    expect(catIcon('Рыбалка')).toBe('flag');
  });
});
