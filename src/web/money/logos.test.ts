import { describe, expect, it } from 'vitest';
import { logoDomain, logoSources, monogram, suggestTitles } from './logos';

describe('logoDomain', () => {
  it.each([
    ['Пятёрочка', '5ka.ru'],
    ['ПЯТЕРОЧКА 1234', '5ka.ru'],
    ['Магнит у дома', 'magnit.ru'],
    ['plati.ru', 'plati.market'],
    ['Plati', 'plati.market'],
    ['Подписка Spotify', 'spotify.com'],
    ['Спотифай', 'spotify.com'],
    ['Лента', 'lenta.com'],
    ['ВБ', 'wildberries.ru'],
    ['Яндекс Go', 'taxi.yandex.ru'],
    ['Т-Банк', 'tbank.ru'],
  ])('%s → %s', (title, domain) => {
    expect(logoDomain(title)).toBe(domain);
  });

  it('takes a typed site as it is', () => {
    expect(logoDomain('Заказ на Example.COM')).toBe('example.com');
  });

  it('does not see a brand inside another word', () => {
    expect(logoDomain('Рулет к чаю')).toBeNull();
    expect(logoDomain('Изолента')).toBeNull();
    expect(logoDomain('Рынок')).toBeNull();
  });
});

describe('suggestTitles', () => {
  it('finds a brand by the start of its name, with or without «ё»', () => {
    expect(suggestTitles('пятё', [])[0]).toEqual({ title: 'Пятёрочка', cat: 'Еда' });
    expect(suggestTitles('пяте', [])[0].title).toBe('Пятёрочка');
    expect(suggestTitles('ПЯТ', [])[0].title).toBe('Пятёрочка');
  });

  it('finds a brand by its other spelling', () => {
    expect(suggestTitles('спот', [])[0].title).toBe('Spotify');
    expect(suggestTitles('spot', [])[0].title).toBe('Spotify');
  });

  it('puts the owner’s own purchases first and uses their category', () => {
    const past = [{ title: 'Пятёрочка у дома', cat: 'Продукты' }, { title: 'Рынок' }];
    expect(suggestTitles('пят', past)[0]).toEqual({ title: 'Пятёрочка у дома', cat: 'Продукты' });
    expect(suggestTitles('рын', past)).toEqual([{ title: 'Рынок' }]);
  });

  it('matches any word of a name, not its middle', () => {
    expect(suggestTitles('вкусв', []).map((s) => s.title)).toContain('ВкусВилл');
    expect(suggestTitles('точка', []).map((s) => s.title)).toContain('Вкусно — и точка');
    expect(suggestTitles('ерочка', [])).toEqual([]);
  });

  it('stays quiet until there is something to go on, and after the name is complete', () => {
    expect(suggestTitles('п', [])).toEqual([]);
    expect(suggestTitles('Пятёрочка', [])).toEqual([]);
  });

  it('never repeats a name and respects the limit', () => {
    const past = [{ title: 'Spotify' }, { title: 'spotify' }];
    expect(suggestTitles('spo', past)).toEqual([{ title: 'Spotify' }]);
    expect(suggestTitles('ма', [], 2)).toHaveLength(2);
  });
});

describe('logoSources', () => {
  it('asks for the domain and nothing else', () => {
    const urls = logoSources('5ka.ru');
    expect(urls[0]).toContain('favicon.yandex.net/favicon/v2/5ka.ru');
    expect(urls[1]).toContain('domain=5ka.ru');
  });
});

describe('monogram', () => {
  it('uses the first letter, or two for several words', () => {
    expect(monogram('рынок')).toBe('Р');
    expect(monogram('Рынок у дома')).toBe('РД');
    expect(monogram('')).toBe('?');
  });
});
