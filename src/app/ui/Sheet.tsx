import type { ReactNode } from 'react';
import { Plate } from '../../web/Plate';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Was a sheet from the bottom; now every form opens in the one small window of the site, over a
 * blurred page, so nothing looks different from anything else.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  return (
    <Plate open={open} title={title} onClose={onClose}>
      <div className="plate-form">{children}</div>
    </Plate>
  );
}
