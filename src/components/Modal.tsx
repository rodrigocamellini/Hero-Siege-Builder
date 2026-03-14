'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, children, onClose }: Props) {
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
      <div className="min-h-full flex items-start justify-center px-4 py-6">
        <div className="relative w-full max-w-lg bg-white border border-brand-dark/10 rounded-2xl shadow-xl overflow-hidden max-h-[calc(100vh-3rem)] flex flex-col">
          <div className="px-6 py-4 border-b border-brand-dark/10 shrink-0">
            <div className="font-heading font-bold uppercase tracking-wider text-brand-darker">{title}</div>
          </div>
          <div className="p-6 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
