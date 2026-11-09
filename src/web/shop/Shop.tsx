import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, useCurrency } from '../../app/money/currency';
import { openSheet } from '../../app/sheet';
import { LOW } from '../../app/ui/device';
import { EASE } from '../../app/ui/text';
import { actions, appStore, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Buy } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { catIcon } from '../money/categories';
import { Recede } from '../Recede';
import { BuyWindow } from './BuyWindow';
import { Dream, DreamBackdrop, useImage } from './Dream';
import { autoPicture, takeShopLink, useImporting, wantsPicture } from './importer';
import { activeBuys, flickReachesDream, isBlankBuy, MAIN_COUNT, splitBuys } from './logic';
import { buyNow, buysAtOnce, deleteBuyUndoable } from './buyActions';
import { Swipe } from './Swipe';

/** Which purchase is open, and the thing on screen its window grows out of and returns to. */
interface Opened {
  id: string;
  morph: string;
  isNew?: boolean;
}

const PLUS = 'buy-plus';

export function Shop() {
  const buys = visible(useStore((s) => s.shared.buys));
  const [opened, setOpened] = useState<Opened | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dream = useRef<HTMLDivElement>(null);
  // From the dream's top edge at the bottom of the screen (0) to it filling the screen (1).
  const { scrollYProgress: toward } = useScroll({ container: scroller, target: dream, offset: ['start end', 'start start'] });
  const pageOpacity = useTransform(toward, [0, 0.6], [1, 0]);
  // On a phone only the fade: scaling the whole page on every step of a scroll costs too much.
  const pageScale = useTransform(toward, [0, 1], [1, LOW ? 1 : 0.94]);
  const photoOpacity = useTransform(toward, [0.05, 0.85], [0, 1]);
  const photoScale = useTransform(toward, [0, 1], [LOW ? 1 : 1.12, 1]);
  const dreamOpacity = useTransform(toward, [0.4, 1], [0, 1]);
  const open = buys.find((b) => b.id === opened?.id && !b.boughtAt);
  const shown = buys.filter((b) => !(b.id === opened?.id && isBlankBuy(b)));
  const { main, rest } = splitBuys(shown);

  // A link that came from the phone's share menu, at start or while the site is open.
  useEffect(() => {
    const take = () => {
      const id = takeShopLink();
      if (id) setOpened({ id, morph: `link-${id}` });
    };
    take();
    addEventListener('hashchange', take);
    return () => removeEventListener('hashchange', take);
  }, []);

  // What was left blank when the page was closed goes; whatever has a name and no picture gets one, in turn.
  useEffect(() => {
    const list = activeBuys(visible(appStore.get().shared.buys));
    list.filter(isBlankBuy).forEach((b) => actions.deleteBuy(b.id));
    void (async () => {
      for (const b of list.filter(wantsPicture)) await autoPicture(b.id);
    })();
  }, []);

  const addNew = (morph: string) => setOpened({ id: actions.addBuy({ title: '', url: '', price: 0 }).id, morph, isNew: true });
  const close = () => {
    setOpened(null);
    if (open && isBlankBuy(open)) actions.deleteBuy(open.id);
    else if (open) void autoPicture(open.id);
  };
  const toDream = () => scroller.current?.scrollTo({ top: dream.current?.offsetTop ?? 0, behavior: 'smooth' });

  // With little of the list left below, one flick is enough: it goes on to the dream instead of stopping at the end of the list.
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    let from: { y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      from = e.touches.length === 1 ? { y: e.touches[0].clientY, t: e.timeStamp } : null;
    };
    const onEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!from || !touch) return;
      if (flickReachesDream(from.y - touch.clientY, e.timeStamp - from.t, el.scrollHeight - el.clientHeight - el.scrollTop, el.clientHeight)) toDream();
      from = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  return (
    <>
      <motion.div ref={scroller} className="budget shop" layoutScroll>
        <DreamBackdrop opacity={photoOpacity} scale={photoScale} />

        <motion.section className="buys" style={{ opacity: pageOpacity, scale: pageScale, transformOrigin: '50% 100%' }}>
          {/* The list scrolls inside its own page; past its end the next swipe carries on to the dream. */}
          <motion.div ref={list} className="buys-scroll" layoutScroll>
          <Recede from={2.2} className="mains">
            <h2>Важные покупки</h2>
            <ul className="mains-row">
              <AnimatePresence>
                {main.map((b, i) => (
                  <BuyCard key={b.id} buy={b} index={i} morph={`main-${b.id}`} openMorph={opened?.morph} onOpen={setOpened} />
                ))}
              </AnimatePresence>
              {Array.from({ length: MAIN_COUNT - main.length }, (_, i) => (
                <li key={i} className="buy-cell">
                  <motion.button layoutId={`free-${i}`} type="button" className="buy-free" style={{ borderRadius: 24, visibility: opened?.morph === `free-${i}` ? 'hidden' : undefined }} aria-label="Добавить покупку" onClick={() => addNew(`free-${i}`)} whileTap={{ scale: 0.95 }}>
                    <Icon name="plus" size={20} stroke={1.8} />
                  </motion.button>
                </li>
              ))}
            </ul>
          </Recede>

          <h2 className="buys-title">Покупки</h2>
          <AddPlus hidden={opened?.morph === PLUS} onAdd={() => addNew(PLUS)} />
          <ul className="buy-list">
            <AnimatePresence initial={false}>
              {rest.map((b) => (
                <BuyRow key={b.id} buy={b} morph={`row-${b.id}`} openMorph={opened?.morph} onOpen={setOpened} />
              ))}
            </AnimatePresence>
          </ul>

          <button type="button" className="buys-how" onClick={() => openSheet('shopShare')}>
            Добавлять из магазинов через «Поделиться»
          </button>
          </motion.div>
          <button type="button" className="buys-hint" onClick={toDream}>
            <span>
              <Icon name="down" size={14} stroke={2.2} />
            </span>
            К мечте
          </button>
        </motion.section>

        <div ref={dream} className="dreamx-place">
          <Dream contentOpacity={dreamOpacity} />
        </div>
      </motion.div>
      {createPortal(<AnimatePresence>{open && opened && <BuyWindow key={open.id} buy={open} morph={opened.morph} isNew={opened.isNew} onClose={close} />}</AnimatePresence>, document.body)}
    </>
  );
}

