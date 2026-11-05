import { toEnglish } from './words';

/*
 * Pictures for a dream by its name. Google answers automated visitors with a captcha, so two open
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
  [/айфон[а-яё]*/i, 'iphone'], [/макбук[а-яё]*/i, 'macbook'], [/айпад[а-яё]*/i, 'ipad'], [/самсунг/i, 'samsung'], [/плейстейшн|плойк[а-яё]*/i, 'playstation'],
  [/квартир[а-яё]*/i, 'apartment'], [/переезд[а-яё]*/i, 'moving boxes'], [/дом(?![а-яё])/i, 'house'], [/отдых[а-яё]*|отпуск[а-яё]*/i, 'beach resort'], [/мальдив[а-яё]*/i, 'maldives'], [/яхт[а-яё]*/i, 'yacht'], [/мотоцикл[а-яё]*/i, 'motorcycle'],
];

export async function dreamQuery(name: string, signal?: AbortSignal): Promise<string> {
  const direct = NAMES.reduce((text, [re, en]) => text.replace(re, en), name);
  return /[а-яё]/i.test(direct) ? toEnglish(direct, signal) : direct.trim();
}

interface SketchfabImage {
  url: string;
  width: number;
}

async function fromSketchfab(q: string, signal?: AbortSignal): Promise<Found[]> {
  const res = await fetch(`https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(q)}&count=12&sort_by=-likeCount`, { signal });
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

/** Takes turns from both sources, so neither fills the whole choice. */
export function mixFound(a: Found[], b: Found[], limit = 12): Found[] {
  const out: Found[] = [];
  for (let i = 0; out.length < limit && (i < a.length || i < b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i] && out.length < limit) out.push(b[i]);
  }
  return out;
}

export async function findPictures(name: string, signal?: AbortSignal): Promise<Found[]> {
  const q = await dreamQuery(name, signal);
  const [models, photos] = await Promise.all([fromSketchfab(q, signal).catch(() => []), fromCommons(q, signal).catch(() => [])]);
  return mixFound(models, photos);
}
