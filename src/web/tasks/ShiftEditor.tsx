import { motion } from 'motion/react';
import { useState } from 'react';
import { actions } from '../../lib/appStore';
import { dayKey } from '../../lib/dates';
import type { Shift } from '../../lib/types';
import { AmountInput } from '../AmountInput';
import { parseAmount, typedAmount } from '../money/data';
import { CardPick, useCards, useDefaultCard } from '../money/sheets';
import { Seg } from '../Seg';
import { pulseWave } from '../Wave';
import { lastShift } from './logic';

const MAX_HOURS = 24;
const text = (n?: number) => (n ? typedAmount(String(n)) : '');

/**
 * A shift, opened right under its button in the day's window: day or night, hours, pay, and the
 * card the money comes to. A new one starts from the last shift of its kind.
 */
export function ShiftEditor({ day, shift, shifts, onDone }: { day: string; shift?: Shift; shifts: Shift[]; onDone: () => void }) {
  const [type, setType] = useState<Shift['type']>(() => shift?.type ?? shifts.reduce<Shift | null>((last, s) => (!last || s.date > last.date ? s : last), null)?.type ?? 'd');
  const usual = shift ?? lastShift(shifts, type);
  const [hours, setHours] = useState(text(usual?.h));
  const [pay, setPay] = useState(text(usual?.pay));
  const [touched, setTouched] = useState(false);
  const cards = useCards();
  const [usualCard] = useDefaultCard(cards);
  const [bankId, setBankId] = useState(shift?.bankId ?? usual?.bankId ?? usualCard);
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

  const save = () => {
    if (!fits) return;
    const record = { date: day, type, h, pay: money, bankId };
    // The same kind of shift on the same day is that shift being corrected, not a second one.
    const same = shifts.find((s) => s.date === day && s.type === type && s.id !== shift?.id);
    if (shift && same) actions.deleteShift(same.id);
    if (shift) actions.updateShift(shift.id, record);
    else if (same) actions.updateShift(same.id, record);
    else actions.addShift(record);
    pulseWave();
    onDone();
  };

  return (
    <motion.div className="plate-sub-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
      <div className="plate-sub-in">
        <Seg
          value={type}
          onChange={changeType}
          options={[
            { id: 'd', label: 'Дневная' },
            { id: 'n', label: 'Ночная' },
          ]}
          label="Какая смена"
        />
        <div className="plate-two">
          <label>
            <span>Часы</span>
            <AmountInput
              className="plate-input"
              value={hours}
              placeholder="12"
              aria-label="Сколько часов"
              onValue={(v) => {
                setHours(v);
                setTouched(true);
              }}
            />
          </label>
          <label>
            <span>Выплата, ₽</span>
            <AmountInput
              className="plate-input"
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
            <span className="plate-hint">{day > dayKey(new Date()) ? 'На какую карту придёт' : 'На какую карту пришло'}</span>
            <CardPick cards={cards} value={bankId} onChange={setBankId} />
          </>
        )}
        <div className="plate-foot">
          {shift && (
            <button
              type="button"
              className="plate-del"
              onClick={() => {
                actions.deleteShift(shift.id);
                onDone();
              }}
            >
              Удалить
            </button>
          )}
          <motion.button type="button" className="plate-go" disabled={!fits} whileTap={{ scale: 0.94 }} onClick={save}>
            {shift ? 'Сохранить' : 'Добавить'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
