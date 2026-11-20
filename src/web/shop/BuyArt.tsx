import type { Buy } from '../../lib/types';
import { useImage } from './Dream';
import { catalogImage, usePictureStatus } from './productPictures';

export function BuyArt({ buy }: { buy: Buy }) {
  const photo = useImage(!buy.autoPic || buy.autoPic === buy.title.trim() ? buy.imgId : undefined);
  const source = photo || catalogImage(buy.title);
  const status = usePictureStatus(buy.id);
  return (
    <span className="purchase-art" aria-hidden="true">
      {source ? <img src={source} alt="" draggable={false} /> : status === 'pending' ? <span className="art-pending">Готовим изображение…</span> : null}
    </span>
  );
}
