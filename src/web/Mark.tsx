import { CAP } from './capPath';

/** The brand: the owner's cap, its silhouette as it was with the smoke drips rounded off. Same shape as public/favicon.svg. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="mark" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d={CAP} />
    </svg>
  );
}