/** A plus with a light running round it and rings going out from it. */
function AddPlus({ hidden, onAdd }: { hidden: boolean; onAdd: () => void }) {
  // Watched on the block around it: a straight line has no area for the browser to see come into view.
  const place = useRef<HTMLDivElement>(null);
  const seen = useInView(place, { once: true });
  const stroke = (delay: number) => ({
    initial: { pathLength: 0 },
    animate: { pathLength: seen ? 1 : 0 },
    transition: { delay, duration: 0.7, ease: EASE },
  });
  return (
    <div ref={place} className="add-plus-place">
      <motion.button layoutId={PLUS} type="button" className="add-plus" style={{ borderRadius: 40, visibility: hidden ? 'hidden' : undefined }} aria-label="Добавить покупку" onClick={onAdd} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.88 }}>
        <span className="add-plus-wave" />
        <span className="add-plus-wave add-plus-wave--late" />
        <span className="add-plus-core">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <motion.path d="M12 4.5v15" {...stroke(0.1)} />
            <motion.path d="M4.5 12h15" {...stroke(0.3)} />
          </svg>
        </span>
      </motion.button>
    </div>
  );
}

interface CardProps {
  buy: Buy;
  index: number;
  inView?: boolean;
  morph: string;
  openMorph?: string;
  onOpen: (o: Opened) => void;
}

/** The shop's own photo fills the card; at the bottom it goes out of focus, and the words stand on that. */
function BuyCard({ buy, index, inView = false, morph, openMorph, onOpen }: CardProps) {
  const url = useImage(buy.imgId);
  const importing = useImporting(buy.id);
  const { cur, rate } = useCurrency();
  const show = { opacity: 1, y: 0, scale: 1 };
  const icon = catIcon(buy.category ?? '');

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 26, scale: 0.94 }}
      {...(inView ? { whileInView: show, viewport: { once: true, amount: 0.2 } } : { animate: show })}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      transition={{ delay: inView ? 0.04 : 0.2 + index * 0.06, duration: 0.7, ease: EASE }}
      className="buy-cell"
    >
      <Swipe compact radius={24} buysAtOnce={buysAtOnce(buy)} onBuy={() => buyNow(buy)} onDelete={() => deleteBuyUndoable(buy)}>
      <motion.button layoutId={morph} type="button" className={`buy-card${importing ? ' is-loading' : ''}`} style={{ borderRadius: 24, visibility: openMorph === morph ? 'hidden' : undefined }} onClick={() => onOpen({ id: buy.id, morph })} whileTap={{ scale: 0.97 }}>
        {url ? <img className={`buy-photo${buy.cut ? ' is-cut' : ''}`} src={url} alt="" loading="lazy" /> : <span className="buy-card-empty"><Icon name={icon === 'flag' ? 'bag' : icon} size={36} stroke={1.2} /></span>}
        <span className="buy-card-fog" />
        <span className="buy-card-words">
          {buy.price > 0 && <strong>{formatMoney(buy.price, cur, rate)}</strong>}
          <span className="buy-card-note">{buy.note || buy.title || 'Без названия'}</span>
          {buy.category && <span className="buy-card-cat">{buy.category}</span>}
        </span>
      </motion.button>
      </Swipe>
    </motion.li>
  );
}

/** The smaller purchases: one line each, and it grows into the same window. */
function BuyRow({ buy, morph, openMorph, onOpen }: Omit<CardProps, 'index' | 'inView'>) {
  const url = useImage(buy.imgId);
  const importing = useImporting(buy.id);
  const { cur, rate } = useCurrency();
  const icon = catIcon(buy.category ?? '');

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      // It has already slid away; the place it leaves closes up.
      exit={{ height: 0, paddingBottom: 0, opacity: 0, transition: { duration: 0.26, ease: EASE } }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Swipe radius={20} buysAtOnce={buysAtOnce(buy)} onBuy={() => buyNow(buy)} onDelete={() => deleteBuyUndoable(buy)}>
      <motion.button layoutId={morph} type="button" className={`glass buy-row${importing ? ' is-loading' : ''}`} style={{ borderRadius: 20, visibility: openMorph === morph ? 'hidden' : undefined }} onClick={() => onOpen({ id: buy.id, morph })} whileTap={{ scale: 0.98 }}>
        <span className="buy-row-pic">{url ? <img className={`buy-photo${buy.cut ? ' is-cut' : ''}`} src={url} alt="" loading="lazy" /> : <Icon name={icon === 'flag' ? 'bag' : icon} size={22} stroke={1.5} />}</span>
        <span className="buy-row-words">
          <strong>{buy.title || 'Без названия'}</strong>
          {buy.category && <span>{buy.category}</span>}
        </span>
        {buy.price > 0 && <span className="buy-row-price">{formatMoney(buy.price, cur, rate)}</span>}
      </motion.button>
      </Swipe>
    </motion.li>
  );
}
