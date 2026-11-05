import type { CSSProperties } from 'react';

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}

/**
 * A choice of a few options with a highlight under the current one. The highlight is plain CSS
 * inside the control: it moves only when the choice does, and travels with the control when the
 * layout around it shifts, instead of catching up on its own.
 */
export function Seg<T extends string>({ value, onChange, options, label }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ '--n': options.length, '--i': index } as CSSProperties}>
      <span className="seg-pill" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="seg-opt" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
