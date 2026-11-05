import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { pickReceipt, scanReceipt, type ScanStage } from '../../app/money/scan';
import { closeSheet, useSheet, useSheetData } from '../../app/sheet';
import { Sheet } from '../../app/ui/Sheet';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { dayKey } from '../../lib/dates';
import { visible } from '../../lib/records';
import type { SpendItem } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { pulseWave } from '../Wave';
import { allCats, catIcon, existingCat } from './categories';
import { cardViews, fullDate, parseAmount, type CardView } from './data';
import { Logo } from './Logo';
import { brandOf, suggestTitles, type Suggestion } from './logos';

export function MoneySheets() {
  const open = useSheet();
  const data = useSheetData();
  return (
    <>
      <Sheet open={open === 'tx' && data.tx === 'out'} onClose={closeSheet} title="Новая покупка">
        <PurchaseForm />
      </Sheet>
      <Sheet open={open === 'tx' && data.tx === 'in'} onClose={closeSheet} title="Новый доход">
        <IncomeForm />
      </Sheet>
      <Sheet open={open === 'balance'} onClose={closeSheet} title="Сколько на карте">
        <BalanceForm id={data.id} />
      </Sheet>
    </>
  );
}

function useCards() {
  return cardViews(visible(useStore((s) => s.shared.banks)));
}

/** The card picked last time, or the first one. */
function useDefaultCard(cards: CardView[]) {
  const last = useStore((s) => s.personal.settings.lastTopUpBankId);
  return useState(() => (cards.some((c) => c.id === last) ? last : cards[0]?.id));
}

function CardPick({ cards, value, onChange }: { cards: CardView[]; value?: string; onChange: (id: string) => void }) {
  return (
    <div className="card-pick" role="radiogroup" aria-label="Карта">
      {cards.map(
        (c) =>
          c.id && (
            <button key={c.code} type="button" role="radio" aria-checked={value === c.id} className="card-chip" onClick={() => onChange(c.id!)}>
              <Logo title={c.label} domain={c.domain} size={24} />
              <span>{c.label}</span>
            </button>
          ),
      )}
    </div>
  );
}

/** Built-in categories and the owner's own in one row; a new one is typed once and stays for next time. */
function CatPick({ value, onChange }: { value: string; onChange: (cat: string) => void }) {
  const custom = useStore((s) => s.personal.settings.spendCats);
  const spends = visible(useStore((s) => s.shared.spends));
  const cats = allCats(custom, spends.map((s) => s.cat));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const add = () => {
    const name = draft.trim();
    setAdding(false);
    setDraft('');
    if (!name) return;
    const known = existingCat(cats, name);
    if (!known) actions.setSettings({ spendCats: [...(custom ?? []), name] });
    onChange(known ?? name);
  };

  return (
    <div className="cat-pick" role="radiogroup" aria-label="Категория">
      {cats.map((c) => (
        // A second tap takes the category off: it is not required.
        <button key={c} type="button" role="radio" aria-checked={value === c} className="cat-chip" onClick={() => onChange(value === c ? '' : c)}>
          <Icon name={catIcon(c)} size={16} />
          {c}
        </button>
      ))}
      {adding ? (
        <input
          className="cat-input"
          autoFocus
          value={draft}
          maxLength={24}
          placeholder="Своя категория"
          aria-label="Название новой категории"
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      ) : (
        <button type="button" className="cat-chip cat-chip--add" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />
          Своя
        </button>
      )}
    </div>
  );
}

/**
 * A day in words, with the browser's own picker over it. The native field looks different on every
 * device, and in Russian it writes a stray dot after the year.
 */
function DateField({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <label className="date-field">
      <span>{fullDate(value)}</span>
      <Icon name="calendar" size={18} />
      <input
        type="date"
        value={value}
        aria-label="Дата"
        // An emptied field has no day to keep.
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
      />
    </label>
  );
}

/** A receipt line while it is being checked; the key keeps it apart from its neighbours when one is removed. */
type Line = SpendItem & { key: number };
let lineKey = 0;

/** Holds the text as typed, so «45,» can stay on the way to «45,5». */
function PriceInput({ price, label, onChange }: { price: number; label: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(price));
  return (
    <input
      className="edit-price"
      value={text}
      aria-label={label}
      inputMode="decimal"
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
    />
  );
}

