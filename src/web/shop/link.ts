/*
 * A product link → name, category, price and photo. Shops guard their pages, so each source
 * is used for what it actually gives a browser:
 * - Wildberries exposes product photos on its CDN.
 * - For other sites, Microlink reads public product metadata when available.
 */

export interface Product {
  url: string;
  shop: string;
  title?: string;
  category?: string;
  price?: number;
  image?: string;
  imageAlternates?: string[];
  note?: string;
}

/** The first link in a pasted share text («Смотри, что нашёл https://…»). */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"«»]+/i) ?? text.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ru|com|net|org|shop|store|io|link)\/[^\s<>"«»]*/i);
  if (!m) return null;
  const url = m[0].replace(/[),.!?;:]+$/, '');
  return /^https?:/i.test(url) ? url : `https://${url}`;
}

const SHOPS: [RegExp, string][] = [
  [/(^|\.)(wildberries\.(ru|by|kz|am|kg|uz)|wb\.ru)$/, 'Wildberries'],
  [/(^|\.)ozon\.(ru|by|kz|link)$/, 'Ozon'],
  [/(^|\.)market\.yandex\.ru$/, 'Яндекс Маркет'],
  [/(^|\.)amazon\.[a-z.]+$/, 'Amazon'],
  [/(^|\.)aliexpress\.(ru|com|us)$/, 'AliExpress'],
  [/(^|\.)megamarket\.ru$/, 'Мегамаркет'],
  [/(^|\.)lamoda\.ru$/, 'Lamoda'],
  [/(^|\.)dns-shop\.ru$/, 'DNS'],
  [/(^|\.)mvideo\.ru$/, 'М.Видео'],
  [/(^|\.)eldorado\.ru$/, 'Эльдорадо'],
  [/(^|\.)citilink\.ru$/, 'Ситилинк'],
  [/(^|\.)avito\.ru$/, 'Авито'],
  [/(^|\.)apple\.com$/, 'Apple'],
  [/(^|\.)ikea\.(com|ru)$/, 'IKEA'],
];

export function shopOf(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
  return SHOPS.find(([re]) => re.test(host))?.[1] ?? host;
}

/** Wildberries article from `…/catalog/172466373/detail.aspx` or `?nm=172466373`. */
export function wbArticle(url: string): number | null {
  if (shopOf(url) !== 'Wildberries') return null;
  const m = url.match(/\/catalog\/(\d{5,12})(?:\/|$|\?)/) ?? url.match(/[?&](?:nm|card)=(\d{5,12})/);
  return m ? Number(m[1]) : null;
}

