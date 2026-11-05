import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { closeSheet, openSheet, useSheet } from '../../app/sheet';
import { Sheet } from '../../app/ui/Sheet';
import { actions, useStore } from '../../lib/appStore';
import { addDays, dayKey } from '../../lib/dates';
import { visible } from '../../lib/records';
import { Icon } from '../../ui/Icon';
import { AmountInput } from '../AmountInput';
import { fullDate, parseAmount, typedAmount } from '../money/data';
import { plural } from '../reminders';
import { DateField } from '../money/sheets';
import { pulseWave } from '../Wave';
import { GrowText } from './BuyWindow';
import { autoDream, setDreamLink, setDreamPhoto } from './importer';
import { dreamPlan, hasDream, monthlyPace } from './logic';
import { shareScript } from './shareScript';

export function ShopSheets() {
  const open = useSheet();
  return (
    <>
      <Sheet open={open === 'dream'} onClose={closeSheet} title="Мечта">
        <DreamForm />
      </Sheet>
      <Sheet open={open === 'dreamInfo'} onClose={closeSheet} title="Подробнее">
        <DreamInfo />
      </Sheet>
      <Sheet open={open === 'dreamPic'} onClose={closeSheet} title="Фон мечты">
        <DreamPicture />
      </Sheet>
      <Sheet open={open === 'shopShare'} onClose={closeSheet} title="Из магазина через «Поделиться»">
        <ShareHelp />
      </Sheet>
      <Sheet open={open === 'dreamSave'} onClose={closeSheet} title="Отложить">
        <SaveForm />
      </Sheet>
    </>
  );
}

const text = (n?: number) => (n ? typedAmount(String(n)) : '');

function DreamForm() {
  const car = useStore((s) => s.shared.car);
  const isNew = !hasDream(car);
  const [name, setName] = useState(isNew ? '' : car.name);
  const [price, setPrice] = useState(text(car.price));
  const [saved, setSaved] = useState(text(car.saved));
  const [pace, setPace] = useState(text(car.pace));
  const [date, setDate] = useState(car.date);
  const value = parseAmount(price);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || value <= 0) return;
    // A new name wants a new picture: the screen behind finds it by itself. The owner's own photo stays.
    const renamed = name.trim() !== car.name && !car.ownPic;
    actions.setCar({ name: name.trim(), price: value, saved: parseAmount(saved), pace: parseAmount(pace) || undefined, date, ...(renamed ? { imgId: undefined, cut: undefined, credit: undefined, creditUrl: undefined } : {}) });
    pulseWave();
    closeSheet();
  };


  return (
    <form className="form" onSubmit={submit}>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Что это: порш 911, переезд, отдых" aria-label="Название мечты" maxLength={60} />
      <div className="form-two">
        <AmountInput className="field" value={price} onValue={setPrice} placeholder="Цена, ₽" aria-label="Цена в рублях" />
        <AmountInput className="field" value={saved} onValue={setSaved} placeholder="Уже есть, ₽" aria-label="Уже накоплено, в рублях" />
      </div>
      <div className="form-two">
        <AmountInput className="field" value={pace} onValue={setPace} placeholder="В месяц, ₽" aria-label="Сколько откладывать в месяц, в рублях" />
        <DateField value={date} placeholder="К какой дате" onChange={setDate} />
      </div>
      <p className="form-hint">Если не указать, сколько откладывать в месяц, посчитаю по доходам и покупкам за три месяца</p>
      <motion.button type="submit" className="primary-btn" disabled={!name.trim() || value <= 0} whileTap={{ scale: 0.96 }}>
        {isNew ? 'Добавить' : 'Сохранить'}
      </motion.button>
    </form>
  );
}

function SaveForm() {
  const car = useStore((s) => s.shared.car);
  const [amount, setAmount] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const value = parseAmount(amount);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value) return;
    actions.setCar({ saved: Math.max(0, (car.saved ?? 0) + value) });
    pulseWave();
    closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <AmountInput inputRef={input} className="field" value={amount} onValue={setAmount} placeholder="Сумма, ₽" aria-label="Сумма в рублях" />
      <p className="form-hint">С минусом, если пришлось взять обратно. Деньги с карт это не списывает</p>
      <motion.button type="submit" className="primary-btn" disabled={!value} whileTap={{ scale: 0.96 }}>
        Отложить
      </motion.button>
    </form>
  );
}

