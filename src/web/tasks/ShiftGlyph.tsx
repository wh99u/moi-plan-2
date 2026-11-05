import type { Shift } from '../../lib/types';

/** Solid and heavy, so it reads at the size of a calendar cell: a sun for a day shift, a moon for a night one. */
export function ShiftGlyph({ type, size = 14 }: { type: Shift['type']; size?: number }) {
  return type === 'n' ? (
    <svg className="glyph-moon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M21.5 14.6A9.800 9.800 0 1 1 9.400 2.500a8 8 0 0 0 12.100 12.100z" fill="currentColor" />
    </svg>
  ) : (
    <svg className="glyph-sun" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="5.600" fill="currentColor" />
      <path d="M12 1.800v2.400M12 19.800v2.400M1.800 12h2.400M19.800 12h2.400M4.800 4.800l1.700 1.700M17.500 17.500l1.700 1.700M4.800 19.200l1.700-1.700M17.500 6.500l1.700-1.700" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
