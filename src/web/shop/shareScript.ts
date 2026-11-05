/*
 * «Поделиться» on an iPhone. A shop keeps its pages closed to outside readers, but the owner can
 * open them: a Shortcut runs this script on the page already open in Safari and sends what it reads
 * here in the address. Ozon's own check is passed by the owner opening the page, never got round.
 */

export interface Shared {
  url: string;
  title?: string;
  price?: number;
  image?: string;
  note?: string;
  category?: string;
}

/**
 * What a product page says about itself: the structured data shops publish for search engines
 * first, the preview tags and the page itself after that. It is sent to the page as text through
 * `toString`, so it must use nothing from outside itself.
 */
export function readProduct(doc: Document, pageUrl: string): Shared {
  type Node = Record<string, unknown>;
  const NOTE_LENGTH = 280;
  const TITLE_LENGTH = 120;
  const clean = (v: unknown, max: number) => {
    if (typeof v !== 'string') return undefined;
    const text = v.replace(/\s+/g, ' ').trim();
    if (!text) return undefined;
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2)).replace(/[\s,.;:–-]+$/, '')}…`;
  };
  const meta = (name: string) => doc.querySelector<HTMLMetaElement>(`meta[property="${name}"],meta[name="${name}"]`)?.content;

  const nodes: Node[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const data = JSON.parse(s.textContent ?? '') as Node | Node[];
      const list = Array.isArray(data) ? data : [data];
      list.forEach((n) => nodes.push(n, ...(Array.isArray(n['@graph']) ? (n['@graph'] as Node[]) : [])));
    } catch {
      /* a broken block on the page: the others still count */
    }
  });
  const ofType = (t: string) => nodes.find((n) => n['@type'] === t || (Array.isArray(n['@type']) && (n['@type'] as string[]).includes(t)));
  const product = ofType('Product') ?? {};

  const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
  const picture = first(product.image);
  const image = typeof picture === 'string' ? picture : ((picture as Node | undefined)?.url as string | undefined);
  const offer = first(product.offers) as Node | undefined;
  const written = offer?.price ?? offer?.lowPrice ?? meta('product:price:amount') ?? meta('og:price:amount');
  const shown = doc.querySelector('[data-widget="webPrice"]')?.textContent?.match(/\d[\d\s  ]*(?=\s*₽)/)?.[0];
  const price = Math.round(parseFloat(String(written ?? shown ?? '').replace(/[\s  ]/g, '').replace(',', '.')));

  // The last step of the path is often the brand or the thing itself; the one before it is the category.
  const path = ((ofType('BreadcrumbList')?.itemListElement as Node[] | undefined) ?? []).map((i) => (i.name ?? (i.item as Node | undefined)?.name) as string);
  const crumbs = path.length ? path : Array.from(doc.querySelectorAll('[data-widget="breadCrumbs"] li')).map((li) => li.textContent ?? '');
  const category = typeof product.category === 'string' ? product.category : crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;

  return {
    url: pageUrl.split(/[?#]/)[0],
    title: clean(product.name ?? meta('og:title') ?? doc.querySelector('h1')?.textContent, TITLE_LENGTH),
    price: price > 0 ? price : undefined,
    image: image ?? meta('og:image'),
    note: clean(product.description ?? meta('og:description'), NOTE_LENGTH),
    category: clean(category, 60),
  };
}

const PARAMS: Record<Exclude<keyof Shared, 'url'>, string> = { title: 't', price: 'p', image: 'i', note: 'd', category: 'c' };

/** The text to paste into the Shortcut's «Run JavaScript on Web Page». `site` is this site's address. */
export function shareScript(site: string): string {
  return `var r=(${readProduct.toString()})(document,location.href);var q=new URLSearchParams();q.set('add',r.url);var k=${JSON.stringify(PARAMS)};for(var n in k){if(r[n])q.set(k[n],r[n])}completion(${JSON.stringify(site)}+'#/shop?'+q.toString());`;
}

/** Back from the address; null when it holds only a plain link or a name, with nothing read from a page. */
export function parseShared(q: URLSearchParams): Shared | null {
  const url = q.get('add');
  const title = q.get(PARAMS.title);
  const image = q.get(PARAMS.image);
  if (!url || (!title && !image)) return null;
  const price = Number(q.get(PARAMS.price));
  return {
    url,
    title: title ?? undefined,
    price: price > 0 ? price : undefined,
    image: image ?? undefined,
    note: q.get(PARAMS.note) ?? undefined,
    category: q.get(PARAMS.category) ?? undefined,
  };
}
