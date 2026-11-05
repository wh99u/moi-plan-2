import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Amt } from '../../app/money/Amt';
import { setNotice, useNotice } from '../../app/money/auto';
import { formatMoney, loadRate, setCurrency, useCurrency, type Cur } from '../../app/money/currency';
import { WaveChart, type ChartPalette } from '../../app/money/WaveChart';
import { openSheet } from '../../app/sheet';
import { EASE, MorphText } from '../../app/ui/text';
import { actions, appStore, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Spend } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Recede } from '../Recede';
import { plural } from '../reminders';
import { Seg } from '../Seg';
import { byDay, cardLabel, cardViews, dayTitle, incomeSeries, incomeTitle, incomeTotals, missingCards, type CardView, type Span } from './data';
import { Logo } from './Logo';
import { SpendWindow } from './SpendWindow';

/** The panel is dark blue in both themes, so the chart keeps one set of colours. */
const PALETTE: ChartPalette = {
  fill: ['rgba(120, 190, 255, 0)', 'rgba(130, 195, 255, 0.2)', 'rgba(190, 225, 255, 0.5)'],
  stroke: ['rgba(190, 225, 255, 0.6)', '#cfe6ff', '#ffffff'],
  halo: 'rgba(190, 225, 255, 0.26)',
  headGlow: 'rgba(220, 238, 255, 0.55)',
  head: '#fff',
  pick: 'rgba(255, 255, 255, 0.6)',
  light: 'rgba(190, 228, 255, 0.34)',
};

/** How many purchases appear at first, and how many more each tap brings. */
const PAGE = 40;

