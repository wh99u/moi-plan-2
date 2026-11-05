import type { Rec, StateV4 } from './types';

/** Record by record, the later change wins. A deletion is a change like any other, so it travels too. */
export function mergeRecords<T extends Rec>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const x of a) byId.set(x.id, x);
  for (const y of b) {
    const x = byId.get(y.id);
    if (!x || y.updatedAt > x.updatedAt) byId.set(y.id, y);
  }
  return [...byId.values()];
}

/**
 * Two copies of the data become one: nothing added on either device is lost. Settings have no
 * times of their own, so `theirs`, the copy already shared between devices, wins on those, and
 * lists inside them are joined.
 */
export function mergeStates(ours: StateV4, theirs: StateV4): StateV4 {
  const s = (k: Exclude<keyof StateV4['shared'], 'car'>) => mergeRecords<Rec>(ours.shared[k], theirs.shared[k] ?? []);
  const p = (k: 'shifts' | 'tasks' | 'goals') => mergeRecords<Rec>(ours.personal[k], theirs.personal[k] ?? []);
  const cats = [...new Set([...(theirs.personal.settings?.spendCats ?? []), ...(ours.personal.settings.spendCats ?? [])])];
  return {
    v: 4,
    shared: {
      banks: s('banks'),
      incomes: s('incomes'),
      car: (theirs.shared.car?.updatedAt ?? 0) > ours.shared.car.updatedAt ? theirs.shared.car : ours.shared.car,
      buys: s('buys'),
      budgets: s('budgets'),
      spends: s('spends'),
      subs: s('subs'),
    } as StateV4['shared'],
    personal: {
      shifts: p('shifts'),
      tasks: p('tasks'),
      goals: p('goals'),
      plan: theirs.personal.plan ?? ours.personal.plan,
      settings: { ...ours.personal.settings, ...theirs.personal.settings, ...(cats.length ? { spendCats: cats } : {}) },
      processedLaunches: [...new Set([...(theirs.personal.processedLaunches ?? []), ...ours.personal.processedLaunches])].slice(-50),
    } as StateV4['personal'],
  };
}

/** The ids of pictures the data points at. */
export function imageIds(state: StateV4): string[] {
  const ids = new Set<string>();
  const car = state.shared.car;
  if (car.imgId) ids.add(car.imgId);
  for (const b of state.shared.buys) if (b.imgId && !b.deleted) ids.add(b.imgId);
  return [...ids];
}

/** Same data, whatever order the lists came in. */
export function sameState(a: StateV4, b: StateV4): boolean {
  const canon = (s: StateV4) =>
    JSON.stringify(s, (_, v) => {
      if (Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'id' in x)) return [...v].sort((p, q) => String(p.id).localeCompare(String(q.id)));
      return v;
    });
  return canon(a) === canon(b);
}
