import { describe, expect, it } from 'vitest';
import { logoDomain, logoSources, monogram } from './logos';

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
