'use client';

import { useEffect, useMemo, useState } from 'react';

function randDigit() {
  const n = Math.floor(Math.random() * 10);
  return Math.max(0, Math.min(9, n));
}

export function MathCaptcha({
  onValidChange,
  disabled,
}: {
  onValidChange: (valid: boolean) => void;
  disabled?: boolean;
}) {
  const [a, setA] = useState(() => randDigit());
  const [b, setB] = useState(() => randDigit());
  const [value, setValue] = useState('');

  const expected = useMemo(() => a + b, [a, b]);
  const valid = useMemo(() => value.trim() !== '' && Number(value) === expected, [value, expected]);

  useEffect(() => {
    onValidChange(valid);
  }, [onValidChange, valid]);

  const reset = () => {
    setA(randDigit());
    setB(randDigit());
    setValue('');
  };

  const pushDigit = (d: number) => {
    if (disabled) return;
    const next = `${value}${d}`;
    if (next.length > 2) return;
    setValue(next);
  };

  const clear = () => {
    if (disabled) return;
    setValue('');
  };

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-brand-darker">{a} + {b} = ?</div>
        <button type="button" onClick={reset} className="px-3 py-1.5 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg">
          Refresh
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
          inputMode="numeric"
          className={`w-full bg-white border rounded-xl py-2 px-3 text-sm text-brand-darker outline-none ${
            value.trim() === '' ? 'border-brand-dark/10' : valid ? 'border-emerald-600/40' : 'border-red-600/30'
          }`}
          placeholder="Answer"
        />
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pushDigit(d)}
              className="h-9 rounded-xl border border-brand-dark/10 bg-white text-sm font-black text-brand-darker hover:bg-brand-bg"
            >
              {d}
            </button>
          ))}
          <button type="button" onClick={clear} className="col-span-2 h-9 rounded-xl border border-brand-dark/10 bg-white text-xs font-bold uppercase tracking-widest text-brand-darker hover:bg-brand-bg">
            Clear
          </button>
        </div>
      </div>

      {value.trim() !== '' && !valid ? <div className="mt-2 text-xs font-bold text-red-600">Wrong answer</div> : null}
      {valid ? <div className="mt-2 text-xs font-bold text-emerald-600">OK</div> : null}
    </div>
  );
}