/** «Чехол … – купить в интернет-магазине Wildberries» → «Чехол …». */
export function cleanTitle(title: string): string {
  return title
    .replace(/^amazon\.[a-z.]+\s*:\s*/i, '')
    .replace(/\s*[|–—-]\s*(купить|buy|цены?|отзывы|интернет-магазин|amazon|ozon|wildberries|яндекс маркет|aliexpress).*$/i, '')
    .replace(/\s*:\s*[^:]*(?:amazon|electronics|computers|clothing)[^:]*$/i, '')
    .replace(/^купить\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Marketplace titles run on with specs; a card needs the first phrase. */
export function shortTitle(title: string, max = 48): string {
  if (title.length <= max) return title;
  const cuts = [' with ', ', ', ': ', ' (', ' - ', ' – ', ' | ', '; ', ' / ']
    .map((s) => title.indexOf(s, 16))
    .filter((i) => i > 0);
  const at = cuts.length ? Math.min(...cuts) : -1;
  if (at > 0 && at <= max + 12) return title.slice(0, at);
  return `${title.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** «12 990 ₽», «12990 руб.» → 12990. Other currencies are not guessed. */
export function rublesIn(text: string): number | undefined {
  const m = text.match(/(\d{1,3}(?:[\s  ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:₽|руб\b|руб\.|р\.)/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/\D/g, '')) + (m[2] ? Number(`0.${m[2]}`) : 0);
  return n > 0 ? n : undefined;
}

/** Pages that are a bot check rather than the product. */
const WALL = /проверяем браузер|нет соединения|access denied|robot|captcha|just a moment|attention required|доступ ограничен/i;

/** CORS-friendly copy of a picture from any site. */
export const proxied = (img: string, w = 900) => `https://wsrv.nl/?url=${encodeURIComponent(img)}&w=${w}&output=png`;

/** A big picture for the whole screen, whatever its source; tall enough for a phone held upright. */
export const fullScreen = (img: string) => `https://wsrv.nl/?url=${encodeURIComponent(img)}&h=1800&we&output=webp&q=82`;

/** The preview picture of a page, as microlink reads it. */
export async function pageImage(url: string, signal?: AbortSignal): Promise<string | undefined> {
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal });
  const json = (await res.json()) as { status: string; data?: { image?: { url?: string } | null } };
  return json.status === 'success' ? (json.data?.image?.url ?? undefined) : undefined;
}

const wbPath = (nm: number) => `vol${Math.floor(nm / 1e5)}/part${Math.floor(nm / 1e3)}/${nm}`;

/** Last volume on each CDN shard, as Wildberries' own site maps them; newer shards are guessed. */
const WB_VOLS = [143, 287, 431, 719, 1007, 1061, 1115, 1169, 1313, 1601, 1655, 1919, 2045, 2189, 2405, 2621, 2837, 3053, 3269, 3485, 3701, 3917, 4133, 4349, 4565, 4877];

function legacyWbHost(nm: number): string | undefined {
  const vol = Math.floor(nm / 1e5);
  const i = WB_VOLS.findIndex((v) => vol <= v);
  if (i >= 0) return `basket-${String(i + 1).padStart(2, '0')}.wbbasket.ru`;
}

interface WbCard {
  imt_name?: string;
  subj_name?: string;
  description?: string;
}

interface WbHost {
  host: string;
  vol_range_from: number;
  vol_range_to: number;
}

let wbHosts: Promise<WbHost[]> | undefined;

async function mappedWbHost(nm: number) {
  wbHosts ??= fetch('https://cdn.wbbasket.ru/api/v3/upstreams', { signal: AbortSignal.timeout(3500) })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { origin?: { mediabasket_route_map?: { method: string; hosts: WbHost[] }[] } };
      return data.origin?.mediabasket_route_map?.find((map) => map.method === 'range')?.hosts ?? [];
    })
    .catch(() => { wbHosts = undefined; return []; });
  const volume = Math.floor(nm / 1e5);
  const hosts = await wbHosts;
  return hosts.find((entry) => volume >= entry.vol_range_from && volume <= entry.vol_range_to
    && /^basket-\d+\.wbbasket\.ru$/.test(entry.host))?.host;
}

async function wbProduct(nm: number, url: string, signal: AbortSignal): Promise<Product> {
  const host = legacyWbHost(nm) ?? await mappedWbHost(nm);
  if (!host) throw new Error('Unknown Wildberries CDN host');
  const base = `https://${host}/${wbPath(nm)}`;
  const load = async <T>(path: string) => {
    const res = await fetch(base + path, { signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]) });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json() as T;
  };
  const [card, history] = await Promise.all([
    load<WbCard>('/info/ru/card.json'),
    load<{ dt: number; price?: { RUB?: number } }[]>('/info/price-history.json').catch(() => []),
  ]);
  let latest = 0;
  let price: number | undefined;
  for (const entry of Array.isArray(history) ? history : []) {
    const rubles = entry.price?.RUB;
    if (rubles && entry.dt >= latest) {
      latest = entry.dt;
      price = rubles / 100;
    }
  }
  return {
    url, shop: 'Wildberries', price,
    title: card.imt_name?.trim() || undefined,
    category: card.subj_name,
    note: card.description?.trim().slice(0, 6000) || undefined,
    image: base + '/images/big/1.webp',
    imageAlternates: [base + '/images/c516x688/1.webp', base + '/images/big/1.jpg'],
  };
}

interface Microlink {
  status: string;
  data?: { title?: string | null; description?: string | null; image?: { url?: string } | null };
}

async function pageProduct(url: string, signal?: AbortSignal): Promise<Product> {
  const shop = shopOf(url);
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal });
  const json = (await res.json()) as Microlink;
  const d = json.status === 'success' ? json.data : undefined;
  if (d?.title && WALL.test(d.title)) return { url, shop };
  const title = d?.title && !WALL.test(d.title) && d.title !== '...' ? shortTitle(cleanTitle(d.title)) : undefined;
  const image = d?.image?.url && !/challenge|incident|captcha|favicon|logo/i.test(d.image.url) ? d.image.url : undefined;
  if (!title && !image) return { url, shop };
  return { url, shop, title, image, price: rublesIn(`${d?.title ?? ''} ${d?.description ?? ''}`) };
}

