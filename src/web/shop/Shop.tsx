import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { actions, appStore, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { BuyArt } from './BuyArt';
import { BuyWindow } from './BuyWindow';
import { takeShopLink } from './importer';
import { activeBuys, isBlankBuy, splitBuys } from './logic';
import { generatePicture } from './productPictures';
import './catalog.css';

interface Opened { id: string; morph: string; isNew?: boolean }
type Open = (value: Opened) => void;

function Header({ subtitle, onAdd, query, onQuery }: {
  subtitle: string; onAdd: () => void; query: string; onQuery: (text: string) => void;
}) {
  const [searching, setSearching] = useState(false);
  const toggle = () => {
    onQuery('');
    setSearching(!searching);
  };
  return (
    <header className="shop-heading">
      <div><h2>Покупки</h2><p>{subtitle}</p></div>
      <div className="shop-tools">
        <button type="button" aria-label={searching ? 'Закрыть поиск' : 'Найти покупку'} aria-expanded={searching} onClick={toggle}><Icon name={searching ? 'close' : 'search'} size={19} /></button>
        <button type="button" aria-label="Добавить покупку" onClick={onAdd}><Icon name="plus" size={22} /></button>
      </div>
      {searching && <input autoFocus type="search" className="shop-search" aria-label={`Поиск — ${subtitle}`} placeholder="Найти покупку" value={query} onChange={e => onQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') toggle(); }} />}
    </header>
  );
}

export function Shop() {
  const buys = activeBuys(visible(useStore(s => s.shared.buys)));
  const [opened, setOpened] = useState<Opened | null>(null);
  const [mainQuery, setMainQuery] = useState('');
  const [restQuery, setRestQuery] = useState('');
  const [category, setCategory] = useState('');
  const open = buys.find(b => b.id === opened?.id);
  const { main, rest } = splitBuys(buys.filter(b => !isBlankBuy(b)));
  const categories = Array.from(new Set(rest.flatMap(b => b.category ? [b.category] : [])));
  const selected = categories.includes(category) ? category : '';
  const matches = (buy: Buy, query: string) => [buy.title, buy.shop, buy.category].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const featured = main.filter(b => matches(b, mainQuery));
  const remaining = rest.filter(b => (!selected || b.category === selected) && matches(b, restQuery));
  const catalog = useRef<HTMLElement>(null);

  useEffect(() => {
    for (const buy of activeBuys(visible(appStore.get().shared.buys))) {
      if (isBlankBuy(buy)) actions.deleteBuy(buy.id);
      else void generatePicture(buy.id, true);
    }
    const take = () => {
      const id = takeShopLink();
      if (id) setOpened({ id, morph: `link-${id}` });
    };
    take();
    addEventListener('hashchange', take);
    return () => removeEventListener('hashchange', take);
  }, []);

  const add = () => setOpened({ id: actions.addBuy({ title: '', url: '', price: 0 }).id, morph: 'purchase-add', isNew: true });
  const close = () => {
    setOpened(null);
    if (open && isBlankBuy(open)) actions.deleteBuy(open.id);
  };

  return (
    <motion.div className="budget purchase-page" layoutScroll>
      <section className="shop-screen shop-feature" aria-label="Главные покупки">
        <Header subtitle="Главные" onAdd={add} query={mainQuery} onQuery={setMainQuery} />
        {featured.length ? <Reel key={featured.map(b => b.id).join('/')} buys={featured} onOpen={setOpened} /> :
          <p className="shop-empty">{mainQuery ? 'Покупки не найдены' : 'Здесь появятся твои покупки'}</p>}
        <button type="button" className="shop-to-rest" onClick={() => catalog.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Все покупки</button>
      </section>
      <section className="shop-screen shop-catalog" ref={catalog} aria-label="Остальные покупки">
        <Header subtitle="Остальное" onAdd={add} query={restQuery} onQuery={setRestQuery} />
        {categories.length > 0 && <div className="shop-categories" role="group" aria-label="Категории">
          {['', ...categories].map(c => <button key={c} type="button" aria-pressed={c === selected} onClick={() => setCategory(c)}>{c || 'Все'}</button>)}
        </div>}
        {remaining.length ? <ul className="purchase-grid">{remaining.map(b => <li key={b.id}><Card buy={b} morph={`catalog-${b.id}`} onOpen={setOpened} /></li>)}</ul> :
          <p className="shop-empty">{restQuery ? 'Покупки не найдены' : 'Здесь появятся твои покупки'}</p>}
      </section>
      {createPortal(<AnimatePresence>{open && opened && <BuyWindow key={open.id} buy={open} morph={opened.morph} isNew={opened.isNew} onClose={close} />}</AnimatePresence>, document.body)}
    </motion.div>
  );
}

function Reel({ buys, onOpen }: { buys: Buy[]; onOpen: Open }) {
  const list = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const count = buys.length;
  const loop = count > 1;
  const cards = loop ? [...buys, ...buys, ...buys] : buys;
  const step = () => {
    const children = list.current?.children;
    if (!children || children.length < 2) return 0;
    return children[1].getBoundingClientRect().left - children[0].getBoundingClientRect().left;
  };
  useLayoutEffect(() => {
    const el = list.current!;
    if (!loop) return;
    const center = () => { el.scrollLeft = count * step(); };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(el);
    let timer = 0;
    const normalize = () => {
      if (drag.current?.moved) return;
      const width = step();
      if (!width) return;
      const index = Math.round(el.scrollLeft / width);
      if (index < count || index >= count * 2) el.scrollLeft = (count + index % count) * width;
    };
    const moved = () => { clearTimeout(timer); timer = window.setTimeout(normalize, 150); };
    el.addEventListener('scroll', moved, { passive: true });
    return () => { clearTimeout(timer); observer.disconnect(); el.removeEventListener('scroll', moved); };
  }, [count, loop]);
  return (
    <ul ref={list} className="shop-reel" aria-label="Карусель главных покупок" tabIndex={loop ? 0 : undefined}
      onPointerDown={e => {
        suppressClick.current = false;
        if (loop && e.pointerType === 'mouse' && e.button === 0) drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={e => {
        const start = drag.current;
        if (!start || !e.buttons) return;
        const distance = start.x - e.clientX;
        if (!start.moved && Math.abs(distance) < 5) return;
        start.moved = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.style.scrollSnapType = 'none';
        e.currentTarget.scrollLeft = start.left + distance;
      }}
      onPointerUp={e => {
        if (drag.current?.moved) {
          suppressClick.current = true;
          const width = step();
          const target = Math.round(e.currentTarget.scrollLeft / width) * width;
          e.currentTarget.style.scrollSnapType = '';
          e.currentTarget.scrollTo({ left: target });
        }
        drag.current = null;
      }}
      onPointerCancel={e => { drag.current = null; e.currentTarget.style.scrollSnapType = ''; }}
      onClickCapture={e => {
        if (suppressClick.current) { e.stopPropagation(); suppressClick.current = false; }
      }}
      onKeyDown={e => {
        if (!loop || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        list.current?.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * step() });
      }}
      onWheel={e => { if (e.shiftKey && !e.deltaX) list.current?.scrollBy({ left: e.deltaY }); }}>
      {cards.map((buy, index) => {
        const clone = loop && (index < count || index >= count * 2);
        return <li key={`${index}-${buy.id}`} aria-hidden={clone || undefined}><Card buy={buy} morph={`featured-${index}-${buy.id}`} hero clone={clone} onOpen={onOpen} /></li>;
      })}
    </ul>
  );
}

function Card({ buy, morph, hero, clone, onOpen }: { buy: Buy; morph: string; hero?: boolean; clone?: boolean; onOpen: Open }) {
  const { cur, rate } = useCurrency();
  return (
    <motion.button type="button" layoutId={morph} tabIndex={clone ? -1 : undefined} className={`shop-product ${hero ? 'is-hero' : 'is-tile'}`} style={{ borderRadius: 32 }} onClick={() => onOpen({ id: buy.id, morph })}>
      <BuyArt buy={buy} />
      <span className="shop-product-copy">
        {(buy.category || buy.shop) && <small>{buy.category || buy.shop}</small>}
        <strong>{buy.title || 'Без названия'}</strong>
        <span>{buy.price ? formatMoney(buy.price, cur, rate) : 'Цена не указана'}</span>
      </span>
    </motion.button>
  );
}
