import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { EASE } from '../../app/ui/text';
import { actions, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { catIcon } from '../money/categories';
import { Recede } from '../Recede';
import { plural } from '../reminders';
import { BuyWindow } from './BuyWindow';
import { Dream, useImage } from './Dream';
import { addBuyFrom, takeShopLink, useImporting } from './importer';
import { splitBuys } from './logic';

export function Shop() {
  const buys = visible(useStore((s) => s.shared.buys));
  const [opened, setOpened] = useState<string | null>(null);
  const { main, rest } = splitBuys(buys);
  const open = buys.find((b) => b.id === opened && !b.boughtAt);

  // A link that came from the phone's share menu, at start or while the site is open.
  useEffect(() => {
    const take = () => {
      const id = takeShopLink();
      if (id) setOpened(id);
    };
    take();
    addEventListener('hashchange', take);
    return () => removeEventListener('hashchange', take);
  }, []);

  return (
    <>
      <motion.div className="budget shop" layoutScroll>
        <Dream />
        <section className="buys">
          <Recede from={2} delay={0.1} panel className="buys-head">
            <h2>Покупки</h2>
            <AddBar onAdded={setOpened} />
          </Recede>
          {!main.length && <p className="b-empty">Вставь ссылку с ВБ, Озона или Авито, и карточка заполнится сама</p>}
          <ul className="buy-grid">
            {main.map((b, i) => (
              <BuyTile key={b.id} buy={b} index={i} hidden={b.id === opened} onOpen={() => setOpened(b.id)} />
            ))}
          </ul>
          {rest.length > 0 && (
            <>
              <div className="buys-more">
                <motion.span animate={{ y: [0, 5, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'grid' }}>
                  <Icon name="down" size={18} stroke={2.2} />
                </motion.span>
                Потяни вниз: ещё {rest.length} {plural(rest.length, ['покупка', 'покупки', 'покупок'])}
              </div>
              <ul className="buy-grid">
                {rest.map((b, i) => (
                  <BuyTile key={b.id} buy={b} index={i} inView hidden={b.id === opened} onOpen={() => setOpened(b.id)} />
                ))}
              </ul>
            </>
          )}
        </section>
      </motion.div>
      {createPortal(<AnimatePresence>{open && <BuyWindow key={open.id} buy={open} onClose={() => setOpened(null)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function AddBar({ onAdded }: { onAdded: (id: string) => void }) {
  const [text, setText] = useState('');
  const canPaste = typeof navigator.clipboard?.readText === 'function';

  const add = (value: string) => {
    const id = addBuyFrom(value);
    if (id) onAdded(id);
    setText('');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add(text);
  };
  const paste = async () => {
    try {
      add(await navigator.clipboard.readText());
    } catch {
      /* the browser said no: the field is right there to paste into */
    }
  };

  return (
    <form className="add-bar" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => { const v = e.clipboardData.getData('text'); if (/https?:\/\//i.test(v)) { e.preventDefault(); add(v); } }} placeholder="Ссылка на товар или название" aria-label="Ссылка на товар или название" enterKeyHint="go" />
      {text.trim() ? (
        <button type="submit" aria-label="Добавить">
          <Icon name="arrowRight" size={18} stroke={2.2} />
        </button>
      ) : (
        canPaste && (
          <button type="button" aria-label="Вставить из буфера" onClick={() => void paste()}>
            <Icon name="copy" size={18} />
          </button>
        )
      )}
    </form>
  );
}

function BuyTile({ buy, index, inView = false, hidden, onOpen }: { buy: Buy; index: number; inView?: boolean; hidden: boolean; onOpen: () => void }) {
  const url = useImage(buy.imgId);
  const importing = useImporting(buy.id);
  const { cur, rate } = useCurrency();
  const pin = () => actions.updateBuy(buy.id, { pinned: buy.pinned ? undefined : Date.now() });
  const show = { opacity: 1, y: 0, scale: 1 };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 26, scale: 0.94 }}
      {...(inView ? { whileInView: show, viewport: { once: true, amount: 0.2 } } : { animate: show })}
      transition={{ delay: inView ? 0.04 : 0.2 + index * 0.06, duration: 0.7, ease: EASE }}
      className="buy-cell"
    >
      <motion.button layoutId={`buy-${buy.id}`} type="button" className={`glass buy-tile${importing ? ' is-loading' : ''}`} style={{ borderRadius: 32, visibility: hidden ? 'hidden' : undefined }} onClick={onOpen} whileTap={{ scale: 0.97 }}>
        <span className="buy-tile-cat">{buy.category || buy.shop || 'Покупка'}</span>
        <strong className="buy-tile-name">{buy.title || 'Без названия'}</strong>
        <span className="buy-tile-price">{buy.price ? formatMoney(buy.price, cur, rate) : 'Цена?'}</span>
        <span className="buy-tile-pic">
          {url ? <img src={url} alt="" loading="lazy" /> : <Icon name={catIcon(buy.category ?? '') === 'flag' ? 'bag' : catIcon(buy.category ?? '')} size={44} stroke={1.3} />}
        </span>
      </motion.button>
      <motion.button type="button" className={`buy-pin${buy.pinned ? ' is-on' : ''}`} aria-label={buy.pinned ? 'Убрать с главной' : 'Вынести на главную'} aria-pressed={!!buy.pinned} onClick={pin} whileTap={{ scale: 0.82 }}>
        <Icon name="flag" size={17} stroke={2} />
      </motion.button>
    </motion.li>
  );
}
