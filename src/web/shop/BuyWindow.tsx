import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { parseAmount } from '../money/data';
import { CatPick, DateField } from '../money/sheets';
import { Badge3D } from './Badge3D';
import { useImage } from './Dream';
import { setBuyPicture, useImporting } from './importer';

const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

const part = (i: number) => ({
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay: 0.14 + i * 0.04, duration: 0.5, ease: EASE },
});

/** The tile grows into this window: all of it can be edited, and is saved as it is typed. */
export function BuyWindow({ buy, onClose }: { buy: Buy; onClose: () => void }) {
  const url = useImage(buy.imgId);
  const importing = useImporting(buy.id);
  const [price, setPrice] = useState(buy.price ? String(buy.price) : '');
  const [sure, setSure] = useState(false);
  const [cutting, setCutting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Buy>) => actions.updateBuy(buy.id, patch);

  // The price can arrive from the link while the window is open.
  useEffect(() => {
    if (buy.price) setPrice((p) => (p ? p : String(buy.price)));
  }, [buy.price]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    setCutting(true);
    try {
      await setBuyPicture(buy.id, f);
    } finally {
      setCutting(false);
    }
  };

  return (
    <>
      <motion.div className="sheet-scrim p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      {/* This layer scrolls a long window, so it takes the tap on the empty space around it from the scrim below. */}
      <div className="p-win-place buy-place" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="buy-holder">
          <Badge3D shop={buy.shop} />
          <motion.div layoutId={`buy-${buy.id}`} className="buy-win" style={{ borderRadius: 36 }} role="dialog" aria-modal="true" aria-label={buy.title || 'Покупка'} transition={MORPH}>
            <motion.div className="buy-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ delay: 0.1, duration: 0.3 }}>
              <button type="button" className="round-btn buy-close" aria-label="Закрыть" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>

              <motion.button type="button" className={`buy-stage${importing || cutting ? ' is-loading' : ''}`} onClick={() => file.current?.click()} aria-label="Загрузить своё фото" {...part(0)}>
                {url ? <img src={url} alt="" /> : <span className="buy-stage-empty"><Icon name="photo" size={24} />{importing ? 'Ищу фото товара' : 'Добавить фото'}</span>}
              </motion.button>
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />

              <motion.label className="buy-price-row" {...part(1)}>
                <input
                  className="buy-price"
                  style={{ width: `${Math.max(price.length, 4) + 0.5}ch` }}
                  value={price}
                  inputMode="decimal"
                  placeholder="Цена"
                  aria-label="Цена в рублях"
                  onChange={(e) => {
                    setPrice(e.target.value);
                    set({ price: parseAmount(e.target.value) });
                  }}
                />
                <span>₽</span>
              </motion.label>
              <motion.input className="buy-name" value={buy.title} placeholder="Название" aria-label="Название" maxLength={120} {...part(2)} onChange={(e) => set({ title: e.target.value })} />

              <motion.div {...part(3)}>
                <CatPick value={buy.category ?? ''} onChange={(c) => set({ category: c || undefined })} />
              </motion.div>
              <motion.textarea className="field buy-text" rows={2} value={buy.note ?? ''} placeholder="Описание" aria-label="Описание" {...part(4)} onChange={(e) => set({ note: e.target.value })} />
              <motion.textarea className="field buy-text" rows={2} value={buy.why ?? ''} placeholder="Для чего он нужен" aria-label="Для чего нужен" {...part(5)} onChange={(e) => set({ why: e.target.value })} />
              <motion.div {...part(6)}>
                <DateField value={buy.due ?? ''} placeholder="Купить до" onChange={(due) => set({ due })} />
              </motion.div>

              {buy.url && (
                <motion.a className="scan-link" href={buy.url} target="_blank" rel="noreferrer" {...part(7)}>
                  <Icon name="link" size={18} />
                  Открыть {buy.shop ? `на ${buy.shop}` : 'ссылку'}
                </motion.a>
              )}

              <motion.div className="buy-actions" {...part(8)}>
                <button type="button" className={`scan-link${buy.pinned ? ' is-on' : ''}`} onClick={() => set({ pinned: buy.pinned ? undefined : Date.now() })}>
                  <Icon name="flag" size={18} />
                  {buy.pinned ? 'Убрать с главной' : 'На главную'}
                </button>
                <button
                  type="button"
                  className="scan-link"
                  onClick={() => {
                    set({ boughtAt: Date.now() });
                    onClose();
                  }}
                >
                  <Icon name="check" size={18} />
                  Купил
                </button>
              </motion.div>

              <button
                type="button"
                className={`p-delete${sure ? ' is-sure' : ''}`}
                onClick={() => {
                  if (!sure) {
                    setSure(true);
                    return;
                  }
                  actions.deleteBuy(buy.id);
                  onClose();
                }}
              >
                {sure ? 'Точно удалить' : 'Удалить'}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
