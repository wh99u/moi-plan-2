/** Built-in purchase categories; the owner's own come after them. */
export const BASE_CATS: { name: string; icon: string }[] = [
  { name: 'Еда', icon: 'food' },
  { name: 'Электроника', icon: 'laptop' },
  { name: 'Мебель', icon: 'sofa' },
  { name: 'Одежда', icon: 'shirt' },
  { name: 'Дом', icon: 'home' },
  { name: 'Транспорт', icon: 'bus' },
  { name: 'Здоровье', icon: 'health' },
  { name: 'Подписки', icon: 'repeat' },
  { name: 'Развлечения', icon: 'fun' },
  { name: 'Подарки', icon: 'gift' },
];

const key = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

export const catIcon = (name: string) => BASE_CATS.find((c) => key(c.name) === key(name))?.icon ?? 'flag';

/** Everything to choose from: built-in, then added by hand, then met on older purchases; no repeats. */
export function allCats(custom: string[] = [], used: (string | undefined)[] = []) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...BASE_CATS.map((c) => c.name), ...custom, ...used]) {
    const clean = name?.trim();
    if (!clean || seen.has(key(clean))) continue;
    seen.add(key(clean));
    out.push(clean);
  }
  return out;
}

/** The name as it already exists, so «еда» typed by hand does not become a second «Еда». */
export const existingCat = (cats: string[], typed: string) => cats.find((c) => key(c) === key(typed));
