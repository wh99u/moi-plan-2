import { AnimatePresence, LayoutGroup, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { closeSheet, openSheet, useSheet } from '../../app/sheet';
import { actions, appStore, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Swipe } from '../Swipe';
import { BuyWindow } from './BuyWindow';
import { buyNow, buysAtOnce, deleteBuyUndoable } from './buyActions';
import { Dream, DreamBackdrop, useImage } from './Dream';
import { buyPhotoId, refreshBuyPhoto, takeShopLink, useImporting } from './importer';
import { activeBuys, isBlankBuy, splitBuys } from './logic';
import './purchases.css';

export function Shop() {
  const buys = activeBuys(visible(useStore((s) => s.shared.buys)));
  const [opened, setOpened] = useState<{ id: string; isNew?: boolean }>();
  const screen = useRef<HTMLDivElement>(null);
  const dream = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: screen, target: dream, offset: ['start end', 'start start'] });
  const photoOpacity = useTransform(scrollYProgress, [0.05, 0.95], [0, 1]);
  const photoScale = useTransform(scrollYProgress, [0, 1], [1.05, 1]);
  const sheet = useSheet();
  const open = buys.find((buy) => buy.id === opened?.id);
  const { main, rest } = splitBuys(buys.filter((buy) => !isBlankBuy(buy)));
  const add = () => setOpened({ id: actions.addBuy({ title: '', url: '', price: 0 }).id, isNew: true });

  useEffect(() => {
    const list = activeBuys(visible(appStore.get().shared.buys));
    for (const buy of list) {
      if (isBlankBuy(buy)) actions.deleteBuy(buy.id);
    }
    const take = () => {
      const id = takeShopLink();
      if (id) setOpened({ id });
    };
    take();
    addEventListener('hashchange', take);
    return () => removeEventListener('hashchange', take);
  }, []);

  useEffect(() => {
    if (sheet !== 'shopAdd') return;
    closeSheet();
    add();
  }, [sheet]);

  const close = () => {
    setOpened(undefined);
    if (open && isBlankBuy(open)) actions.deleteBuy(open.id);
  };
  const onOpen = (id: string) => setOpened({ id });

  return (
    <LayoutGroup>
      <motion.div ref={screen} className="budget purchases" layoutScroll>
        <DreamBackdrop opacity={photoOpacity} scale={photoScale} />
        <section className="purchases-content">
          <header className="purchases-heading">
            <h1>Покупки</h1>
            <button type="button" className="purchases-round" aria-label="Импорт через «Поделиться»" onClick={() => openSheet('shopShare')}><Icon name="link" size={20} /></button>
          </header>
          <Featured buys={main} opened={open?.id} onOpen={onOpen} />
          <section className="purchases-catalog" aria-labelledby="purchases-remaining">
            <h2 id="purchases-remaining">Остальные покупки</h2>
            {rest.length ? (
              <motion.ul className="purchases-grid" layout>
                <AnimatePresence initial={false}>
                  {rest.map((buy) => <PurchaseCard key={buy.id} buy={buy} opened={open?.id} onOpen={onOpen} />)}
                </AnimatePresence>
              </motion.ul>
            ) : <p className="purchases-empty">Здесь появятся покупки без закрепа</p>}
          </section>
        </section>
        <div ref={dream} className="dreamx-place">
          <Dream contentOpacity={photoOpacity} />
        </div>
      </motion.div>
      {createPortal(
        <AnimatePresence>
          {open && <BuyWindow key={open.id} buy={open} morph={`purchase-${open.id}`} isNew={opened?.isNew} onClose={close} />}
        </AnimatePresence>, document.body,
      )}
    </LayoutGroup>
  );
}

