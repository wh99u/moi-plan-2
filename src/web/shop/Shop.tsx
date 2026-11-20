import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { openSheet } from '../../app/sheet';
import { actions, appStore, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { BuyArt } from './BuyArt';
import { BuyWindow } from './BuyWindow';
import { takeShopLink, useImporting } from './importer';
import { activeBuys, isBlankBuy, splitBuys } from './logic';
import './catalog.css';

interface Opened {
  id: string;
  morph: string;
  isNew?: boolean;
}

const PLUS = 'buy-plus';

export function Shop() {
  const buys = activeBuys(visible(useStore((s) => s.shared.buys)));
  const [opened, setOpened] = useState<Opened | null>(null);
  const [category, setCategory] = useState('');
  const open = buys.find((b) => b.id === opened?.id);
  const shown = buys.filter((b) => !isBlankBuy(b));
  const { main } = splitBuys(shown);
  const categories = Array.from(new Set(shown.flatMap((b) => b.category ? [b.category] : [])));
  const picked = categories.includes(category) ? category : '';
  const matches = picked ? shown.filter((b) => b.category === picked) : shown;

  useEffect(() => {
    activeBuys(visible(appStore.get().shared.buys)).filter(isBlankBuy).forEach((buy) => actions.deleteBuy(buy.id));
    const take = () => {
      const id = takeShopLink();
      if (id) setOpened({ id, morph: `link-${id}` });
    };
    take();
    addEventListener('hashchange', take);
    return () => removeEventListener('hashchange', take);
  }, []);

  const add = () => setOpened({ id: actions.addBuy({ title: '', url: '', price: 0 }).id, morph: PLUS, isNew: true });
  const close = () => {
    setOpened(null);
    if (open && isBlankBuy(open)) actions.deleteBuy(open.id);
  };

  return (
    <motion.div className="budget purchase-page" layoutScroll>
      <section className="purchase-feature" aria-label="Важные покупки">
        {main.length > 0 ? (
          <Featured buys={main} opened={opened} onOpen={setOpened} />
        ) : (
          <button type="button" className="purchase-empty" onClick={add}>
            <span className="purchase-empty-icon"><Icon name="bag" size={42} stroke={1.25} /></span>
            <strong>Первая покупка</strong>
            <span>Добавь товар по названию или ссылке</span>
            <span className="purchase-round"><Icon name="plus" size={22} /></span>
          </button>
        )}
      </section>

      <section className="purchase-catalog" aria-labelledby="purchase-catalog-title">
        <header className="purchase-heading">
          <h2 id="purchase-catalog-title">Все покупки</h2>
          <div className="purchase-tools">
            <button type="button" className="purchase-round purchase-round--quiet" aria-label="Импорт через «Поделиться»" onClick={() => openSheet('shopShare')}><Icon name="link" size={20} /></button>
            <motion.button layoutId={PLUS} type="button" className="purchase-round" aria-label="Добавить покупку" onClick={add}><Icon name="plus" size={23} /></motion.button>
          </div>
        </header>
        {categories.length > 0 && (
          <div className="purchase-filters" role="group" aria-label="Категории покупок">
            <button type="button" aria-pressed={!picked} onClick={() => setCategory('')}>Все</button>
            {categories.map((c) => <button key={c} type="button" aria-pressed={picked === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
        )}
        {matches.length ? (
          <ul className="purchase-grid">
            {matches.map((buy) => <li key={buy.id}><ProductCard buy={buy} morph={`catalog-${buy.id}`} onOpen={setOpened} /></li>)}
          </ul>
        ) : <p className="purchase-none">Здесь появятся твои покупки</p>}
      </section>
      {createPortal(
        <AnimatePresence>
          {open && opened && <BuyWindow key={open.id} buy={open} morph={opened.morph} isNew={opened.isNew} onClose={close} />}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}

function Featured({ buys, opened, onOpen }: { buys: Buy[]; opened: Opened | null; onOpen: (o: Opened) => void }) {
  const list = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState(0);
  const reduceMotion = useReducedMotion();
  const index = Math.min(position, buys.length - 1);

  const go = (i: number) => {
    const el = list.current;
    const card = el?.children.item(i);
    if (!el || !card) return;
    const delta = card.getBoundingClientRect().left + card.clientWidth / 2 - el.getBoundingClientRect().left - el.clientWidth / 2;
    el.scrollTo({ left: el.scrollLeft + delta, behavior: reduceMotion ? 'instant' : 'smooth' });
  };

  return (
    <>
      <motion.ul
        ref={list}
        className="purchase-reel"
        layoutScroll
        onScroll={(e) => {
          const el = e.currentTarget;
          const first = el.children.item(0);
          const second = el.children.item(1);
          if (!first || !second) return;
          const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
          if (step > 0) setPosition(Math.round(Math.max(0, el.scrollLeft) / step));
        }}
      >
        {buys.map((buy, i) => (
          <li key={buy.id} data-current={i === index}>
            <ProductCard buy={buy} morph={`featured-${buy.id}`} featured onOpen={onOpen} covered={opened?.morph === `featured-${buy.id}`} />
          </li>
        ))}
      </motion.ul>
      {buys.length > 1 && (
        <div className="purchase-pager">
          <button type="button" aria-label="Предыдущая покупка" disabled={index === 0} onClick={() => go(index - 1)}><Icon name="arrowRight" size={17} /></button>
          {buys.map((buy, i) => <button key={buy.id} type="button" className="purchase-dot" aria-label={buy.title || `Покупка ${i + 1}`} aria-current={index === i ? 'true' : undefined} onClick={() => go(i)} />)}
          <button type="button" aria-label="Следующая покупка" disabled={index === buys.length - 1} onClick={() => go(index + 1)}><Icon name="arrowRight" size={17} /></button>
        </div>
      )}
    </>
  );
}

function ProductCard({ buy, featured = false, covered = false, morph, onOpen }: {
  buy: Buy;
  featured?: boolean;
  covered?: boolean;
  morph: string;
  onOpen: (o: Opened) => void;
}) {
  const { cur, rate } = useCurrency();
  const busy = useImporting(buy.id);
  const name = buy.title.trim() || 'Без названия';
  return (
    <motion.button
      layoutId={morph}
      type="button"
      className={`purchase-card ${featured ? 'purchase-card--hero' : 'purchase-card--tile'}`}
      style={covered ? { visibility: 'hidden' } : undefined}
      onClick={() => onOpen({ id: buy.id, morph })}
    >
      <span className="purchase-card-copy">
        {(buy.category || buy.shop) && <span className="purchase-card-category">{buy.category || buy.shop}</span>}
        <strong>{name}</strong>
        <span className="purchase-card-price">{buy.price > 0 ? formatMoney(buy.price, cur, rate) : busy ? 'Импорт…' : 'Цена не указана'}</span>
      </span>
      <BuyArt buy={buy} />
      <span className="purchase-card-open" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
    </motion.button>
  );
}