/** Latin words that are names, and must not be read back as Russian. */
const KEEP_LATIN = /^(apple|iphone|ipad|macbook|airpods|samsung|galaxy|xiaomi|redmi|poco|huawei|honor|realme|oneplus|google|pixel|sony|playstation|xbox|nintendo|lg|asus|acer|lenovo|hp|dell|msi|nike|adidas|puma|reebok|new|balance|dyson|bosch|philips|jbl|marshall|logitech|razer|pro|max|plus|ultra|mini|air|lite|se|gb|tb|mm|ml|xl|xxl|usb|led|wi|fi|ssd|rtx|gtx)$/i;

const BACK: [RegExp, string][] = [
  [/shch/g, 'щ'], [/zh/g, 'ж'], [/kh/g, 'х'], [/ts/g, 'ц'], [/ch/g, 'ч'], [/sh/g, 'ш'], [/yu/g, 'ю'], [/ya/g, 'я'], [/yo/g, 'ё'],
  [/yy\b/g, 'ый'], [/iy\b/g, 'ий'], [/ey\b/g, 'ей'], [/oy\b/g, 'ой'],
  [/a/g, 'а'], [/b/g, 'б'], [/v/g, 'в'], [/g/g, 'г'], [/d/g, 'д'], [/e/g, 'е'], [/z/g, 'з'], [/i/g, 'и'], [/j/g, 'й'], [/k/g, 'к'], [/l/g, 'л'], [/m/g, 'м'],
  [/n/g, 'н'], [/o/g, 'о'], [/p/g, 'п'], [/r/g, 'р'], [/s/g, 'с'], [/t/g, 'т'], [/u/g, 'у'], [/f/g, 'ф'], [/h/g, 'х'], [/c/g, 'к'], [/y/g, 'ы'],
];

const backToRussian = (word: string) => BACK.reduce((w, [re, to]) => w.replace(re, to), word.toLowerCase());

/**
 * The name written in the link itself: Ozon and Avito keep their pages closed, but the address is
 * the owner's own and reads `…/smartfon-apple-iphone-15-1234567/`. It is a first draft to correct.
 */
export function nameFromUrl(url: string): string | undefined {
  let path = '';
  try {
    const address = new URL(url);
    path = address.pathname;
    if (wbArticle(url) || (shopOf(url) === 'Ozon' && (path.startsWith('/t/') || address.hostname === 'ozon.link'))) return undefined;
  } catch {
    return undefined;
  }
  const last = path.split('/').filter(Boolean).at(-1);
  if (!last || !/[a-z]{3}/i.test(last)) return undefined;
  const words = last
    .replace(/[-_]\d{5,}$/, '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (/\d/.test(w) || KEEP_LATIN.test(w) ? w : backToRussian(w)));
  const name = words.join(' ');
  return name ? shortTitle(name[0].toUpperCase() + name.slice(1), 64) : undefined;
}

/** A page that does not answer in this time is treated as closed. */
const PAGE_WAIT = 9000;

/** Whatever the link gives away; fields it could not read stay empty for the user to fill. */
export async function lookup(url: string, signal?: AbortSignal): Promise<Product> {
  const nm = wbArticle(url);
  const fromAddress = { url, shop: shopOf(url), title: nameFromUrl(url) };
  const wait = AbortSignal.timeout(PAGE_WAIT);
  const deadline = signal ? AbortSignal.any([signal, wait]) : wait;
  try {
    if (nm) {
      const wb = await wbProduct(nm, url, deadline).catch(() => undefined);
      if (wb) return wb;
    }
    const page = await pageProduct(url, deadline);
    // A closed page often answers with its own address as the title.
    const real = page.title && !/^[\w.-]+$/.test(page.title) ? page.title : undefined;
    return { ...page, title: real ?? fromAddress.title };
  } catch (e) {
    if (signal?.aborted) throw e;
    return fromAddress;
  }
}

/** The product photo as bytes, or null when the site would not give it. */
export async function fetchImage(src: string, signal?: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch(src, { signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith('image/') ? blob : null;
  } catch {
    return null;
  }
}