export function Budget() {
  const [opened, setOpened] = useState<string | null>(null);
  const spends = visible(useStore((s) => s.shared.spends));

  // All six cards exist from the first visit, so an operation always has somewhere to go.
  // The list is read at this very moment: an effect can run twice, and a card must not appear twice.
  useEffect(() => {
    missingCards(visible(appStore.get().shared.banks)).forEach((code) => actions.addBank(code, 0));
  }, []);

  useEffect(() => {
    void loadRate();
  }, []);

  const open = spends.find((s) => s.id === opened);

  return (
    <>
      <motion.div className="budget" layoutScroll>
        <div className="b-col">
          <TopPanel />
          <Tiles />
          <Purchases spends={spends} openedId={opened} onOpen={setOpened} />
        </div>
      </motion.div>
      <BankNotice />
      {createPortal(
        <AnimatePresence>{open && <SpendWindow key={open.id} spend={open} onClose={() => setOpened(null)} />}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function TopPanel() {
  const { cur, rate } = useCurrency();
  const banks = visible(useStore((s) => s.shared.banks));
  const incomes = visible(useStore((s) => s.shared.incomes));
  const [span, setSpan] = useState<Span>('days');
  const [cardsOpen, setCardsOpen] = useState(false);
  const [noRate, setNoRate] = useState(false);
  const [smear, setSmear] = useState(false);

  const cards = cardViews(banks);
  const total = banks.reduce((t, b) => t + b.sum, 0);
  const now = useMemo(() => new Date(), []);
  const points = useMemo(() => incomeSeries(incomes, span, now), [incomes, span, now]);
  const { sum, change } = useMemo(() => incomeTotals(incomes, span, now), [incomes, span, now]);

  const switchCurrency = async (next: Cur) => {
    setNoRate(false);
    if (next === 'USD' && !(await loadRate())) {
      setNoRate(true);
      return;
    }
    setSmear(true);
    setTimeout(() => setSmear(false), 520);
    setCurrency(next);
  };

  return (
    <Recede from={3.4} panel className={`b-top${smear ? ' is-smearing' : ''}`}>
      <div className="b-cur">
        <Seg
          value={cur}
          onChange={switchCurrency}
          options={[
            { id: 'RUB', label: '₽' },
            { id: 'USD', label: '$' },
          ]}
          label="Валюта"
        />
      </div>
      <button type="button" className="b-total" aria-haspopup="dialog" aria-expanded={cardsOpen} onClick={() => setCardsOpen(true)}>
        <span className="b-label">
          Общий бюджет
          <span className="b-chev">
            <Icon name="chevron" size={15} stroke={2.2} />
          </span>
        </span>
        <span className="b-sum">
          <Amt rub={total} delay={0.25} />
        </span>
      </button>
      {/* One line in height: without it the whole panel would jump when the note comes and goes. */}
      <p className="b-note" aria-live="polite">
        {noRate ? 'Курс не загрузился. Проверь интернет и попробуй снова' : cur === 'USD' && rate ? `1 $ = ${rate.value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ по курсу ЦБ` : ' '}
      </p>

      {createPortal(<AnimatePresence>{cardsOpen && <CardsWindow total={total} cards={cards} onClose={() => setCardsOpen(false)} />}</AnimatePresence>, document.body)}

      <div className="b-income">
        <p className="b-label">
          <MorphText text={incomeTitle(span, now)} delay={0.1} />
        </p>
        <div className="b-income-row">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={span}
              className="b-income-sum"
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              {formatMoney(sum, cur, rate)}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            {change !== null && (
              <motion.span
                key={`${span}${change}`}
                className={`b-change${change < 0 ? ' is-down' : ''}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <span style={{ display: 'grid', rotate: change < 0 ? '90deg' : '-90deg' }}>
                  <Icon name="arrowRight" size={13} stroke={2.4} />
                </span>
                {Math.abs(change)}%
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <WaveChart points={points} palette={PALETTE} delay={0.35} format={(v) => formatMoney(v, cur, rate)} />
      {!sum && <p className="b-chart-empty">Доходов за это время нет</p>}

      <div className="b-span">
        <Seg
          value={span}
          onChange={setSpan}
          options={[
            { id: 'days', label: 'По дням' },
            { id: 'months', label: 'По месяцам' },
          ]}
          label="Период"
        />
      </div>
    </Recede>
  );
}

/** Every bank and what is on it, in a clear window of its own over the page. */
function CardsWindow({ total, cards, onClose }: { total: number; cards: CardView[]; onClose: () => void }) {
  const { cur, rate } = useCurrency();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div className="sheet-scrim p-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose} />
      <div className="p-win-place">
        <motion.div
          className="cards-win"
          role="dialog"
          aria-modal="true"
          aria-label="Карты"
          initial={{ opacity: 0, scale: 0.82, y: -40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.2, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <header className="cards-head">
            <div>
              <h2>Карты</h2>
              <p>{formatMoney(total, cur, rate)}</p>
            </div>
            <motion.button type="button" className="round-btn" aria-label="Закрыть" onClick={onClose} whileTap={{ scale: 0.86 }}>
              <Icon name="close" size={18} />
            </motion.button>
          </header>
          <ul>
            {cards.map((c, i) => (
              <motion.li key={c.code} initial={{ opacity: 0, x: -16, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ delay: 0.08 + i * 0.05, duration: 0.55, ease: EASE }}>
                <button
                  type="button"
                  className="cards-row"
                  disabled={!c.id}
                  onClick={() => {
                    onClose();
                    openSheet('balance', { id: c.id });
                  }}
                >
                  <Logo title={c.label} domain={c.domain} size={44} />
                  <span className="cards-name">{c.label}</span>
                  <span className="cards-sum">{formatMoney(c.sum, cur, rate)}</span>
                  <span className="p-chev">
                    <Icon name="chevron" size={16} stroke={2} />
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </>
  );
}

function Tiles() {
  const tiles = [
    { label: 'Покупка', icon: 'plus', tx: 'out', wide: true },
    { label: 'Доход', icon: 'trend', tx: 'in', wide: false },
  ] as const;
  return (
    <div className="b-tiles">
      {tiles.map((t, i) => (
        <Recede key={t.label} from={2.6} delay={0.04 + i * 0.04} panel className={`b-tile-wrap${t.wide ? ' is-wide' : ''}`}>
          <motion.button type="button" className="b-tile glass" onClick={() => openSheet('tx', { tx: t.tx })} whileHover={{ y: -3 }} whileTap={{ scale: 0.93 }}>
            <span className="b-tile-icon">
              <Icon name={t.icon} size={21} stroke={2} />
            </span>
            {t.label}
          </motion.button>
        </Recede>
      ))}
    </div>
  );
}

function Purchases({ spends, openedId, onOpen }: { spends: Spend[]; openedId: string | null; onOpen: (id: string) => void }) {
  const [shown, setShown] = useState(PAGE);
  const banks = visible(useStore((s) => s.shared.banks));
  const now = useMemo(() => new Date(), []);
  const groups = useMemo(() => byDay(spends), [spends]);

  // Whole days until the limit is reached, so a day is never cut in half.
  let left = shown;
  const part = groups.filter((g) => {
    if (left <= 0) return false;
    left -= g.list.length;
    return true;
  });
  let row = 0;

  return (
    <Recede from={2} delay={0.1} panel className="b-list">
      <h2>Покупки</h2>
      {!spends.length && <p className="b-empty">Здесь появятся ваши покупки</p>}
      {part.map((g) => (
        <section key={g.day}>
          <h3>{dayTitle(g.day, now)}</h3>
          <ul>
            {g.list.map((s) => (
              <SpendRow key={s.id} spend={s} card={cardLabel(banks, s.bankId)} index={row++} hidden={s.id === openedId} onOpen={() => onOpen(s.id)} />
            ))}
          </ul>
        </section>
      ))}
      {spends.length > shown && (
        <button type="button" className="b-more" onClick={() => setShown(shown + PAGE)}>
          Показать ещё
        </button>
      )}
    </Recede>
  );
}

function SpendRow({ spend, card, index, hidden, onOpen }: { spend: Spend; card?: string; index: number; hidden: boolean; onOpen: () => void }) {
  const { cur, rate } = useCurrency();
  const title = spend.title || 'Покупка';
  const count = spend.items?.length ?? 0;
  const details = [spend.cat, count ? `${count} ${plural(count, ['позиция', 'позиции', 'позиций'])}` : null, card].filter(Boolean).join(', ');

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.035 + 0.28, duration: 0.6, ease: EASE }}
    >
      <motion.button layoutId={`spend-${spend.id}`} type="button" className="p-row" style={{ borderRadius: 22, visibility: hidden ? 'hidden' : undefined }} onClick={onOpen} whileTap={{ scale: 0.98 }}>
        <motion.span layoutId={`spend-logo-${spend.id}`} className="p-logo">
          <Logo title={title} />
        </motion.span>
        <span className="p-text">
          <strong>{title}</strong>
          {details && <span>{details}</span>}
        </span>
        <span className="p-sum">−{formatMoney(spend.amount, cur, rate)}</span>
        {/* The place is kept on every row, so the sums stay in one column. */}
        <span className="p-chev" style={count > 0 ? undefined : { visibility: 'hidden' }}>
          <Icon name="chevron" size={16} stroke={2} />
        </span>
      </motion.button>
    </motion.li>
  );
}

/** What came from a bank's message: the amount, and a way to take it back. */
function BankNotice() {
  const notice = useNotice();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  return (
    <AnimatePresence>
      {notice && (
        <motion.div className="glass b-notice" role="status" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
          <span>{notice.text}</span>
          {notice.undo && (
            <button
              type="button"
              onClick={() => {
                notice.undo?.();
                setNotice(null);
              }}
            >
              Отменить
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
