import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { blur } from '../app/ui/device';
import { EASE } from '../app/ui/text';
import { Icon } from '../ui/Icon';

/*
 * A small screen of its own over the page, which goes out of focus behind it: a title, a cross,
 * rows of «what — which» divided by dashes, and one button at the end. Plain on purpose; every
 * little window of the site is to come to this look.
 */

interface Props {
  open: boolean;
  title: ReactNode;
  /** A line under the title. */
  note?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** The one button at the bottom. */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  /** A key that, when it changes, lets the content come in again: another day in the same window. */
  stage?: string;
}

export function Plate({ open, ...rest }: Props) {
  return createPortal(<AnimatePresence>{open && <Body key="plate" {...rest} />}</AnimatePresence>, document.body);
}

function Body({ title, note, onClose, children, action, stage }: Omit<Props, 'open'>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div className="plate-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.32 }} onClick={onClose} />
      <div className="plate-place" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <motion.section
          className="plate"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.9, y: 26, ...blur(10) }}
          animate={{ opacity: 1, scale: 1, y: 0, ...blur(0) }}
          exit={{ opacity: 0, scale: 0.94, y: 14, ...blur(6), transition: { duration: 0.2, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        >
          <header className="plate-head">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={stage ?? 'one'} className="plate-titles" initial={{ opacity: 0, y: 10, ...blur(6) }} animate={{ opacity: 1, y: 0, ...blur(0) }} exit={{ opacity: 0, y: -10, ...blur(6) }} transition={{ duration: 0.3, ease: EASE }}>
                <h2>{title}</h2>
                {note && <p>{note}</p>}
              </motion.div>
            </AnimatePresence>
            <motion.button type="button" className="plate-close" aria-label="Закрыть" onClick={onClose} whileTap={{ scale: 0.82, rotate: 90 }}>
              <Icon name="close" size={18} />
            </motion.button>
          </header>
          <div className="plate-body">{children}</div>
          {action && (
            <motion.button type="button" className="plate-go" disabled={action.disabled} onClick={action.onClick} initial={{ opacity: 0, y: 10 }} animate={{ opacity: action.disabled ? 0.45 : 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4, ease: EASE }} whileTap={{ scale: 0.94 }}>
              {action.label}
            </motion.button>
          )}
        </motion.section>
      </div>
    </>
  );
}

/** «Дата — 9 ноября»: the label on the left, the thing itself on the right; comes in a little after the one above. */
export function PlateRow({ label, children, index = 0, wide = false }: { label: string; children: ReactNode; index?: number; wide?: boolean }) {
  return (
    <motion.div className={`plate-row${wide ? ' is-wide' : ''}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + index * 0.04, duration: 0.42, ease: EASE }}>
      <span className="plate-label">{label}</span>
      <div className="plate-value">{children}</div>
    </motion.div>
  );
}
