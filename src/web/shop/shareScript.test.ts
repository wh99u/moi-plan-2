import { describe, expect, it } from 'vitest';
import { parseShared, readProduct, shareScript } from './shareScript';

const page = (html: string) => new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, 'text/html');
const URL_ = 'https://www.ozon.ru/product/karcher-1899881186/?sh=abc';

// The shape Ozon's product page really had when this was written.
const OZON = page(`
  <script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    name: 'Karcher KWD 1 Пылесос, желтый',
    description: 'Компактный   хозяйственный пылесос',
    image: 'https://ir.ozone.ru/s3/multimedia-1-e/9291717446.jpg',
    offers: { '@type': 'Offer', price: '5699', priceCurrency: 'RUB' },
  })}</script>
  <div data-widget="breadCrumbs"><ol><li>Пылесосы</li><li>Напольные пылесосы</li><li>Karcher</li></ol></div>
  <div data-widget="webPrice">5 642 ₽ С банками 5 699 ₽</div>`);

describe('readProduct', () => {
  it('reads a product page by its structured data', () => {
    expect(readProduct(OZON, URL_)).toEqual({
      url: 'https://www.ozon.ru/product/karcher-1899881186/',
      title: 'Karcher KWD 1 Пылесос, желтый',
      price: 5699,
      image: 'https://ir.ozone.ru/s3/multimedia-1-e/9291717446.jpg',
      note: 'Компактный хозяйственный пылесос',
      category: 'Напольные пылесосы',
    });
  });

  it('falls back to the preview tags and the price on the page', () => {
    const doc = page(`<div data-widget="webPrice">5 642 ₽ С банками</div><h1>Чайник</h1>`);
    doc.head.innerHTML = `<meta property="og:image" content="https://x.ru/a.jpg"><meta property="og:description" content="Хороший">`;
    expect(readProduct(doc, 'https://x.ru/p')).toMatchObject({ title: 'Чайник', price: 5642, image: 'https://x.ru/a.jpg', note: 'Хороший' });
  });

  it('shortens a long description at a word', () => {
    const note = readProduct(page(`<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'A', description: 'слово '.repeat(100) })}</script>`), 'https://x.ru').note!;
    expect(note.length).toBeLessThanOrEqual(281);
    expect(note.endsWith('слово…')).toBe(true);
  });

  it('survives a page with nothing on it and a broken block', () => {
    expect(readProduct(page(`<script type="application/ld+json">{oops</script>`), 'https://x.ru/p?a=1')).toEqual({ url: 'https://x.ru/p', title: undefined, price: undefined, image: undefined, note: undefined, category: undefined });
  });
});

describe('shareScript', () => {
  it('runs on its own, as text, and hands over an address the site reads back', () => {
    let address = '';
    new Function('document', 'location', 'completion', shareScript('https://site.test/app/'))(OZON, { href: URL_ }, (a: string) => (address = a));
    expect(address.startsWith('https://site.test/app/#/shop?add=')).toBe(true);
    const shared = parseShared(new URLSearchParams(address.split('?')[1]));
    expect(shared).toMatchObject({ url: 'https://www.ozon.ru/product/karcher-1899881186/', title: 'Karcher KWD 1 Пылесос, желтый', price: 5699, category: 'Напольные пылесосы' });
  });
});

describe('parseShared', () => {
  it('leaves a plain link to the older way', () => {
    expect(parseShared(new URLSearchParams('add=https://x.ru/p'))).toBeNull();
    expect(parseShared(new URLSearchParams(''))).toBeNull();
  });
});
