import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { closeSheet, openSheet, toggleSheet, useSheet } from '../app/sheet';
import { Icon } from '../ui/Icon';
import { NavGlyph } from './NavGlyphs';
import { FULL_H, barPath, navFrame } from './navShape';
import { Recede } from './Recede';
import { TABS, href, type Route } from './route';
import './navigation.css';

const GLYPH = { home: 0, money: 1, tasks: 3 } as const;
const PLUS = { shop: 'shopAdd', tasks: 'newTask' } as const;

export function Nav({ route }: { route: Route }) {
  const sheet = useSheet();
  const calm = useReducedMotion();
  const moreOpen = sheet === 'more';
  const moreActive = moreOpen || !TABS.some(tab => tab.id === route);
  const root = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = root.current!;
    const read = () => setWidth(el.clientWidth);
    const observer = new ResizeObserver(read);
    observer.observe(el);
    read();
    return () => observer.disconnect();
  }, []);

  const outline = width ? barPath(width, navFrame(1, null, width / 2)) : '';
  const add = route === 'shop' || route === 'tasks' ? PLUS[route] : 'tx';
  const tab = (id: keyof typeof GLYPH, label: string) => {
    const active = !moreOpen && id === route;
    return (
      <a href={href(id)} className="dock-tab" onClick={closeSheet} aria-current={active ? 'page' : undefined}>
        <NavGlyph index={GLYPH[id]} run={active && !calm} size={21} />
        <span>{label}</span>
      </a>
    );
  };

  return (
    <Recede from={2.2} delay={0.05} solid className="lnav-wrap">
      <nav ref={root} className="site-dock" aria-label="Разделы">
        <div aria-hidden="true" className="dock-fill" style={{ clipPath: outline ? `path("${outline}")` : undefined }} />
        {outline && <svg className="dock-edge" viewBox={`0 0 ${width} ${FULL_H}`} aria-hidden="true"><path d={outline} fill="none" stroke="var(--nav-rim)" /></svg>}
        <div className="dock-tabs">
          {tab('home', 'Главная')}
          {tab('money', 'Бюджет')}
          <motion.button className="dock-plus" type="button" aria-label={route === 'shop' ? 'Добавить покупку' : route === 'tasks' ? 'Добавить запись' : 'Добавить операцию'}
            whileTap={{ scale: 0.9, rotate: 12 }} onClick={() => openSheet(add)}><Icon name="plus" size={25} /></motion.button>
          {tab('tasks', 'Задачи')}
          <button type="button" className="dock-tab" aria-expanded={moreOpen} aria-pressed={moreActive} onClick={() => toggleSheet('more')}>
            <NavGlyph index={4} run={moreActive && !calm} size={21} />
            <span>Прочее</span>
          </button>
        </div>
      </nav>
    </Recede>
  );
}
