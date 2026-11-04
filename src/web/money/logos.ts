/** Which site's logo stands for a purchase. Only these public domains ever leave the device, never the purchase itself. */
const BRANDS: [RegExp, string][] = [
  [/п[яa]т[её]р[оo]чк|pyaterochka|5ka/i, '5ka.ru'],
  [/перекр[её]ст|perekrestok/i, 'perekrestok.ru'],
  [/магнит|magnit/i, 'magnit.ru'],
  [/вкус\s*вилл|vkusvill/i, 'vkusvill.ru'],
  [/(?<![а-яё])лента(?![а-яё])|lenta/i, 'lenta.com'],
  [/ашан|auchan/i, 'auchan.ru'],
  [/дикси|dixy/i, 'dixy.ru'],
  [/о['’]?к[еэ]й|okey/i, 'okeydostavka.ru'],
  [/spar|спар(?![а-яё])/i, 'myspar.ru'],
  [/светофор/i, 'svetofore.ru'],
  [/азбука\s*вкуса|av\.ru/i, 'av.ru'],
  [/metro|(?<![а-яё])метро(?![а-яё])/i, 'metro-cc.ru'],
  [/самокат|samokat/i, 'samokat.ru'],
  [/красное\s*[&и]\s*белое/i, 'krasnoeibeloe.ru'],
  [/вкусно\s*[-—–]?\s*и\s*точка/i, 'vkusnoitochka.ru'],
  [/додо|dodo/i, 'dodopizza.ru'],
  [/fix\s*price|фикс\s*прайс/i, 'fix-price.com'],
  [/rostic|ростикс|kfc/i, 'rostics.ru'],
  [/burger\s*king|бургер\s*кинг/i, 'burgerkingrus.ru'],

  [/plati/i, 'plati.market'],
  [/wildberries|вайлдберриз|(?<![a-zа-яё])(wb|вб)(?![a-zа-яё])/i, 'wildberries.ru'],
  [/ozon|озон/i, 'ozon.ru'],
  [/aliexpress|алиэкспресс/i, 'aliexpress.ru'],
  [/авито|avito/i, 'avito.ru'],
  [/dns(?![a-z])|днс(?![а-яё])/i, 'dns-shop.ru'],
  [/м\.?\s*видео|mvideo/i, 'mvideo.ru'],
  [/эльдорадо|eldorado/i, 'eldorado.ru'],
  [/ситилинк|citilink/i, 'citilink.ru'],
  [/золотое\s*яблоко|goldapple/i, 'goldapple.ru'],
  [/л['’]?этуаль|letu/i, 'letu.ru'],
  [/ikea|икеа|hoff|хофф/i, 'hoff.ru'],
  [/ригла|rigla/i, 'rigla.ru'],
  [/горздрав/i, 'gorzdrav.org'],
  [/еаптека|eapteka/i, 'eapteka.ru'],
  [/лукойл|lukoil/i, 'lukoil.ru'],
  [/роснефть|rosneft/i, 'rosneft.ru'],
  [/газпром\s*нефть|gazprom\s*neft/i, 'gpnbonus.ru'],

  [/spotify|спотифай/i, 'spotify.com'],
  [/netflix|нетфликс/i, 'netflix.com'],
  [/youtube|ютуб/i, 'youtube.com'],
  [/кинопоиск|kinopoisk/i, 'kinopoisk.ru'],
  [/okko|окко/i, 'okko.tv'],
  [/(?<![a-zа-яё])(ivi|иви)(?![a-zа-яё])/i, 'ivi.ru'],
  [/steam|стим(?![а-яё])/i, 'store.steampowered.com'],
  [/playstation|(?<![a-z])psn(?![a-z])/i, 'playstation.com'],
  [/telegram|телеграм/i, 'telegram.org'],
  [/chatgpt|openai/i, 'openai.com'],
  [/claude|anthropic/i, 'claude.ai'],
  [/github/i, 'github.com'],
  [/apple|icloud|эппл/i, 'apple.com'],
  [/google|гугл/i, 'google.com'],
  [/яндекс\s*go|яндекс\s*такси|yandex\s*go/i, 'taxi.yandex.ru'],
  [/яндекс\s*лавка|лавка/i, 'lavka.yandex.ru'],
  [/яндекс\s*маркет|yandex\s*market/i, 'market.yandex.ru'],
  [/яндекс|yandex/i, 'ya.ru'],
  [/(?<![a-zа-яё])(vk|вк)(?![a-zа-яё])|вконтакте/i, 'vk.com'],

  [/мтс|(?<![a-z])mts(?![a-z])/i, 'mts.ru'],
  [/билайн|beeline/i, 'beeline.ru'],
  [/мегафон|megafon/i, 'megafon.ru'],
  [/теле2|tele2/i, 't2.ru'],
  [/ростелеком|rostelecom/i, 'rt.ru'],

  [/сбер|sber/i, 'sberbank.ru'],
  [/т-?\s*банк|тинькофф|tinkoff|tbank/i, 'tbank.ru'],
  [/альфа|alfa/i, 'alfabank.ru'],
  [/втб|vtb/i, 'vtb.ru'],
];

/** A site typed as the name: «plati.ru», «store.example.com». */
const SITE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ru|com|net|org|io|app|me|tv|market|shop|store|su|ai))\b/i;

export function logoDomain(title: string): string | null {
  const known = BRANDS.find(([re]) => re.test(title));
  if (known) return known[1];
  return title.match(SITE)?.[1].toLowerCase() ?? null;
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
