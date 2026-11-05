export type BankCode = 'alfa' | 'sber' | 'vtb' | 'tbank' | 'ozon' | 'wb';

export const BANK_CODES: BankCode[] = ['tbank', 'sber', 'alfa', 'vtb', 'ozon', 'wb'];
export const BANK_NAMES: Record<BankCode, string> = {
  wb: 'ВБ Банк',
  alfa: 'Альфа-Банк',
  sber: 'Сбербанк',
  vtb: 'ВТБ',
  tbank: 'Т-Банк',
  ozon: 'Озон Банк',
};

/** Every synced record carries an id and a modification time; deletes are tombstones. */
export interface Rec {
  id: string;
  updatedAt: number;
  deleted?: true;
}

export interface Bank extends Rec {
  code: BankCode;
  sum: number;
  order: number;
}

export interface Income extends Rec {
  date: string;
  amount: number;
  bankId: string;
  source: 'manual' | 'shortcut';
  note?: string;
}

export interface Car {
  name: string;
  price: number;
  date: string;
  color: string;
  imgId?: string;
  /** The photo is a cut-out on a transparent background. */
  cut?: boolean;
  /** The picture is a white line icon rather than a photo. */
  icon?: boolean;
  /** Already put aside for it. */
  saved?: number;
  /** Put aside per month, when set by hand; otherwise worked out from income and spending. */
  pace?: number;
  /** Why the owner wants it, in their own words. */
  why?: string;
  /** The picture is the owner's own, an upload or a link, so nothing replaces it. */
  ownPic?: boolean;
  /** Who took the found photo and where it comes from, as its licence asks to say. */
  credit?: string;
  creditUrl?: string;
  url?: string;
  updatedAt: number;
}

export interface Buy extends Rec {
  title: string;
  url: string;
  price: number;
  imgId?: string;
  tint?: string;
  /** The photo is a cut-out on a transparent background. */
  cut?: boolean;
  /** The picture is a white line icon rather than a photo. */
  icon?: boolean;
  /** Small line above the name: «Чехлы для телефонов». */
  category?: string;
  /** One line about it, shown on its page: «Газированный напиток в банке 0,33 л». */
  note?: string;
  /** What it is needed for. */
  why?: string;
  /** Brought up to the main screen at this moment; the newest three stay there. */
  pinned?: number;
  /** The name the picture was found by, when it was found by name: a new name finds a new one. */
  autoPic?: string;
  /** Where it is sold: «Wildberries», «Amazon». */
  shop?: string;
  /** Buy it by this day, `YYYY-MM-DD`. */
  due?: string;
  /** When it was marked as bought; such wishes leave the list. */
  boughtAt?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
}

export interface BudgetMonth extends Rec {
  ym: string;
  income: number;
  cats: Category[];
}

/** One line of a receipt: «Молоко 3,2% — 89 ₽». */
export interface SpendItem {
  name: string;
  price: number;
}

export interface Spend extends Rec {
  ym: string;
  catId: string;
  amount: number;
  date: string;
  note?: string;
  /** Where the money went: «Магазин», «Пятёрочка». */
  title?: string;
  /** What kind of purchase it is, by name: «Еда», «Электроника». */
  cat?: string;
  /** What exactly was bought; their sum is the amount when present. */
  items?: SpendItem[];
  /** Set when the spend is a paid subscription. */
  subId?: string;
  /** The card it was paid from; its sum went down with this spend. */
  bankId?: string;
  /** Added by itself from a bank's message. */
  auto?: boolean;
}

export type SubPeriod = 'month' | 'year';

/** A regular payment to remember: mobile, internet, Яндекс Плюс… */
export interface Sub extends Rec {
  name: string;
  amount: number;
  icon: string;
  /** Next payment day, `YYYY-MM-DD`. */
  next: string;
  period: SubPeriod;
  /** Budget category it is paid from, by name (category ids differ between months). */
  catName: string;
}

export interface Shift extends Rec {
  date: string;
  type: 'd' | 'n';
  pay: number;
  h: number;
}

/** 0 none, 1 low, 2 medium, 3 high. */
export type Priority = 0 | 1 | 2 | 3;
export type Repeat = 'd' | 'w' | 'm';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task extends Rec {
  title: string;
  desc: string;
  /** `YYYY-MM-DD`, or empty for no date. */
  due: string;
  done: boolean;
  /** `HH:MM`: with it the task stands in the hours of its day. */
  time?: string;
  minutes?: number;
  priority?: Priority;
  tags?: string[];
  subtasks?: Subtask[];
  repeat?: Repeat;
  /** Minutes spent on it in focus. */
  focused?: number;
}

export interface Settings {
  botLink: string;
  lastTopUpBankId?: string;
  /** Purchase categories the owner added to the built-in ones. */
  spendCats?: string[];
}

export interface StateV4 {
  v: 4;
  shared: {
    banks: Bank[];
    incomes: Income[];
    car: Car;
    buys: Buy[];
    budgets: BudgetMonth[];
    spends: Spend[];
    subs: Sub[];
  };
  personal: {
    shifts: Shift[];
    tasks: Task[];
    plan: number;
    settings: Settings;
    processedLaunches: string[];
  };
}
