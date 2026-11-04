import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { convert, formatMoney, useCurrency, type Cur, type UsdRate } from '../../app/money/currency';
import { exactMoney } from '../../app/money/logic';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Spend } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { cardLabel, fullDate } from './data';
import { Logo } from './Logo';

const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

/** Receipt lines keep their kopecks or cents, unlike the whole amounts everywhere else. */
const lineMoney = (rub: number, cur: Cur, rate: UsdRate | null) =>
  cur === 'USD' && rate ? `${convert(rub, cur, rate).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $` : exactMoney(rub);

/** A purchase's row grows into this window: logo and all, then the receipt's lines fall in one by one. */
export function SpendWindow({ spend, onClose }: { spend: Spend; onClose: () => void }) {
  const { cur, rate } = useCurrency();
  const banks = visible(useStore((s) => s.shared.banks));
  const [sure, setSure] = useState(false);
  const title = spend.title || 'Покупка';
  const card = cardLabel(banks, spend.bankId);
  const items = spend.items ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div className="sheet-scrim p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <div className="p-win-place">
        <motion.div layoutId={`spend-${spend.id}`} className="p-win" style={{ borderRadius: 36 }} role="dialog" aria-modal="true" aria-label={title} transition={MORPH}>
          <motion.div className="p-win-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ delay: 0.12, duration: 0.3 }}>
            <header className="p-win-head">
              <motion.span layoutId={`spend-logo-${spend.id}`} className="p-logo" transition={MORPH}>
                <Logo title={title} size={52} />
              </motion.span>
              <div className="p-win-title">
                <h2>{title}</h2>
                <p>{[fullDate(spend.date), card].filter(Boolean).join(', ')}</p>
              </div>
              <motion.button type="button" className="round-btn" aria-label="Закрыть" onClick={onClose} whileTap={{ scale: 0.86 }}>
                <Icon name="close" size={18} />
              </motion.button>
            </header>

            {items.length > 0 && (
              <ul className="p-items">
                {items.map((it, i) => (
                  <motion.li
                    key={`${i}-${it.name}`}
                    initial={{ opacity: 0, x: -14, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.16 + Math.min(i, 16) * 0.035, duration: 0.55, ease: EASE }}
                  >
                    <span>{it.name}</span>
                    <span className="p-item-sum">{lineMoney(it.price, cur, rate)}</span>
                  </motion.li>
                ))}
              </ul>
            )}

            <div className="p-total">
              <span>Итого</span>
              <strong>{formatMoney(spend.amount, cur, rate)}</strong>
            </div>

            <button
              type="button"
              className={`p-delete${sure ? ' is-sure' : ''}`}
              onClick={() => {
                if (!sure) {
                  setSure(true);
                  return;
                }
                actions.revertSpend(spend.id);
                onClose();
              }}
            >
              {sure ? (card ? `Удалить и вернуть деньги на ${card}` : 'Точно удалить') : 'Удалить покупку'}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
