import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { EASE } from '../../app/ui/text';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { openSheet } from '../../app/sheet';
import { actions } from '../../lib/appStore';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { AmountInput } from '../AmountInput';
import { fullDate, parseAmount, typedAmount } from '../money/data';
import { CatPick, DateField } from '../money/sheets';
import { Badge3D } from './Badge3D';
import { BuyArt } from './BuyArt';
import { generatePicture, needsPicture, usePictureStatus } from './productPictures';
import { linkInto, setBuyPicture, useImporting } from './importer';
import { firstUrl } from './link';
import { isBlankBuy } from './logic';
import { pulseWave } from '../Wave';
import { blur } from '../../app/ui/device';
import { useGone } from '../gone';
import { deleteBuyUndoable } from './buyActions';

const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

const part = (i: number) => ({
  initial: { opacity: 0, y: 12, ...blur(6) },
  animate: { opacity: 1, y: 0, ...blur(0) },
  transition: { delay: 0.14 + i * 0.04, duration: 0.5, ease: EASE },
});

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

export function BuyWindow({ buy, morph, isNew = false, onClose }: { buy: Buy; morph: string; isNew?: boolean; onClose: () => void }) {
  const importing = useImporting(buy.id);
  const pictureStatus = usePictureStatus(buy.id);
  const [editing, setEditing] = useState(isNew);
  const { cur, rate } = useCurrency();
  const [price, setPrice] = useState(buy.price ? typedAmount(String(buy.price)) : '');
  const gone = useGone(morph);
  const [cutting, setCutting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const canPaste = typeof navigator.clipboard?.readText === 'function';
  const [invalidLink, setInvalidLink] = useState(false);
  const useLink = (text: string) => {
    const url = firstUrl(text);
    if (!url) {
      setInvalidLink(true);
      return;
    }
    linkInto(buy.id, url);
    setInvalidLink(false);
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
    void generatePicture(buy.id);
    pulseWave();
    onClose();
  };

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

  const productLink = firstUrl(buy.url);
  const showImportHelp = !!productLink && !importing && (!buy.price || !buy.note || !buy.title || buy.title === buy.shop);
  const importStatus = importing ? 'Загружаю данные товара…' : showImportHelp ? 'Магазин передал не все данные. Их можно дописать вручную или импортировать из открытой карточки через «Поделиться».' : '';

  return (
    <>
      <motion.div className="sheet-scrim p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      {/* This layer scrolls a long window, so it takes the tap on the empty space around it from the scrim below. */}
      <div className={`p-win-place buy-place${isNew ? ' is-new' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="buy-holder">
          <Badge3D shop={buy.shop} />
          <motion.div layoutId={gone.layoutId} exit={gone.exit} className="buy-win" style={{ borderRadius: 36 }} role="dialog" aria-modal="true" aria-label={buy.title || 'Покупка'} transition={MORPH}>
            <motion.div className="buy-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ delay: 0.1, duration: 0.3 }}>
              <button type="button" className="round-btn buy-close" aria-label="Закрыть" onClick={onClose}>
                <Icon name="close" size={18} />
              </button>

              <motion.button type="button" className={`buy-stage${cutting ? ' is-loading' : ''}`} onClick={() => file.current?.click()} aria-label="Загрузить своё фото" {...part(0)}>
                <BuyArt buy={buy} />
              </motion.button>
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />

              {!editing && (
                <motion.div className="buy-details" {...part(1)}>
                  <h2>{buy.title || 'Без названия'}</h2>
                  <p className="buy-detail-price">{buy.price > 0 ? formatMoney(buy.price, cur, rate) : 'Цена не указана'}</p>
                  {(buy.category || buy.due || buy.pinned) && (
                    <div className="buy-detail-meta">
                      {buy.category && <span>{buy.category}</span>}
                      {buy.due && <span>До {fullDate(buy.due)}</span>}
                      {buy.pinned && <span>Важная</span>}
                    </div>
                  )}
                  {buy.note && <p className="buy-description">{buy.note}</p>}
                  {buy.why && <p className="buy-description"><strong>Для чего</strong><br />{buy.why}</p>}
                  {productLink && <a className="scan-link" href={productLink} target="_blank" rel="noreferrer"><Icon name="link" size={18} />{buy.shop ? `Открыть на ${buy.shop}` : 'Открыть в магазине'}</a>}
                  <button type="button" className="primary-btn" onClick={() => { onClose(); openSheet('bought', { id: buy.id }); }}>Отметить купленной</button>
                  <button type="button" className="scan-link" onClick={() => setEditing(true)}>Редактировать</button>
                </motion.div>
              )}
              {importStatus && <p className="buy-import-status" role="status">{importStatus}</p>}
              {showImportHelp && <button type="button" className="scan-link" onClick={() => { onClose(); openSheet('shopShare'); }}>Как импортировать через «Поделиться»</button>}
              {needsPicture(buy) && (
                <div className="buy-import-status">
                  {pictureStatus === 'pending' ? <span role="status">AI Horde готовит изображение по названию товара</span> :
                    <button type="button" className="scan-link" onClick={() => void generatePicture(buy.id)}>
                      {pictureStatus === 'error' ? 'Повторить генерацию в AI Horde' : 'Создать изображение в AI Horde'}
                    </button>}
                </div>
              )}

              {editing && <>
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
                    onChange={(e) => { setLink(e.target.value); setInvalidLink(false); }}
                    onPaste={(e) => {
                      const v = e.clipboardData.getData('text');
                      if (firstUrl(v)) {
                        e.preventDefault();
                        useLink(v);
                      }
                    }}
                    placeholder={productLink ? 'Заменить ссылку' : 'Ссылка с Ozon, WB, Авито…'}
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
                {isNew && !productLink && !buy.title.trim() && <p className="buy-import-status">Для товаров без готового изображения AI Horde получает название и создаёт иллюстрацию.</p>}
                {invalidLink && <p className="buy-import-status" role="alert">Вставь ссылку на товар целиком</p>}

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

              {productLink && (
                <motion.a className="scan-link" href={productLink} target="_blank" rel="noreferrer" {...part(7)}>
                  <Icon name="link" size={18} />
                  Открыть {buy.shop ? `на ${buy.shop}` : 'ссылку'}
                </motion.a>
              )}

              <motion.div className="buy-actions" {...part(8)}>
                <button type="button" className={`scan-link${buy.pinned ? ' is-on' : ''}`} onClick={() => set({ pinned: buy.pinned ? undefined : Date.now() })}>
                  <Icon name="flag" size={18} />
                  {buy.pinned ? 'Убрать из важных' : 'В важные'}
                </button>
              </motion.div>

              {/* One tap: «Отменить» comes up over the tab bar instead of asking twice. */}
              <button type="button" className="p-delete" onClick={() => gone.leave(() => {
                deleteBuyUndoable(buy);
                onClose();
              })}>
                Удалить
              </button>
              {!isNew && <button type="button" className="primary-btn" onClick={() => { void generatePicture(buy.id); setEditing(false); }}>Готово</button>}
              </>}
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