const STAGES: Record<ScanStage, string> = {
  prepare: 'Готовлю фото',
  qr: 'Ищу QR-код',
  model: 'Загружаю распознавание. В первый раз это занимает до минуты',
  text: 'Читаю позиции',
  done: 'Готово',
};

function PurchaseForm() {
  const [file, setFile] = useState<File | null>(null);
  const cards = useCards();
  const [bankId, setBankId] = useDefaultCard(cards);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [items, setItems] = useState<Line[]>([]);
  const [cat, setCat] = useState('');
  const [about, setAbout] = useState('');
  const [scan, setScan] = useState<{ stage: ScanStage; share: number } | null>(null);
  const [hint, setHint] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [titleFocus, setTitleFocus] = useState(false);
  const amountTouched = useRef(false);
  // A category picked by hand is not overwritten by what the name suggests.
  const catTouched = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const spends = visible(useStore((s) => s.shared.spends));
  const past = useMemo(
    () => [...spends].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).flatMap((s) => (s.title ? [{ title: s.title, cat: s.cat }] : [])),
    [spends],
  );
  const suggestions = titleFocus ? suggestTitles(title, past) : [];

  const suggestCat = (name?: string) => {
    if (!catTouched.current) setCat(name ?? '');
  };
  const changeTitle = (next: string) => {
    setTitle(next);
    suggestCat(past.find((p) => p.title.toLowerCase() === next.trim().toLowerCase())?.cat ?? brandOf(next)?.cat);
  };
  const pickTitle = (s: Suggestion) => {
    setTitle(s.title);
    suggestCat(s.cat);
    setTitleFocus(false);
  };

  useEffect(() => {
    // After the sheet has sprung up, so the keyboard does not fight the animation.
    const t = setTimeout(() => input.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
    setScan({ stage: 'prepare', share: 0 });
    let gone = false;
    scanReceipt(file, (stage, share) => !gone && setScan({ stage, share }))
      .then((r) => {
        if (gone) return;
        if (r.store) setTitle(r.store);
        if (r.catName && !catTouched.current) setCat(r.catName);
        if (r.date) setDate(r.date);
        setItems(r.items.map((x) => ({ ...x, key: lineKey++ })));
        if (r.total) setAmount(String(r.total));
        setHint(r.items.length || r.total ? 'Проверь позиции: распознавание иногда ошибается' : 'На фото не нашлось позиций. Заполни вручную или сними чек ровнее и ближе');
      })
      .catch(() => {
        if (!gone) setHint('Не удалось прочитать чек. Заполни вручную или попробуй другое фото');
      })
      .finally(() => {
        if (!gone) setScan(null);
      });
    return () => {
      gone = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Until the amount is typed by hand it follows the lines of the receipt.
  const changeItems = (next: Line[]) => {
    setItems(next);
    if (!amountTouched.current) setAmount(String(Math.round(next.reduce((t, x) => t + x.price, 0) * 100) / 100));
  };

  const value = parseAmount(amount);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!bankId || value <= 0) return;
    const clean = items.filter((x) => x.name.trim()).map(({ name, price }) => ({ name, price }));
    actions.spendFrom(
      bankId,
      value,
      {
        title: title.trim() || 'Покупка',
        ...(clean.length ? { items: clean } : {}),
        ...(cat ? { cat } : {}),
        ...(about.trim() ? { note: about.trim() } : {}),
      },
      date,
    );
    actions.setSettings({ lastTopUpBankId: bankId });
    pulseWave();
    closeSheet();
  };

  if (scan) {
    return (
      <div className="scan" role="status">
        <div className="scan-photo">
          {photo && <img src={photo} alt="Фото чека" />}
          <span className="scan-line" aria-hidden="true" />
        </div>
        <p>{STAGES[scan.stage]}</p>
        <span className="scan-track">
          <motion.span className="scan-fill" animate={{ scaleX: scan.share }} transition={{ duration: 0.4, ease: EASE }} />
        </span>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      {hint && <p className="form-note">{hint}</p>}
      <div className="field-logo">
        <Logo title={title || '?'} size={36} />
        <input
          ref={input}
          className="field"
          value={title}
          onChange={(e) => {
            changeTitle(e.target.value);
            setTitleFocus(true);
          }}
          onFocus={() => setTitleFocus(true)}
          // Later than the tap on a suggestion, which would otherwise vanish under the finger.
          onBlur={() => setTimeout(() => setTitleFocus(false), 160)}
          placeholder="Где: Пятёрочка, Spotify, plati.ru"
          aria-label="Название"
          autoComplete="off"
          maxLength={80}
        />
      </div>
      <AnimatePresence initial={false}>
        {suggestions.length > 0 && (
          <motion.ul
            className="suggest"
            aria-label="Подсказки"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {suggestions.map((s) => (
              <li key={s.title}>
                <button type="button" onClick={() => pickTitle(s)}>
                  <Logo title={s.title} size={28} />
                  <span>{s.title}</span>
                  {s.cat && <em>{s.cat}</em>}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <div className="form-two">
        <input className="field" value={amount} onChange={(e) => { amountTouched.current = true; setAmount(e.target.value); }} placeholder="Сумма, ₽" aria-label="Сумма в рублях" inputMode="decimal" />
        <DateField value={date} onChange={setDate} />
      </div>
      <CatPick
        value={cat}
        onChange={(c) => {
          catTouched.current = true;
          setCat(c);
        }}
      />
      <input className="field" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Описание: что и зачем купил" aria-label="Описание" maxLength={140} />
      {!hint && (
        <button
          type="button"
          className="scan-link"
          // The picker has to open right inside the tap, or the browser blocks it.
          onClick={() => void pickReceipt().then((f) => f && setFile(f))}
        >
          <Icon name="scan" size={18} />
          Заполнить по фото чека
        </button>
      )}
      <CardPick cards={cards} value={bankId} onChange={setBankId} />

      {items.length > 0 && (
        <ul className="edit-items">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.li key={it.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                <input value={it.name} aria-label="Название позиции" onChange={(e) => changeItems(items.map((x) => (x.key === it.key ? { ...x, name: e.target.value } : x)))} />
                <PriceInput price={it.price} label={`Цена позиции «${it.name}»`} onChange={(price) => changeItems(items.map((x) => (x.key === it.key ? { ...x, price } : x)))} />
                <button type="button" aria-label={`Убрать «${it.name}»`} onClick={() => changeItems(items.filter((x) => x.key !== it.key))}>
                  <Icon name="close" size={15} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <motion.button type="submit" className="primary-btn" disabled={value <= 0 || !bankId} whileTap={{ scale: 0.96 }}>
        Добавить покупку
      </motion.button>
    </form>
  );
}

function IncomeForm() {
  const cards = useCards();
  const [bankId, setBankId] = useDefaultCard(cards);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => dayKey(new Date()));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);

  const value = parseAmount(amount);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!bankId || value <= 0) return;
    actions.topUp(bankId, value, 'manual', note.trim() || undefined, date);
    pulseWave();
    closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-two">
        <input ref={input} className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" aria-label="Сумма в рублях" inputMode="decimal" />
        <DateField value={date} onChange={setDate} />
      </div>
      <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Откуда: зарплата, подработка" aria-label="Откуда" maxLength={80} />
      <CardPick cards={cards} value={bankId} onChange={setBankId} />
      <motion.button type="submit" className="primary-btn" disabled={value <= 0 || !bankId} whileTap={{ scale: 0.96 }}>
        Добавить доход
      </motion.button>
    </form>
  );
}

function BalanceForm({ id }: { id?: string }) {
  const banks = visible(useStore((s) => s.shared.banks));
  const card = cardViews(banks).find((c) => c.id === id);
  const [amount, setAmount] = useState(() => (card ? String(Math.round(card.sum * 100) / 100) : ''));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => input.current?.select(), 380);
    return () => clearTimeout(t);
  }, []);

  if (!card) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Older data may hold more records of this bank: the first one takes the difference.
    const others = banks.filter((b) => b.code === card.code && b.id !== card.id).reduce((t, b) => t + b.sum, 0);
    actions.updateBank(card.id!, { sum: parseAmount(amount) - others });
    closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="field-logo">
        <Logo title={card.label} domain={card.domain} size={36} />
        <input ref={input} className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" aria-label={`Сумма на карте ${card.label}, в рублях`} inputMode="decimal" />
      </div>
      <motion.button type="submit" className="primary-btn" whileTap={{ scale: 0.96 }}>
        Сохранить
      </motion.button>
    </form>
  );
}
