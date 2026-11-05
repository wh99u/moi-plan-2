import { addMonthsKeepDay, dayKey } from './dates';
import { emptyState } from './defaults';
import { uid } from './ids';
import { migrateV3 } from './migrate';
import { visible } from './records';
import { templateCategories } from './template';
import type { Bank, BankCode, BudgetMonth, Buy, Car, Category, Goal, Income, Rec, Settings, Shift, Spend, StateV4, Sub, Task } from './types';

export { visible };

type StoreError = 'save' | 'load';

export interface StoreOptions {
  legacyKey?: string;
  seed?: () => StateV4;
  now?: () => Date;
}

const SAVE_DELAY = 150;
const MAX_LAUNCHES = 50;
const SHIFT_NAMES = { d: 'Дневная смена', n: 'Ночная смена' } as const;

/**
 * Every shift whose day has come has its pay on a card and in the income chart, exactly once: a
 * later correction of the shift moves the money by the difference, and deleting it takes it back.
 * A shift still ahead counts for nothing yet. Returns the same state when there is nothing to do.
 */
export function settleShifts(state: StateV4, today: string, now = Date.now()): StateV4 {
  let { banks, incomes } = state.shared;
  const live = visible(banks);
  const usual = live.find((b) => b.id === state.personal.settings.lastTopUpBankId) ?? [...live].sort((a, b) => a.order - b.order)[0];
  const add = (id: string, by: number) => {
    banks = banks.map((b) => (b.id === id ? { ...b, sum: b.sum + by, updatedAt: now } : b));
  };
  for (const s of state.personal.shifts) {
    const id = `shift-${s.id}`;
    const paid = incomes.find((i) => i.id === id && !i.deleted);
    const due = !s.deleted && s.pay > 0 && s.date <= today;
    if (!due) {
      if (paid) {
        add(paid.bankId, -paid.amount);
        incomes = incomes.map((i) => (i.id === id ? { ...i, deleted: true as const, updatedAt: now } : i));
      }
      continue;
    }
    const wanted = (live.find((b) => b.id === s.bankId) ?? live.find((b) => b.id === paid?.bankId) ?? usual)?.id;
    // No card yet: it waits until there is one.
    if (!wanted) continue;
    if (!paid) {
      add(wanted, s.pay);
      const income: Income = { id, date: s.date, amount: s.pay, bankId: wanted, source: 'shift', note: SHIFT_NAMES[s.type], shiftId: s.id, updatedAt: now };
      incomes = incomes.some((i) => i.id === id) ? incomes.map((i) => (i.id === id ? income : i)) : [...incomes, income];
    } else if (paid.amount !== s.pay || paid.date !== s.date || paid.bankId !== wanted || paid.note !== SHIFT_NAMES[s.type]) {
      add(paid.bankId, -paid.amount);
      add(wanted, s.pay);
      incomes = incomes.map((i) => (i.id === id ? { ...i, amount: s.pay, date: s.date, bankId: wanted, note: SHIFT_NAMES[s.type], updatedAt: now } : i));
    }
  }
  if (banks === state.shared.banks && incomes === state.shared.incomes) return state;
  return { ...state, shared: { ...state.shared, banks, incomes } };
}

function load(storage: Storage, key: string, opts: StoreOptions, now: number): { state: StateV4; error: boolean; fresh?: boolean } {
  const read = (k: string) => {
    try {
      return storage.getItem(k);
    } catch {
      return null;
    }
  };
  const own = read(key);
  if (own) {
    try {
      const parsed = JSON.parse(own) as StateV4;
      if (parsed && parsed.v === 4) {
        // Lists added after v4 shipped start empty in older saves.
        parsed.shared.subs ??= [];
        parsed.personal.goals ??= [];
        return { state: parsed, error: false };
      }
    } catch {
      /* fall through to legacy / empty */
    }
    try {
      storage.setItem(`${key}_corrupt`, own);
    } catch {
      /* best effort backup */
    }
  }
  const legacy = opts.legacyKey ? read(opts.legacyKey) : null;
  if (legacy) {
    try {
      return { state: migrateV3(JSON.parse(legacy), now), error: !!own, fresh: true };
    } catch {
      return { state: emptyState(now), error: true };
    }
  }
  if (opts.seed) return { state: opts.seed(), error: !!own, fresh: true };
  return { state: emptyState(now), error: !!own };
}