/** The picture is found by itself; these are for when it is not the one. */
function DreamPicture() {
  const car = useStore((s) => s.shared.car);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [work, setWork] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const another = async () => {
    setWork(true);
    setNote('');
    const ok = await autoDream(car.name, true);
    setWork(false);
    if (ok) closeSheet();
    else setNote('Другой картинки не нашлось. Вставь ссылку или загрузи своё фото');
  };
  const byLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!link.trim()) return;
    setWork(true);
    setNote('');
    const ok = await setDreamLink(link);
    setWork(false);
    if (ok) closeSheet();
    else setNote('По этой ссылке картинку не получить. Попробуй ссылку на саму картинку');
  };
  const own = (f?: File) => {
    if (!f) return;
    void setDreamPhoto(f);
    closeSheet();
  };

  return (
    <form className="form" onSubmit={(e) => void byLink(e)}>
      <button type="button" className="scan-link" disabled={work} onClick={() => void another()}>
        <Icon name="repeat" size={18} />
        {work ? 'Ищу' : 'Другая из интернета'}
      </button>
      <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ссылка на картинку или страницу" aria-label="Ссылка на картинку или страницу" inputMode="url" />
      {link.trim() && (
        <motion.button type="submit" className="primary-btn" disabled={work} whileTap={{ scale: 0.96 }}>
          Поставить
        </motion.button>
      )}
      <button type="button" className="scan-link" onClick={() => file.current?.click()}>
        <Icon name="photo" size={18} />
        Загрузить своё фото
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => own(e.target.files?.[0])} />
      {note && <p className="form-note">{note}</p>}
      {car.credit && (
        <a className="form-credit" href={car.creditUrl} target="_blank" rel="noreferrer">
          {car.credit}
        </a>
      )}
    </form>
  );
}

const DAYS: [string, string, string] = ['день', 'дня', 'дней'];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <dt>
        {label}
        {note && <span>{note}</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Everything about the dream that does not fit on its screen. */
function DreamInfo() {
  const car = useStore((s) => s.shared.car);
  const incomes = visible(useStore((s) => s.shared.incomes));
  const spends = visible(useStore((s) => s.shared.spends));
  const { cur, rate } = useCurrency();
  const money = (rub: number) => formatMoney(rub, cur, rate);
  const now = new Date();
  const auto = monthlyPace(incomes, spends, now);
  const plan = dreamPlan(car, auto, now);
  const days = plan.daysToSave;
  const daysText = (n: number) => `${n} ${plural(n, DAYS)}`;

  return (
    <div className="form">
      <dl className="stats">
        <Stat label="Цена" value={money(car.price)} />
        <Stat label="Накоплено" value={`${money(plan.saved)}, ${Math.round(plan.share * 100)}%`} />
        <Stat label="Осталось собрать" value={money(plan.left)} />
        <Stat label="Откладывать в месяц" note={car.pace ? undefined : plan.pace ? 'Посчитано по доходам и покупкам' : undefined} value={plan.pace ? money(plan.pace) : 'Не указано'} />
        <Stat label="Сколько копить" value={days === null ? 'Укажи темп' : days === 0 ? 'Всё накоплено' : daysText(days)} />
        {days !== null && days > 0 && <Stat label="Накопится примерно" value={fullDate(dayKey(addDays(now, days)))} />}
        <Stat label="Срок" value={car.date ? fullDate(car.date) : 'Не указан'} />
        {plan.daysLeft !== null && <Stat label="До срока" value={plan.daysLeft > 0 ? daysText(plan.daysLeft) : 'Срок прошёл'} />}
        {plan.needed !== null && <Stat label="Чтобы успеть" value={`${money(plan.needed)} в месяц`} />}
      </dl>
      <GrowText value={car.why ?? ''} placeholder="Зачем мне эта мечта" aria-label="Зачем мне эта мечта" onChange={(e) => actions.setCar({ why: e.target.value })} />
      <button type="button" className="scan-link" onClick={() => openSheet('dream')}>
        <Icon name="edit" size={18} />
        Изменить
      </button>
    </div>
  );
}

/** A Shortcut cannot be installed from a web page, so it is put together once, by these steps. */
function ShareHelp() {
  const [copied, setCopied] = useState(false);
  const [refused, setRefused] = useState(false);
  const script = shareScript(location.origin + location.pathname);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      setRefused(true); // the browser said no: the text is shown to copy by hand
    }
  };

  return (
    <div className="form">
      <ol className="steps">
        <li>Скопируй скрипт кнопкой ниже</li>
        <li>Открой приложение «Команды» и создай новую команду, назови её «В Мой план»</li>
        <li>В её настройках включи показ в меню «Поделиться», тип: веб-страницы Safari</li>
        <li>Добавь действие «Запустить JavaScript на веб-странице» и вставь туда скрипт</li>
        <li>Добавь действие «Открыть URL», ему дай результат скрипта</li>
        <li>В настройках iPhone: Приложения, Команды, Дополнения, включи «Разрешить выполнение скриптов»</li>
      </ol>
      <motion.button type="button" className="primary-btn" onClick={() => void copy()} whileTap={{ scale: 0.96 }}>
        {copied ? 'Скопировано' : 'Скопировать скрипт'}
      </motion.button>
      {refused && <textarea className="field share-script" readOnly rows={4} value={script} aria-label="Скрипт" onFocus={(e) => e.target.select()} />}
      <p className="form-hint">Дальше открываешь товар в Safari, нажимаешь «Поделиться» и выбираешь «В Мой план». Карточка появится здесь с фото, ценой и описанием</p>
    </div>
  );
}
