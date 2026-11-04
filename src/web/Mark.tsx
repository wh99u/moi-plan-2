/** The brand: a cap reduced to a half disc over a longer bar. Same shape as public/favicon.svg. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="mark" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M2.2 14a8.2 8.2 0 0 1 16.4 0z" />
      <rect x="2.2" y="15.7" width="19.6" height="2.6" rx="1.3" />
    </svg>
  );
}
