'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
};

export function Modal({ open, title, children, onClose, maxWidthClassName }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="min-h-full flex items-center justify-center px-4 py-6">
        <div
          className={`relative w-full ${maxWidthClassName ?? 'max-w-lg'} bg-white border border-brand-dark/10 rounded-2xl shadow-xl overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col`}
        >
          <div className="px-6 py-4 border-b border-brand-dark/10 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="font-heading font-bold uppercase tracking-wider text-brand-darker">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full border border-brand-dark/10 bg-white text-brand-darker hover:bg-brand-orange/5 hover:border-brand-orange/30 transition-colors flex items-center justify-center text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
