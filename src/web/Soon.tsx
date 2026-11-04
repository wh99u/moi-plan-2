import { motion } from 'motion/react';
import { EASE } from '../app/ui/text';
import { Icon } from '../ui/Icon';
import { Recede } from './Recede';
import { section, type Route } from './route';

const part = (delay: number) => ({
  initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay, duration: 0.8, ease: EASE },
});

/** A section that has not been rebuilt yet. */
export function Soon({ route }: { route: Route }) {
  const s = section(route);
  return (
    <div className="soon">
      <Recede from={2.2} panel className="glass soon-card">
        <motion.span className="soon-icon" {...part(0.08)}>
          <Icon name={s.icon} size={26} />
        </motion.span>
        <motion.h1 {...part(0.14)}>{s.label}</motion.h1>
        <motion.p {...part(0.2)}>{s.hint}</motion.p>
        <motion.span className="soon-pill" {...part(0.26)}>
          Скоро
        </motion.span>
      </Recede>
    </div>
  );
}