export function createStore(storage: Storage, key: string, opts: StoreOptions = {}) {
  const today = opts.now ?? (() => new Date());
  const loaded = load(storage, key, opts, Date.now());
  let state = loaded.state;
  let pendingLoadError = loaded.error;
  const listeners = new Set<() => void>();
  const errorListeners = new Set<(e: StoreError) => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emitError = (e: StoreError) => errorListeners.forEach((fn) => fn(e));

  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch {
      emitError('save');
    }
  }

  function set(next: StateV4) {
    state = next;
    listeners.forEach((fn) => fn());
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
  }

  const settled = () => set(settleShifts(state, dayKey(today())));
  const shared = (patch: Partial<StateV4['shared']>) => set({ ...state, shared: { ...state.shared, ...patch } });
  const personal = (patch: Partial<StateV4['personal']>) => set({ ...state, personal: { ...state.personal, ...patch } });
  const stamp = <T extends object>(x: T) => ({ ...x, updatedAt: Date.now() });
  const patchIn = <T extends Rec>(list: T[], id: string, patch: NoInfer<Partial<T>>): T[] =>
    list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x));
  const removeIn = <T extends Rec>(list: T[], id: string) => patchIn(list, id, { deleted: true } as Partial<T>);

  const findBudget = (ym: string) => visible(state.shared.budgets).find((b) => b.ym === ym);

  function ensureBudget(ym: string): BudgetMonth {
    const found = findBudget(ym);
    if (found) return found;
    const created: BudgetMonth = { id: ym, ym, income: 0, cats: [], updatedAt: Date.now() };
    shared({ budgets: [...state.shared.budgets.filter((b) => b.ym !== ym), created] });
    return created;
  }

  function updateBudget(ym: string, patch: Partial<Pick<BudgetMonth, 'income' | 'cats'>>) {
    ensureBudget(ym);
    shared({ budgets: state.shared.budgets.map((b) => (b.ym === ym && !b.deleted ? { ...b, ...patch, updatedAt: Date.now() } : b)) });
  }

  const actions = {
    addBank(code: BankCode, sum: number): Bank {
      const banks = visible(state.shared.banks);
      const order = banks.length ? Math.max(...banks.map((b) => b.order)) + 1 : 0;
      const bank = stamp({ id: uid(), code, sum, order });
      shared({ banks: [...state.shared.banks, bank] });
      return bank;
    },
    updateBank(id: string, patch: Partial<Pick<Bank, 'code' | 'sum' | 'order'>>) {
      shared({ banks: patchIn(state.shared.banks, id, patch) });
    },
    deleteBank(id: string) {
      shared({ banks: removeIn(state.shared.banks, id) });
    },
    topUp(bankId: string, amount: number, source: Income['source'], note?: string, date = dayKey(today())): Income {
      const income: Income = stamp({ id: uid(), date, amount, bankId, source, ...(note ? { note } : {}) });
      set({
        ...state,
        shared: {
          ...state.shared,
          banks: state.shared.banks.map((b) => (b.id === bankId ? { ...b, sum: b.sum + amount, updatedAt: Date.now() } : b)),
          incomes: [...state.shared.incomes, income],
        },
        personal: { ...state.personal, settings: { ...state.personal.settings, lastTopUpBankId: bankId } },
      });
      return income;
    },
    /** Undo of a top-up: takes the money back and tombstones the income. */
    revertTopUp(incomeId: string) {
      const inc = state.shared.incomes.find((i) => i.id === incomeId && !i.deleted);
      if (!inc) return;
      shared({
        banks: state.shared.banks.map((b) => (b.id === inc.bankId ? { ...b, sum: b.sum - inc.amount, updatedAt: Date.now() } : b)),
        incomes: removeIn(state.shared.incomes, incomeId),
      });
    },
    transfer(fromId: string, toId: string, amount: number): boolean {
      const from = visible(state.shared.banks).find((b) => b.id === fromId);
      const to = visible(state.shared.banks).find((b) => b.id === toId);
      if (!from || !to || from === to || amount <= 0 || amount > from.sum) return false;
      shared({
        banks: state.shared.banks.map((b) =>
          b.id === fromId ? { ...b, sum: b.sum - amount, updatedAt: Date.now() } : b.id === toId ? { ...b, sum: b.sum + amount, updatedAt: Date.now() } : b,
        ),
      });
      return true;
    },
    setCar(patch: Partial<Omit<Car, 'updatedAt'>>) {
      shared({ car: { ...state.shared.car, ...patch, updatedAt: Date.now() } });
    },
    addBuy(b: Omit<Buy, 'id' | 'updatedAt'>): Buy {
      const buy = stamp({ ...b, id: uid() });
      shared({ buys: [...state.shared.buys, buy] });
      return buy;
    },
    updateBuy(id: string, patch: Partial<Omit<Buy, 'id' | 'updatedAt'>>) {
      shared({ buys: patchIn(state.shared.buys, id, patch) });
    },
    deleteBuy(id: string) {
      shared({ buys: removeIn(state.shared.buys, id) });
    },
    ensureBudget,
    updateBudget,
    addCategory(ym: string, cat: Omit<Category, 'id'>): Category {
      const c = { ...cat, id: uid() };
      updateBudget(ym, { cats: [...ensureBudget(ym).cats, c] });
      return c;
    },
    updateCategory(ym: string, catId: string, patch: Partial<Omit<Category, 'id'>>) {
      updateBudget(ym, { cats: ensureBudget(ym).cats.map((c) => (c.id === catId ? { ...c, ...patch } : c)) });
    },
    deleteCategory(ym: string, catId: string) {
      updateBudget(ym, { cats: ensureBudget(ym).cats.filter((c) => c.id !== catId) });
    },
    copyBudget(fromYm: string, toYm: string) {
      const src = findBudget(fromYm);
      if (!src) return;
      updateBudget(toYm, { income: src.income, cats: src.cats.map((c) => ({ ...c })) });
    },
    applyTemplate(ym: string) {
      updateBudget(ym, { cats: templateCategories(ensureBudget(ym).income) });
    },
    addSpend(s: Omit<Spend, 'id' | 'updatedAt'>): Spend {
      const spend = stamp({ ...s, id: uid() });
      shared({ spends: [...state.shared.spends, spend] });
      return spend;
    },
    updateSpend(id: string, patch: Partial<Omit<Spend, 'id' | 'updatedAt'>>) {
      shared({ spends: patchIn(state.shared.spends, id, patch) });
    },
    deleteSpend(id: string) {
      shared({ spends: removeIn(state.shared.spends, id) });
    },
    /** Money out of a card: logs a spend, for today unless told otherwise, and lowers the card's sum. */
    spendFrom(bankId: string, amount: number, extra: Partial<Pick<Spend, 'title' | 'auto' | 'items' | 'catId' | 'cat' | 'note'>> = {}, date = dayKey(today())): Spend {
      const spend: Spend = stamp({ id: uid(), ym: date.slice(0, 7), catId: '', amount, date, bankId, ...extra });
      shared({
        banks: state.shared.banks.map((b) => (b.id === bankId ? { ...b, sum: b.sum - amount, updatedAt: Date.now() } : b)),
        spends: [...state.shared.spends, spend],
      });
      return spend;
    },
    /** Undo of a spend: gives the money back to its card, if it has one, and tombstones it. */
    revertSpend(id: string) {
      const spend = state.shared.spends.find((x) => x.id === id && !x.deleted);
      if (!spend) return;
      shared({
        banks: state.shared.banks.map((b) => (b.id === spend.bankId ? { ...b, sum: b.sum + spend.amount, updatedAt: Date.now() } : b)),
        spends: removeIn(state.shared.spends, id),
        // The purchase was not made after all, so the wish is back on the list.
        ...(spend.buyId ? { buys: patchIn(state.shared.buys, spend.buyId, { boughtAt: undefined }) } : {}),
      });
    },
    /** A wish from the list was bought: it leaves the list and becomes a spend on the card. */
    buyFrom(buyId: string, bankId: string, amount: number, date = dayKey(today())): Spend | null {
      const buy = visible(state.shared.buys).find((b) => b.id === buyId);
      if (!buy) return null;
      const spend: Spend = stamp({ id: uid(), ym: date.slice(0, 7), catId: '', amount, date, bankId, buyId, title: buy.title || 'Покупка', ...(buy.category ? { cat: buy.category } : {}), ...(buy.note ? { note: buy.note } : {}) });
      set({
        ...state,
        shared: {
          ...state.shared,
          banks: state.shared.banks.map((b) => (b.id === bankId ? { ...b, sum: b.sum - amount, updatedAt: Date.now() } : b)),
          spends: [...state.shared.spends, spend],
          buys: patchIn(state.shared.buys, buyId, { boughtAt: Date.now() }),
        },
        personal: { ...state.personal, settings: { ...state.personal.settings, lastTopUpBankId: bankId } },
      });
      return spend;
    },
    addSub(x: Omit<Sub, 'id' | 'updatedAt'>): Sub {
      const sub = stamp({ ...x, id: uid() });
      shared({ subs: [...state.shared.subs, sub] });
      return sub;
    },
    updateSub(id: string, patch: Partial<Omit<Sub, 'id' | 'updatedAt'>>) {
      shared({ subs: patchIn(state.shared.subs, id, patch) });
    },
    deleteSub(id: string) {
      shared({ subs: removeIn(state.shared.subs, id) });
    },
    /** Records the payment as a spend in `catId` and moves the reminder to the next period. */
    paySub(id: string, catId: string): Spend | null {
      const sub = visible(state.shared.subs).find((x) => x.id === id);
      if (!sub) return null;
      const date = dayKey(today());
      const spend: Spend = stamp({ id: uid(), ym: date.slice(0, 7), catId, amount: sub.amount, date, title: sub.name, subId: sub.id });
      const next = addMonthsKeepDay(sub.next, sub.period === 'year' ? 12 : 1);
      shared({ spends: [...state.shared.spends, spend], subs: patchIn(state.shared.subs, id, { next }) });
      return spend;
    },
    addShift(s: Omit<Shift, 'id' | 'updatedAt'>): Shift {
      const shift = stamp({ ...s, id: uid() });
      personal({ shifts: [...state.personal.shifts, shift] });
      settled();
      return shift;
    },
    updateShift(id: string, patch: Partial<Omit<Shift, 'id' | 'updatedAt'>>) {
      personal({ shifts: patchIn(state.personal.shifts, id, patch) });
      settled();
    },
    deleteShift(id: string) {
      personal({ shifts: removeIn(state.personal.shifts, id) });
      settled();
    },
    /** Shifts whose day has just come are paid out. */
    settleShifts: settled,
    addTask(t: Omit<Task, 'id' | 'updatedAt' | 'done'>): Task {
      const task = stamp({ ...t, id: uid(), done: false });
      personal({ tasks: [...state.personal.tasks, task] });
      return task;
    },
    updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'updatedAt'>>) {
      personal({ tasks: patchIn(state.personal.tasks, id, patch) });
    },
    toggleTask(id: string) {
      const t = state.personal.tasks.find((x) => x.id === id);
      if (t) personal({ tasks: patchIn(state.personal.tasks, id, { done: !t.done }) });
    },
    deleteTask(id: string) {
      personal({ tasks: removeIn(state.personal.tasks, id) });
    },
    addGoal(g: Omit<Goal, 'id' | 'updatedAt'>): Goal {
      const goal = stamp({ ...g, id: uid() });
      personal({ goals: [...state.personal.goals, goal] });
      return goal;
    },
    updateGoal(id: string, patch: Partial<Omit<Goal, 'id' | 'updatedAt'>>) {
      personal({ goals: patchIn(state.personal.goals, id, patch) });
    },
    /** Its steps stay as ordinary tasks. */
    deleteGoal(id: string) {
      personal({
        goals: removeIn(state.personal.goals, id),
        tasks: state.personal.tasks.map((t) => (t.goalId === id ? { ...t, goalId: undefined, updatedAt: Date.now() } : t)),
      });
    },
    setPlan(n: number) {
      personal({ plan: n });
    },
    setSettings(patch: Partial<Settings>) {
      personal({ settings: { ...state.personal.settings, ...patch } });
    },
    /** True the first time a launch key is seen; protects deep-link top-ups from repeats. */
    markLaunch(key: string): boolean {
      if (state.personal.processedLaunches.includes(key)) return false;
      personal({ processedLaunches: [...state.personal.processedLaunches, key].slice(-MAX_LAUNCHES) });
      return true;
    },
  };

  // Migrated or seeded data becomes the source of truth immediately.
  if (loaded.fresh) flush();

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && timer) flush();
    });
  }

  return {
    get: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onError(fn: (e: StoreError) => void) {
      errorListeners.add(fn);
      if (pendingLoadError) {
        pendingLoadError = false;
        fn('load');
      }
      return () => errorListeners.delete(fn);
    },
    flush,
    /** What synchronisation brought in: the whole state, stamped as it came. */
    replace: set,
    actions,
  };
}

export type Store = ReturnType<typeof createStore>;
export type Actions = Store['actions'];
