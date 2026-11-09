import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { takeBankLink } from '../app/money/auto';
import { useProfile } from '../app/profile';
import { closeSheet, openSheet } from '../app/sheet';
import { toggleTheme, useTheme } from '../app/theme';
import { EASE } from '../app/ui/text';
import { actions, appStore, isDemo } from '../lib/appStore';
import { visible } from '../lib/records';
import { Icon } from '../ui/Icon';
import { missingCards } from './money/data';
import { Home } from './Home';
import { Mark } from './Mark';
import { Budget } from './money/Budget';
import { Nav } from './Nav';
import { Notice } from './Notice';
import { Recede, startEntry } from './Recede';
import { useRoute, type Route } from './route';
import { Shop } from './shop/Shop';
import { FocusWindow } from './tasks/Focus';
import { Tasks } from './tasks/Tasks';
import { Sheets } from './Sheets';
import { sync } from './sync/site';
import { Soon } from './Soon';
import { Wave } from './Wave';

/** The loading screen stays at least this long, counted from the start of the page: long enough for the cap to fill. */
const SPLASH_MS = 2600;

export function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);

  // The site mounts the moment the loading screen starts to go, so the opening shot plays out from behind it.
  useEffect(() => {
    const splash = document.getElementById('splash');
    if (!splash) {
      startEntry();
      setReady(true);
      return;
    }
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(
      () => {
        startEntry();
        splash.classList.add('is-leaving');
        setReady(true);
        setTimeout(() => splash.remove(), 800);
      },
      Math.max(0, (calm ? 600 : SPLASH_MS) - performance.now()),
    );
    return () => clearTimeout(t);
  }, []);

  useEffect(() => closeSheet(), [route]);

  useEffect(() => (isDemo ? undefined : sync.start()), []);

  // All six cards exist from the first visit, and a shift whose day has come reaches the budget, wherever the site was opened.
  useEffect(() => {
    const settle = () => {
      if (document.hidden) return;
      missingCards(visible(appStore.get().shared.banks)).forEach((code) => actions.addBank(code, 0));
      actions.settleShifts();
    };
    settle();
    document.addEventListener('visibilitychange', settle);
    return () => document.removeEventListener('visibilitychange', settle);
  }, []);

  // A bank's message can arrive through a link; it must not get lost while the budget is being rebuilt.
  useEffect(() => {
    takeBankLink();
    addEventListener('hashchange', takeBankLink);
    return () => removeEventListener('hashchange', takeBankLink);
  }, []);

  if (!ready) return null;

  return (
    <MotionConfig reducedMotion="user">
      <Wave route={route} />
      <AnimatePresence mode="wait">
        <main key={route} className="page">
          {route === 'home' ? <Home /> : route === 'money' ? <Budget /> : route === 'shop' ? <Shop /> : route === 'tasks' ? <Tasks /> : <Soon route={route} />}
        </main>
      </AnimatePresence>
      <TopBar route={route} />
      <Nav route={route} />
      <Notice />
      <Sheets />
      <FocusWindow />
    </MotionConfig>
  );
}

function TopBar({ route }: { route: Route }) {
  const { theme } = useTheme();
  const { name, picture } = useProfile();
  const dark = theme === 'dark';
  return (
    <div className="topbar">
      {/* These sections scroll under this bar, and plain text over a list would be unreadable. */}
      <Recede from={3.6} delay={0.04} className={`brand${route === 'money' || route === 'shop' || route === 'tasks' ? ' is-away' : ''}`}>
        {/* Back on the home screen the corners greet it too. */}
        <motion.div key={route === 'home' ? 'home' : 'away'} className="top-in" initial={route === 'home' ? { opacity: 0, x: -18 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: EASE }}>
          <Mark size={28} />
          <span>Мой план</span>
        </motion.div>
      </Recede>
      <Recede from={3.6} delay={0.06} solid className="top-actions">
        <motion.div key={route === 'home' ? 'home' : 'away'} className="top-in" initial={route === 'home' ? { opacity: 0, y: -14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.6, ease: EASE }}>
        <motion.button
          type="button"
          className="theme-pill"
          aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
          onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.92 }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={theme}
              className="theme-pill-in"
              initial={{ y: 16, opacity: 0, rotate: -50 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -16, opacity: 0, rotate: 50 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            >
              <Icon name={dark ? 'moon' : 'sun'} size={16} />
              <span>{dark ? 'Тёмная' : 'Светлая'}</span>
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <motion.button type="button" className="round-btn avatar" aria-label="Профиль" onClick={() => openSheet('profile')} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}>
          {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : name ? <span>{name[0].toUpperCase()}</span> : <Icon name="user" size={18} />}
        </motion.button>
        </motion.div>
      </Recede>
    </div>
  );
}
