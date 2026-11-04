import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect } from 'react';
import { CapMark } from '../app/brand/CapMark';
import { takeBankLink } from '../app/money/auto';
import { useProfile } from '../app/profile';
import { closeSheet, openSheet } from '../app/sheet';
import { toggleTheme, useTheme } from '../app/theme';
import { Icon } from '../ui/Icon';
import { Home } from './Home';
import { Nav } from './Nav';
import { Recede } from './Recede';
import { useRoute } from './route';
import { Sheets } from './Sheets';
import { Soon } from './Soon';
import { Wave } from './Wave';

export function App() {
  const route = useRoute();

  useEffect(() => closeSheet(), [route]);

  // A bank's message can arrive through a link; it must not get lost while the budget is being rebuilt.
  useEffect(() => {
    takeBankLink();
    addEventListener('hashchange', takeBankLink);
    return () => removeEventListener('hashchange', takeBankLink);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Wave route={route} />
      <AnimatePresence mode="wait">
        <main key={route} className="page">
          {route === 'home' ? <Home /> : <Soon route={route} />}
        </main>
      </AnimatePresence>
      <TopBar />
      <Nav route={route} />
      <Sheets />
    </MotionConfig>
  );
}

function TopBar() {
  const { theme } = useTheme();
  const { name, picture } = useProfile();
  const dark = theme === 'dark';
  return (
    <div className="topbar">
      <Recede from={2} delay={0.12} className="brand">
        <CapMark size={34} mono />
        <span>Мой план</span>
      </Recede>
      <Recede from={2} delay={0.16} solid className="top-actions">
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
      </Recede>
    </div>
  );
}
