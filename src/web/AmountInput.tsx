import { useLayoutEffect, useRef, type ComponentProps, type Ref } from 'react';
import { typedAmount } from './money/data';

const COUNTED = /[\d,]/;

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  /** The text as shown, «10.000». */
  value: string;
  onValue: (text: string) => void;
  inputRef?: Ref<HTMLInputElement>;
};

/** A sum, grouped by thousands as it is typed. The caret stays after the same digit when the dots move. */
export function AmountInput({ value, onValue, inputRef, ...rest }: Props) {
  const own = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = own.current;
    if (!el || caret.current === null) return;
    let i = 0;
    for (let seen = 0; i < el.value.length && seen < caret.current; i++) if (COUNTED.test(el.value[i])) seen++;
    el.setSelectionRange(i, i);
    caret.current = null;
  }, [value]);

  return (
    <input
      inputMode="decimal"
      {...rest}
      ref={(el) => {
        own.current = el;
        if (typeof inputRef === 'function') inputRef(el);
        else if (inputRef) inputRef.current = el;
      }}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const at = e.target.selectionStart ?? raw.length;
        const next = typedAmount(raw, value);
        // At the very end it stays at the end, whatever a typed dot became.
        caret.current = at >= raw.length ? next.length : [...raw.slice(0, at)].filter((c) => COUNTED.test(c)).length;
        onValue(next);
      }}
    />
  );
}
