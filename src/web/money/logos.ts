/** Known brands: how to spot them in a title, whose logo stands for them, how to write them, what they usually sell. */
export interface Brand {
  re: RegExp;
  domain: string;
  name: string;
  cat?: string;
  /** Other spellings to suggest it by while typing: «спот» finds Spotify. */
  alias?: string;
}

const b = (re: RegExp, domain: string, name: string, cat?: string, alias?: string): Brand => ({ re, domain, name, cat, alias });

/** Only these public domains ever leave the device, never the purchase itself. */
export const BRANDS: Brand[] = [
  b(/п[яa]т[её]р[оo]чк|pyaterochka|5ka/i, '5ka.ru', 'Пятёрочка', 'Еда', 'pyaterochka'),
  b(/перекр[её]ст|perekrestok/i, 'perekrestok.ru', 'Перекрёсток', 'Еда'),
  b(/магнит|magnit/i, 'magnit.ru', 'Магнит', 'Еда', 'magnit'),
  b(/вкус\s*вилл|vkusvill/i, 'vkusvill.ru', 'ВкусВилл', 'Еда'),
  b(/(?<![а-яё])лента(?![а-яё])|lenta/i, 'lenta.com', 'Лента', 'Еда'),
  b(/ашан|auchan/i, 'auchan.ru', 'Ашан', 'Еда'),
  b(/дикси|dixy/i, 'dixy.ru', 'Дикси', 'Еда'),
  b(/о['’]?к[еэ]й|okey/i, 'okeydostavka.ru', 'О’кей', 'Еда', 'окей'),
  b(/spar|спар(?![а-яё])/i, 'myspar.ru', 'Spar', 'Еда', 'спар'),
  b(/светофор/i, 'svetofore.ru', 'Светофор', 'Еда'),
  b(/азбука\s*вкуса|av\.ru/i, 'av.ru', 'Азбука вкуса', 'Еда'),
  b(/metro|(?<![а-яё])метро(?![а-яё])/i, 'metro-cc.ru', 'Metro', 'Еда', 'метро'),
  b(/самокат|samokat/i, 'samokat.ru', 'Самокат', 'Еда'),
  b(/красное\s*[&и]\s*белое/i, 'krasnoeibeloe.ru', 'Красное&Белое', 'Еда', 'красное и белое'),
  b(/вкусно\s*[-—–]?\s*и\s*точка/i, 'vkusnoitochka.ru', 'Вкусно — и точка', 'Еда', 'вкусно и точка'),
  b(/додо|dodo/i, 'dodopizza.ru', 'Додо Пицца', 'Еда'),
  b(/fix\s*price|фикс\s*прайс/i, 'fix-price.com', 'Fix Price', 'Дом', 'фикс прайс'),
  b(/rostic|ростикс|kfc/i, 'rostics.ru', 'Rostic’s', 'Еда', 'ростикс'),
  b(/burger\s*king|бургер\s*кинг/i, 'burgerkingrus.ru', 'Burger King', 'Еда', 'бургер кинг'),

  b(/plati/i, 'plati.market', 'plati.ru', 'Подписки', 'плати'),
  b(/wildberries|вайлдберриз|(?<![a-zа-яё])(wb|вб)(?![a-zа-яё])/i, 'wildberries.ru', 'Wildberries', undefined, 'вайлдберриз вб'),
  b(/ozon|озон/i, 'ozon.ru', 'Ozon', undefined, 'озон'),
  b(/aliexpress|алиэкспресс/i, 'aliexpress.ru', 'AliExpress', undefined, 'алиэкспресс'),
  b(/авито|avito/i, 'avito.ru', 'Авито'),
  b(/dns(?![a-z])|днс(?![а-яё])/i, 'dns-shop.ru', 'DNS', 'Электроника', 'днс'),
  b(/м\.?\s*видео|mvideo/i, 'mvideo.ru', 'М.Видео', 'Электроника', 'мвидео'),
  b(/эльдорадо|eldorado/i, 'eldorado.ru', 'Эльдорадо', 'Электроника'),
  b(/ситилинк|citilink/i, 'citilink.ru', 'Ситилинк', 'Электроника'),
  b(/золотое\s*яблоко|goldapple/i, 'goldapple.ru', 'Золотое яблоко', 'Здоровье'),
  b(/л['’]?этуаль|letu/i, 'letu.ru', 'Л’Этуаль', 'Здоровье', 'летуаль'),
  b(/ikea|икеа|hoff|хофф/i, 'hoff.ru', 'Hoff', 'Мебель', 'хофф'),
  b(/ригла|rigla/i, 'rigla.ru', 'Ригла', 'Здоровье'),
  b(/горздрав/i, 'gorzdrav.org', 'Горздрав', 'Здоровье'),
  b(/еаптека|eapteka/i, 'eapteka.ru', 'ЕАптека', 'Здоровье'),
  b(/лукойл|lukoil/i, 'lukoil.ru', 'Лукойл', 'Транспорт'),
  b(/роснефть|rosneft/i, 'rosneft.ru', 'Роснефть', 'Транспорт'),
  b(/газпром\s*нефть|gazprom\s*neft/i, 'gpnbonus.ru', 'Газпромнефть', 'Транспорт'),

  b(/spotify|спотифай/i, 'spotify.com', 'Spotify', 'Подписки', 'спотифай'),
  b(/netflix|нетфликс/i, 'netflix.com', 'Netflix', 'Подписки', 'нетфликс'),
  b(/youtube|ютуб/i, 'youtube.com', 'YouTube', 'Подписки', 'ютуб'),
  b(/кинопоиск|kinopoisk/i, 'kinopoisk.ru', 'Кинопоиск', 'Подписки'),
  b(/okko|окко/i, 'okko.tv', 'Okko', 'Подписки', 'окко'),
  b(/(?<![a-zа-яё])(ivi|иви)(?![a-zа-яё])/i, 'ivi.ru', 'Иви', 'Подписки', 'ivi'),
  b(/steam|стим(?![а-яё])/i, 'store.steampowered.com', 'Steam', 'Развлечения', 'стим'),
  b(/playstation|(?<![a-z])psn(?![a-z])/i, 'playstation.com', 'PlayStation', 'Развлечения'),
  b(/telegram|телеграм/i, 'telegram.org', 'Telegram', 'Подписки', 'телеграм'),
  b(/chatgpt|openai/i, 'openai.com', 'ChatGPT', 'Подписки'),
  b(/claude|anthropic/i, 'claude.ai', 'Claude', 'Подписки'),
  b(/github/i, 'github.com', 'GitHub', 'Подписки'),
  b(/apple|icloud|эппл/i, 'apple.com', 'Apple', undefined, 'эппл'),
  b(/google|гугл/i, 'google.com', 'Google', undefined, 'гугл'),
  b(/яндекс\s*go|яндекс\s*такси|yandex\s*go/i, 'taxi.yandex.ru', 'Яндекс Go', 'Транспорт'),
  b(/яндекс\s*лавка|лавка/i, 'lavka.yandex.ru', 'Яндекс Лавка', 'Еда'),
  b(/яндекс\s*маркет|yandex\s*market/i, 'market.yandex.ru', 'Яндекс Маркет'),
  b(/яндекс|yandex/i, 'ya.ru', 'Яндекс'),
  b(/(?<![a-zа-яё])(vk|вк)(?![a-zа-яё])|вконтакте/i, 'vk.com', 'VK', 'Подписки', 'вконтакте'),

  b(/мтс|(?<![a-z])mts(?![a-z])/i, 'mts.ru', 'МТС', 'Подписки'),
  b(/билайн|beeline/i, 'beeline.ru', 'Билайн', 'Подписки'),
  b(/мегафон|megafon/i, 'megafon.ru', 'МегаФон', 'Подписки'),
  b(/теле2|tele2/i, 't2.ru', 'Т2', 'Подписки', 'теле2'),
  b(/ростелеком|rostelecom/i, 'rt.ru', 'Ростелеком', 'Подписки'),

  b(/сбер|sber/i, 'sberbank.ru', 'Сбер'),
  b(/т-?\s*банк|тинькофф|tinkoff|tbank/i, 'tbank.ru', 'Т-Банк', undefined, 'тинькофф'),
  b(/альфа|alfa/i, 'alfabank.ru', 'Альфа-Банк'),
  b(/втб|vtb/i, 'vtb.ru', 'ВТБ'),
];

export const brandOf = (title: string) => BRANDS.find((x) => x.re.test(title));

/** A site typed as the name: «plati.ru», «store.example.com». */
const SITE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ru|com|net|org|io|app|me|tv|market|shop|store|su|ai))\b/i;

export function logoDomain(title: string): string | null {
  return brandOf(title)?.domain ?? title.match(SITE)?.[1].toLowerCase() ?? null;
}

/** Where to ask for a domain's logo: Yandex answers from Russia at full size, Google is the reserve. */
export const logoSources = (domain: string) => [
  `https://favicon.yandex.net/favicon/v2/${encodeURIComponent(domain)}?size=120`,
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
];

/** One or two letters for when there is no logo: «Рынок у дома» → «РД». */
export function monogram(title: string) {
  const words = title.trim().split(/\s+/).filter((w) => w.length > 2 || w === title.trim());
  const picked = words.length ? words : [title.trim()];
  const letters = picked.length > 1 ? picked[0][0] + picked[picked.length - 1][0] : picked[0].slice(0, 1);
  return (letters || '?').toUpperCase();
}

export interface Suggestion {
  title: string;
  cat?: string;
}

/** Lower case and «ё» as «е», so «пятё» and «пяте» both find Пятёрочка. */
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

/** True when some word of the text starts with the query. */
const startsWord = (text: string, q: string) => norm(text).split(/[\s\-—–.&]+/).some((w) => w.startsWith(q)) || norm(text).startsWith(q);

/**
 * What the owner may be typing: their own earlier purchases first, then known brands.
 * `past` goes newest first, and the category of the newest purchase of a name is the one offered.
 */
export function suggestTitles(query: string, past: Suggestion[], limit = 4): Suggestion[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (s: Suggestion) => {
    const key = norm(s.title);
    if (seen.has(key)) return;
    seen.add(key);
    // Already fully typed: nothing left to suggest for this one.
    if (key !== q) out.push(s);
  };
  for (const p of past) if (startsWord(p.title, q)) add(p);
  for (const x of BRANDS) if (startsWord(x.name, q) || (x.alias && startsWord(x.alias, q))) add({ title: x.name, cat: x.cat });
  return out.slice(0, limit);
}
