import { motion } from 'motion/react';
import { Logo } from '../money/Logo';

/** Each shop's own colour, for the sides of its badge. */
const SHOPS: Record<string, { domain: string; edge: string }> = {
  Wildberries: { domain: 'wildberries.ru', edge: '#9a1fd8' },
  Ozon: { domain: 'ozon.ru', edge: '#0a4fd6' },
  Авито: { domain: 'avito.ru', edge: '#0f9ad6' },
};

const LAYERS = 9;

/**
 * The shop's icon as a thick little block standing at an angle: stacked copies of its shape give it
 * real sides, so it can turn in 3D with no model file and nothing to load.
 */
export function Badge3D({ shop, size = 84 }: { shop?: string; size?: number }) {
  if (!shop) return null;
  const known = SHOPS[shop];
  const edge = known?.edge ?? '#1f5fd6';
  return (
    <motion.div
      className="badge3d"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, y: 34, scale: 0.5, rotateY: -80 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
      transition={{ delay: 0.16, type: 'spring', stiffness: 170, damping: 15 }}
      aria-hidden="true"
    >
      <div className="badge3d-turn">
        {Array.from({ length: LAYERS }, (_, i) => (
          <span key={i} className="badge3d-side" style={{ background: edge, transform: `translateZ(${-i * 1.6}px)` }} />
        ))}
        <span className="badge3d-face">
          <Logo title={shop} domain={known?.domain} size={size} />
          <span className="badge3d-shine" />
        </span>
      </div>
    </motion.div>
  );
}
