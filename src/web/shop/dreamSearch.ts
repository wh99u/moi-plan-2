import { fallbacks, toEnglish } from './words';

/*
 * Pictures for a dream or a purchase by its name. Google answers automated visitors with a captcha, so two open
 * sources are used instead, both readable from a browser: Sketchfab's renders of 3D models, on a
 * plain studio background that cuts out cleanly, and photographs from Wikimedia Commons.
 */

export interface Found {
  id: string;
  title: string;
  /** Small, for the choice. */
  thumb: string;
  /** Large, to cut out. */
  full: string;
  source: 'Sketchfab' | 'Wikimedia Commons';
}

/** A machine translator turned «порш» into «piston», so names people dream of are looked up here first. */
const NAMES: [RegExp, string][] = [
  [/порш[а-яё]*/i, 'porsche'], [/панамер[а-яё]*/i, 'panamera'], [/кайен[а-яё]*/i, 'cayenne'], [/макан[а-яё]*/i, 'macan'],
  [/бмв/i, 'bmw'], [/мерс[а-яё]*/i, 'mercedes'], [/ауди/i, 'audi'], [/тесл[а-яё]*/i, 'tesla'], [/лада/i, 'lada'], [/тойот[а-яё]*/i, 'toyota'],
  [/лексус[а-яё]*/i, 'lexus'], [/хендай|хёндэ|хундай/i, 'hyundai'], [/киа/i, 'kia'], [/феррари/i, 'ferrari'], [/ламборгини|ламба/i, 'lamborghini'],
  [/бентли/i, 'bentley'], [/рендж ровер/i, 'range rover'], [/ленд крузер|крузак/i, 'land cruiser'], [/гелик|гелендваген/i, 'mercedes g-class'], [/мустанг/i, 'mustang'],
  [/(?<![а-яё])про(?![а-яё])/i, 'pro'], [/айфон[а-яё]*/i, 'iphone'], [/макбук[а-яё]*/i, 'macbook'], [/айпад[а-яё]*/i, 'ipad'], [/самсунг/i, 'samsung'], [/плейстейшн|плойк[а-яё]*/i, 'playstation'],
  [/квартир[а-яё]*/i, 'apartment'], [/переезд[а-яё]*/i, 'moving boxes'], [/дом(?![а-яё])/i, 'house'], [/отдых[а-яё]*|отпуск[а-яё]*/i, 'beach resort'], [/мальдив[а-яё]*/i, 'maldives'], [/яхт[а-яё]*/i, 'yacht'], [/мотоцикл[а-яё]*/i, 'motorcycle'],
];

export async function dreamQuery(name: string, signal?: AbortSignal): Promise<string> {
  const direct = NAMES.reduce((text, [re, en]) => text.replace(re, en), name).trim();
  const russian = direct.split(/\s+/).filter((w) => /[а-яё]/i.test(w));
  if (!russian.length) return direct;
  // Only the words still in Russian go to the translator: it would lose the model number in «911».
  const english = await toEnglish(russian.join(' '), signal);
  const known = direct.split(/\s+/).filter((w) => !/[а-яё]/i.test(w));
  return [english, ...known].filter(Boolean).join(' ');
}

interface SketchfabImage {
  url: string;
  width: number;
}

/** By relevance, not likes, and only with realistic materials: the most liked are art pieces, not goods. */
async function fromSketchfab(q: string, signal?: AbortSignal): Promise<Found[]> {
  const res = await fetch(`https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(q)}&count=12&pbr_type=metalness`, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: { uid: string; name: string; thumbnails?: { images?: SketchfabImage[] } }[] };
  return (json.results ?? []).flatMap((m) => {
    const images = [...(m.thumbnails?.images ?? [])].sort((a, b) => a.width - b.width);
    const thumb = images.find((i) => i.width >= 400) ?? images.at(-1);
    const full = images.at(-1);
    return thumb && full ? [{ id: m.uid, title: m.name, thumb: thumb.url, full: full.url, source: 'Sketchfab' as const }] : [];
  });
}