function Featured({ buys, opened, onOpen }: { buys: Buy[]; opened?: string; onOpen: (id: string) => void }) {
  const reel = useRef<HTMLUListElement>(null);
  const calm = useReducedMotion();
  const [at, setAt] = useState(0);
  const count = buys.length;

  const measure = () => {
    const list = reel.current;
    if (!list) return;
    const mid = list.scrollLeft + list.clientWidth / 2;
    let closest = 0;
    let min = Infinity;
    Array.from(list.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement)) return;
      const distance = (child.offsetLeft + child.offsetWidth / 2 - mid) / child.offsetWidth;
      child.style.setProperty('--offset', String(Math.max(-1, Math.min(1, distance))));
      child.style.setProperty('--distance', String(Math.min(1, Math.abs(distance))));
      if (Math.abs(distance) < min) { closest = index; min = Math.abs(distance); }
    });
    setAt(closest);
  };

  useLayoutEffect(() => {
    if (!reel.current) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(reel.current);
    return () => observer.disconnect();
  }, [count]);

  const go = (index: number) => {
    const list = reel.current;
    const card = list?.children[index] as HTMLElement | undefined;
    if (!list || !card) return;
    list.scrollTo({ left: card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2, behavior: calm ? 'instant' : 'smooth' });
  };

  return (
    <section aria-labelledby="purchases-featured">
      <div className="purchases-subhead">
        <h2 id="purchases-featured">Главные покупки</h2>
        {count > 1 && <div className="purchases-arrows">
          <button type="button" className="purchases-round" disabled={at === 0} aria-label="Предыдущая покупка" onClick={() => go(at - 1)}><Icon name="back" size={17} /></button>
          <button type="button" className="purchases-round" disabled={at === count - 1} aria-label="Следующая покупка" onClick={() => go(at + 1)}><Icon name="chevron" size={17} /></button>
        </div>}
      </div>
      {count ? (
        <motion.ul ref={reel} layoutScroll className="purchases-reel" onScroll={measure} tabIndex={count > 1 ? 0 : undefined}
          aria-label="Карусель главных покупок" onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            go(at + (event.key === 'ArrowLeft' ? -1 : 1));
          }}>
          {buys.map((buy) => <PurchaseCard key={buy.id} buy={buy} hero opened={opened} onOpen={onOpen} />)}
        </motion.ul>
      ) : <div className="purchases-feature-empty"><Icon name="pin" size={27} /><p>Закрепи покупку, чтобы она появилась здесь</p></div>}
    </section>
  );
}

function PurchaseCard({ buy, hero, opened, onOpen }: { buy: Buy; hero?: boolean; opened?: string; onOpen: (id: string) => void }) {
  const photo = useImage(buyPhotoId(buy));
  const importing = useImporting(buy.id);
  const { cur, rate } = useCurrency();
  const name = buy.title || 'Без названия';
  useEffect(() => {
    if (!buyPhotoId(buy) && buy.url) void refreshBuyPhoto(buy);
  }, [buy.id, buy.url, buy.imgId, buy.autoPic, buy.photoFrom, buy.icon]);
  const tile = (
    <article className={`purchase-tile${photo ? ' has-photo' : ''}`}>
        <motion.button layoutId={`purchase-${buy.id}`} type="button" className="purchase-open" style={{ borderRadius: 30, visibility: opened === buy.id ? 'hidden' : undefined }}
          onClick={() => onOpen(buy.id)} whileTap={{ scale: 0.985 }}>
          {photo ? <img className={buy.cut ? 'is-cut' : undefined} src={photo} alt="" draggable={false} /> :
            <span className="purchase-placeholder" aria-hidden="true"><Icon name="photo" size={32} stroke={1.25} />{importing && 'Загружаю фото'}</span>}
          <span className="purchase-copy">
            {(buy.category || buy.shop) && <small>{buy.category || buy.shop}</small>}
            <strong>{name}</strong>
            {buy.price > 0 && <span>{formatMoney(buy.price, cur, rate)}</span>}
          </span>
        </motion.button>
        <motion.button type="button" className="purchase-pin" aria-label={`${buy.pinned ? 'Открепить' : 'Закрепить'} «${name}»`} aria-pressed={!!buy.pinned}
          whileTap={{ scale: 0.83 }} onClick={() => actions.updateBuy(buy.id, { pinned: buy.pinned ? undefined : Date.now() })}>
          <Icon name="pin" size={17} />
        </motion.button>
    </article>
  );
  return (
    <motion.li className={hero ? 'purchase-slot is-hero' : 'purchase-slot is-tile'} layout="position">
      {hero ? tile : <Swipe compact radius={30}
        right={{ label: 'Куплено', icon: 'check', tone: 'buy', away: buysAtOnce(buy), run: () => buyNow(buy) }}
        left={{ label: 'Удалить', icon: 'trash', tone: 'del', away: true, run: () => deleteBuyUndoable(buy) }}>
        {tile}
      </Swipe>}
    </motion.li>
  );
}
