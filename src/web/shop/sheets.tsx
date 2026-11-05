import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { closeSheet, openSheet, useSheet } from '../../app/sheet';
import { Sheet } from '../../app/ui/Sheet';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { putImage } from '../../lib/images';
import { Icon } from '../../ui/Icon';
import { parseAmount } from '../money/data';
import { DateField } from '../money/sheets';
import { pulseWave } from '../Wave';
import { cutOut, type CutStage } from './cutout';
import { findPictures, type Found } from './dreamSearch';
import { fetchImage } from './link';
import { hasDream } from './logic';

export function ShopSheets() {
  const open = useSheet();
  return (
    <>
      <Sheet open={open === 'dream'} onClose={closeSheet} title="Мечта">
        <DreamForm />
      </Sheet>
      <Sheet open={open === 'dreamPic'} onClose={closeSheet} title="Картинка мечты">
        <DreamPicture />
      </Sheet>
      <Sheet open={open === 'dreamSave'} onClose={closeSheet} title="Отложить">
        <SaveForm />
      </Sheet>
    </>
  );
}

const text = (n?: number) => (n ? String(n) : '');

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
    actions.setCar({ name: name.trim(), price: value, saved: parseAmount(saved), pace: parseAmount(pace) || undefined, date });
    pulseWave();
    // The sheet stays up for the picture: a new dream wants one straight away.
    if (!car.imgId) openSheet('dreamPic');
    else closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Что это: порш 911, переезд, отдых" aria-label="Название мечты" maxLength={60} />
      <div className="form-two">
        <input className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена, ₽" aria-label="Цена в рублях" inputMode="decimal" />
        <input className="field" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="Уже есть, ₽" aria-label="Уже накоплено, в рублях" inputMode="decimal" />
      </div>
      <div className="form-two">
        <input className="field" value={pace} onChange={(e) => setPace(e.target.value)} placeholder="В месяц, ₽" aria-label="Сколько откладывать в месяц, в рублях" inputMode="decimal" />
        <DateField value={date} placeholder="К какой дате" onChange={setDate} />
      </div>
      <p className="form-hint">Если не указать, сколько откладывать в месяц, посчитаю по доходам и покупкам за три месяца</p>
      <motion.button type="submit" className="primary-btn" disabled={!name.trim() || value <= 0} whileTap={{ scale: 0.96 }}>
        {isNew ? 'Дальше' : 'Сохранить'}
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
      <input ref={input} className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма, ₽" aria-label="Сумма в рублях" inputMode="decimal" />
      <p className="form-hint">С минусом, если пришлось взять обратно. Деньги с карт это не списывает</p>
      <motion.button type="submit" className="primary-btn" disabled={!value} whileTap={{ scale: 0.96 }}>
        Отложить
      </motion.button>
    </form>
  );
}

const STAGES: Record<CutStage, string> = {
  model: 'Загружаю нейросеть. Это нужно один раз',
  cut: 'Вырезаю',
};

function DreamPicture() {
  const car = useStore((s) => s.shared.car);
  const [found, setFound] = useState<Found[] | null>(null);
  const [work, setWork] = useState<string | null>(null);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stop = new AbortController();
    setFound(null);
    findPictures(car.name, stop.signal)
      .then(setFound)
      .catch(() => {
        if (!stop.signal.aborted) setFound([]);
      });
    return () => stop.abort();
  }, [car.name]);

  const apply = async (blob: Blob) => {
    setError('');
    setWork(STAGES.cut);
    try {
      const cut = await cutOut(blob, (stage, share) => setWork(stage === 'model' ? `${STAGES.model}: ${Math.round(share * 100)}%` : STAGES.cut));
      const imgId = await putImage(cut.blob);
      actions.setCar({ imgId, cut: cut.removed });
      pulseWave();
      closeSheet();
    } catch {
      setError('Не удалось обработать картинку. Попробуй другую');
    } finally {
      setWork(null);
    }
  };

  const pick = async (f: Found) => {
    setError('');
    setWork('Скачиваю картинку');
    const blob = await fetchImage(f.full);
    if (blob) await apply(blob);
    else {
      setWork(null);
      setError('Сайт не отдал эту картинку. Попробуй другую');
    }
  };

  if (work) {
    return (
      <div className="scan" role="status">
        <motion.span className="pic-spin" animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }} />
        <p>{work}</p>
      </div>
    );
  }

  return (
    <div className="form">
      <button type="button" className="scan-link" onClick={() => file.current?.click()}>
        <Icon name="photo" size={18} />
        Загрузить своё фото
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void apply(e.target.files[0])} />
      {error && <p className="form-note">{error}</p>}
      {found === null && <p className="form-hint">Ищу картинки для «{car.name}»</p>}
      {found?.length === 0 && <p className="form-note">Ничего не нашлось. Загрузи своё фото или поменяй название мечты</p>}
      {found && found.length > 0 && (
        <ul className="pic-grid">
          {found.map((f, i) => (
            <motion.li key={`${f.source}${f.id}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.45, ease: EASE }}>
              <button type="button" aria-label={`Выбрать: ${f.title}`} onClick={() => void pick(f)}>
                <img src={f.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                <span>{f.source}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
