import { useReducedMotion } from 'motion/react';
import { closeSheet, toggleSheet, useSheet } from '../app/sheet';
import { NavGlyph } from './NavGlyphs';
import { TABS, href, tabIndex, type Route } from './route';
import './navigation.css';

export function Nav({ route }: { route: Route }) {
  const moreOpen = useSheet() === 'more';
  const more = TABS.length;
  const active = moreOpen ? more : tabIndex(route);
  const calm = useReducedMotion();
  return (
    <nav className="dock" aria-label="Разделы">
      <div className="dock-track">
        <span aria-hidden="true" className="dock-selection" style={{ transform: `translateX(${active * 100}%)` }} />
        {TABS.map((tab, index) => (
          <a key={tab.id} href={href(tab.id)} onClick={closeSheet} aria-label={tab.label} aria-current={active === index ? 'page' : undefined}>
            <NavGlyph index={index} run={active === index && !calm} size={23} />
          </a>
        ))}
        <button type="button" aria-label={moreOpen ? 'Закрыть' : 'Ещё разделы'} aria-expanded={moreOpen} data-active={active === more} onClick={() => toggleSheet('more')}>
          <NavGlyph index={more} run={active === more && !calm} size={23} />
        </button>
      </div>
    </nav>
  );
}
