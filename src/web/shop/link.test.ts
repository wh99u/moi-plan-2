import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanTitle, firstUrl, lookup, nameFromUrl, rublesIn, shopOf, wbArticle } from './link';

afterEach(() => vi.unstubAllGlobals());

describe('purchase import', () => {
  it('reads price and description from public marketplace metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      status: 'success',
      data: { title: 'Кофемолка – купить на Ozon', description: 'Керамические жернова. 2 490 рублей' },
    })));
    await expect(lookup('https://www.ozon.ru/product/kofemolka-1234567/')).resolves.toMatchObject({
      title: 'Кофемолка', note: 'Керамические жернова. 2 490 рублей', price: 2490,
    });
  });

  it('falls back to the address when a marketplace returns a challenge page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      status: 'success',
      data: { title: 'Доступ ограничен', description: 'Проверяем браузер' },
    })));
    const product = await lookup('https://www.avito.ru/moskva/mebel/divan_uglovoy_3456789012');
    expect(product.title).toBe('Диван угловой');
    expect(product.price).toBeUndefined();
    expect(product.note).toBeUndefined();
  });
});

describe('firstUrl', () => {
  it('finds the link in a shared text', () => {
    expect(firstUrl('Смотри, что нашёл https://www.ozon.ru/product/x-123/, классно!')).toBe('https://www.ozon.ru/product/x-123/');
  });

  it('adds the scheme to a bare address and gives up on plain words', () => {
    expect(firstUrl('wildberries.ru/catalog/177311561/detail.aspx')).toBe('https://wildberries.ru/catalog/177311561/detail.aspx');
    expect(firstUrl('просто кроссовки')).toBeNull();
  });
});

describe('shopOf', () => {
  it('knows the three marketplaces', () => {
    expect(shopOf('https://www.wildberries.ru/catalog/1/detail.aspx')).toBe('Wildberries');
    expect(shopOf('https://www.ozon.ru/product/x-1/')).toBe('Ozon');
    expect(shopOf('https://www.avito.ru/moskva/telefony/x_1')).toBe('Авито');
  });
});

describe('wbArticle', () => {
  it('reads the article from a link', () => {
    expect(wbArticle('https://www.wildberries.ru/catalog/177311561/detail.aspx?targetUrl=GP')).toBe(177311561);
    expect(wbArticle('https://www.ozon.ru/product/177311561/')).toBeNull();
  });
});

describe('nameFromUrl', () => {
  it('reads a name out of an Ozon address, keeping brands in Latin', () => {
    expect(nameFromUrl('https://www.ozon.ru/product/smartfon-apple-iphone-15-128-gb-1234567/')).toBe('Смартфон apple iphone 15 128 gb');
  });

  it('reads a name out of an Avito address', () => {
    expect(nameFromUrl('https://www.avito.ru/moskva/telefony/iphone_15_128_gb_3456789012')).toBe('Iphone 15 128 gb');
    expect(nameFromUrl('https://www.avito.ru/moskva/mebel/divan_uglovoy_3456789012')).toBe('Диван угловой');
  });

  it('gives up on addresses with no words', () => {
    expect(nameFromUrl('https://www.ozon.ru/product/1234567/')).toBeUndefined();
    expect(nameFromUrl('https://www.ozon.ru/t/Yk7vFeV')).toBeUndefined();
    expect(nameFromUrl('https://www.wildberries.ru/catalog/177311561/detail.aspx')).toBeUndefined();
    expect(nameFromUrl('не ссылка')).toBeUndefined();
  });
});

describe('page titles and prices', () => {
  it('strips the shop from a title', () => {
    expect(cleanTitle('Чехол для телефона – купить в интернет-магазине Wildberries')).toBe('Чехол для телефона');
  });

  it('reads roubles and ignores other sums', () => {
    expect(rublesIn('Цена 12 990 ₽ со скидкой')).toBe(12990);
    expect(rublesIn('Всего 25 штук')).toBeUndefined();
  });
});
