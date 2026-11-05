import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { openSheet } from '../../app/sheet';
import { EASE } from '../../app/ui/text';
import { actions } from '../../lib/appStore';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { AmountInput } from '../AmountInput';
import { parseAmount, typedAmount } from '../money/data';
import { CatPick, DateField } from '../money/sheets';
import { Badge3D } from './Badge3D';
import { useImage } from './Dream';
import { autoPicture, linkInto, setBuyPicture, useImporting, wantsPicture } from './importer';
import { firstUrl } from './link';
import { isBlankBuy } from './logic';
import { pulseWave } from '../Wave';
import { blur } from '../../app/ui/device';

const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

const part = (i: number) => ({
  initial: { opacity: 0, y: 12, ...blur(6) },
  animate: { opacity: 1, y: 0, ...blur(0) },
  transition: { delay: 0.14 + i * 0.04, duration: 0.5, ease: EASE },
});

/** How long after the last letter the picture is looked for: «пылесос» and not «пыл». */
const TYPING = 800;

/** One line, the height of the other fields, until more is written into it. */
export function GrowText({ value, ...rest }: ComponentProps<typeof motion.textarea> & { value: string }) {
  const el = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = el.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  }, [value]);
  return <motion.textarea ref={el} className="field buy-text" rows={1} value={value} {...rest} />;
}

/** The card grows into this window: all of it can be edited, and is saved as it is typed. */
export function BuyWindow({ buy, morph, isNew = false, onClose }: { buy: Buy; morph: string; isNew?: boolean; onClose: () => void }) {
  const url = useImage(buy.imgId);
  const importing = useImporting(buy.id);
  const [price, setPrice] = useState(buy.price ? typedAmount(String(buy.price)) : '');
  const [sure, setSure] = useState(false);
  const [cutting, setCutting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const canPaste = typeof navigator.clipboard?.readText === 'function';
  const useLink = (text: string) => {
    if (firstUrl(text)) linkInto(buy.id, text);
    setLink('');
  };
  const pasteLink = async () => {
    try {
      useLink(await navigator.clipboard.readText());
    } catch {
      /* the browser said no: the field is right there to paste into */
    }
  };
  const set = (patch: Partial<Buy>) => actions.updateBuy(buy.id, patch);
  const blank = isBlankBuy(buy);
  const add = () => {
    if (blank) return;
    pulseWave();
    onClose();
  };

  // The picture comes by itself once the name is written.
  useEffect(() => {
    if (!wantsPicture(buy)) return;
    const t = setTimeout(() => void autoPicture(buy.id), TYPING);
    return () => clearTimeout(t);
  }, [buy]);

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => nameField.current?.focus(), 380);
    return () => clearTimeout(t);
  }, [isNew]);

  // The price can arrive from the link while the window is open.
  useEffect(() => {
    if (buy.price) setPrice((p) => (p ? p : typedAmount(String(buy.price))));
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
      <div className={`p-win-place buy-place${isNew ? ' is-new' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="buy-holder">
          <Badge3D shop={buy.shop} />
          <motion.div layoutId={morph} className="buy-win" style={{ borderRadius: 36 }} role="dialog" aria-modal="true" aria-label={buy.title || 'Покупка'} transition={MORPH}>
            <motion.div className="buy-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ delay: 0.1, duration: 0.3 }}>
              <button type="button" className="round-btn buy-close" aria-label="Закрыть" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>

              <motion.button type="button" className={`buy-stage${importing || cutting ? ' is-loading' : ''}`} onClick={() => file.current?.click()} aria-label="Загрузить своё фото" {...part(0)}>
                {url ? (
                  <img className={`buy-photo${buy.cut ? ' is-cut' : ''}`} src={url} alt="" />
                ) : (
                  <span className="buy-stage-empty">
                    <Icon name="photo" size={24} />
                    {importing || cutting ? 'Подбираю картинку' : 'Картинка появится сама'}
                  </span>
                )}
              </motion.button>
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />

              {!buy.url && (
                <motion.form
                  className="buy-link"
                  {...part(1)}
                  onSubmit={(e) => {
                    e.preventDefault();
                    useLink(link);
                  }}
                >
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onPaste={(e) => {
                      const v = e.clipboardData.getData('text');
                      if (firstUrl(v)) {
                        e.preventDefault();
                        useLink(v);
                      }
                    }}
                    placeholder="Вставь ссылку с Ozon"
                    aria-label="Ссылка на товар"
                    inputMode="url"
                    enterKeyHint="go"
                  />
                  {link.trim() ? (
                    <button type="submit" aria-label="Добавить по ссылке">
                      <Icon name="arrowRight" size={18} stroke={2.2} />
                    </button>
                  ) : (
                    canPaste && (
                      <button type="button" aria-label="Вставить из буфера" onClick={() => void pasteLink()}>
                        <Icon name="copy" size={18} />
                      </button>
                    )
                  )}
                </motion.form>
              )}

              <motion.label className="buy-price-row" {...part(1)}>
                <AmountInput
                  className="buy-price"
                  style={{ width: `${Math.max(price.length, 4) + 0.5}ch` }}
                  value={price}
                  placeholder="Цена"
                  aria-label="Цена в рублях"
                  onValue={(v) => {
                    setPrice(v);
                    set({ price: parseAmount(v) });
                  }}
                />
                <span>₽</span>
              </motion.label>
              <motion.input
                ref={nameField}
                className="buy-name"
                value={buy.title}
                placeholder="Название"
                aria-label="Название"
                maxLength={400}
                enterKeyHint={isNew ? 'done' : undefined}
                {...part(2)}
                onChange={(e) => set({ title: e.target.value })}
                onKeyDown={(e) => {
                  if (isNew && e.key === 'Enter') add();
                }}
              />

              <motion.div {...part(3)}>
                <CatPick value={buy.category ?? ''} onChange={(c) => set({ category: c || undefined })} />
              </motion.div>
              <GrowText value={buy.note ?? ''} placeholder="Описание" aria-label="Описание" {...part(4)} onChange={(e) => set({ note: e.target.value })} />
              <GrowText value={buy.why ?? ''} placeholder="Для чего" aria-label="Для чего" {...part(5)} onChange={(e) => set({ why: e.target.value })} />
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
                {!isNew && !blank && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      onClose();
                      openSheet('bought', { id: buy.id });
                    }}
                  >
                    Купил
                  </button>
                )}
                <button type="button" className={`scan-link${buy.pinned ? ' is-on' : ''}`} onClick={() => set({ pinned: buy.pinned ? undefined : Date.now() })}>
                  <Icon name="flag" size={18} />
                  {buy.pinned ? 'Убрать из важных' : 'В важные'}
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
      {/* Over the window, not at its far end: the fields below can take a long scroll to get past. */}
      {isNew && (
        <motion.button type="button" className="primary-btn buy-add" disabled={blank} initial={{ opacity: 0, y: 28 }} animate={{ opacity: blank ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, y: 28, transition: { duration: 0.22 } }} transition={{ delay: 0.15, duration: 0.45, ease: EASE }} whileTap={{ scale: 0.96 }} onClick={add}>
          Добавить
        </motion.button>
      )}
    </>
  );
}
