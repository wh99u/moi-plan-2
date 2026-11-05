import { motion } from 'motion/react';
import { useRef, useState, type FormEvent } from 'react';
import { closeSheet, useSheet, useSheetData } from '../../app/sheet';
import { Sheet } from '../../app/ui/Sheet';
import { actions, useStore } from '../../lib/appStore';
import { dayKey } from '../../lib/dates';
import { visible } from '../../lib/records';
import type { Shift } from '../../lib/types';
import { AmountInput } from '../AmountInput';
import { CardPick, DateField, useCards, useDefaultCard } from '../money/sheets';
import { parseAmount, typedAmount } from '../money/data';
import { Seg } from '../Seg';
import { pulseWave } from '../Wave';
import { lastShift } from './logic';

const MAX_HOURS = 24;
const text = (n?: number) => (n ? typedAmount(String(n)) : '');

export function ShiftSheet() {
  const open = useSheet() === 'shift';
  const data = useSheetData();
  const shifts = visible(useStore((s) => s.personal.shifts));
  // While the sheet slides away its data is already gone; the title stays what it was.
  const shown = useRef(data);
  if (open) shown.current = data;
  const shift = shifts.find((s) => s.id === shown.current.id);

  return (
    <Sheet open={open} onClose={closeSheet} title={shift ? 'Смена' : 'Новая смена'}>
      <ShiftForm shift={shift} shifts={shifts} day={shown.current.date} />
    </Sheet>
  );
}

function ShiftForm({ shift, shifts, day }: { shift?: Shift; shifts: Shift[]; day?: string }) {
  const [type, setType] = useState<Shift['type']>(() => shift?.type ?? shifts.reduce<Shift | null>((last, s) => (!last || s.date > last.date ? s : last), null)?.type ?? 'd');
  const usual = shift ?? lastShift(shifts, type);
  const [date, setDate] = useState(shift?.date ?? day ?? dayKey(new Date()));
  // A new one starts from what the last shift of this kind was: they are usually the same.
  const [hours, setHours] = useState(text(usual?.h));
  const [pay, setPay] = useState(text(usual?.pay));
  const [touched, setTouched] = useState(false);
  const [sure, setSure] = useState(false);
  const cards = useCards();
  const [usualCard] = useDefaultCard(cards);
  const [bankId, setBankId] = useState(shift?.bankId ?? usual?.bankId ?? usualCard);
  const ahead = date > dayKey(new Date());
  const h = parseAmount(hours);
  const money = parseAmount(pay);
  const fits = h > 0 && h <= MAX_HOURS;

  const changeType = (next: Shift['type']) => {
    setType(next);
    if (shift || touched) return;
    const last = lastShift(shifts, next);
    setHours(text(last?.h));
    setPay(text(last?.pay));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fits) return;
    const record = { date, type, h, pay: money, bankId };
    // The same kind of shift on the same day is that shift being corrected, not a second one.
    const same = shifts.find((s) => s.date === date && s.type === type && s.id !== shift?.id);
    if (shift && same) actions.deleteShift(same.id);
    if (shift) actions.updateShift(shift.id, record);
    else if (same) actions.updateShift(same.id, record);
    else actions.addShift(record);
    pulseWave();
    closeSheet();
  };

  return (
    <form className="form" onSubmit={submit}>
      <Seg
        value={type}
        onChange={changeType}
        options={[
          { id: 'd', label: 'Дневная' },
          { id: 'n', label: 'Ночная' },
        ]}
        label="Какая смена"
      />
      <DateField value={date} onChange={setDate} />
      <div className="form-two">
        <label className="shift-field">
          <span className="form-label">Часы</span>
          <AmountInput
            className="field"
            value={hours}
            placeholder="12"
            aria-label="Сколько часов"
            onValue={(v) => {
              setHours(v);
              setTouched(true);
            }}
          />
        </label>
        <label className="shift-field">
          <span className="form-label">Выплата, ₽</span>
          <AmountInput
            className="field"
            value={pay}
            placeholder="5.000"
            aria-label="Выплата за смену в рублях"
            onValue={(v) => {
              setPay(v);
              setTouched(true);
            }}
          />
        </label>
      </div>
      {money > 0 && (
        <>
          <span className="form-label">{ahead ? 'На какую карту придёт в этот день' : 'На какую карту пришло'}</span>
          <CardPick cards={cards} value={bankId} onChange={setBankId} />
        </>
      )}
      <motion.button type="submit" className="primary-btn" disabled={!fits} whileTap={{ scale: 0.96 }}>
        {shift ? 'Сохранить' : 'Добавить'}
      </motion.button>
      {shift && (
        <button
          type="button"
          className={`p-delete shift-delete${sure ? ' is-sure' : ''}`}
          onClick={() => {
            if (!sure) return setSure(true);
            actions.deleteShift(shift.id);
            closeSheet();
          }}
        >
          {sure ? 'Точно удалить' : 'Удалить'}
        </button>
      )}
    </form>
  );
}
