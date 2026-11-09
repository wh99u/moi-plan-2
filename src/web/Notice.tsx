import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { setNotice, useNotice } from '../app/money/auto';

/** A short line over the tab bar on any screen: what just happened, and a way to take it back. */
export function Notice() {
  const notice = useNotice();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  return (
    <AnimatePresence mode="popLayout">
      {notice && (
        <motion.div key={notice.text} className="glass b-notice" role="status" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
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
