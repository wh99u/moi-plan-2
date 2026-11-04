import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Amt } from '../../app/money/Amt';
import { setNotice, useNotice } from '../../app/money/auto';
import { formatMoney, loadRate, setCurrency, useCurrency, type Cur } from '../../app/money/currency';
import { pickReceipt } from '../../app/money/scan';
import { WaveChart, type ChartPalette } from '../../app/money/WaveChart';
import { openSheet } from '../../app/sheet';
import { useTheme } from '../../app/theme';
import { Segmented } from '../../app/ui/Segmented';
import { EASE } from '../../app/ui/text';
import { actions, appStore, useStore } from '../../lib/appStore';
import { visible } from '../../lib/records';
import type { Spend } from '../../lib/types';
import { Icon } from '../../ui/Icon';
import { Recede } from '../Recede';
import { plural } from '../reminders';
import { byDay, cardLabel, cardViews, dayTitle, incomeSeries, incomeTotals, missingCards, type Span } from './data';
import { Logo } from './Logo';
import { SpendWindow } from './SpendWindow';

const PALETTE: Record<'dark' | 'light', ChartPalette> = {
  dark: {
    fill: ['rgba(60, 130, 230, 0)', 'rgba(70, 145, 240, 0.16)', 'rgba(130, 195, 255, 0.46)'],
    stroke: ['rgba(120, 185, 255, 0.5)', '#8cc8ff', '#ffffff'],
    halo: 'rgba(130, 195, 255, 0.24)',
    headGlow: 'rgba(190, 225, 255, 0.5)',
    head: '#fff',
    pick: 'rgba(255, 255, 255, 0.55)',
    soft: 'rgba(90, 165, 255, 0.2)',
  },
  light: {
    fill: ['rgba(20, 97, 244, 0)', 'rgba(20, 97, 244, 0.12)', 'rgba(26, 155, 255, 0.4)'],
    stroke: ['rgba(20, 97, 244, 0.45)', '#1461f4', '#0d9bf5'],
    halo: 'rgba(20, 110, 245, 0.2)',
    headGlow: 'rgba(20, 110, 245, 0.4)',
    head: '#0d4fe0',
    pick: 'rgba(10, 50, 140, 0.45)',
    soft: 'rgba(26, 130, 255, 0.18)',
  },
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
  const { theme } = useTheme();
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
    <Recede from={1.9} panel className={`glass b-top${smear ? ' is-smearing' : ''}`}>
      <div className="b-head">
        <button type="button" className="b-total" aria-expanded={cardsOpen} onClick={() => setCardsOpen(!cardsOpen)}>
          <span className="b-label">
            Общий бюджет
            <motion.span className="b-chev" animate={{ rotate: cardsOpen ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
              <Icon name="down" size={15} stroke={2.2} />
            </motion.span>
          </span>
          <span className="b-sum">
            <Amt rub={total} delay={0.25} />
          </span>
        </button>
        <div className="b-cur">
          <Segmented
            value={cur}
            onChange={switchCurrency}
            options={[
              { id: 'RUB', label: '₽' },
              { id: 'USD', label: '$' },
            ]}
            name="budget-cur"
          />
        </div>
      </div>
      {noRate && <p className="b-note">Курс не загрузился. Проверь интернет и попробуй снова</p>}
      {cur === 'USD' && rate && <p className="b-note">1 $ = {rate.value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ по курсу ЦБ</p>}

      <AnimatePresence initial={false}>
        {cardsOpen && (
          <motion.ul
            className="b-cards"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: 'spring', stiffness: 220, damping: 28 }, opacity: { duration: 0.25 } }}
          >
            {cards.map((c, i) => (
              <motion.li key={c.code} initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.05 + i * 0.045, duration: 0.55, ease: EASE }}>
                <button type="button" className="b-card" disabled={!c.id} onClick={() => openSheet('balance', { id: c.id })}>
                  <Logo title={c.label} domain={c.domain} size={36} />
                  <span className="b-card-name">{c.label}</span>
                  <span className="b-card-sum">{formatMoney(c.sum, cur, rate)}</span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="b-income">
        <div>
          <p className="b-label">Доход за {span === 'days' ? '30 дней' : '12 месяцев'}</p>
          <p className="b-income-sum">{formatMoney(sum, cur, rate)}</p>
        </div>
        {change !== null && (
          <span className={`b-change${change < 0 ? ' is-down' : ''}`}>
            <motion.span style={{ display: 'grid' }} animate={{ rotate: change < 0 ? 90 : -90 }}>
              <Icon name="arrowRight" size={13} stroke={2.4} />
            </motion.span>
            {Math.abs(change)}%
          </span>
        )}
      </div>

      <WaveChart points={points} palette={PALETTE[theme]} delay={0.35} format={(v) => formatMoney(v, cur, rate)} />
      {!sum && <p className="b-chart-empty">Доходов за это время нет. Добавь первый кнопкой ниже</p>}

      <div className="b-span">
        <Segmented
          value={span}
          onChange={setSpan}
          options={[
            { id: 'days', label: 'По дням' },
            { id: 'months', label: 'По месяцам' },
          ]}
          name="budget-span"
        />
      </div>
    </Recede>
  );
}

function Tiles() {
  const scan = () => {
    // The picker has to open right inside the tap, or the browser blocks it.
    void pickReceipt().then((file) => file && openSheet('tx', { tx: 'out', file }));
  };
  const tiles = [
    { label: 'Скан чека', icon: 'scan', go: scan, main: true },
    { label: 'Покупка', icon: 'plus', go: () => openSheet('tx', { tx: 'out' }), main: false },
    { label: 'Доход', icon: 'trend', go: () => openSheet('tx', { tx: 'in' }), main: false },
  ];
  return (
    <div className="b-tiles">
      {tiles.map((t, i) => (
        <Recede key={t.label} from={1.6} delay={0.06 + i * 0.05} panel className={`b-tile-wrap${t.main ? ' is-main' : ''}`}>
          <motion.button type="button" className={`b-tile${t.main ? ' is-main' : ' glass'}`} onClick={t.go} whileHover={{ y: -3 }} whileTap={{ scale: 0.93 }}>
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
    <Recede from={1.35} delay={0.14} panel className="glass b-list">
      <h2>Покупки</h2>
      {!spends.length && <p className="b-empty">Здесь появятся покупки. Отсканируй чек или добавь покупку вручную</p>}
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
  const details = [count ? `${count} ${plural(count, ['позиция', 'позиции', 'позиций'])}` : null, card].filter(Boolean).join(', ');

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
        {count > 0 && (
          <span className="p-chev">
            <Icon name="chevron" size={16} stroke={2} />
          </span>
        )}
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