async function fromCommons(q: string, signal?: AbortSignal): Promise<Found[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url&iiurlwidth=1280`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { query?: { pages?: Record<string, { pageid: number; title: string; imageinfo?: { thumburl?: string }[] }> } };
  return Object.values(json.query?.pages ?? {}).flatMap((p) => {
    const full = p.imageinfo?.[0]?.thumburl;
    return full ? [{ id: String(p.pageid), title: p.title.replace(/^File:|\.\w+$/g, ''), thumb: full, full, source: 'Wikimedia Commons' as const }] : [];
  });
}

export interface Photo {
  /** Wikimedia's own copy, 1920 wide: sharp on a phone, and readable from a browser. The image proxy gets no answer from it. */
  url: string;
  credit: string;
  creditUrl: string;
}

/** Close-ups of parts: true to the name, but no picture of a dream. */
const NOT_THE_WHOLE = /\b(engine|motor|gearbox|interior|cockpit|dashboard|logo|badge|wheel|seat|diagram|map|chart)\b/i;
const MIN_WIDE = 2000;

const plainText = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function commonsPhotos(q: string, filter: string, signal?: AbortSignal): Promise<Photo[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap ${filter}`)}&prop=imageinfo&iiprop=url|size|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=1920`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { index?: number; title: string; imageinfo?: { thumburl?: string; descriptionurl: string; width: number; extmetadata?: { Artist?: { value: string }; LicenseShortName?: { value: string } } }[] }> };
  };
  return Object.values(json.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl || info.width < MIN_WIDE || NOT_THE_WHOLE.test(p.title)) return [];
      const who = plainText(info.extmetadata?.Artist?.value);
      const licence = plainText(info.extmetadata?.LicenseShortName?.value);
      return [{ url: info.thumburl, credit: `Фото: ${[who, licence].filter(Boolean).join(', ')}`, creditUrl: info.descriptionurl }];
    });
}

/** Large clear photographs for the whole screen: those Wikimedia's reviewers passed as quality images first. */
export async function findPhotos(name: string, signal?: AbortSignal): Promise<Photo[]> {
  const q = await dreamQuery(name, signal);
  const [best, rest] = await Promise.all([commonsPhotos(q, 'hastemplate:"Quality image"', signal).catch(() => []), commonsPhotos(q, `filew:>${MIN_WIDE}`, signal).catch(() => [])]);
  const seen = new Set<string>();
  return [...best, ...rest].filter((p) => !seen.has(p.url) && !!seen.add(p.url));
}

const TRIED_QUERIES = 6;

/** Scenes and sets of many things: no good as a picture of one. */
const NOT_ONE_THING = /\b(packs?|sets?|collection|kit|bundle|props?|scene|room|assets?|level|environment|interior)\b/i;

/** How many words of the query the model's name holds; 0 means it is something else that merely turned up. */
export function fitsQuery(title: string, query: string): number {
  if (NOT_ONE_THING.test(title)) return 0;
  const name = title.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && name.includes(w.replace(/s$/, ''))).length;
}

/**
 * Pictures of a thing by its name, best first: 3D renders whose name really matches, since they
 * stand on a plain studio background and cut out cleanly, then photographs as a last resort.
 */
export async function findPictures(name: string, signal?: AbortSignal): Promise<Found[]> {
  const q = await dreamQuery(name, signal);
  let models: Found[] = [];
  // Model numbers and stray letters only narrow a long name read from a link down to nothing.
  const plain = q.split(/\s+/).filter((w) => w.length > 1 && !/^\d+$/.test(w)).join(' ');
  for (const query of [...new Set([q, ...fallbacks(plain)])].slice(0, TRIED_QUERIES)) {
    const fit = (await fromSketchfab(query, signal).catch(() => [] as Found[]))
      .map((m) => ({ m, score: fitsQuery(m.title, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    models = fit.map((x) => x.m);
    if (models.length) break;
  }
  const photos = await fromCommons(q, signal).catch(() => [] as Found[]);
  return [...models, ...photos];
}
